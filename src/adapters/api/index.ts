import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Hono, type Context } from "hono";
import YAML from "yaml";
import type { ActionRegistry } from "@gaudi/core";
import type { TodoContext } from "../../ports/context.js";

const FEATURE = "personal.todolists";

function zodTypeName(schema: unknown): string | undefined {
  const s = schema as { _def?: { typeName?: string }; def?: { typeName?: string } } | undefined;
  return s?._def?.typeName ?? s?.def?.typeName;
}

function unwrap(schema: unknown): unknown {
  let current = schema;
  const WRAPPERS = new Set([
    "ZodDefault", "ZodOptional", "ZodNullable", "ZodEffects",
    "ZodPipeline", "ZodLazy", "ZodCoerce", "ZodUnion",
  ]);
  for (let i = 0; i < 8; i++) {
    const name = zodTypeName(current);
    if (!name || !WRAPPERS.has(name)) return current;
    const def = (current as { _def?: { innerType?: unknown; schema?: unknown; options?: unknown[] } })._def;
    const inner = def?.innerType ?? def?.schema ?? (def as { options?: unknown[] })?.options?.[0];
    if (!inner) return current;
    current = inner;
  }
  return current;
}

function coarseType(schema: unknown): string {
  const inner = unwrap(schema);
  const name = zodTypeName(inner);
  switch (name) {
    case "ZodArray": return "array";
    case "ZodObject": case "ZodRecord": return "object";
    case "ZodBoolean": return "boolean";
    case "ZodNumber": return "number";
    default: return "string";
  }
}

function describeAction(action: { id: string; description: string; inputSchema: unknown; meta?: { destructive?: boolean } }) {
  const shape = (action.inputSchema as { shape?: Record<string, unknown> }).shape ?? {};
  const input = Object.entries(shape).map(([key, schema]) => ({
    key,
    type: coarseType(schema),
    optional: (zodTypeName(schema) ?? "").startsWith("ZodOptional") || (zodTypeName(schema) ?? "").startsWith("ZodDefault"),
  }));
  return { id: action.id, description: action.description, input, destructive: action.meta?.destructive ?? false };
}

function loadUi(): Array<{ id: string; kind: string; dataSource: string }> {
  try {
    const file = fileURLToPath(new URL("../../../gaudi-feature.yaml", import.meta.url));
    const m = YAML.parse(readFileSync(file, "utf8")) as { ui?: Array<{ id: string; kind: string; dataSource: string }> };
    return m.ui ?? [];
  } catch {
    return [];
  }
}

/**
 * API del feature (Hono) — MODEL UNIFICAT API+UI (SPEC §8):
 * l'API viu sota /api/* i la UI embebida (ui/dist) es serveix a l'arrel amb
 * SPA fallback (server.ts). Tota la lògica passa pel registry (zero duplicació).
 */
export function createApp(registry: ActionRegistry, ctxFactory: () => TodoContext) {
  const app = new Hono();

  app.get("/health", async (c) => {
    // SPEC §18: serveix l'ACCIÓ del registry (mateixa font de veritat que el CLI)
    try {
      const ctx = ctxFactory();
      return c.json(await registry.run("todo.health", {}, ctx));
    } catch (err) {
      return c.json({ ok: false, components: [{ name: "health", ok: false, detail: (err as Error).message }] }, 500);
    }
  });

  const runAction = async (c: Context, id: string, input: Record<string, unknown>) => {
    try {
      const ctx = ctxFactory();
      if (input.dryRun === true) ctx.dryRun = true;
      delete input.dryRun;
      return c.json(await registry.run(id, input, ctx));
    } catch (err) {
      return c.json({ error: (err as Error).message, action: id }, 400);
    }
  };

  app.get("/api/health", (c) =>
    c.json({ ok: true, feature: FEATURE, actions: registry.list().map((a) => a.id) })
  );
  app.get("/api/registry", (c) => c.json({ actions: registry.list().map(describeAction) }));
  app.get("/api/views", (c) => c.json({ views: loadUi() }));

  // Endpoint genèric (paritat CLI/API): POST /api/actions/<actionId>
  app.post("/api/actions/:id", async (c) => {
    const id = c.req.param("id");
    if (!registry.get(id)) return c.json({ error: `Acción desconocida: ${id}` }, 404);
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return runAction(c, id, body ?? {});
  });

  // ── REST conveniència per a la UI (deleguen al registry) ────────────────
  app.get("/api/lists", async (c) => {
    const isMaster = c.req.query("isMaster");
    return runAction(c, "todo.list-list", isMaster === undefined ? {} : { isMaster: isMaster === "true" });
  });

  app.post("/api/lists", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "payload JSON requerit" }, 400);
    }
    return runAction(c, "todo.list-create", body);
  });

  app.get("/api/lists/:id", async (c) =>
    runAction(c, "todo.list-get", { id: c.req.param("id") })
  );

  app.patch("/api/lists/:id", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return runAction(c, "todo.list-update", { ...(body ?? {}), id: c.req.param("id") });
  });

  app.delete("/api/lists/:id", async (c) =>
    runAction(c, "todo.list-delete", { id: c.req.param("id") })
  );

  app.post("/api/lists/:id/master", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return runAction(c, "todo.list-set-master", { ...(body ?? {}), id: c.req.param("id") });
  });

  app.post("/api/lists/:id/shared", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return runAction(c, "todo.list-set-shared", { ...(body ?? {}), id: c.req.param("id") });
  });

  app.post("/api/lists/:id/instantiate", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return runAction(c, "todo.list-instantiate", { ...(body ?? {}), masterId: c.req.param("id") });
  });

  app.post("/api/lists/:id/items", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "payload JSON requerit amb { text }" }, 400);
    }
    return runAction(c, "todo.item-add", { ...(body ?? {}), listId: c.req.param("id") });
  });

  app.delete("/api/items/:itemId", async (c) =>
    runAction(c, "todo.item-remove", { itemId: c.req.param("itemId") })
  );

  const mark = (action: string) => async (c: Context) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return runAction(c, action, { ...(body ?? {}), listId: c.req.param("id") });
  };
  app.post("/api/lists/:id/check", mark("todo.item-check"));
  app.post("/api/lists/:id/uncheck", mark("todo.item-uncheck"));

  app.get("/api/search", async (c) => {
    const query = c.req.query("q");
    if (!query) return c.json({ error: "falta el paràmetre q" }, 400);
    return runAction(c, "todo.list-search", { query });
  });

  return app;
}

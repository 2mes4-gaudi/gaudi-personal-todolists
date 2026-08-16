import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildRegistry } from "./domain/actions/index.js";
import type { ServiceContext } from "@gaudi/core";

/**
 * Entry del feature — MODEL UNIFICAT: la mateixa app Hono serveix l'API
 * (/api/* + /health) i la UI estàtica (/) en UN sol origen / una sola imatge.
 * La plataforma ho publica sota <feature>/api i <feature>/ (path-stripping).
 */
const registry = buildRegistry();

const noopDb = {
  kind: "postgres" as const,
  name: "memory",
  listCollections: async () => [],
  get: async () => null,
  set: async () => {},
  delete: async () => {},
  list: async () => [],
  listValues: async () => [],
};

const ctxFactory = (): ServiceContext => ({
  credentials: { get: async () => undefined, has: async () => false },
  logger: console,
  dryRun: false,
  db: noopDb,
});

const app = new Hono();

app.get("/health", (c) =>
  c.json({ ok: true, feature: "personal.todolists", actions: registry.list().map((a) => a.id) })
);

const api = new Hono();
api.post("/actions/:id", async (c) => {
  const id = c.req.param("id");
  const action = registry.get(id);
  if (!action) return c.json({ error: `Acción desconocida: ${id}` }, 404);
  const body = await c.req.json().catch(() => ({}));
  try {
    return c.json(await registry.run(id, body, ctxFactory()));
  } catch (err) {
    return c.json({ error: (err as Error).message, action: id }, 400);
  }
});
app.route("/api", api);

// UI estàtica (embeguda a la imatge) — servida per la mateixa app.
const uiDist = fileURLToPath(new URL("../ui/dist", import.meta.url));
if (existsSync(uiDist)) {
  app.use("*", serveStatic({ root: uiDist }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[personal.todolists] API + UI escoltant a http://0.0.0.0:${info.port}`);
});

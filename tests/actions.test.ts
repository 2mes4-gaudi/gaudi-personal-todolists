/**
 * Tests de CONTRATO del feature personal.todolists (SPEC §3c):
 *   1. registry expone las acciones declaradas (con metas destructivas correctas)
 *   2. cada acción: caso feliz + validación + reglas de owner/visibilidad (DAO fake)
 *   3. snapshot de maestras (fresh start) + transición completed + eventos
 *   4. indexación Llull (fake) + fan-out de búsqueda + fallback DAO
 *   5. PARIDAD CLI/API: misma acción por bin.js y por createApp(registry)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRegistry } from "../dist/domain/actions/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, "..", "dist", "bin.js");

// ── Infra de test: DAO en memoria + Llull fake + bus local ────────────────

export function createMemoryDao() {
  const store = new Map<string, Map<string, unknown>>();
  return {
    kind: "postgres" as const,
    name: "memory",
    listCollections: async () => [...store.keys()],
    get: async <T = unknown>(collection: string, key: string) =>
      (store.get(collection)?.get(key) as T) ?? null,
    set: async (collection: string, key: string, value: unknown) => {
      if (!store.has(collection)) store.set(collection, new Map());
      store.get(collection)!.set(key, value);
    },
    delete: async (collection: string, key: string) => { store.get(collection)?.delete(key); },
    list: async (collection: string) => [...(store.get(collection)?.keys() ?? [])],
    listValues: async <T = unknown>(collection: string) =>
      [...(store.get(collection)?.values() ?? [])] as T[],
    _store: store,
  };
}

export interface LlullCall { op: "index" | "delete" | "search"; indexName: string; id?: string; query?: string }

/** Fake del port LlullSearch: registra las llamadas y devuelve resultados programables. */
export function createFakeLlull(hitsByIndex: Record<string, Array<{ id: string; title: string; score?: number }>> = {}) {
  const calls: LlullCall[] = [];
  const docs = new Map<string, Map<string, { id: string; fields: Record<string, string> }>>();
  return {
    calls,
    _docs: docs,
    async index(indexName: string, doc: { id: string; fields: Record<string, string> }) {
      calls.push({ op: "index", indexName, id: doc.id });
      if (!docs.has(indexName)) docs.set(indexName, new Map());
      docs.get(indexName)!.set(doc.id, doc);
    },
    async delete(indexName: string, id: string) {
      calls.push({ op: "delete", indexName, id });
      docs.get(indexName)?.delete(id);
    },
    async search(indexName: string, query: string) {
      calls.push({ op: "search", indexName, query });
      return (hitsByIndex[indexName] ?? []).map((h) => ({
        id: h.id, title: h.title, path: "", score: h.score ?? null, folder: undefined, content: undefined,
      }));
    },
  };
}

/** Bus local: captura els missatges publicats (tipus + payload). */
export function createLocalBus() {
  const published: Array<{ type: string; payload: any }> = [];
  return {
    configured: true,
    published,
    async publish(input: { type: string; payload: unknown }) {
      published.push({ type: input.type, payload: input.payload });
      return { published: true };
    },
  };
}

export function makeCtx(opts: {
  db?: ReturnType<typeof createMemoryDao>;
  llull?: ReturnType<typeof createFakeLlull>;
  bus?: ReturnType<typeof createLocalBus>;
  withLlullToken?: boolean;
  dryRun?: boolean;
  userKey?: string;
} = {}) {
  const llullToken = opts.withLlullToken ?? false;
  return {
    credentials: {
      get: async (id: string) => (id === "todolists.llull-token" && llullToken ? "tok" : undefined),
      has: async (id: string) => id === "todolists.llull-token" && llullToken,
    },
    logger: { info() {}, warn() {}, error() {} },
    dryRun: opts.dryRun ?? false,
    db: opts.db ?? createMemoryDao(),
    llull: opts.llull ?? createFakeLlull(),
    messageBus: opts.bus ?? createLocalBus(),
    clock: () => new Date("2026-08-16T10:00:00.000Z"),
  };
}

type Ctx = ReturnType<typeof makeCtx>;

const IDX_LOCAL = "gaudi-personal-todolists-local";
const IDX_OTHER = "gaudi-personal-todolists-other";
export const IDX_SHARED = "gaudi-personal-todolists-shared";

/** Helper: crea una llista amb items i torna ids. */
async function seedList(
  ctx: Ctx, name: string, items: string[] = [], extra: Record<string, unknown> = {}
) {
  const registry = buildRegistry();
  const created = (await registry.run("todo.list-create", { name, ...extra }, ctx)) as any;
  const listId = created.list.id;
  const itemIds: string[] = [];
  for (const text of items) {
    const r = (await registry.run("todo.item-add", { listId, text }, ctx)) as any;
    itemIds.push(r.item.id);
  }
  return { listId, itemIds };
}

// ── 1. Registry ────────────────────────────────────────────────────────────

const EXPECTED_ACTIONS = [
  "todo.list-create", "todo.list-list", "todo.list-get", "todo.list-update",
  "todo.list-delete", "todo.list-set-master", "todo.list-set-shared",
  "todo.list-instantiate", "todo.item-add", "todo.item-remove",
  "todo.item-check", "todo.item-uncheck", "todo.list-search",
];

test("registry expone exactamente las 13 acciones declaradas", () => {
  const registry = buildRegistry();
  const ids = registry.list().map((a) => a.id).sort();
  assert.deepEqual(ids, [...EXPECTED_ACTIONS].sort());
  for (const a of registry.list()) {
    assert.match(a.id, /^todo\.[a-z-]+$/, `id inválido: ${a.id}`);
    assert.ok(a.description.length > 0);
  }
});

test("list-delete e item-remove son destructive con confirm", () => {
  const registry = buildRegistry();
  for (const id of ["todo.list-delete", "todo.item-remove"]) {
    const meta = registry.get(id)!.meta ?? {};
    assert.equal(meta.destructive, true, `${id} debe ser destructive`);
    assert.equal(meta.confirm, "required", `${id} requiere confirmación`);
  }
});

// ── 2. CRUD de llistes ─────────────────────────────────────────────────────

test("list-create: happy path con defaults (privada, no mestra) + valida nombre", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const out = (await registry.run("todo.list-create", { name: "Compra setmanal" }, ctx)) as any;
  assert.equal(out.list.name, "Compra setmanal");
  assert.equal(out.list.isMaster, false);
  assert.equal(out.list.shared, false);
  assert.equal(out.list.userKey, "local");
  assert.ok(out.list.id);
  assert.ok(!out.list.sourceMasterId);

  await assert.rejects(
    () => registry.run("todo.list-create", { name: "" }, ctx),
    (err: any) => /name/i.test(err.message)
  );
});

test("list-create: indexa el document de la llista al seu índex Llull", async () => {
  const registry = buildRegistry();
  const llull = createFakeLlull();
  const ctx = makeCtx({ llull });
  const out = (await registry.run("todo.list-create", { name: "Compra" }, ctx)) as any;
  const idx = llull.calls.filter((c) => c.op === "index");
  assert.equal(idx.length, 1);
  assert.equal(idx[0].indexName, IDX_LOCAL);
  assert.equal(idx[0].id, `list-${out.list.id}`);
});

test("list-create: publica todolist.created", async () => {
  const registry = buildRegistry();
  const bus = createLocalBus();
  const ctx = makeCtx({ bus });
  await registry.run("todo.list-create", { name: "Compra" }, ctx);
  assert.equal(bus.published.length, 1);
  assert.equal(bus.published[0].type, "todolist.created");
});

test("list-list: scoping per usuari (meves + compartides) i filtre isMaster", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const { listId: mine } = await seedList(ctx, "La meva");
  const { listId: shared } = await seedList(ctx, "Compartida");
  await registry.run("todo.list-set-shared", { id: shared, shared: true }, ctx);
  await seedList(ctx, "Mestra", [], { isMaster: true });

  const mineView = (await registry.run("todo.list-list", {}, ctx)) as any;
  assert.equal(mineView.lists.length, 3);

  const otherView = (await registry.run("todo.list-list", { userKey: "other" }, makeCtx())) as any;
  assert.equal(otherView.lists.length, 1);
  assert.equal(otherView.lists[0].name, "Compartida");

  const masters = (await registry.run("todo.list-list", { isMaster: true }, ctx)) as any;
  assert.equal(masters.lists.length, 1);
  assert.equal(masters.lists[0].name, "Mestra");
  assert.ok(mine && shared);
});

test("list-get: torna llista + items; privada aliena no visible, compartida sí", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const { listId } = await seedList(ctx, "Compra", ["Pa", "Llet"]);

  const out = (await registry.run("todo.list-get", { id: listId }, ctx)) as any;
  assert.equal(out.list.name, "Compra");
  assert.equal(out.items.length, 2);
  assert.deepEqual(out.items.map((i: any) => i.text).sort(), ["Llet", "Pa"]);

  await assert.rejects(
    () => registry.run("todo.list-get", { id: listId, userKey: "other" }, makeCtx()),
    /no trobada|privada/i
  );

  await registry.run("todo.list-set-shared", { id: listId, shared: true }, ctx);
  const sharedView = (await registry.run("todo.list-get", { id: listId, userKey: "other" }, makeCtx())) as any;
  assert.equal(sharedView.list.name, "Compra");
  assert.equal(sharedView.items.length, 2);
});

test("list-update: només l'owner; reindexa el document", async () => {
  const registry = buildRegistry();
  const llull = createFakeLlull();
  const ctx = makeCtx({ llull });
  const { listId } = await seedList(ctx, "Compra");

  const out = (await registry.run("todo.list-update", { id: listId, name: "Compra gran" }, ctx)) as any;
  assert.equal(out.list.name, "Compra gran");

  await assert.rejects(
    () => registry.run("todo.list-update", { id: listId, name: "X", userKey: "other" }, makeCtx()),
    /només|owner|propietari/i
  );

  const indexes = llull.calls.filter((c) => c.op === "index" && c.id === `list-${listId}`);
  assert.ok(indexes.length >= 2, "create + update reindexen el mateix doc");
});

// ── 3. Mestres, instàncies i shared ────────────────────────────────────────

test("list-set-master: toggle del flag (només owner)", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const { listId } = await seedList(ctx, "Viatges");

  const on = (await registry.run("todo.list-set-master", { id: listId, isMaster: true }, ctx)) as any;
  assert.equal(on.list.isMaster, true);
  const off = (await registry.run("todo.list-set-master", { id: listId, isMaster: false }, ctx)) as any;
  assert.equal(off.list.isMaster, false);

  await assert.rejects(
    () => registry.run("todo.list-set-master", { id: listId, isMaster: true, userKey: "other" }, makeCtx()),
    /només|owner|propietari/i
  );
});

test("list-set-shared: mou els documents entre índexs (user → shared) i publica todolist.shared", async () => {
  const registry = buildRegistry();
  const llull = createFakeLlull();
  const bus = createLocalBus();
  const ctx = makeCtx({ llull, bus });
  const { listId } = await seedList(ctx, "Compra", ["Pa"]);

  await registry.run("todo.list-set-shared", { id: listId, shared: true }, ctx);

  const dels = llull.calls.filter((c) => c.op === "delete");
  assert.ok(dels.some((c) => c.indexName === IDX_LOCAL && c.id === `list-${listId}`), "desindexa del privat");
  assert.ok(llull.calls.some((c) => c.op === "index" && c.indexName === IDX_SHARED && c.id === `list-${listId}`), "indexa al compartit");
  assert.ok(llull.calls.some((c) => c.op === "index" && c.indexName === IDX_SHARED && /^item-/.test(c.id ?? "")), "reindexa els items al compartit");
  assert.ok(bus.published.some((m) => m.type === "todolist.shared"));
});

test("list-instantiate: snapshot fresh-start amb sourceMasterId (i valida mestra)", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const { listId } = await seedList(ctx, "Viatges", ["Passaport", "Carregador"], { isMaster: true });
  await registry.run("todo.item-check", { listId, itemIds: "all" }, ctx); // mestra tot marcat

  const out = (await registry.run("todo.list-instantiate", { masterId: listId, name: "Setembre" }, ctx)) as any;
  assert.equal(out.list.name, "Setembre");
  assert.equal(out.list.sourceMasterId, listId);
  assert.equal(out.list.isMaster, false);
  assert.equal(out.list.shared, false);
  assert.equal(out.items.length, 2);
  assert.ok(out.items.every((i: any) => i.done === false), "fresh start: cap item marcat");
  assert.equal(out.completed, false);

  const master = (await registry.run("todo.list-get", { id: listId }, ctx)) as any;
  assert.ok(master.items.every((i: any) => i.done === true), "la mestra conserva el seu estat");

  await assert.rejects(
    () => registry.run("todo.list-instantiate", { masterId: "inexistent" }, ctx),
    /no trobada|master|mestra/i
  );

  const { listId: plain } = await seedList(ctx, "No mestra");
  await assert.rejects(
    () => registry.run("todo.list-instantiate", { masterId: plain }, ctx),
    /mestra|master/i
  );
});

test("list-instantiate: publica todolist.instantiated", async () => {
  const registry = buildRegistry();
  const bus = createLocalBus();
  const ctx = makeCtx({ bus });
  const { listId } = await seedList(ctx, "Viatges", ["Pa"], { isMaster: true });
  await registry.run("todo.list-instantiate", { masterId: listId }, ctx);
  assert.ok(bus.published.some((m) => m.type === "todolist.instantiated"));
});

test("list-delete: cascada d'items, desindexació i event (només owner)", async () => {
  const registry = buildRegistry();
  const llull = createFakeLlull();
  const bus = createLocalBus();
  const ctx = makeCtx({ llull, bus });
  const { listId, itemIds } = await seedList(ctx, "Compra", ["Pa", "Llet"]);

  const out = (await registry.run("todo.list-delete", { id: listId }, ctx)) as any;
  assert.equal(out.deleted, true);
  assert.equal(out.itemsDeleted, 2);

  const after = (await registry.run("todo.list-list", {}, ctx)) as any;
  assert.equal(after.lists.length, 0);
  assert.ok(llull.calls.some((c) => c.op === "delete" && c.id === `item-${itemIds[0]}`), "desindexa items");
  assert.ok(llull.calls.some((c) => c.op === "delete" && c.id === `list-${listId}`), "desindexa llista");
  assert.ok(bus.published.some((m) => m.type === "todolist.deleted"));

  const { listId: other } = await seedList(ctx, "Aliena");
  await assert.rejects(
    () => registry.run("todo.list-delete", { id: other, userKey: "other2" }, makeCtx()),
    /només|owner|propietari/i
  );
});

// ── 4. Items: add/remove/check/uncheck ─────────────────────────────────────

test("item-add: neix pendent i s'indexa com a item-", async () => {
  const registry = buildRegistry();
  const llull = createFakeLlull();
  const ctx = makeCtx({ llull });
  const { listId } = await seedList(ctx, "Compra");

  const out = (await registry.run("todo.item-add", { listId, text: "Pa" }, ctx)) as any;
  assert.equal(out.item.text, "Pa");
  assert.equal(out.item.done, false);
  assert.ok(llull.calls.some((c) => c.op === "index" && c.id === `item-${out.item.id}`));

  await assert.rejects(
    () => registry.run("todo.item-add", { listId, text: "" }, ctx),
    /text/i
  );
});

test("item-add en llista compartida: col·laboració total (no-owner hi pot afegir)", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const { listId } = await seedList(ctx, "Compra");
  await registry.run("todo.list-set-shared", { id: listId, shared: true }, ctx);
  const out = (await registry.run("todo.item-add", { listId, text: "Cafè", userKey: "other" }, makeCtx())) as any;
  assert.equal(out.item.text, "Cafè");
});

test("item-check: single, bulk JSON i all; transició completed publica un sol event", async () => {
  const registry = buildRegistry();
  const bus = createLocalBus();
  const ctx = makeCtx({ bus });
  const { listId, itemIds } = await seedList(ctx, "Compra", ["Pa", "Llet", "Ous"]);

  const single = (await registry.run("todo.item-check", { listId, itemIds: itemIds[0] }, ctx)) as any;
  assert.equal(single.updated, 1);
  assert.equal(single.completed, false);
  assert.ok(single.items.find((i: any) => i.id === itemIds[0]).done === true);

  const bulk = (await registry.run("todo.item-check", { listId, itemIds: JSON.stringify([itemIds[1]]) }, ctx)) as any;
  assert.equal(bulk.updated, 1);

  const all = (await registry.run("todo.item-check", { listId, itemIds: "all" }, ctx)) as any;
  assert.equal(all.updated, 1); // només el que faltava
  assert.equal(all.completed, true);

  const completedEvents = bus.published.filter((m) => m.type === "todolist.completed");
  assert.equal(completedEvents.length, 1, "un únic event de completed en la transició");
  assert.equal(completedEvents[0].payload.listId, listId);

  // tornar a marcar "all" quan ja ho està: cap event nou
  const again = (await registry.run("todo.item-check", { listId, itemIds: "all" }, ctx)) as any;
  assert.equal(again.updated, 0);
  assert.equal(again.completed, true);
  assert.equal(bus.published.filter((m) => m.type === "todolist.completed").length, 1);
});

test("item-uncheck: desmarca i completed torna a false", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const { listId, itemIds } = await seedList(ctx, "Compra", ["Pa"]);
  await registry.run("todo.item-check", { listId, itemIds: "all" }, ctx);
  const out = (await registry.run("todo.item-uncheck", { listId, itemIds: itemIds[0] }, ctx)) as any;
  assert.equal(out.updated, 1);
  assert.equal(out.completed, false);
});

test("item-remove: esborra i desindexa", async () => {
  const registry = buildRegistry();
  const llull = createFakeLlull();
  const ctx = makeCtx({ llull });
  const { itemIds } = await seedList(ctx, "Compra", ["Pa"]);

  const out = (await registry.run("todo.item-remove", { itemId: itemIds[0] }, ctx)) as any;
  assert.equal(out.deleted, true);
  assert.ok(llull.calls.some((c) => c.op === "delete" && c.id === `item-${itemIds[0]}`));
});

test("item-check en llista aliena privada: rebutjat", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  const { listId, itemIds } = await seedList(ctx, "Privada", ["Pa"]);
  await assert.rejects(
    () => registry.run("todo.item-check", { listId, itemIds: itemIds[0], userKey: "other" }, makeCtx()),
    /no trobada|privada|permís/i
  );
});

// ── 5. Cerca: Llull + fallback DAO ─────────────────────────────────────────

test("list-search amb token: engine llull, fan-out (propi + shared) i hits normalitzats", async () => {
  const registry = buildRegistry();
  const llull = createFakeLlull({
    [IDX_LOCAL]: [{ id: "list-abc", title: "Compra setmanal", score: 0.9 }],
    [IDX_SHARED]: [{ id: "list-def", title: "Compra de la casa", score: 0.7 }],
    [IDX_OTHER]: [{ id: "list-ghi", title: "Privada d'un altre", score: 0.99 }],
  });
  const ctx = makeCtx({ llull, withLlullToken: true });

  const out = (await registry.run("todo.list-search", { query: "compra" }, ctx)) as any;
  assert.equal(out.engine, "llull");
  const ids = out.hits.map((h: any) => h.id).sort();
  assert.deepEqual(ids, ["list-abc", "list-def"], "només propi + shared (mai l'índex d'un altre)");
  assert.ok(out.hits.every((h: any) => h.type === "list" || h.type === "item"));
  assert.equal(out.total, 2);
});

test("list-search sense token: fallback DAO per nom, descripció i text d'items (visibles only)", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx();
  await seedList(ctx, "Compra setmanal", ["Pa"]);
  await seedList(ctx, "Feina", [], { description: "comprar cable HDMI" });
  await seedList(ctx, "Secreta", ["targeta de compra"]);
  const { listId: shared } = await seedList(ctx, "Colònies", ["paper de cuina"]);
  await registry.run("todo.list-set-shared", { id: shared, shared: true }, ctx);

  const out = (await registry.run("todo.list-search", { query: "COMPRA" }, ctx)) as any;
  assert.equal(out.engine, "dao-fallback");
  assert.ok(out.warning, "avisa de la degradació");
  const names = out.hits.map((h: any) => h.title);
  assert.ok(names.includes("Compra setmanal"), "match per nom");
  assert.ok(names.includes("Feina"), "match per descripció");
  assert.ok(!names.includes("Secreta"), "error: ha de ser case-insensitive");
  assert.ok(!names.includes("Colònies"), "llista no related");

  const items = out.hits.filter((h: any) => h.type === "item");
  assert.ok(items.some((h: any) => /targeta de compra/i.test(h.title ?? "")), "match per text d'item");

  // user "other" només veu les compartides
  const otherView = (await registry.run("todo.list-search", { query: "cuina", userKey: "other" }, makeCtx())) as any;
  assert.equal(otherView.total, 1);
  assert.ok(/paper de cuina/i.test(otherView.hits[0].title));
});

// ── 6. Dry-run, CLI i paritat API ──────────────────────────────────────────

test("dry-run: no executa el handler ni persisteix", async () => {
  const registry = buildRegistry();
  const ctx = makeCtx({ dryRun: true });
  const out = (await registry.run("todo.list-create", { name: "Dry" }, ctx)) as any;
  assert.equal(out.dryRun, true);
  const after = (await registry.run("todo.list-list", {}, makeCtx({ db: ctx.db }))) as any;
  assert.equal(after.lists.length, 0);
});

test("CLI: create → add → check → get amb HOME aïllat (memòria) i --json", () => {
  const home = mkdtempSync(join(tmpdir(), "gaudi-todolists-"));
  const env = { ...process.env, HOME: home, GAUDI_NO_ENV_LOAD: "1" };
  const run = (args: string[]) =>
    JSON.parse(execFileSync("node", [BIN, ...args, "--json"], { encoding: "utf8", env }));

  const created = run(["todo", "list-create", "Compra CLI"]);
  assert.equal(created.list.name, "Compra CLI");
  const listId = created.list.id;

  const item = run(["todo", "item-add", listId, "Pa"]);
  assert.equal(item.item.done, false);

  const checked = run(["todo", "item-check", listId, "all"]);
  assert.equal(checked.completed, true);

  // destructiu sense --yes → CONFIRM_REQUIRED + exit 2
  let confirmError: any = null;
  try {
    execFileSync("node", [BIN, "todo", "list-delete", listId, "--json"], { env });
  } catch (err) {
    confirmError = err as { status?: number; stdout?: Buffer };
  }
  assert.ok(confirmError, "ha de fallar sense --yes");
  assert.equal(confirmError.status, 2);
  assert.ok(String(confirmError.stdout).includes("CONFIRM_REQUIRED"));
});

test("PARIDAD CLI/API: mateixa acció per bin.js i per createApp → mateix resultat", async () => {
  const home = mkdtempSync(join(tmpdir(), "gaudi-todolists-"));
  const env = { ...process.env, HOME: home, GAUDI_NO_ENV_LOAD: "1" };
  const cliOut = JSON.parse(
    execFileSync("node", [BIN, "todo", "list-create", "Paritat", "--json"], { encoding: "utf8", env })
  );

  const mod = await import("../dist/adapters/api/index.js");
  assert.equal(typeof mod.createApp, "function", "createApp exportat");
  const registry = buildRegistry();
  const app = mod.createApp(registry, () => makeCtx());
  const res = await app.request("/api/actions/todo.list-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Paritat" }),
  });
  const apiOut = await res.json();

  assert.equal(res.status, 200);
  assert.equal(cliOut.list.name, apiOut.list.name);
  assert.equal(cliOut.list.isMaster, apiOut.list.isMaster);
  assert.equal(cliOut.list.shared, apiOut.list.shared);
  assert.equal(cliOut.error, apiOut.error);
});

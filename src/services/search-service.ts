import type { TodoContext } from "../ports/context.js";
import type { SearchHit, TodoItem, TodoList } from "../domain/model/todolist.js";
import { COLLECTIONS } from "../domain/model/todolist.js";
import type { SearchHitLike } from "../ports/llull.js";
import { listItems, resolveUserKey } from "./list-service.js";
import { SHARED_INDEX, userIndexName } from "./indexing.js";

const FALLBACK_WARNING =
  "cerca degradada (sense Llull): fallback DAO case-insensitive sobre nom, descripció i text d'items";

/** Llistes visibles per a l'usuari (seves + compartides). */
async function visibleLists(ctx: TodoContext, userKey: string): Promise<TodoList[]> {
  const rows = await ctx.db.listValues<TodoList>(COLLECTIONS.lists);
  return rows.filter((l) => l.userKey === userKey || l.shared === true);
}

/** Normalitza un hit de Llull (doc id "list-x" o "item-x" + path todolists/<listId>/...). */
function normalizeHit(hit: SearchHitLike, index: string): SearchHit {
  const isList = hit.id.startsWith("list-");
  const path = hit.path ?? "";
  const segments = path.split("/").filter(Boolean); // ["todolists", "<listId>", "items", "<itemId>"]
  const listId = isList
    ? hit.id.slice("list-".length)
    : segments.length >= 2 ? segments[1] : undefined;
  return {
    id: hit.id,
    type: isList ? "list" : "item",
    title: hit.title ?? "",
    listId,
    snippet: hit.content ? String(hit.content).slice(0, 200) : undefined,
    score: typeof hit.score === "number" ? hit.score : null,
    index,
  };
}

/** Cerca canònica: fan-out a l'índex propi + el compartit, dedupe per id. */
async function searchWithLlull(ctx: TodoContext, userKey: string, query: string): Promise<SearchHit[]> {
  const indexes = [userIndexName(userKey), SHARED_INDEX];
  const results = await Promise.all(
    indexes.map(async (index) => {
      const raw = await ctx.llull.search(index, query);
      return raw.map((h) => normalizeHit(h, index));
    })
  );
  const byId = new Map<string, SearchHit>();
  for (const hits of results) {
    for (const hit of hits) {
      const prev = byId.get(hit.id);
      if (!prev || (hit.score ?? 0) > (prev.score ?? 0)) byId.set(hit.id, hit);
    }
  }
  return [...byId.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/** Fallback DAO: match case-insensitive sobre nom, descripció i text d'items. */
async function searchFallback(ctx: TodoContext, userKey: string, query: string): Promise<SearchHit[]> {
  const q = query.toLowerCase();
  const lists = await visibleLists(ctx, userKey);
  const hits: SearchHit[] = [];

  for (const list of lists) {
    const matchName = list.name.toLowerCase().includes(q);
    const matchDesc = (list.description ?? "").toLowerCase().includes(q);
    if (matchName || matchDesc) {
      hits.push({
        id: `list-${list.id}`,
        type: "list",
        title: list.name,
        listId: list.id,
        snippet: list.description,
        score: matchName ? 1 : 0.5,
        index: "dao",
      });
    }
    const items: TodoItem[] = await listItems(ctx, list.id);
    for (const item of items) {
      if (item.text.toLowerCase().includes(q)) {
        hits.push({
          id: `item-${item.id}`,
          type: "item",
          title: item.text,
          listId: list.id,
          snippet: list.name,
          score: 0.7,
          index: "dao",
        });
      }
    }
  }
  return hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Cerca de llistes i items: Llull (canònic, amb token) amb fan-out propi+shared;
 * sense token (o si el motor falla) → fallback DAO avisant de la degradació.
 */
export async function searchLists(
  input: { query: string; userKey?: string },
  ctx: TodoContext
): Promise<{ query: string; engine: "llull" | "dao-fallback"; total: number; hits: SearchHit[]; warning?: string }> {
  const userKey = resolveUserKey(input, ctx);

  if (ctx.llullEnabled) {
    try {
      const hits = await searchWithLlull(ctx, userKey, input.query);
      return { query: input.query, engine: "llull", total: hits.length, hits };
    } catch (err) {
      ctx.logger.warn(
        `[personal.todolists] cerca Llull fallida → fallback DAO: ${(err as Error).message}`
      );
      const hits = await searchFallback(ctx, userKey, input.query);
      return {
        query: input.query, engine: "dao-fallback", total: hits.length, hits,
        warning: `cerca degradada (Llull no disponible: ${(err as Error).message})`,
      };
    }
  }

  const hits = await searchFallback(ctx, userKey, input.query);
  return { query: input.query, engine: "dao-fallback", total: hits.length, hits, warning: FALLBACK_WARNING };
}

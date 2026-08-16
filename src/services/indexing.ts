import type { TodoContext } from "../ports/context.js";
import type { TodoList, TodoItem } from "../domain/model/todolist.js";

/** Índex compartit de la plataforma per a llistes shared (SPEC §16). */
export const SHARED_INDEX = "gaudi-personal-todolists-shared";

/** Índex propi de l'usuari (nomenclatura canònica gaudi-<slug>-<uid>). */
export function userIndexName(userKey: string): string {
  const slug = userKey.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") || "local";
  return `gaudi-personal-todolists-${slug}`;
}

/** Índex on viu una llista (compartides al subíndex comú). */
export function indexFor(list: Pick<TodoList, "shared" | "userKey">): string {
  return list.shared ? SHARED_INDEX : userIndexName(list.userKey);
}

function warn(ctx: TodoContext, op: string, err: unknown): void {
  ctx.logger.warn(`[personal.todolists] indexació Llull fallida (${op}): ${(err as Error).message}`);
}

/** Avís únic per procés quan s'omet la indexació (sense token de Llull). */
let warnedNoLlull = false;
function skipWarn(ctx: TodoContext): void {
  if (warnedNoLlull) return;
  warnedNoLlull = true;
  ctx.logger.warn(
    "[personal.todolists] sense token de Llull (GAUDI_TODOLISTS_LLULL_TOKEN): s'omet la indexació; la cerca farà servir el fallback DAO"
  );
}

/** Indexa el document d'una llista (best-effort, omès sense token). */
export async function indexList(ctx: TodoContext, list: TodoList): Promise<void> {
  if (!ctx.llullEnabled) { skipWarn(ctx); return; }
  try {
    await ctx.llull.index(indexFor(list), {
      id: `list-${list.id}`,
      fields: {
        title: list.name,
        content: list.description ?? "",
        path: `todolists/${list.id}`,
        folder: list.shared ? "shared" : list.userKey,
      },
    });
  } catch (err) {
    warn(ctx, `list ${list.id}`, err);
  }
}

/** Indexa el document d'un item (best-effort, omès sense token). */
export async function indexItem(ctx: TodoContext, list: TodoList, item: TodoItem): Promise<void> {
  if (!ctx.llullEnabled) return;
  try {
    await ctx.llull.index(indexFor(list), {
      id: `item-${item.id}`,
      fields: {
        title: item.text,
        content: item.text,
        path: `todolists/${list.id}/items/${item.id}`,
        folder: list.name,
      },
    });
  } catch (err) {
    warn(ctx, `item ${item.id}`, err);
  }
}

/** Desindexa un document per id (best-effort). */
export async function deindex(ctx: TodoContext, indexName: string, docId: string): Promise<void> {
  if (!ctx.llullEnabled) return;
  try {
    await ctx.llull.delete(indexName, docId);
  } catch (err) {
    warn(ctx, `delete ${docId}`, err);
  }
}

/** Mou llista + items d'índex (set-shared): desindexa del vell, indexa al nou. */
export async function moveListIndex(
  ctx: TodoContext,
  from: TodoList,
  to: TodoList,
  items: TodoItem[]
): Promise<void> {
  const fromIndex = indexFor(from);
  await deindex(ctx, fromIndex, `list-${to.id}`);
  for (const item of items) await deindex(ctx, fromIndex, `item-${item.id}`);
  await indexList(ctx, to);
  for (const item of items) await indexItem(ctx, to, item);
}

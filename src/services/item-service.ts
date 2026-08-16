import { randomUUID } from "node:crypto";
import type { TodoContext } from "../ports/context.js";
import type { TodoItem } from "../domain/model/todolist.js";
import { COLLECTIONS, normalizeItemIds, type ItemIdsSel } from "../domain/model/todolist.js";
import { listItems, loadVisibleList, resolveUserKey } from "./list-service.js";
import { deindex, indexFor, indexItem } from "./indexing.js";
import { publishEvent } from "./events.js";

async function getItem(ctx: TodoContext, itemId: string): Promise<TodoItem> {
  const item = await ctx.db.get<TodoItem>(COLLECTIONS.items, itemId);
  if (!item) throw new Error(`Item no trobat: ${itemId}`);
  return item;
}

/** Llista + item comprovant visibilitat (col·laboració total a les compartides). */
async function loadVisibleItemWithList(ctx: TodoContext, itemId: string, userKey: string) {
  const item = await getItem(ctx, itemId);
  const list = await loadVisibleList(ctx, item.listId, userKey);
  return { item, list };
}

function isCompleted(items: TodoItem[]): boolean {
  return items.length > 0 && items.every((i) => i.done);
}

export async function addItem(
  input: { listId: string; text: string; userKey?: string },
  ctx: TodoContext
): Promise<TodoItem> {
  const userKey = resolveUserKey(input, ctx);
  const list = await loadVisibleList(ctx, input.listId, userKey);
  const item: TodoItem = {
    id: randomUUID(),
    listId: list.id,
    text: input.text,
    done: false,
    createdAt: ctx.clock().toISOString(),
  };
  await ctx.db.set(COLLECTIONS.items, item.id, item);
  await indexItem(ctx, list, item);
  return item;
}

export async function removeItem(
  input: { itemId: string; userKey?: string },
  ctx: TodoContext
): Promise<{ deleted: boolean }> {
  const userKey = resolveUserKey(input, ctx);
  const { item, list } = await loadVisibleItemWithList(ctx, input.itemId, userKey);
  await ctx.db.delete(COLLECTIONS.items, item.id);
  await deindex(ctx, indexFor(list), `item-${item.id}`);
  return { deleted: true };
}

async function setDone(
  input: { listId: string; itemIds: string | string[]; done: boolean; userKey?: string },
  ctx: TodoContext
): Promise<{ updated: number; items: TodoItem[]; completed: boolean }> {
  const userKey = resolveUserKey(input, ctx);
  const list = await loadVisibleList(ctx, input.listId, userKey);
  const items = await listItems(ctx, list.id);
  const before = isCompleted(items);

  const sel: ItemIdsSel = normalizeItemIds(input.itemIds);
  const targetSet = new Set(sel.mode === "all" ? items.map((i) => i.id) : sel.mode === "ids" ? sel.ids : []);

  let updated = 0;
  const next: TodoItem[] = [];
  for (const item of items) {
    if (targetSet.has(item.id) && item.done !== input.done) {
      const changed: TodoItem = { ...item, done: input.done };
      await ctx.db.set(COLLECTIONS.items, item.id, changed);
      updated++;
      next.push(changed);
    } else {
      next.push(item);
    }
  }

  const after = isCompleted(next);
  // Event de completed NOMÉS en la transició (un sol event per canvi d'estat).
  if (input.done && after && !before) {
    await publishEvent(ctx.messageBus, "todolist.completed", list, { items: next.length });
  }

  return { updated, items: next, completed: after };
}

export const checkItems = (
  input: { listId: string; itemIds: string | string[]; userKey?: string },
  ctx: TodoContext
) => setDone({ ...input, done: true }, ctx);

export const uncheckItems = (
  input: { listId: string; itemIds: string | string[]; userKey?: string },
  ctx: TodoContext
) => setDone({ ...input, done: false }, ctx);

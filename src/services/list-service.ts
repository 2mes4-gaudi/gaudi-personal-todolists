import { randomUUID } from "node:crypto";
import type { TodoContext } from "../ports/context.js";
import type { TodoList, TodoItem } from "../domain/model/todolist.js";
import { COLLECTIONS } from "../domain/model/todolist.js";
import { publishEvent } from "./events.js";
import { deindex, indexFor, indexItem, indexList, moveListIndex } from "./indexing.js";

// ── Helpers d'accés i visibilitat ──────────────────────────────────────────

export function resolveUserKey(input: { userKey?: string }, ctx: TodoContext): string {
  return input.userKey ?? ctx.userKey ?? "local";
}

async function getList(ctx: TodoContext, id: string): Promise<TodoList | null> {
  return ctx.db.get<TodoList>(COLLECTIONS.lists, id);
}

/** Carrega una llista VISIBLE per a l'usuari (seva o compartida). */
export async function loadVisibleList(ctx: TodoContext, id: string, userKey: string): Promise<TodoList> {
  const list = await getList(ctx, id);
  if (!list || (list.userKey !== userKey && !list.shared)) {
    throw new Error(`Llista no trobada o privada: ${id}`);
  }
  return list;
}

/** Carrega una llista de la que l'usuari és PROPETARI (accions d'owner). */
export async function loadOwnedList(ctx: TodoContext, id: string, userKey: string): Promise<TodoList> {
  const list = await getList(ctx, id);
  if (!list) throw new Error(`Llista no trobada: ${id}`);
  if (list.userKey !== userKey) {
    throw new Error(`Només el propietari pot fer aquesta acció sobre la llista: ${id}`);
  }
  return list;
}

export async function listItems(ctx: TodoContext, listId: string): Promise<TodoItem[]> {
  const rows = await ctx.db.listValues<TodoItem>(COLLECTIONS.items);
  return rows.filter((i) => i.listId === listId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function isCompleted(items: TodoItem[]): boolean {
  return items.length > 0 && items.every((i) => i.done);
}

// ── CRUD de llistes ────────────────────────────────────────────────────────

export interface CreateListInput {
  name: string;
  description?: string;
  isMaster?: boolean;
  shared?: boolean;
  userKey?: string;
}

export async function createList(input: CreateListInput, ctx: TodoContext): Promise<TodoList> {
  const now = ctx.clock().toISOString();
  const list: TodoList = {
    id: randomUUID(),
    userKey: resolveUserKey(input, ctx),
    name: input.name,
    description: input.description,
    isMaster: input.isMaster ?? false,
    shared: input.shared ?? false,
    createdAt: now,
    updatedAt: now,
  };
  await ctx.db.set(COLLECTIONS.lists, list.id, list);
  await indexList(ctx, list);
  await publishEvent(ctx.messageBus, "todolist.created", list);
  return list;
}

export async function listLists(
  input: { isMaster?: boolean; userKey?: string },
  ctx: TodoContext
): Promise<TodoList[]> {
  const userKey = resolveUserKey(input, ctx);
  const rows = await ctx.db.listValues<TodoList>(COLLECTIONS.lists);
  return rows
    .filter((l) => l.userKey === userKey || l.shared === true)
    .filter((l) => input.isMaster === undefined ? true : l.isMaster === input.isMaster)
    .sort((a, b) => `${a.createdAt}${a.id}`.localeCompare(`${b.createdAt}${b.id}`));
}

export async function getListWithItems(
  input: { id: string; userKey?: string },
  ctx: TodoContext
): Promise<{ list: TodoList; items: TodoItem[] }> {
  const userKey = resolveUserKey(input, ctx);
  const list = await loadVisibleList(ctx, input.id, userKey);
  return { list, items: await listItems(ctx, list.id) };
}

export async function updateList(
  input: { id: string; name?: string; description?: string; userKey?: string },
  ctx: TodoContext
): Promise<TodoList> {
  const userKey = resolveUserKey(input, ctx);
  const current = await loadOwnedList(ctx, input.id, userKey);
  if (input.name === undefined && input.description === undefined) {
    throw new Error("cal proporcionar name o description per actualitzar");
  }
  const next: TodoList = {
    ...current,
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    updatedAt: ctx.clock().toISOString(),
  };
  await ctx.db.set(COLLECTIONS.lists, next.id, next);
  await indexList(ctx, next);
  return next;
}

export async function deleteList(
  input: { id: string; userKey?: string },
  ctx: TodoContext
): Promise<{ deleted: boolean; itemsDeleted: number }> {
  const userKey = resolveUserKey(input, ctx);
  const list = await loadOwnedList(ctx, input.id, userKey);
  const items = await listItems(ctx, list.id);
  for (const item of items) await ctx.db.delete(COLLECTIONS.items, item.id);
  await ctx.db.delete(COLLECTIONS.lists, list.id);

  const idx = indexFor(list);
  await deindex(ctx, idx, `list-${list.id}`);
  for (const item of items) await deindex(ctx, idx, `item-${item.id}`);

  await publishEvent(ctx.messageBus, "todolist.deleted", list, { itemsDeleted: items.length });
  return { deleted: true, itemsDeleted: items.length };
}

// ── Flags: mestra i compartida ─────────────────────────────────────────────

export async function setMaster(
  input: { id: string; isMaster: boolean; userKey?: string },
  ctx: TodoContext
): Promise<TodoList> {
  const userKey = resolveUserKey(input, ctx);
  const current = await loadOwnedList(ctx, input.id, userKey);
  const next: TodoList = { ...current, isMaster: input.isMaster, updatedAt: ctx.clock().toISOString() };
  await ctx.db.set(COLLECTIONS.lists, next.id, next);
  await indexList(ctx, next);
  return next;
}

export async function setShared(
  input: { id: string; shared: boolean; userKey?: string },
  ctx: TodoContext
): Promise<TodoList> {
  const userKey = resolveUserKey(input, ctx);
  const current = await loadOwnedList(ctx, input.id, userKey);
  if (current.shared === input.shared) return current;

  const next: TodoList = { ...current, shared: input.shared, updatedAt: ctx.clock().toISOString() };
  await ctx.db.set(COLLECTIONS.lists, next.id, next);

  const items = await listItems(ctx, next.id);
  await moveListIndex(ctx, current, next, items);

  await publishEvent(ctx.messageBus, "todolist.shared", next);
  return next;
}

// ── Instanciació de mestres ────────────────────────────────────────────────

export async function instantiateList(
  input: { masterId: string; name?: string; userKey?: string },
  ctx: TodoContext
): Promise<{ list: TodoList; items: TodoItem[]; completed: boolean }> {
  const userKey = resolveUserKey(input, ctx);
  const master = await loadVisibleList(ctx, input.masterId, userKey);
  if (!master.isMaster) {
    throw new Error(`La llista no és mestra (isMaster=false): ${input.masterId}`);
  }

  const now = ctx.clock().toISOString();
  const list: TodoList = {
    id: randomUUID(),
    userKey,
    name: input.name ?? master.name,
    description: master.description,
    isMaster: false,
    shared: false,
    sourceMasterId: master.id,
    createdAt: now,
    updatedAt: now,
  };
  await ctx.db.set(COLLECTIONS.lists, list.id, list);

  // Snapshot FRESH START: copia els textos, reseteja l'estat (decisió 0007/v1).
  const masterItems = await listItems(ctx, master.id);
  const items: TodoItem[] = [];
  for (const src of masterItems) {
    const item: TodoItem = {
      id: randomUUID(),
      listId: list.id,
      text: src.text,
      done: false,
      createdAt: now,
    };
    await ctx.db.set(COLLECTIONS.items, item.id, item);
    items.push(item);
  }

  await indexList(ctx, list);
  for (const item of items) await indexItem(ctx, list, item);

  await publishEvent(ctx.messageBus, "todolist.instantiated", list, {
    sourceMasterId: master.id,
    items: items.length,
  });
  return { list, items, completed: isCompleted(items) };
}

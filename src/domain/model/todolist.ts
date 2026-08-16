import { z } from "zod";

/** Col·leccions/taules del DAO (snake_case, manifest data.*). */
export const COLLECTIONS = {
  lists: "todolists",
  items: "todo_items",
} as const;

// ── Models persistits ──────────────────────────────────────────────────────

export const TodoListModel = z.object({
  id: z.string(),
  /** Propietari (uid de user.profile o clau d'instal·lació; "local" per defecte). */
  userKey: z.string(),
  name: z.string(),
  description: z.string().optional(),
  /** És plantilla instanciable (flag, no entitat separada). */
  isMaster: z.boolean(),
  /** Compartida amb tothom de la instal·lació (col·laboració total). */
  shared: z.boolean(),
  /** Traçabilitat: de quina mestra deriva aquesta instància (si escau). */
  sourceMasterId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TodoList = z.infer<typeof TodoListModel>;

export const TodoItemModel = z.object({
  id: z.string(),
  listId: z.string(),
  text: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
});
export type TodoItem = z.infer<typeof TodoItemModel>;

export const SearchHitModel = z.object({
  id: z.string(),
  type: z.enum(["list", "item"]),
  title: z.string(),
  listId: z.string().optional(),
  snippet: z.string().optional(),
  score: z.number().nullable().optional(),
  index: z.string().optional(),
});
export type SearchHit = z.infer<typeof SearchHitModel>;

// ── Helpers de coerció CLI/API ─────────────────────────────────────────────

/**
 * Identitat d'usuari: opcional per input; el runtime el resol de
 * GAUDI_TODOLISTS_USER_KEY (default "local"). Mai process.env als handlers.
 */
export const userKeyInput = z.string().min(1).optional();

/** Ids d'items: "all" | id | JSON array | array nadiu (API). */
export const itemIdsInput = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
]);

export type ItemIdsSel = { mode: "all" } | { mode: "ids"; ids: string[] };

export function normalizeItemIds(value: string | string[]): ItemIdsSel {
  const arr = Array.isArray(value) ? value : null;
  if (arr) {
    if (arr.length === 1 && arr[0] === "all") return { mode: "all" };
    return { mode: "ids", ids: arr };
  }
  const raw = (value as string).trim();
  if (raw === "all") return { mode: "all" };
  if (raw.startsWith("[")) {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== "string")) {
      throw new Error("itemIds ha de ser \"all\", un id o un array JSON d'ids");
    }
    return { mode: "ids", ids: parsed as string[] };
  }
  return { mode: "ids", ids: [raw] };
}

// ── Schemas d'input/output per acció ───────────────────────────────────────

export const listCreateInput = z.object({
  name: z.string().min(1, "el nom de la llista és obligatori"),
  description: z.string().optional(),
  isMaster: z.boolean().default(false),
  shared: z.boolean().default(false),
  userKey: userKeyInput,
});

export const listListInput = z.object({
  isMaster: z.boolean().optional(),
  userKey: userKeyInput,
});

export const listGetInput = z.object({
  id: z.string().min(1),
  userKey: userKeyInput,
});

export const listUpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  userKey: userKeyInput,
});

export const listDeleteInput = z.object({
  id: z.string().min(1),
  userKey: userKeyInput,
});

export const listSetMasterInput = z.object({
  id: z.string().min(1),
  isMaster: z.boolean(),
  userKey: userKeyInput,
});

export const listSetSharedInput = z.object({
  id: z.string().min(1),
  shared: z.boolean(),
  userKey: userKeyInput,
});

export const listInstantiateInput = z.object({
  masterId: z.string().min(1),
  name: z.string().min(1).optional(),
  userKey: userKeyInput,
});

export const itemAddInput = z.object({
  listId: z.string().min(1),
  text: z.string().min(1, "el text de l'item és obligatori"),
  userKey: userKeyInput,
});

export const itemRemoveInput = z.object({
  itemId: z.string().min(1),
  userKey: userKeyInput,
});

export const itemCheckInput = z.object({
  listId: z.string().min(1),
  itemIds: itemIdsInput,
  userKey: userKeyInput,
});

export const listSearchInput = z.object({
  query: z.string().min(1, "la consulta de cerca és obligatòria"),
  userKey: userKeyInput,
});

export const listOutput = z.object({ list: TodoListModel });
export const listsOutput = z.object({ lists: z.array(TodoListModel) });
export const listGetOutput = z.object({ list: TodoListModel, items: z.array(TodoItemModel) });
export const listDeleteOutput = z.object({ deleted: z.boolean(), itemsDeleted: z.number().int() });
export const instantiateOutput = z.object({
  list: TodoListModel,
  items: z.array(TodoItemModel),
  completed: z.boolean(),
});
export const itemOutput = z.object({ item: TodoItemModel });
export const itemRemoveOutput = z.object({ deleted: z.boolean() });
export const itemCheckOutput = z.object({
  updated: z.number().int(),
  items: z.array(TodoItemModel),
  completed: z.boolean(),
});
export const searchOutput = z.object({
  query: z.string(),
  engine: z.enum(["llull", "dao-fallback"]),
  total: z.number().int(),
  hits: z.array(SearchHitModel),
  warning: z.string().optional(),
});

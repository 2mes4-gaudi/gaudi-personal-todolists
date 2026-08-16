/** Client de l'API del feature (mateixa font de veritat que el CLI). */

export interface TodoList {
  id: string;
  userKey: string;
  name: string;
  description?: string;
  isMaster: boolean;
  shared: boolean;
  sourceMasterId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoItem {
  id: string;
  listId: string;
  text: string;
  done: boolean;
  createdAt: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && data?.error) throw new Error(data.error);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}

export const api = {
  listLists: (isMaster?: boolean) =>
    call<{ lists: TodoList[] }>(`/api/lists${isMaster ? "?isMaster=true" : ""}`),

  getList: (id: string) => call<{ list: TodoList; items: TodoItem[] }>(`/api/lists/${id}`),

  createList: (body: { name: string; description?: string; isMaster?: boolean; shared?: boolean }) =>
    call<{ list: TodoList }>("/api/lists", { method: "POST", body: JSON.stringify(body) }),

  updateList: (id: string, body: { name?: string; description?: string }) =>
    call<{ list: TodoList }>(`/api/lists/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteList: (id: string) =>
    call<{ deleted: boolean; itemsDeleted: number }>(`/api/lists/${id}`, { method: "DELETE" }),

  setMaster: (id: string, isMaster: boolean) =>
    call<{ list: TodoList }>(`/api/lists/${id}/master`, { method: "POST", body: JSON.stringify({ isMaster }) }),

  setShared: (id: string, shared: boolean) =>
    call<{ list: TodoList }>(`/api/lists/${id}/shared`, { method: "POST", body: JSON.stringify({ shared }) }),

  instantiate: (masterId: string, name?: string) =>
    call<{ list: TodoList; items: TodoItem[] }>(`/api/lists/${masterId}/instantiate`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  addItem: (listId: string, text: string) =>
    call<{ item: TodoItem }>(`/api/lists/${listId}/items`, { method: "POST", body: JSON.stringify({ text }) }),

  removeItem: (itemId: string) =>
    call<{ deleted: boolean }>(`/api/items/${itemId}`, { method: "DELETE" }),

  check: (listId: string, itemIds: string[] | "all") =>
    call<{ updated: number; items: TodoItem[]; completed: boolean }>(`/api/lists/${listId}/check`, {
      method: "POST",
      body: JSON.stringify({ itemIds }),
    }),

  uncheck: (listId: string, itemIds: string[] | "all") =>
    call<{ updated: number; items: TodoItem[]; completed: boolean }>(`/api/lists/${listId}/uncheck`, {
      method: "POST",
      body: JSON.stringify({ itemIds }),
    }),

  search: (q: string) => call<{ query: string; engine: string; total: number; hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`),
};

export interface SearchHit {
  id: string;
  type: "list" | "item";
  title: string;
  listId?: string;
  snippet?: string;
}

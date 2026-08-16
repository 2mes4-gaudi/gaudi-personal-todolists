export { buildRegistry } from "./domain/actions/index.js";
export { buildRuntime, makeMemoryDb, type TodoRuntime, type RuntimeOptions } from "./runtime.js";
export { createApp } from "./adapters/api/index.js";
export { createLlullSearch } from "./adapters/llull/http.js";
export { buildTodoCli } from "./adapters/cli/index.js";
export { loadFpConfig, toDbConfig, type FpConfig } from "./config/index.js";
export type { TodoContext } from "./ports/context.js";
export type { LlullSearch } from "./ports/llull.js";
export type { TodoList, TodoItem, SearchHit } from "./domain/model/todolist.js";

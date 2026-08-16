import type { MessageBus } from "@gaudi/core";
import type { TodoList } from "../domain/model/todolist.js";

export type TodoEventType =
  | "todolist.created"
  | "todolist.deleted"
  | "todolist.instantiated"
  | "todolist.completed"
  | "todolist.shared";

/**
 * Publica un event del cicle de vida a la cua única (gaudi.notifications).
 * Sobris per disseny: mai event per item-add/check individual (evitem spam).
 */
export async function publishEvent(
  bus: MessageBus,
  type: TodoEventType,
  list: TodoList,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await bus.publish({
    type,
    correlationId: list.id,
    payload: {
      listId: list.id,
      name: list.name,
      userKey: list.userKey,
      isMaster: list.isMaster,
      shared: list.shared,
      ...extra,
    },
  });
}

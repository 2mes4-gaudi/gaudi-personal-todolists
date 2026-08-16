import { buildRegistry } from "../../domain/actions/index.js";
import { toMastraTools, type ServiceContext } from "@gaudi/core";

/**
 * Integración con Mastra: convierte el registry del feature en tools de agente.
 * Misma doc, mismos schemas, misma lógica que el CLI — la capa domain es la
 * única fuente de verdad.
 */
export function todoTools(ctx: ServiceContext) {
  return toMastraTools(buildRegistry(), ctx);
}

import { buildRegistry } from "../../domain/actions/index.js";
import { toMastraTools, type ServiceContext } from "@gaudi/core";

/**
 * Integración con Mastra: convierte el registry del feature en tools de agente.
 *
 * Uso en un agente Mastra:
 *   import { createAgent } from "@mastra/core";
 *   import { personalTools } from "@gaudi/personal.todolists/agent";
 *
 *   const agent = createAgent({
 *     name: "personal-agent",
 *     instructions: "Llistes personals (todo lists): crear llistes amb nom i descripcio, afegir/esborrar items, marcar/desmarcar (individual, bulk i tot), llistes mestres instanciables (snapshot fresh-start), llistes compartides (colaboracio total), cerca semantica via Llull i UI embebida.",
 *     tools: personalTools(ctx),
 *   });
 *
 * Misma doc, mismos schemas, misma lógica que el CLI — la capa domain es la
 * única fuente de verdad.
 */
export function personalTools(ctx: ServiceContext) {
  return toMastraTools(buildRegistry(), ctx);
}

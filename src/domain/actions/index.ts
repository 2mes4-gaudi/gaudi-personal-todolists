import { createRegistry } from "@gaudi/core";
import type { z } from "zod";
import { helloInput, helloOutput, savedGreetingsOutput, type Greeting } from "../model/greeting.js";
import { helloHandler } from "../../services/greeting-service.js";

type HelloInput = z.infer<typeof helloInput>;
type HelloOutput = z.infer<typeof helloOutput>;

/**
 * Registry del feature: UNA acción = UNA fuente de verdad.
 * El CLI, las tools de agente (Mastra/MCP) y la doc del skill se generan desde aquí.
 */
export function buildRegistry() {
  const registry = createRegistry();

  registry.register<HelloInput, HelloOutput>({
    id: "personal.hello",
    description: "Saluda y persiste el saludo en la base de datos configurada (firestore o postgres).",
    inputSchema: helloInput,
    outputSchema: helloOutput,
    handler: helloHandler,
    meta: { destructive: false },
  });

  registry.register<{}, { greetings: Greeting[] }>({
    id: "personal.greetings.list",
    description: "Lista los saludos guardados.",
    inputSchema: helloInput.pick({}),
    outputSchema: savedGreetingsOutput,
    handler: async (_input, ctx) => {
      const rows = await ctx.db.listValues<Greeting>("greetings");
      return { greetings: rows };
    },
    meta: { destructive: false },
  });

  return registry;
}

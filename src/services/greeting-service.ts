import type { ServiceContext } from "@gaudi/core";
import type { z } from "zod";
import type { helloInput, helloOutput } from "../domain/model/greeting.js";

/**
 * Handler de ejemplo: lógica de negocio pura.
 * Usa ctx.db (DAO seleccionado por config global) y ctx.credentials (inyectadas
 * por core.credentials) — nunca lee env ni elige la BD.
 */
export async function helloHandler(
  input: z.infer<typeof helloInput>,
  ctx: ServiceContext
): Promise<z.infer<typeof helloOutput>> {
  const id = `greeting-${Date.now()}`;
  const doc = {
    id,
    message: `Hola, ${input.name}!`,
    createdAt: new Date().toISOString(),
  };

  // Persistencia vía DAO: funciona igual con firestore o postgres
  await ctx.db.set("greetings", id, doc);

  return doc;
}
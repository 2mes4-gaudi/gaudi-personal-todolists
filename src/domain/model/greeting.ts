import { z } from "zod";

/** Modelo de ejemplo: un registro con mensaje y fecha. Reemplazar por el dominio real del feature. */
export const GreetingModel = z.object({
  id: z.string(),
  message: z.string(),
  createdAt: z.string().datetime(),
});

export type Greeting = z.infer<typeof GreetingModel>;

/** Schemas de acciones del registry (cada acción declara sus inputs/outputs). */
export const helloInput = z.object({
  name: z.string().describe("Nombre a saludar"),
});
export const helloOutput = z.object({
  id: z.string(),
  message: z.string(),
  createdAt: z.string().datetime(),
});

export const savedGreetingsOutput = z.object({
  greetings: z.array(GreetingModel),
});

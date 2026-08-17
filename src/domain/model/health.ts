import { z } from "zod";

/** Output estàndard del health (SPEC §18) — igual a tots els nivells. */
export const healthOutput = z.object({
  ok: z.boolean(),
  components: z.array(
    z.object({
      name: z.string(),
      ok: z.boolean(),
      detail: z.string().optional(),
    })
  ),
});
export type HealthOutput = z.infer<typeof healthOutput>;

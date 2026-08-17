import type { TodoContext } from "../ports/context.js";
import type { HealthOutput } from "../domain/model/health.js";

/**
 * Health del feature (SPEC §18, nivell 1): DAO (lectura de col·leccions) +
 * validació LLEUGERA dels elements externs que el feature declara.
 */
export async function checkHealth(ctx: TodoContext): Promise<HealthOutput> {
  const components: Array<{ name: string; ok: boolean; detail?: string }> = [];

  // DAO: lectura (detecta caiguda de connexió)
  try {
    const cols = await ctx.db.listCollections();
    components.push({ name: "dao", ok: true, detail: `${ctx.db.kind ?? "db"} · ${cols.length} col·leccions` });
  } catch (err) {
    components.push({ name: "dao", ok: false, detail: (err as Error).message });
  }

  // Extern: Llull (cerca) — ping LLEUGER si està configurat; sinó degradació permesa
  const llullCtx = ctx as unknown as { llull?: { search: (i: string, q: string) => Promise<unknown> }; llullAvailable?: boolean };
  if (llullCtx.llull && llullCtx.llullAvailable) {
    try {
      await llullCtx.llull.search("gaudi-ping", "ping");
      components.push({ name: "llull", ok: true, detail: "respon" });
    } catch (err) {
      components.push({ name: "llull", ok: false, detail: (err as Error).message });
    }
  } else if (llullCtx.llull) {
    components.push({ name: "llull", ok: true, detail: "no configurat (fallback DAO)" });
  }

  return { ok: components.every((c) => c.ok), components };
}

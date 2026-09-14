import { createLlullClient, type LlullClient } from "@gaudi/core";
import type { LlullSearch, SearchHitLike } from "../../ports/llull.js";

/**
 * Adapter Llull DELEGANT a l'SDK (@gaudi/core — SPEC §3d/§16: prohibits els
 * adapters HTTP propis). Conserva la semàntica del port del feature:
 * - `index`/`delete` LLENÇEN si el motor falla (els serveis hi compten).
 * - `search` només llença si el motor està CAIGUT (resultats buits + ping KO)
 *   per preservar els fallbacks DAO del feature.
 */
export function createLlullSearch(opts: { baseUrl: string; token?: string }): LlullSearch {
  const client: LlullClient = createLlullClient({ url: opts.baseUrl, token: opts.token });

  return {
    async index(indexName, doc) {
      const ok = await client.index(indexName, {
        id: doc.id,
        fields: { title: doc.fields.title ?? doc.id, content: doc.fields.content ?? "", ...doc.fields },
      });
      if (!ok) throw new Error(`Llull POST /v1/${indexName}/index fallit`);
    },

    async delete(indexName, id) {
      const ok = await client.delete(indexName, id);
      if (!ok) throw new Error(`Llull DELETE /v1/${indexName}/${id} fallit`);
    },

    async search(indexName, query): Promise<SearchHitLike[]> {
      const hits = await client.search(indexName, query);
      if (hits.length === 0 && !(await client.ping())) {
        throw new Error("Llull no disponible (ping KO)");
      }
      return hits.map<SearchHitLike>((h) => ({
        id: h.id,
        title: h.title ?? null,
        path: String((h.fields as { path?: string } | undefined)?.path ?? ""),
        score: typeof h.score === "number" ? h.score : null,
        folder: (h.fields as { folder?: string } | undefined)?.folder ?? null,
        content: (h.fields as { content?: string } | undefined)?.content ?? null,
      }));
    },

    async ping() {
      return client.ping();
    },
  };
}

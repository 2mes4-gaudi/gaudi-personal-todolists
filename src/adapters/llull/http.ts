import type { LlullSearch, SearchHitLike } from "../../ports/llull.js";

/**
 * Adapter de Llull Search Engine via HTTP REST (SPEC §16).
 * Contracte: POST /v1/{index}/index (action INDEX|DELETE), GET /v1/{index}/search?q=.
 */
export function createLlullSearch(opts: { baseUrl: string; token?: string }): LlullSearch {
  const base = opts.baseUrl.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
  };

  async function post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Llull POST ${path} fallit (${res.status})`);
    return res.json();
  }

  return {
    async index(indexName, doc) {
      await post(`/v1/${indexName}/index`, { id: doc.id, action: "INDEX", fields: doc.fields });
    },

    async delete(indexName, id) {
      await post(`/v1/${indexName}/index`, { id, action: "DELETE" });
    },

    async search(indexName, query): Promise<SearchHitLike[]> {
      const res = await fetch(`${base}/v1/${indexName}/search?q=${encodeURIComponent(query)}`, {
        headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      });
      if (!res.ok) throw new Error(`Llull GET search fallit (${res.status})`);
      const data = (await res.json()) as {
        results?: Array<Record<string, unknown>>;
        hits?: Array<Record<string, unknown>>;
      };
      const raw = (data.results ?? data.hits ?? []) as Array<Record<string, unknown>>;
      return raw.map<SearchHitLike>((r) => ({
        id: String(r.id ?? r.path ?? ""),
        title: typeof r.title === "string"
          ? r.title
          : (r.fields as { title?: string } | undefined)?.title ?? null,
        path: String((r.fields as { path?: string } | undefined)?.path ?? r.path ?? ""),
        score: typeof r.score === "number" ? r.score : null,
        folder: (r.fields as { folder?: string } | undefined)?.folder ?? null,
        content: (r.fields as { content?: string } | undefined)?.content ?? null,
      }));
    },
  };
}

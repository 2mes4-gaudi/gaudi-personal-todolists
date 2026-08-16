import type { SearchHit } from "../domain/model/todolist.js";

/** Port de cerca/indexació Llull (contracte REST del SPEC §16). */
export interface LlullSearch {
  /** Indexa (o reindexa) un document a un índex. */
  index(indexName: string, doc: { id: string; fields: Record<string, string> }): Promise<void>;
  /** Elimina un document de l'índex (action DELETE). */
  delete(indexName: string, id: string): Promise<void>;
  /** Cerca documents d'un índex. */
  search(indexName: string, query: string): Promise<SearchHitLike[]>;
}

/** Hit cru que retorna el motor (normalitzat pel service de cerca). */
export interface SearchHitLike {
  id: string;
  title?: string | null;
  path?: string | null;
  score?: number | null;
  folder?: string | null;
  content?: string | null;
}

export type { SearchHit };

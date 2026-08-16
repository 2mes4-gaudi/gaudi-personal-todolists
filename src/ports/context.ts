import type { ServiceContext, MessageBus } from "@gaudi/core";
import type { LlullSearch } from "./llull.js";

/**
 * Context estès del feature: DAO (ctx.db del core, DAOs ×2 postgres/firestore),
 * port Llull + flag de disponibilitat (token), cua única i rellotge injectable.
 */
export interface TodoContext extends ServiceContext {
  /** Port de cerca/indexació (best-effort: si falla, el CRUD no es trenca). */
  llull: LlullSearch;
  /** true si hi ha token de Llull configurat (cerca canònica); sinó fallback DAO. */
  llullEnabled: boolean;
  /** Cua única de la plataforma (gaudi.notifications). */
  messageBus: MessageBus;
  /** Rellotge injectable (tests). */
  clock: () => Date;
  /** userKey per defecte del runtime (GAUDI_TODOLISTS_USER_KEY o "local"). */
  userKey: string;
}

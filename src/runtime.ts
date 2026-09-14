import { createFeatureLogger } from "@gaudi/core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  createStore, createNatsMessageBus, createLocalMessageBus,
  type KVStore, type CredentialProvider, type Logger, type MessageBus,
} from "@gaudi/core";
import type { TodoContext } from "./ports/context.js";
import type { LlullSearch } from "./ports/llull.js";
import { buildRegistry } from "./domain/actions/index.js";
import { createLlullSearch } from "./adapters/llull/http.js";
import { createEnvCredentialProvider, noopCredentials, stderrLogger } from "./config/credentials.js";
import { loadFpConfig, toDbConfig, NoGaudiConfigError } from "./config/index.js";

function readManifestMeta(): { id: string; version: string } {
  try {
    const file = fileURLToPath(new URL("../gaudi-feature.yaml", import.meta.url));
    const m = YAML.parse(readFileSync(file, "utf8")) as { id?: string; version?: string };
    return { id: m.id ?? "personal.todolists", version: m.version ?? "0.0.0" };
  } catch {
    return { id: "personal.todolists", version: "0.0.0" };
  }
}

export function makeMemoryDb(): KVStore {
  const store = new Map<string, Map<string, unknown>>();
  return {
    kind: "postgres",
    name: "memory",
    async listCollections() { return [...store.keys()]; },
    async get<T>(collection: string, key: string) { return (store.get(collection)?.get(key) as T) ?? null; },
    async set(collection: string, key: string, value: unknown) {
      if (!store.has(collection)) store.set(collection, new Map());
      store.get(collection)!.set(key, value);
    },
    async delete(collection: string, key: string) { store.get(collection)?.delete(key); },
    async list(collection: string) { return [...(store.get(collection)?.keys() ?? [])]; },
    async listValues<T>(collection: string) { return [...(store.get(collection)?.values() ?? [])] as T[]; },
  };
}

export interface RuntimeOptions {
  db?: KVStore;
  credentials?: CredentialProvider;
  logger?: Logger;
  llull?: LlullSearch;
  messageBus?: MessageBus;
  clock?: () => Date;
  noConfig?: boolean;
}

export interface TodoRuntime {
  registry: ReturnType<typeof buildRegistry>;
  ctx: TodoContext;
}

async function loadDb(opts: RuntimeOptions, credentials: CredentialProvider, logger: Logger): Promise<KVStore> {
  if (opts.db) return opts.db;
  if (opts.noConfig) return makeMemoryDb();
  let config;
  try {
    config = loadFpConfig();
  } catch (err) {
    if (err instanceof NoGaudiConfigError) {
      logger.warn(
        `[personal.todolists] sense config global (${err.path}): DAO de MEMÒRIA, les dades NO persisteixen entre invocacions. Executa 'gaudi init' per configurar el DAO real.`
      );
      return makeMemoryDb();
    }
    throw err;
  }
  try {
    return await createStore(toDbConfig(config), credentials);
  } catch (err) {
    throw new Error(
      `DAO configurat però no disponible: ${(err as Error).message}. ` +
        `Revisa ~/.gaudi/gaudi.yaml i les credencials (per postgres: env POSTGRES_URL o GAUDI_PLATFORM_DB_URL). ` +
        `NO es fa fallback a memòria: les dades es perdrien entre invocacions.`
    );
  }
}

/** Arrel de composició: aquí (i només aquí) es llegeix process.env. */
export async function buildRuntime(opts: RuntimeOptions = {}): Promise<TodoRuntime> {
  const logger = opts.logger ?? createFeatureLogger("personal-todolists");
  const credentials = opts.credentials ?? (opts.noConfig ? noopCredentials : createEnvCredentialProvider());
  const db = await loadDb(opts, credentials, logger);
  const clock = opts.clock ?? (() => new Date());

  const llullToken = ((await credentials.get("todolists.llull-token")) as string | undefined) ?? undefined;
  const llull = opts.llull ?? createLlullSearch({
    baseUrl: process.env.GAUDI_TODOLISTS_LLULL_URL ?? "http://localhost:8080",
    token: llullToken,
  });

  const manifest = readManifestMeta();
  const messageBus =
    opts.messageBus ??
    (opts.noConfig
      ? createLocalMessageBus({ source: manifest.id, version: manifest.version })
      : createNatsMessageBus({
          source: manifest.id,
          version: manifest.version,
          logger,
        }));

  const ctx: TodoContext = {
    credentials,
    logger,
    dryRun: false,
    db,
    llull,
    llullEnabled: Boolean(llullToken),
    messageBus,
    clock,
    userKey: process.env.GAUDI_TODOLISTS_USER_KEY ?? "local",
  };

  return { registry: buildRegistry(), ctx };
}

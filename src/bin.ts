#!/usr/bin/env node
import { createStore, runFeatureCli, type KVStore } from "@gaudi/core";
import { buildRegistry } from "./domain/actions/index.js";
import { loadFpConfig, toDbConfig } from "./config/index.js";

/**
 * Punto de entrada del feature: npx <feature> <action> ...
 * Carga config global (~/.gaudi/gaudi.yaml), crea el DAO elegido y monta el CLI.
 * Sin config global: usa memoria (modo desarrollo/CI).
 */

const registry = buildRegistry();

function makeMemoryDb(): KVStore {
  const store = new Map<string, Map<string, unknown>>();
  return {
    kind: "postgres",
    name: "memory",
    async get<T>(collection: string, key: string) {
      return (store.get(collection)?.get(key) as T) ?? null;
    },
    async set(collection: string, key: string, value: unknown) {
      if (!store.has(collection)) store.set(collection, new Map());
      store.get(collection)!.set(key, value);
    },
    async list(collection: string) {
      return [...(store.get(collection)?.keys() ?? [])];
    },
    async listValues<T>(collection: string) {
      return [...(store.get(collection)?.values() ?? [])] as T[];
    },
  };
}

let configuredDb: KVStore | null = null;

async function getDb(): Promise<KVStore> {
  if (configuredDb) return configuredDb;
  try {
    const config = loadFpConfig();
    const dbConfig = toDbConfig(config);
    configuredDb = await createStore(dbConfig, {
      get: async () => undefined,
    }, config.credentials?.firestoreCredentialId);
  } catch {
    configuredDb = makeMemoryDb();
  }
  return configuredDb;
}

let dbPromise: Promise<KVStore> | null = null;

const ctxFactory = () => {
  dbPromise ??= getDb();
  return {
    credentials: {
      get: async (id: string) => {
        const envVar = `GAUDI_${id.toUpperCase().replace(/[.-]/g, "_")}`;
        return process.env[envVar];
      },
      has: async (id: string) => {
        const envVar = `GAUDI_${id.toUpperCase().replace(/[.-]/g, "_")}`;
        return Boolean(process.env[envVar]);
      },
    },
    logger: console,
    dryRun: false,
    db: dbPromise,
  };
};

runFeatureCli({ registry });

import type { CredentialProvider, Logger } from "@gaudi/core";

export const CREDENTIAL_ENV: Record<string, string> = {
  "todolists.llull-token": "GAUDI_TODOLISTS_LLULL_TOKEN",
  "todolists.firebase-sa": "GAUDI_TODOLISTS_FIREBASE_SA",
  // Credential DAO de plataforma (~/.gaudi/gaudi.yaml → firestoreCredentialId):
  // l'owner és user.profile. Sense aquest mapping, createStore queia SILENCIÓS
  // a memòria i els todolists es perdien (patró Error 3, report 2026-08-20).
  "user.firebase-sa": "GAUDI_USER_FIREBASE_SA",
};

function parseValue(raw: string | undefined): string | object | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      // no és JSON: string
    }
  }
  return raw;
}

export function createEnvCredentialProvider(): CredentialProvider {
  return {
    async get(id: string) {
      const envVar = CREDENTIAL_ENV[id];
      return parseValue(envVar ? process.env[envVar] : undefined);
    },
    async has(id: string) {
      const envVar = CREDENTIAL_ENV[id];
      return Boolean(envVar && process.env[envVar]);
    },
  };
}

export const noopCredentials: CredentialProvider = {
  get: async () => undefined,
  has: async () => false,
};

export function noopLogger(): Logger {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

/** Logger visible (stderr): default del runtime — la degradació de DAO s'ha de VEURE (D1). */
export function stderrLogger(): Logger {
  return {
    info: () => {},
    warn: (m) => process.stderr.write(`${m}\n`),
    error: (m) => process.stderr.write(`${m}\n`),
  };
}

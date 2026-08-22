import type { CredentialProvider, Logger } from "@gaudi/core";
import { createChainedCredentialProvider, PLATFORM_CORE_ENV } from "@gaudi/core";

const CREDENTIAL_CHAINS: Record<string, string[]> = {
  // Llull: token propi SI existeix; sinó el token core de plataforma.
  "todolists.llull-token": ["GAUDI_TODOLISTS_LLULL_TOKEN", PLATFORM_CORE_ENV.llullToken],
  // SA pròpia SI existeix; sinó la SA única de plataforma.
  "todolists.firebase-sa": ["GAUDI_TODOLISTS_FIREBASE_SA", PLATFORM_CORE_ENV.firebaseSa],
  "user.firebase-sa": [PLATFORM_CORE_ENV.firebaseSa],
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
  return createChainedCredentialProvider(CREDENTIAL_CHAINS);
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

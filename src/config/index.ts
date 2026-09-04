import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import type { DbConfig } from "@gaudi/core";

/** Config global absent: l'únic cas legítim de degradació a memòria (CLI standalone). */
export class NoGaudiConfigError extends Error {
  constructor(public readonly path: string) {
    super(`No se encuentra ${path}`);
    this.name = "NoGaudiConfigError";
  }
}

export interface FpConfig {
  database: {
    provider: "postgres";
    postgres?: { url: string };
  };
  credentials?: {
    backend: "env" | "secret-manager";
  };
}

/** Path de la config global, resolt PER CRIDA (permet aïllar HOME a tests). */
export function gaudiYamlPath(): string {
  return join(homedir(), ".gaudi", "gaudi.yaml");
}

/** Config global de la plataforma: ~/.gaudi/gaudi.yaml. El usuario elige DAO y backend una vez. */
export function loadFpConfig(path = gaudiYamlPath()): FpConfig {
  if (!existsSync(path)) throw new NoGaudiConfigError(path);
  try {
    return YAML.parse(readFileSync(path, "utf8")) as FpConfig;
  } catch (err) {
    throw new Error(`No s'ha pogut llegir ${path}: ${(err as Error).message}`);
  }
}

export function toDbConfig(cfg: FpConfig): DbConfig {
  return {
    provider: cfg.database.provider,
    postgres: cfg.database.postgres,
  };
}

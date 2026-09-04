/**
 * Tests de CONTRACTO del runtime DAO (personal.todolists) — mateix patró de
 * l'Error 3 (report 2026-08-20) detectat per Ona: credential DAO no mapat →
 * fallback silenciós a memòria → pèrdua de dades.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEnvCredentialProvider } from "../dist/config/credentials.js";
import { PLATFORM_CORE_ENV } from "@gaudi/core";
import { buildRuntime } from "../dist/runtime.js";

let savedHome: string | undefined;
let tmpHome: string | undefined;

beforeEach(() => {
  savedHome = process.env.HOME;
  tmpHome = mkdtempSync(join(tmpdir(), "gaudi-todo-rt-"));
  process.env.HOME = tmpHome;
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  if (tmpHome) rmSync(tmpHome, { recursive: true, force: true });
});

test("cadena llull-token: cau al core (K3s ONLY)", async () => {
  process.env[PLATFORM_CORE_ENV.llullToken] = "core-llull";
  const p = createEnvCredentialProvider();
  assert.equal(await p.get("todolists.llull-token"), "core-llull");
  // Zero-Firebase: todolists.firebase-sa eliminat
  assert.equal(await p.has("todolists.firebase-sa"), false);
});

test("fail-hard: config postgres sense URL → reject explícit (K3s ONLY)", async () => {
  mkdirSync(join(tmpHome!, ".gaudi"), { recursive: true });
  writeFileSync(join(tmpHome!, ".gaudi", "gaudi.yaml"), "database:\n  provider: postgres\n  postgres:\n    url: postgres://gaudi:gaudi@127.0.0.1:1/does-not-exist\n");
  await assert.rejects(
    () => buildRuntime(),
    (err: unknown) => {
      assert.match((err as Error).message, /postgres|DAO configurat/i);
      return true;
    }
  );
});

test("degradació visible: sense gaudi.yaml → memòria amb avís", async () => {
  const warnings: string[] = [];
  const { ctx } = await buildRuntime({
    logger: { info() {}, warn: (m: string) => warnings.push(m), error() {} },
  });
  assert.equal(ctx.db.name, "memory");
  assert.ok(warnings.some((w) => /MEMÒRIA/.test(w)));
});

test("noConfig → memòria directa (mode tests)", async () => {
  const { ctx } = await buildRuntime({ noConfig: true });
  assert.equal(ctx.db.name, "memory");
});

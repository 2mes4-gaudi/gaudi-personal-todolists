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
import { CREDENTIAL_ENV } from "../dist/config/credentials.js";
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

test("CREDENTIAL_ENV mapeja user.firebase-sa → GAUDI_USER_FIREBASE_SA", () => {
  assert.equal(CREDENTIAL_ENV["user.firebase-sa"], "GAUDI_USER_FIREBASE_SA");
});

test("fail-hard: config firestore + credencial no disponible → reject explícit", async () => {
  mkdirSync(join(tmpHome!, ".gaudi"), { recursive: true });
  writeFileSync(join(tmpHome!, ".gaudi", "gaudi.yaml"),
    "database:\n  provider: firestore\n  firestore:\n    project: makeyourcrew\ncredentials:\n  backend: env\n  firestoreCredentialId: user.firebase-sa\n");
  await assert.rejects(
    () => buildRuntime(),
    (err: unknown) => {
      assert.match((err as Error).message, /user\.firebase-sa/);
      assert.match((err as Error).message, /no disponible/i);
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, "..", "dist", "bin.js");

test("personal.todolists.health: output estàndard (ok + components) amb DAO ok (SPEC §18)", () => {
  // HOME aïllat (patró D1): el test NO depèn de la config global de la màquina.
  const home = mkdtempSync(join(tmpdir(), "gaudi-todo-health-"));
  const out = execFileSync("node", [BIN, "todo", "health", "--json"], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, GAUDI_NO_ENV_LOAD: "1" },
  });
  const raw = out.trim();
  const json = JSON.parse(raw.slice(raw.indexOf("{"))) as { ok: boolean; components: Array<{ name: string; ok: boolean }> };
  assert.equal(typeof json.ok, "boolean");
  assert.ok(Array.isArray(json.components) && json.components.length > 0, "components no buit");
  const dao = json.components.find((c) => c.name === "dao");
  assert.ok(dao, "component dao present");
  assert.equal(dao.ok, true, "DAO ok (memòria si no hi ha config)");
});

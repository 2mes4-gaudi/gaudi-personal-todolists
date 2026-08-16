#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { buildRuntime } from "./runtime.js";
import { buildTodoCli } from "./adapters/cli/index.js";

const manifestFile = fileURLToPath(new URL("../gaudi-feature.yaml", import.meta.url));
let info = { name: "todo", description: "Llistes personals (personal.todolists)", version: "0.1.0" };
try {
  const m = YAML.parse(readFileSync(manifestFile, "utf8")) as { description?: string; version?: string };
  info = { name: "todo", description: m.description ?? info.description, version: m.version ?? info.version };
} catch {
  // defaults
}

const { registry, ctx } = await buildRuntime();
buildTodoCli(registry, info, () => ctx).parse(process.argv);

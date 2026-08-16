import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRuntime } from "./runtime.js";
import { createApp } from "./adapters/api/index.js";

const { registry, ctx } = await buildRuntime();
const app = createApp(registry, () => ctx);

// UI embebida (modelo unificado API+UI): estáticos + SPA fallback (SPEC §8).
const uiDist = fileURLToPath(new URL("../ui/dist", import.meta.url));
if (existsSync(uiDist)) {
  app.use("*", serveStatic({ root: uiDist }));
}
app.get("*", (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: `ruta d'API desconeguda: ${c.req.path}` }, 404);
  }
  const index = join(uiDist, "index.html");
  if (!existsSync(index)) {
    return c.json({ error: "UI no construïda (falta ui/dist). Executa: npm --prefix ui run build" }, 404);
  }
  return c.html(readFileSync(index, "utf8"));
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[personal.todolists] API + UI escoltant a http://0.0.0.0:${info.port}`);
});

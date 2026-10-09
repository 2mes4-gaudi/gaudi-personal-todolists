import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const localGaudiUi = resolve(__dirname, "../../gaudi-ui/dist");
const gaudiUiExists = existsSync(localGaudiUi);

// UI relativa (base ./): l'app serveix la UI a l'arrel i la plataforma la
// publica sota <feature>/ (l'API sota <feature>/api). Assets i fetch relatius
// perquè sobrevisquin al path-stripping de l'ingress.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      external: ["firebase/app", "firebase/auth"],
    },
  },
  resolve: {
    alias: gaudiUiExists
      ? [
          { find: "@gaudi/ui/i18n", replacement: resolve(localGaudiUi, "i18n/index.js") },
          { find: "@gaudi/ui", replacement: resolve(localGaudiUi, "index.js") },
        ]
      : [],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      "/health": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});


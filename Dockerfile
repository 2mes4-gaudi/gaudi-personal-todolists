# Imatge ÚNICA del feature: API (Hono) + UI estàtica servida per la mateixa
# app (un sol origen, una sola directiva d'URL: /api + /). Desplegada per
# devops.installer al K3s (un sol pod) o a Firebase (mateix projecte).
# L'installer NOMÉS la baixa de ghcr: el build+push el fa el developer en el
# release (gaudi feature release).
#
# NOTA: `@gaudi/core` és un paquet publicat (gaudi-core) — no hi ha vendoring.
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
RUN npm run build
RUN cd ui && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/ui/dist ./ui/dist
COPY --from=build /app/gaudi-feature.yaml ./gaudi-feature.yaml
EXPOSE 8787
CMD ["node", "dist/server.js"]

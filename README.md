# Llistes personals — personal.todolists

Llistes personals (todo lists): crear llistes amb nom i descripció, afegir/esborrar
items, marcar/desmarcar (individual, bulk i tot), llistes **mestres** instanciables
(snapshot fresh-start), llistes **compartides** (col·laboració total), cerca semàntica
via **Llull** i **UI embebida**.

Estàndard @gaudi (manifest v1.1, 3 capes, DAOs ×2, CLI agente-friendly, API+UI unificades).

## Accions (CLI: `node dist/bin.js todo <action> ... --json`)

| Acció | Descripció | Destructiva |
|---|---|---|
| `todo.list-create` `name [description] [isMaster] [shared]` | Crea una llista | — |
| `todo.list-list` `[isMaster]` | Llistes visibles (seves + compartides) | — |
| `todo.list-get` `id` | Llista + items | — |
| `todo.list-update` `id [name] [description]` | Actualitza metadades (owner) | — |
| `todo.list-delete` `id` | Esborra llista + items en cascada (owner) | ✅ confirm |
| `todo.list-set-master` `id isMaster` | Promou/demou una llista a mestra (owner) | — |
| `todo.list-set-shared` `id shared` | Comparteix/deixa de compartir (owner) | — |
| `todo.list-instantiate` `masterId [name]` | Snapshot fresh-start d'una mestra | — |
| `todo.item-add` `listId text` | Afegeix item (neix pendent) | — |
| `todo.item-remove` `itemId` | Esborra item | ✅ confirm |
| `todo.item-check` `listId itemIds` | Marca: id, `'["id1","id2"]'` o `all` | — |
| `todo.item-uncheck` `listId itemIds` | Desmarca (idem) | — |
| `todo.list-search` `query` | Cerca per nom, descripció i text d'items | — |

`userKey` opcional com a darrer argument en totes (per defecte: uid de `user.profile`
o `GAUDI_TODOLISTS_USER_KEY` → `local`).

## Model de dades (DAOs ×2: postgres i firestore)

- `todolists` (`TodoList`): id, userKey (owner), name, description, isMaster, shared,
  sourceMasterId (traçabilitat d'instància), createdAt, updatedAt.
- `todo_items` (`TodoItem`): id, listId, text, done, createdAt. Cascade a nivell de servei.

## Cerca (Llull, decisión 0007)

- Índexs: `gaudi-personal-todolists-<uid>` (privades) + `gaudi-personal-todolists-shared`
  (compartides). Docs: `list-<id>` (name, description) i `item-<id>` (text, path amb listId).
- `todo.list-search` fa fan-out al teu índex + el compartit i dedupe per id.
- Sense `GAUDI_TODOLISTS_LLULL_TOKEN`: el CRUD funciona igual (indexació omesa amb un
  warning únic) i la cerca degrada a fallback DAO case-insensitive avisant-ho.

## Messaging (cua única `gaudi.notifications`)

Events sobris: `todolist.created`, `todolist.deleted`, `todolist.instantiated`,
`todolist.completed` (transició a tot-marcat, un sol event) i `todolist.shared`.
Sense daemons: tot és reactiu a accions.

## Regles de domini

- **Visibilitat**: cada usuari veu les seves llistes + totes les `shared`; una privada
  aliena és invisible ("no trobada o privada").
- **Owner-only**: `list-update`, `list-delete`, `list-set-master`, `list-set-shared`.
- **Col·laboració total** a les compartides: tothom pot afegir/esborrar/marcar items.
- **Instanciar** només funciona sobre mestres (`isMaster: true`); la instància neix
  privada, no mestra, amb `sourceMasterId` i tots els items pendents (fresh start).

## Credencials i environment

| Env var | Secret | Descripció |
|---|---|---|
| `GAUDI_TODOLISTS_LLULL_TOKEN` | ✅ | Token de Llull (cerca semàntica canònica) |
| `GAUDI_TODOLISTS_LLULL_URL` | — | URL del motor Llull (default `http://localhost:8080`) |
| `GAUDI_TODOLISTS_FIREBASE_SA` | ✅ | Service account (Firestore + Pub/Sub) |
| `GAUDI_TODOLISTS_USER_KEY` | — | userKey per defecte (default `local`) |

Dependències: `user.profile` (identitat/uid) i `projects.manager` (servei de plataforma Llull).

## API + UI (una sola imatge)

- `GET /health` · `GET /api/health` · `GET /api/registry` (accions) · `GET /api/views`
- `POST /api/actions/:id` — endpoint genèric (paritat CLI/API)
- REST de conveniència per a la UI: `/api/lists*`, `/api/lists/:id/items`,
  `/api/lists/:id/check|uncheck|master|shared|instantiate`, `/api/items/:itemId`, `/api/search?q=`
- UI embebida (Vite+React, `ui/`) servida a l'arrel amb SPA fallback — patró
  `files.manager` (model unificat API+UI, SPEC §8).

## Testing

- Unitari de contracte: `npm test` (24 casos: registry, CRUD, mestres/shared, cerca
  Llull+fallback, events, paritat CLI/API).
- Acceptació E2E al sandbox: `bash workspace/core/sandbox/run-tests.sh <dir>`
  (13 casos a `tests/acceptance/`).

## Release

```bash
node workspace/core/dist/cli.js feature release <dir> --changelog "..." --push-images --push-tag
# → hook del registry publica la versió al catàleg central automàticament
```

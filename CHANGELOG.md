# Changelog

## [v0.1.0] - 2026-08-16

Primera versió del feature `personal.todolists`.

### Afegit

- Llistes personals: crear, llistar, veure, actualitzar i esborrar llistes amb
  nom + descripció (cascade d'items, confirmació de destructives).
- Items: afegir, esborrar, marcar/desmarcar individual, en bulk (array JSON)
  i tot (`all`).
- Llistes mestres (`isMaster`): qualsevol llista pot ser plantilla;
  `list-instantiate` crea un snapshot independent fresh-start amb
  `sourceMasterId` (decisió 0007/v1).
- Llistes compartides (`shared`): privades per defecte; compartir les fa
  visibles i editables per tothom de la instal·lació (col·laboració total,
  accions d'owner reservades).
- Cerca semàntica via Llull des de v1 (decisió 0007): índexs
  `gaudi-personal-todolists-<uid>` + `gaudi-personal-todolists-shared`,
  fan-out i dedupe; fallback DAO case-insensitive sense token (amb warning).
- Events sobris a `gaudi.notifications`: `todolist.created/deleted/
  instantiated/completed/shared`.
- UI embebida (Vite+React, patró files.manager, guies UI de la plataforma):
  llista de llistes, detall amb checkboxes i afegir items, formulari de creació,
  cerca, badges de mestra/compartida, instanciar, compartir, marcar-ho-tot.
- CLI agente-friendly (`todo <action> --json`, `--dry-run`, `--yes`), API Hono
  (`/api/actions/:id` + REST de conveniència) amb paritat CLI/API.
- Tests: 24 unitaris de contracte + 13 casos d'acceptació E2E al sandbox.

## [0.1.0] - 2026-08-16

- Primera versió: llistes personals (CRUD llistes+items, marcar bulk/all, mestres instanciables fresh-start, compartides col·laboratives, cerca Llull+fallback, events sobris, UI embebida). Tests: 24 unit + 13 E2E sandbox.

## [0.1.0] - 2026-08-16

- Primera versió: llistes personals (CRUD llistes+items, marcar bulk/all, mestres instanciables fresh-start, compartides col·laboratives, cerca Llull+fallback, events sobris, UI embebida). Tests: 24 unit + 13 E2E sandbox.

## [0.1.1] - 2026-08-17

- Acció health (SPEC §18): DAO + elements externs declarats, output estàndard {ok, components}, API /health servida des del registry, consumible per gaudi health i el healthcheck del runtime

## [0.1.2] - 2026-08-17

- feat(§8/§17): declara ui.app (app card del launcher — apps derivadas del directorio de features)

## [0.1.3] - 2026-08-17

- fix(api): loadUi normalitza el format ui {app, views}

## [0.1.4] - 2026-08-21

- Fix DAO no persisteix: mapping user.firebase-sa + fail-hard (D1) + @gaudi/core v1.4.1 (bus snake_case).

## [0.1.5] - 2026-08-22

- Credencials en cadena (@gaudi/core v1.5.0): llull-token i firebase-sa cau al core per defecte.

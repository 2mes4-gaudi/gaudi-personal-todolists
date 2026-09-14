---
name: Llistes personals
description: "Domain skill for Llistes personals: use when the user requests operations related to Llistes personals."
---

# Llistes personals — personal.todolists

## What does el feature

Listas personales (todo lists) with items marcables:

- **Listas**: nombre + descripción (la descripción explica el propósito — úsala al create).
- **Items**: texto + state hecho/pendiente. Minimal por diseño: sin fechas ni prioridades.
- **Listas maestras** (`isMaster`): plantillas. Instanciar create un **snapshot independiente**
  with los mismos textos pero **todos los items pendentes** (fresh start) y `sourceMasterId`
  for trazabilidad. La maestra conserva su propio state.
- **Listas compartidas** (`shared`): visibles y editables por **todos** los users de la
  instalación (añadir/borrar items, marcar). Solo el **owner** puede borrar la list,
  cambiar nombre/descripción o tocar los flags.
- **Búsqueda**: semántica vía Llull (listas + items) with degradación automática a fallback
  DAO case-insensitive when no hay token (`engine: "dao-fallback"` + `warning`).

## How ejecutar acciones

CLI agente-friendly vía `node dist/bin.js todo <action> ...`. **Always `--json`**.

```bash
node dist/bin.js todo --help

# Crear lista (descripción recomendada: explica el propósito para poder buscarla)
node dist/bin.js todo list-create "Compra setmanal" "Coses que cal comprar cada setmana" --json

# Crear MAESTRA / compartida (flags posicionales: name [description] [isMaster] [shared])
node dist/bin.js todo list-create "Viatges" "Template de viatges" true --json

# Listar (propias + compartidas; filtro de maestras)
node dist/bin.js todo list-list --json
node dist/bin.js todo list-list true --json

# Ver una lista con sus items
node dist/bin.js todo list-get <listId> --json

# Items: añadir / borrar / marcar / desmarcar
node dist/bin.js todo item-add <listId> "Pa" --json
node dist/bin.js todo item-remove <itemId> --yes --json
node dist/bin.js todo item-check <listId> <itemId> --json          # uno
node dist/bin.js todo item-check <listId> '["id1","id2"]' --json   # varios (JSON)
node dist/bin.js todo item-check <listId> "all" --json             # toda la lista
node dist/bin.js todo item-uncheck <listId> "all" --json

# Mestras y compartidas
node dist/bin.js todo list-set-master <listId> true --json
node dist/bin.js todo list-set-shared <listId> true --json

# Instanciar una maestra (fresh start, copia independiente)
node dist/bin.js todo list-instantiate <masterId> "Viatge setembre" --json

# Buscar listas/items por propósito, nombre o contenido
node dist/bin.js todo list-search "compra" --json

# Editar metadatos (owner) / borrar lista (owner, cascada de items)
node dist/bin.js todo list-update <listId> "Compra gran" --json
node dist/bin.js todo list-delete <listId> --yes --json
```

Nota: `itemIds` admite un id, un array JSON o la palabra `all`. Los ids se obtienen de
`list-get` / `list-list` / `list-search` (campo `id`; en los hits de búsqueda, quita el
prefijo: `item-xxx` → item, `list-xxx` → list).

## Política de confirmación

- `list-delete` e `item-remove` are `destructive: true` (`confirm: required`): proponer
  first with `--dry-run`, mostrar el plan al humano y esperar `--yes` explícito.
  Sin `--yes` el CLI responde `CONFIRM_REQUIRED` (exit 2) — pide confirmación humana.
- `list-delete` borra la list Y todos sus items en cascada: verifica always with
  `list-get` before de proponer el borrado.

## Reglas de dominio

- **Visibilidad**: cada user ve sus listas + todas las `shared`. Una list privada
  ajena is invisible (error "no trobada o privada" — no filtres el mensaje).
- **Owner-only**: `list-update`, `list-delete`, `list-set-master`, `list-set-shared`.
- **Colaboración total** en compartidas: cualquiera puede añadir/quitar/marcar items.
- **Instanciar** solo funciona about maestras (`isMaster: true`) y la instancia nace
  privada, no maestra y with todos los items pendentes.
- **Identidad**: el `userKey` va opcional al final de cada acción (por defecto el del
  runtime: uid de `user.profile` o `GAUDI_TODOLISTS_USER_KEY`).

## Eventos (cua única)

El feature publica a `gaudi.notifications`: `todolist.created`, `todolist.deleted`,
`todolist.instantiated`, `todolist.completed` (transición a todo marcado, un solo event)
y `todolist.shared`. No hay eventos por item individual — el detalle se query al feature.

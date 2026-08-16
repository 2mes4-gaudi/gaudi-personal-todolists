---
name: Llistes personals
description: "Skill de domini del feature personal.todolists: crear i mantindre llistes (afegir, esborrar, marcar individual/bulk/tot), llistes mestres instanciables (fresh start), llistes compartides amb col·laboració total i cerca per nom, descripció o text d'items (Llull amb fallback DAO). Usar quan l'usuari parli de llistes, coses pendents, plantilles de llistes o demani cercar on té apuntat alguna cosa."
---

# Llistes personals — personal.todolists

## Qué hace el feature

Listas personales (todo lists) con items marcables:

- **Listas**: nombre + descripción (la descripción explica el propósito — úsala al crear).
- **Items**: texto + estado hecho/pendiente. Minimal por diseño: sin fechas ni prioridades.
- **Listas maestras** (`isMaster`): plantillas. Instanciar crea un **snapshot independiente**
  con los mismos textos pero **todos los items pendentes** (fresh start) y `sourceMasterId`
  para trazabilidad. La maestra conserva su propio estado.
- **Listas compartidas** (`shared`): visibles y editables por **todos** los usuarios de la
  instalación (añadir/borrar items, marcar). Solo el **owner** puede borrar la lista,
  cambiar nombre/descripción o tocar los flags.
- **Búsqueda**: semántica vía Llull (listas + items) con degradación automática a fallback
  DAO case-insensitive cuando no hay token (`engine: "dao-fallback"` + `warning`).

## Cómo ejecutar acciones

CLI agente-friendly vía `node dist/bin.js todo <action> ...`. **Siempre `--json`**.

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
prefijo: `item-xxx` → item, `list-xxx` → lista).

## Política de confirmación

- `list-delete` e `item-remove` son `destructive: true` (`confirm: required`): proponer
  primero con `--dry-run`, mostrar el plan al humano y esperar `--yes` explícito.
  Sin `--yes` el CLI responde `CONFIRM_REQUIRED` (exit 2) — pide confirmación humana.
- `list-delete` borra la lista Y todos sus items en cascada: verifica siempre con
  `list-get` antes de proponer el borrado.

## Reglas de dominio

- **Visibilidad**: cada usuario ve sus listas + todas las `shared`. Una lista privada
  ajena es invisible (error "no trobada o privada" — no filtres el mensaje).
- **Owner-only**: `list-update`, `list-delete`, `list-set-master`, `list-set-shared`.
- **Colaboración total** en compartidas: cualquiera puede añadir/quitar/marcar items.
- **Instanciar** solo funciona sobre maestras (`isMaster: true`) y la instancia nace
  privada, no maestra y con todos los items pendentes.
- **Identidad**: el `userKey` va opcional al final de cada acción (por defecto el del
  runtime: uid de `user.profile` o `GAUDI_TODOLISTS_USER_KEY`).

## Eventos (cua única)

El feature publica a `gaudi.notifications`: `todolist.created`, `todolist.deleted`,
`todolist.instantiated`, `todolist.completed` (transición a todo marcado, un solo event)
y `todolist.shared`. No hay eventos por item individual — el detalle se consulta al feature.

---
name: personal
description: "Skill de dominio del feature personal.todolists: Llistes personals (todo lists): crear llistes amb nom i descripcio, afegir/esborrar items, marcar/desmarcar (individual, bulk i tot), llistes mestres instanciables (snapshot fresh-start), llistes compartides (colaboracio total), cerca semantica via Llull i UI embebida.. Actívame cuando el agente necesite usar las acciones de este feature (personal.hello, personal.greetings.list)."
---

# Llistes personals — personal.todolists

## Cómo ejecutar acciones

El feature expone un CLI agente-friendly vía `npx personal` o `node dist/bin.js`.
Siempre usa `--json` para que el resultado sea parseable.

```bash
# Listar acciones disponibles
node dist/bin.js --help

# Ejecutar una acción (no destructiva)
node dist/bin.js personal.hello <nombre> --json
```

## Política de confirmación

- Acciones con `destructive: false` → ejecución autónoma.
- Acciones con `confirm: required` → proponer primero con `--dry-run`, mostrar
  el plan al humano y esperar `--yes` explícito.
- Acciones con `confirm: always` → exigir confirmación humana explícita siempre.

## Base de datos

El feature usa el DAO configurado en `~/.gaudi/gaudi.yaml` (`firestore` o `postgres`).
No especifiques la BD desde el agente: la lógica es transparente.

## Credenciales

Las credenciales las gestiona `core.credentials`. Si una acción requiere una
credencial ausente, el CLI devuelve `CONFIRM_REQUIRED` o un error de credencial;
en ese caso solicita al usuario que configure `~/.gaudi/gaudi.yaml` o las env vars.

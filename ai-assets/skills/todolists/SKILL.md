---
name: todolists
description: "Skill de gestió de llistes personals i tasques (personal.todolists): crear llistes, afegir/esborrar ítems, marcar/desmarcar, llistes mestres, compartides i cerca semàntica a Llull."
---

# Llistes personals — personal.todolists

Aquest skill permet gestionar les llistes personals de tasques (todo lists) de l'usuari a la plataforma Gaudi.

## Què fa el feature

- **Llistes**: Nom + descripció (la descripció explica el propòsit; útil per cercar).
- **Ítems**: Text + estat fet/pendent.
- **Llistes mestres (`isMaster`)**: Plantilles reutilitzables. Instanciar una llista mestra crea una còpia independent amb tots els ítems pendents (*fresh start*).
- **Llistes compartides (`shared`)**: Visibles i editables per tots els usuaris de la plataforma (col·laboració total per afegir o marcar ítems). Només el creador pot esborrar la llista o canviar metadades.
- **Cerca**: Cerca semàntica a Llull sobre títols, descripcions i contingut dels ítems, amb fallback automàtic a cerca de base de dades.

---

## Comandes CLI (`todo`)

Execució directe mitjançant el binari `todo` o a través del catàleg del Kernel:

```bash
# Crear llista nova
node dist/bin.js todo list-create "Nom de la llista" "Descripció" --json

# Crear llista mestra (plantilla)
node dist/bin.js todo list-create "Viatges" "Plantilla de viatge" true --json

# Llistar llistes existents
node dist/bin.js todo list-list --json

# Obtenir el detall d'una llista i els seus ítems
node dist/bin.js todo list-get <listId> --json

# Afegir un ítem a la llista
node dist/bin.js todo item-add <listId> "Comprar pomes" --json

# Marcar un ítem com a fet (accepta itemId, JSON array o "all")
node dist/bin.js todo item-check <listId> <itemId> --json
node dist/bin.js todo item-check <listId> "all" --json

# Desmarcar un ítem
node dist/bin.js todo item-uncheck <listId> <itemId> --json

# Eliminar un ítem (destructiva: requereix --yes)
node dist/bin.js todo item-remove <itemId> --yes --json

# Instanciar una plantilla mestra
node dist/bin.js todo list-instantiate <masterId> "Nom de la nova llista" --json

# Cerca semàntica
node dist/bin.js todo list-search "compra" --json

# Esborrar llista (destructiva: requereix --yes)
node dist/bin.js todo list-delete <listId> --yes --json
```

---

## Execució via Kernel Functionalities

Pots executar qualsevol acció directament mitjançant les funcionalitats registrades al Kernel:

```bash
# Crear llista
gaudi kernel functionalities run personal.todolists.todo.list-create \
  --payload '{"name": "Viatge a Menorca", "description": "Equipatge i reserves"}' \
  --json

# Afegir ítem
gaudi kernel functionalities run personal.todolists.todo.item-add \
  --payload '{"listId": "<listId>", "text": "Bitllets de vaixell"}' \
  --json

# Marcar ítem
gaudi kernel functionalities run personal.todolists.todo.item-check \
  --payload '{"listId": "<listId>", "itemIds": ["<itemId>"]}' \
  --json
```

---

## Política de Seguretat i Confirmació

- Les accions `list-delete` i `item-remove` són destructives (`destructive: true`). Si s'executen sense `--yes`, retornen `CONFIRM_REQUIRED`.
- Demana sempre confirmació a l'usuari abans d'esborrar llistes o ítems.

---

## Enllaços (compartir llistes amb l'usuari)

Quan presentis una llista a l'usuari, acompanya SEMPRE la resposta amb el
deep-link canònic del launcher, en **Markdown RELATIU** (mai domini absolut —
el connector del kernel l'absolutitza per al canal i el converteix en botó):

```
[✅ Obre la llista <nom>](/app/personal-todolists?list=<listId>)
```

- Llista general: `[✅ Obre les teves Llistes](/app/personal-todolists)`
- MAI enllaços de fitxer/Finder per a llistes (no són documents).
- MAI URLs absolutes amb domini escrit per tu, ni URLs inventades.
- Si no coneixes el `listId`, consulta'l primer (`todo list-list --json`).

Exemple de resposta:

```
Fet! He creat la llista d'enchiladas amb 11 ingredients.

[✅ Obre la llista Enchiladas 8 persones](/app/personal-todolists?list=7facd64e-937e-4240-b6b0-6bb15c8abe41)
```

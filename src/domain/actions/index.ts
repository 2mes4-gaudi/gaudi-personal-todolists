import { z } from "zod";
import { createRegistry, type ActionRegistry, type ServiceContext } from "@gaudi/core";
import type { TodoContext } from "../../ports/context.js";
import {
  listCreateInput, listListInput, listGetInput, listUpdateInput, listDeleteInput,
  listSetMasterInput, listSetSharedInput, listInstantiateInput,
  itemAddInput, itemRemoveInput, itemCheckInput, listSearchInput,
  listOutput, listsOutput, listGetOutput, listDeleteOutput, instantiateOutput,
  itemOutput, itemRemoveOutput, itemCheckOutput, searchOutput,
} from "../model/todolist.js";
import {
  createList, listLists, getListWithItems, updateList, deleteList,
  setMaster, setShared, instantiateList,
} from "../../services/list-service.js";
import { addItem, removeItem, checkItems, uncheckItems } from "../../services/item-service.js";
import { searchLists } from "../../services/search-service.js";

function register<In, Out>(
  registry: ActionRegistry,
  def: {
    id: string;
    description: string;
    inputSchema: z.ZodType<In>;
    outputSchema: z.ZodType<Out>;
    handler: (input: In, ctx: TodoContext) => Promise<Out>;
    meta?: { destructive?: boolean; confirm?: "none" | "required" | "always"; permission?: string };
  }
) {
  registry.register<In, Out>({
    ...def,
    handler: def.handler as unknown as (input: In, ctx: ServiceContext) => Promise<Out>,
  });
}

/**
 * Registry del feature: UNA acció = UNA font de veritat.
 * El CLI, les tools d'agent (Mastra/MCP), l'API i la doc del skill es generen d'aquí.
 */
export function buildRegistry(): ActionRegistry {
  const registry = createRegistry();

  register(registry, {
    id: "todo.list-create",
    description:
      "Crea una llista amb nom i descripció (opcional). Flags: isMaster (plantilla instanciable) i shared (compartida amb tothom, col·laboració total). Publica todolist.created i indexa a Llull.",
    inputSchema: listCreateInput,
    outputSchema: listOutput,
    handler: async (input, ctx) => ({ list: await createList(input, ctx) }),
    meta: { destructive: false },
  });

  register(registry, {
    id: "todo.list-list",
    description:
      "Llista les llistes visibles per a l'usuari (seves + compartides). Filtre opcional isMaster per veure només les mestres.",
    inputSchema: listListInput,
    outputSchema: listsOutput,
    handler: async (input, ctx) => ({ lists: await listLists(input, ctx) }),
    meta: { destructive: false },
  });

  register(registry, {
    id: "todo.list-get",
    description: "Obté una llista amb els seus items (ordenats per creació). Visible si és teva o compartida.",
    inputSchema: listGetInput,
    outputSchema: listGetOutput,
    handler: async (input, ctx) => getListWithItems(input, ctx),
    meta: { destructive: false },
  });

  register(registry, {
    id: "todo.list-update",
    description: "Actualitza nom o descripció d'una llista (només el propietari) i la reindexa a Llull.",
    inputSchema: listUpdateInput,
    outputSchema: listOutput,
    handler: async (input, ctx) => ({ list: await updateList(input, ctx) }),
    meta: { destructive: false, permission: "todolists.write" },
  });

  register(registry, {
    id: "todo.list-delete",
    description:
      "Esborra una llista i TOTS els seus items en cascada (només el propietari). Desindexa de Llull i publica todolist.deleted.",
    inputSchema: listDeleteInput,
    outputSchema: listDeleteOutput,
    handler: async (input, ctx) => deleteList(input, ctx),
    meta: { destructive: true, confirm: "required", permission: "todolists.delete" },
  });

  register(registry, {
    id: "todo.list-set-master",
    description:
      "Marca (o desmarca) una llista com a MAESTRA: plantilla per instanciar (només el propietari). Qualsevol llista pot ser-ho.",
    inputSchema: listSetMasterInput,
    outputSchema: listOutput,
    handler: async (input, ctx) => ({ list: await setMaster(input, ctx) }),
    meta: { destructive: false, permission: "todolists.write" },
  });

  register(registry, {
    id: "todo.list-set-shared",
    description:
      "Marca (o desmarca) una llista com a COMPARTIDA: visible i editable per tothom de la instal·lació (només el propietari la pot compartir). Mou els documents entre índexs Llull i publica todolist.shared.",
    inputSchema: listSetSharedInput,
    outputSchema: listOutput,
    handler: async (input, ctx) => ({ list: await setShared(input, ctx) }),
    meta: { destructive: false, permission: "todolists.write" },
  });

  register(registry, {
    id: "todo.list-instantiate",
    description:
      "Instancia una llista mestra: snapshot independent amb els mateixos textos però TOTS els items pendents (fresh start). La instància recorda sourceMasterId. Publica todolist.instantiated.",
    inputSchema: listInstantiateInput,
    outputSchema: instantiateOutput,
    handler: async (input, ctx) => instantiateList(input, ctx),
    meta: { destructive: false },
  });

  register(registry, {
    id: "todo.item-add",
    description:
      "Afegeix un item (text) a una llista visible: neix pendent. A les compartides hi pot afegir tothom (col·laboració total). S'indexa a Llull.",
    inputSchema: itemAddInput,
    outputSchema: itemOutput,
    handler: async (input, ctx) => ({ item: await addItem(input, ctx) }),
    meta: { destructive: false, permission: "todolists.write" },
  });

  register(registry, {
    id: "todo.item-remove",
    description: "Esborra un item d'una llista visible i el desindexa de Llull.",
    inputSchema: itemRemoveInput,
    outputSchema: itemRemoveOutput,
    handler: async (input, ctx) => removeItem(input, ctx),
    meta: { destructive: true, confirm: "required", permission: "todolists.write" },
  });

  register(registry, {
    id: "todo.item-check",
    description:
      "Marca items com a fets: itemIds admet un id, un array JSON d'ids o \"all\". Quan la llista passa a tot-marcat publica todolist.completed (un sol event per transició).",
    inputSchema: itemCheckInput,
    outputSchema: itemCheckOutput,
    handler: async (input, ctx) => checkItems(input, ctx),
    meta: { destructive: false, permission: "todolists.write" },
  });

  register(registry, {
    id: "todo.item-uncheck",
    description:
      "Desmarca items (tornen a pendents): itemIds admet un id, un array JSON d'ids o \"all\".",
    inputSchema: itemCheckInput,
    outputSchema: itemCheckOutput,
    handler: async (input, ctx) => uncheckItems(input, ctx),
    meta: { destructive: false, permission: "todolists.write" },
  });

  register(registry, {
    id: "todo.list-search",
    description:
      "Cerca semàntica de llistes i items per nom, descripció i text (motor Llull: fan-out índex propi + compartit). Sense token de Llull degrada a fallback DAO case-insensitive avisant-ho.",
    inputSchema: listSearchInput,
    outputSchema: searchOutput,
    handler: async (input, ctx) => searchLists(input, ctx),
    meta: { destructive: false },
  });

  return registry;
}

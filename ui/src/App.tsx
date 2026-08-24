import { useCallback, useEffect, useState } from "react";
import { AppShell, Badge, Button, Dialog, EmptyState, Field, Icon, Input, ListItem, Stack, Textarea, Toast, type ToastKind } from "@gaudi/ui";
import { api, type SearchHit, type TodoItem, type TodoList } from "./api";

// ── Tipus de vista ──────────────────────────────────────────────────────────

type View = { kind: "lists" } | { kind: "detail"; id: string } | { kind: "search"; q: string };

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>({ kind: "lists" });
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);

  const notify = useCallback((kind: ToastKind, text: string) => setToast({ kind, text }), []);

  return (
    <AppShell>
      {view.kind === "lists" && <ListsView open={(id) => setView({ kind: "detail", id })} onSearch={(q) => setView({ kind: "search", q })} />}
      {view.kind === "detail" && <DetailView id={view.id} back={() => setView({ kind: "lists" })} notify={notify} />}
      {view.kind === "search" && <SearchView q={view.q} back={() => setView({ kind: "lists" })} open={(id) => setView({ kind: "detail", id })} />}
      {toast && <Toast kind={toast.kind}>{toast.text}</Toast>}
    </AppShell>
  );
}

// ── Vista: llista de llistes ────────────────────────────────────────────────

function ListsView({ open, onSearch }: { open: (id: string) => void; onSearch: (q: string) => void }) {
  const [lists, setLists] = useState<TodoList[] | null>(null);
  const [error, setError] = useState("");
  const [mastersOnly, setMastersOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isMaster, setIsMaster] = useState(false);
  const [shared, setShared] = useState(false);
  const [nameError, setNameError] = useState("");
  const [busy, setBusy] = useState(false);

  const onDone = useCallback((id: string) => {
    setCreating(false);
    setName("");
    setDescription("");
    setIsMaster(false);
    setShared(false);
    open(id);
  }, [open]);

  const reload = useCallback(async () => {
    try {
      const out = await api.listLists(mastersOnly || undefined);
      setLists(out.lists);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [mastersOnly]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <Stack>
      <form
        style={{ display: "flex", gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          if (typeof q === "string" && q.trim()) onSearch(q.trim());
        }}
      >
        <Input name="q" type="text" placeholder="Cerca llistes…" aria-label="Cerca llistes" style={{ flex: 1 }} />
        <Button type="submit" aria-label="Cerca" icon={<Icon name="search" />} />
      </form>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="ghost" aria-pressed={mastersOnly} onClick={() => setMastersOnly((v) => !v)}>
          <Icon name="folder" size={18} /> Mestres
        </Button>
        <Button icon={<Icon name="plus" />} onClick={() => setCreating(true)}>Nova llista</Button>
      </div>

      {error && <Toast kind="error">{error}</Toast>}
      {lists === null ? (
        <p className="gaudi-muted">Carregant…</p>
      ) : lists.length === 0 ? (
        <EmptyState message={mastersOnly ? "Encara no hi ha llistes mestres." : "Encara no hi ha llistes. Crea la primera amb Nova llista."} />
      ) : (
        <Stack>
          {lists.map((l) => (
            <ListItem
              key={l.id}
              title={l.name}
              description={l.description}
              meta={
                <div style={{ display: "flex", gap: 4 }}>
                  {l.isMaster && <Badge variant="accent">mestra</Badge>}
                  {l.shared && <Badge variant="success">compartida</Badge>}
                  {l.sourceMasterId && <Badge variant="muted">instància</Badge>}
                </div>
              }
              onClick={() => open(l.id)}
            />
          ))}
        </Stack>
      )}

      <CreateForm
        open={creating}
        onCancel={() => setCreating(false)}
        onDone={onDone}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        isMaster={isMaster}
        setIsMaster={setIsMaster}
        shared={shared}
        setShared={setShared}
        error={error}
        setError={setError}
        busy={busy}
        setBusy={setBusy}
        nameError={nameError}
        setNameError={setNameError}
      />
    </Stack>
  );
}

function CreateForm({ open, onCancel, onDone, name, setName, description, setDescription, isMaster, setIsMaster, shared, setShared, error, setError, busy, setBusy, nameError, setNameError }: {
  open: boolean;
  onCancel: () => void;
  onDone: (id: string) => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  isMaster: boolean;
  setIsMaster: (v: boolean) => void;
  shared: boolean;
  setShared: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  nameError: string;
  setNameError: (v: string) => void;
}) {
  const submit = async () => {
    if (!name.trim()) { setNameError("El nom és obligatori"); return; }
    if (busy) return;
    setBusy(true);
    try {
      const out = await api.createList({
        name: name.trim(),
        description: description.trim() || undefined,
        isMaster,
        shared,
      });
      onDone(out.list.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Nova llista"
      confirmLabel={busy ? "Creant…" : "Crea"}
      cancelLabel="Cancel·la"
      loading={busy}
      onCancel={onCancel}
      onConfirm={() => void submit()}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Nom" htmlFor="new-name" error={nameError}>
          <Input
            id="new-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(""); }}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }}
          />
        </Field>
        <Field label="Descripció (propòsit de la llista)" htmlFor="new-desc">
          <Textarea id="new-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <label style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "center" }}>
          <input type="checkbox" checked={isMaster} style={{ width: 20, height: 20, accentColor: "var(--gaudi-primary)" }}
            onChange={(e) => setIsMaster(e.target.checked)} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Llista mestra (plantilla instanciable)</span>
        </label>
        <label style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "center" }}>
          <input type="checkbox" checked={shared} style={{ width: 20, height: 20, accentColor: "var(--gaudi-primary)" }}
            onChange={(e) => setShared(e.target.checked)} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Compartida amb tothom</span>
        </label>
        {error && <Toast kind="error">{error}</Toast>}
      </div>
    </Dialog>
  );
}

// ── Vista: detall d'una llista ──────────────────────────────────────────────

function DetailView({ id, back, notify }: { id: string; back: () => void; notify: (kind: ToastKind, text: string) => void }) {
  const [list, setList] = useState<TodoList | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmItem, setConfirmItem] = useState<string | null>(null);
  const [instantiating, setInstantiating] = useState(false);

  const reload = useCallback(async () => {
    try {
      const out = await api.getList(id);
      setList(out.list);
      setItems(out.items);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  const toggle = async (item: TodoItem) => {
    const fn = item.done ? api.uncheck : api.check;
    try {
      const out = await fn(id, [item.id]);
      setItems(out.items);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const markAll = async () => {
    const pending = items.filter((i) => !i.done);
    if (pending.length === 0) return;
    try {
      const out = await api.check(id, pending.map((i) => i.id));
      setItems(out.items);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addItem = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      await api.addItem(id, t);
      setText("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await api.removeItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const del = async () => {
    try {
      await api.deleteList(id);
      back();
    } catch (err) {
      setError((err as Error).message);
      setConfirmDelete(false);
    }
  };

  const instantiate = async () => {
    setInstantiating(true);
    try {
      const out = await api.instantiate(id);
      notify("ok", `Instància creada: ${out.list.name} (${out.items.length} items pendents)`);
      back();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInstantiating(false);
    }
  };

  const toggleFlag = async (fn: (v: boolean) => Promise<unknown>, value: boolean) => {
    try {
      await fn(value);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const done = items.filter((i) => i.done).length;
  const allDone = items.length > 0 && done === items.length;

  return (
    <Stack>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button className="gaudi-icon-btn" type="button" aria-label="Enrere" onClick={back}>
          <Icon name="chevron-left" />
        </button>
        <h2 style={{ flex: 1, margin: 0 }}>{list?.name ?? "…"}</h2>
        {list?.isMaster && (
          <button className="gaudi-icon-btn" type="button" aria-label="Instancia aquesta mestra" title="Instancia" disabled={instantiating} onClick={() => void instantiate()}>
            <Icon name="refresh-cw" />
          </button>
        )}
        <button
          className="gaudi-icon-btn"
          type="button"
          aria-label={list?.shared ? "Deixa de compartir" : "Comparteix amb tothom"}
          title={list?.shared ? "Deixa de compartir" : "Comparteix"}
          onClick={() => void toggleFlag((v) => api.setShared(id, v), !list?.shared)}
        >
          <Icon name="globe" />
        </button>
        <button
          className="gaudi-icon-btn"
          type="button"
          aria-label={list?.isMaster ? "Treu el flag de mestra" : "Marca com a mestra"}
          title="Mestra"
          onClick={() => void toggleFlag((v) => api.setMaster(id, v), !list?.isMaster)}
        >
          <Icon name="folder" />
        </button>
        <button className="gaudi-icon-btn gaudi-icon-btn--danger" type="button" aria-label="Esborra la llista" title="Esborra" onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" />
        </button>
      </div>

      {error && <Toast kind="error">{error}</Toast>}
      {list?.description && <p className="gaudi-muted" style={{ margin: 0 }}>{list.description}</p>}
      <div style={{ display: "flex", gap: 4 }}>
        {list?.isMaster && <Badge variant="accent">mestra</Badge>}
        {list?.shared && <Badge variant="success">compartida</Badge>}
        {allDone && <Badge variant="success">completada</Badge>}
      </div>

      {items.length === 0 ? (
        <EmptyState message="Cap item encara. Afegeix el primer ↓" />
      ) : (
        <Stack>
          {items.map((item) => (
            <ListItem
              key={item.id}
              title={
                <span style={item.done ? { textDecoration: "line-through", color: "var(--gaudi-muted)" } : undefined}>
                  {item.text}
                </span>
              }
              actions={
                <div style={{ display: "flex", gap: 2 }}>
                  <button className="gaudi-icon-btn" type="button" aria-label={item.done ? `Desmarca ${item.text}` : `Marca ${item.text}`} aria-pressed={item.done} onClick={() => void toggle(item)}>
                    <Icon name="check" />
                  </button>
                  <button className="gaudi-icon-btn gaudi-icon-btn--danger" type="button" aria-label={`Esborra ${item.text}`} onClick={() => setConfirmItem(item.id)}>
                    <Icon name="x" />
                  </button>
                </div>
              }
            />
          ))}
        </Stack>
      )}

      {items.length > 0 && done < items.length && (
        <Button variant="ghost" block onClick={() => void markAll()}>Marca-ho tot ({items.length - done})</Button>
      )}
      <p className="gaudi-muted" style={{ margin: 0 }}>{done}/{items.length} fets</p>

      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); void addItem(); }}>
        <Input
          type="text"
          value={text}
          placeholder="Afegeix un item…"
          aria-label="Nou item"
          style={{ flex: 1 }}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="cta" disabled={busy || !text.trim()}>Afegeix</Button>
      </form>

      <Dialog
        open={confirmDelete}
        title={`Esborrar «${list?.name ?? ""}»?`}
        danger
        confirmLabel="Esborra"
        cancelLabel="Cancel·la"
        onConfirm={() => void del()}
        onCancel={() => setConfirmDelete(false)}
      >
        <p style={{ margin: 0, color: "var(--gaudi-muted)" }}>
          S'esborrarà la llista i els seus {items.length} items. Acció irreversible.
        </p>
      </Dialog>

      <Dialog
        open={confirmItem !== null}
        title="Esborrar item?"
        danger
        confirmLabel="Esborra"
        cancelLabel="Cancel·la"
        onConfirm={() => {
          const itemId = confirmItem;
          setConfirmItem(null);
          if (itemId) void removeItem(itemId);
        }}
        onCancel={() => setConfirmItem(null)}
      >
        <p style={{ margin: 0, color: "var(--gaudi-muted)" }}>Esborrarà aquest item. No es pot desfer.</p>
      </Dialog>
    </Stack>
  );
}

// ── Vista: resultats de cerca ───────────────────────────────────────────────

function SearchView({ q, back, open }: { q: string; back: () => void; open: (id: string) => void }) {
  const [result, setResult] = useState<{ engine: string; hits: SearchHit[]; warning?: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const out = await api.search(q);
        setResult(out);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [q]);

  const listIdOf = (hit: SearchHit): string | null =>
    hit.type === "list" ? hit.id.replace(/^list-/, "") : hit.listId ?? null;

  return (
    <Stack>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button className="gaudi-icon-btn" type="button" aria-label="Enrere" onClick={back}>
          <Icon name="chevron-left" />
        </button>
        <h2 style={{ flex: 1, margin: 0 }}>Cerca: {q}</h2>
      </div>
      {error && <Toast kind="error">{error}</Toast>}
      {result?.warning && <p style={{ margin: 0, color: "var(--gaudi-warning)" }}>{result.warning}</p>}
      {result === null ? (
        <p className="gaudi-muted">Cercant…</p>
      ) : result.hits.length === 0 ? (
        <EmptyState message={`Cap resultat per «${q}».`} />
      ) : (
        <Stack>
          {result.hits.map((hit) => {
            const target = listIdOf(hit);
            return (
              <ListItem
                key={hit.id}
                title={hit.title}
                description={`${hit.type === "list" ? "llista" : "item"}${hit.snippet ? ` — ${hit.snippet}` : ""}`}
                onClick={() => { if (target) open(target); }}
              />
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

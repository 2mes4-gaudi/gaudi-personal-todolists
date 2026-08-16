import { useCallback, useEffect, useState } from "react";
import { api, type SearchHit, type TodoItem, type TodoList } from "./api";
import "./styles.css";

// ── Icones (Lucide, stroke consistent) ─────────────────────────────────────

const Icon = ({ d, ...p }: { d: string } & React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d={d} />
  </svg>
);
const IPlus = () => <Icon d="M12 5v14M5 12h14" />;
const ISearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const IBack = () => <Icon d="m15 18-6-6 6-6" />;
const ICheck = () => <Icon d="M20 6 9 17l-5-5" />;
const IX = () => <Icon d="M18 6 6 18M6 6l12 12" />;
const ITrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);
const ICopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IShare = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="m16 6-4-4-4 4M12 2v13" />
  </svg>
);
const IStar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
  </svg>
);

// ── Tipus de vista ──────────────────────────────────────────────────────────

type View = { kind: "lists" } | { kind: "detail"; id: string } | { kind: "search"; q: string };

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>({ kind: "lists" });
  return (
    <div className="app">
      {view.kind === "lists" && <ListsView open={(id) => setView({ kind: "detail", id })} onSearch={(q) => setView({ kind: "search", q })} />}
      {view.kind === "detail" && <DetailView id={view.id} back={() => setView({ kind: "lists" })} />}
      {view.kind === "search" && <SearchView q={view.q} back={() => setView({ kind: "lists" })} open={(id) => setView({ kind: "detail", id })} />}
    </div>
  );
}

// ── Vista: llista de llistes ────────────────────────────────────────────────

function ListsView({ open, onSearch }: { open: (id: string) => void; onSearch: (q: string) => void }) {
  const [lists, setLists] = useState<TodoList[] | null>(null);
  const [error, setError] = useState("");
  const [mastersOnly, setMastersOnly] = useState(false);
  const [creating, setCreating] = useState(false);

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
    <>
      <header className="topbar">
        <h1>Llistes</h1>
        <form
          className="searchbar"
          style={{ flex: 1 }}
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            if (typeof q === "string" && q.trim()) onSearch(q.trim());
          }}
        >
          <input name="q" type="text" placeholder="Cerca llistes…" aria-label="Cerca llistes" />
        </form>
        <button className="icon-btn" aria-label="Cerca" onClick={() => { const el = document.querySelector<HTMLInputElement>('input[name="q"]'); el?.focus(); }}>
          <ISearch />
        </button>
        <button className="icon-btn" aria-label="Nova llista" onClick={() => setCreating(true)}>
          <IPlus />
        </button>
      </header>

      <main className="content">
        <div className="filters">
          <button className="chip" aria-pressed={mastersOnly} onClick={() => setMastersOnly((v) => !v)}>
            <IStar /> Mestres
          </button>
        </div>
        {error && <p className="warn" role="alert">{error}</p>}
        {lists === null ? (
          <p className="empty">Carregant…</p>
        ) : lists.length === 0 ? (
          <p className="empty">{mastersOnly ? "Encara no hi ha llistes mestres." : "Encara no hi ha llistes. Crea la primera amb +"} </p>
        ) : (
          lists.map((l) => (
            <ListCard key={l.id} list={l} onOpen={() => open(l.id)} />
          ))
        )}
      </main>

      {creating && (
        <>
          <button className="sheet-backdrop" aria-label="Tanca" onClick={() => setCreating(false)} />
          <CreateSheet
            onDone={(id) => { setCreating(false); open(id); }}
            onCancel={() => setCreating(false)}
          />
        </>
      )}
    </>
  );
}

function ListCard({ list, onOpen }: { list: TodoList; onOpen: () => void }) {
  return (
    <button className="list-card" onClick={onOpen}>
      <div className="body">
        <div className="name">{list.name}</div>
        {list.description && <div className="meta">{list.description}</div>}
        <div className="badges">
          {list.isMaster && <span className="badge master">mestra</span>}
          {list.shared && <span className="badge shared">compartida</span>}
          {list.sourceMasterId && <span className="badge done">instància</span>}
        </div>
      </div>
    </button>
  );
}

function CreateSheet({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isMaster, setIsMaster] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setError("El nom és obligatori"); return; }
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
    <div className="sheet" role="dialog" aria-label="Nova llista">
      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div className="field">
          <label htmlFor="new-name">Nom</label>
          <input id="new-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="new-desc">Descripció (propòsit de la llista)</label>
          <textarea id="new-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="check-row">
          <input id="new-master" type="checkbox" checked={isMaster} onChange={(e) => setIsMaster(e.target.checked)} />
          <label htmlFor="new-master">Llista mestra (plantilla instanciable)</label>
        </div>
        <div className="check-row">
          <input id="new-shared" type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          <label htmlFor="new-shared">Compartida amb tothom</label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel·la</button>
          <button type="submit" className="btn primary" style={{ flex: 2 }} disabled={busy}>
            {busy ? "Creant…" : "Crea"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Vista: detall d'una llista ──────────────────────────────────────────────

function DetailView({ id, back }: { id: string; back: () => void }) {
  const [list, setList] = useState<TodoList | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    if (!window.confirm("Esborrar aquest item?")) return;
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
      back();
      window.alert(`Instància creada: ${out.list.name} (${out.items.length} items pendents)`);
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
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="Enrere" onClick={back}><IBack /></button>
        <h1>{list?.name ?? "…"}</h1>
        {list?.isMaster && (
          <button className="icon-btn" aria-label="Instancia aquesta mestra" title="Instancia" onClick={() => void instantiate()} disabled={instantiating}>
            <ICopy />
          </button>
        )}
        <button
          className="icon-btn"
          aria-label={list?.shared ? "Deixa de compartir" : "Comparteix amb tothom"}
          title={list?.shared ? "Deixa de compartir" : "Comparteix"}
          onClick={() => void toggleFlag((v) => api.setShared(id, v), !list?.shared)}
        >
          <IShare />
        </button>
        <button
          className="icon-btn"
          aria-label={list?.isMaster ? "Treu el flag de mestra" : "Marca com a mestra"}
          title="Mestra"
          onClick={() => void toggleFlag((v) => api.setMaster(id, v), !list?.isMaster)}
        >
          <IStar />
        </button>
        <button className="icon-btn danger" aria-label="Esborra la llista" title="Esborra" onClick={() => setConfirmDelete(true)}>
          <ITrash />
        </button>
      </header>

      <main className="content">
        {error && <p className="warn" role="alert">{error}</p>}
        {list?.description && <p style={{ margin: 0, color: "var(--gaudi-muted)" }}>{list.description}</p>}
        <div className="badges">
          {list?.isMaster && <span className="badge master">mestra</span>}
          {list?.shared && <span className="badge shared">compartida</span>}
          {allDone && <span className="badge done">completada</span>}
        </div>

        <div className="items-card">
          {items.length === 0 ? (
            <p className="empty">Cap item encara. Afegeix el primer ↓</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className={`item${item.done ? " done" : ""}`}>
                <button className="check" aria-label={item.done ? `Desmarca ${item.text}` : `Marca ${item.text}`} aria-pressed={item.done} onClick={() => void toggle(item)}>
                  <ICheck />
                </button>
                <span className="text">{item.text}</span>
                <button className="remove" aria-label={`Esborra ${item.text}`} onClick={() => void removeItem(item.id)}>
                  <IX />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && done < items.length && (
          <button className="btn ghost block" onClick={() => void markAll()}>Marca-ho tot ({items.length - done})</button>
        )}
        <p className="empty" style={{ padding: 0 }}>{done}/{items.length} fets</p>
      </main>

      <div className="bottom">
        <form className="add-form" onSubmit={(e) => { e.preventDefault(); void addItem(); }}>
          <input
            type="text"
            value={text}
            placeholder="Afegeix un item…"
            aria-label="Nou item"
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn cta" disabled={busy || !text.trim()}>Afegeix</button>
        </form>
      </div>

      {confirmDelete && list && (
        <>
          <button className="sheet-backdrop" aria-label="Tanca" onClick={() => setConfirmDelete(false)} />
          <div className="sheet" role="dialog" aria-label="Esborrar llista">
            <strong>Esborrar «{list.name}»?</strong>
            <p style={{ margin: 0, color: "var(--gaudi-muted)" }}>
              S'esborrarà la llista i els seus {items.length} items. Acció irreversible.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancel·la</button>
              <button className="btn danger" style={{ flex: 1 }} onClick={() => void del()}>Esborra</button>
            </div>
          </div>
        </>
      )}
    </>
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
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="Enrere" onClick={back}><IBack /></button>
        <h1>Cerca: {q}</h1>
      </header>
      <main className="content">
        {error && <p className="warn" role="alert">{error}</p>}
        {result?.warning && <p className="warn">{result.warning}</p>}
        {result === null ? (
          <p className="empty">Cercant…</p>
        ) : result.hits.length === 0 ? (
          <p className="empty">Cap resultat per «{q}».</p>
        ) : (
          <div className="hits">
            {result.hits.map((hit) => {
              const target = listIdOf(hit);
              return (
                <button
                  key={hit.id}
                  className="hit"
                  onClick={() => target && open(target)}
                >
                  <div className="title">
                    {hit.type === "item" ? "◦ " : "▸ "}{hit.title}
                  </div>
                  <div className="sub">{hit.type === "list" ? "llista" : "item"}{hit.snippet ? ` — ${hit.snippet}` : ""}</div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

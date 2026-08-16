import { useEffect, useState } from "react";

/**
 * Vista de ejemplo schema-driven para el feature.
 * v1: ejecuta acciones del feature vía el bin local y muestra el resultado JSON.
 * v2: se genera automáticamente desde el manifest (ui:) + schemas del registry.
 */
export default function App() {
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function runAction(id: string, input: Record<string, string>) {
    setError("");
    setResult("ejecutando...");
    try {
      const query = Object.entries(input)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");
      const res = await fetch(`api/actions/${id}?${query}`);
      setResult(await res.text());
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Feature: personal.todolists</h1>
      <p>Vista schema-driven del feature. Ejecuta acciones del registry vía el bin local.</p>
      <section style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button onClick={() => runAction("personal.hello", { name: "world" })}>
          hello
        </button>
        <button onClick={() => runAction("personal.greetings.list", {})}>
          greetings.list
        </button>
      </section>
      {error && <pre style={{ color: "red" }}>{error}</pre>}
      <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto" }}>
        {result || "Sin resultado"}
      </pre>
    </main>
  );
}

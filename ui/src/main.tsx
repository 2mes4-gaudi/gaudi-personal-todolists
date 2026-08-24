import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@gaudi/ui/styles.css";
import App from "./App.tsx";

// Vistas schema-driven: la UI se genera desde el manifest (ui:) y los schemas del registry.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

-- Migració 0001: taules per a Llistes Personals (todolists)
-- Taules KV canòniques de la plataforma Gaudi per a persistència determinista

CREATE TABLE IF NOT EXISTS todolists (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todo_items (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

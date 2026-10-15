CREATE TABLE IF NOT EXISTS project_documents (
  slug TEXT PRIMARY KEY,
  project_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS project_documents_updated_at_idx ON project_documents(updated_at);

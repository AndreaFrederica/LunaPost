CREATE TABLE IF NOT EXISTS project_favorites (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(account_id, project_slug)
);

CREATE TABLE IF NOT EXISTS download_events (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  file_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS download_events_project_idx ON download_events(project_slug);

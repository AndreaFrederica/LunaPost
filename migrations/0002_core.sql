CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT REFERENCES accounts(id),
  repository_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  version_type TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  UNIQUE(project_id, version_number)
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size INTEGER,
  sha1 TEXT,
  sha512 TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'GLOBAL',
  url TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY(project_id, account_id)
);

CREATE TABLE IF NOT EXISTS wiki_bindings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  repository TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  content_root TEXT NOT NULL DEFAULT 'docs',
  revision TEXT,
  UNIQUE(project_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

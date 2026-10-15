CREATE TABLE IF NOT EXISTS ygg_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ygg_sessions_lookup_idx ON ygg_sessions(profile_id, server_id, expires_at);
CREATE TABLE IF NOT EXISTS ygg_revoked_tokens (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  revoked_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS ygg_revoked_tokens_expiry_idx ON ygg_revoked_tokens(expires_at);
CREATE TABLE IF NOT EXISTS mojang_oauth_tokens (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  refresh_token_ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

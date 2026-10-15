-- Moderation policy and review metadata.
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Upgrade the first legacy administrator so an existing installation has a root operator.
UPDATE accounts
SET role = 'root'
WHERE id = (SELECT id FROM accounts WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM accounts WHERE role = 'root');

-- D1 stores complete project documents, so file review fields are carried in project_json.

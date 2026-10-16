import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { AccountMetadata, Project } from '@andrea/contracts'
import type { AccountRecord, AccountStore, AccountSummary, ApiKeyRecord, ApiKeySummary, DownloadEvent, ProjectEngagement, ProjectFavorite, ProjectInvitation, ProjectMember, ProjectMemberRole, SiteNotification, SessionRecord, DashboardStats, ProjectPublishToken } from './auth.js'
import type { AccountRole, OrganizationMember, OrganizationMemberRole, OrganizationRecord } from './auth.js'

export class SqliteAccountStore implements AccountStore {
  private readonly db: DatabaseSync

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        verified_at TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL
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
      CREATE TABLE IF NOT EXISTS project_publish_tokens (id TEXT PRIMARY KEY, project_slug TEXT NOT NULL, account_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, scopes TEXT NOT NULL DEFAULT '["release:write"]', created_at TEXT NOT NULL, revoked_at TEXT);
      CREATE TABLE IF NOT EXISTS publish_uploads (id TEXT PRIMARY KEY, project_slug TEXT NOT NULL, account_id TEXT NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT, content_type TEXT NOT NULL, storage_key TEXT, multipart_id TEXT, status TEXT NOT NULL DEFAULT 'created', created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS project_documents (
        slug TEXT PRIMARY KEY,
        project_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        PRIMARY KEY(project_id, account_id)
      );
      CREATE TABLE IF NOT EXISTS project_invitations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_slug TEXT NOT NULL,
        inviter_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        invitee_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        read_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS organization_members (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        PRIMARY KEY(organization_id, account_id)
      );
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
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
      CREATE TABLE IF NOT EXISTS ygg_sessions (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, profile_id TEXT NOT NULL, server_id TEXT NOT NULL, ip TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS ygg_sessions_lookup_idx ON ygg_sessions(profile_id, server_id, expires_at);
      CREATE TABLE IF NOT EXISTS ygg_revoked_tokens (token_hash TEXT PRIMARY KEY, account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE, revoked_at TEXT NOT NULL, expires_at TEXT);
      CREATE INDEX IF NOT EXISTS ygg_revoked_tokens_expiry_idx ON ygg_revoked_tokens(expires_at);
      CREATE TABLE IF NOT EXISTS mojang_oauth_tokens (account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, refresh_token_ciphertext TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT);
    `)
    try { this.db.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'user'") } catch { /* existing schema already has role */ }
    try { this.db.exec("ALTER TABLE accounts ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'") } catch { /* existing schema already has metadata */ }
    this.db.exec("UPDATE accounts SET role = 'root' WHERE id = (SELECT id FROM accounts WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM accounts WHERE role = 'root')")
  }

  async countAccounts() {
    return Number((this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number }).count)
  }

  async listAccounts() {
    return this.db.prepare('SELECT id, email, created_at as createdAt, verified_at as verifiedAt, role FROM accounts ORDER BY created_at DESC').all() as AccountSummary[]
  }

  async updateRole(id: string, role: AccountRole) {
    const result = this.db.prepare('UPDATE accounts SET role = ? WHERE id = ?').run(role, id) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }

  async setAccountVerified(id: string, verifiedAt: string | null) {
    const result = this.db.prepare('UPDATE accounts SET verified_at = ? WHERE id = ?').run(verifiedAt, id) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }

  async updateAccountMetadata(id: string, metadata: AccountMetadata) {
    const result = this.db.prepare('UPDATE accounts SET metadata_json = ? WHERE id = ?').run(JSON.stringify(metadata), id) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }

  async deleteAccount(id: string) {
    this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(id)
    const result = this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }

  async listApiKeys(accountId: string) {
    const rows = this.db.prepare('SELECT id, name, scopes, created_at as createdAt, revoked_at as revokedAt FROM api_keys WHERE account_id = ? ORDER BY created_at DESC').all(accountId) as Array<{ id: string; name: string; scopes: string; createdAt: string; revokedAt: string | null }>
    return rows.map((key): ApiKeySummary => ({ ...key, scopes: JSON.parse(key.scopes) as string[] }))
  }

  async createApiKey(key: ApiKeyRecord) {
    this.db.prepare('INSERT INTO api_keys (id, account_id, key_hash, name, scopes, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(key.id, key.accountId, key.keyHash, key.name, JSON.stringify(key.scopes), key.createdAt, key.revokedAt)
  }

  async findApiKey(keyHash: string) {
    const row = this.db.prepare('SELECT id, account_id as accountId, key_hash as keyHash, name, scopes, created_at as createdAt, revoked_at as revokedAt FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL').get(keyHash) as { id: string; accountId: string; keyHash: string; name: string; scopes: string; createdAt: string; revokedAt: string | null } | undefined
    return row ? { ...row, scopes: JSON.parse(row.scopes) as string[] } : null
  }
  async createProjectPublishToken(token: ProjectPublishToken) { this.db.prepare('INSERT INTO project_publish_tokens (id, project_slug, account_id, token_hash, name, scopes, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(token.id, token.projectSlug, token.accountId, token.tokenHash, token.name, JSON.stringify(token.scopes), token.createdAt, token.revokedAt) }
  async findProjectPublishToken(tokenHash: string) { const row = this.db.prepare('SELECT id, project_slug as projectSlug, account_id as accountId, token_hash as tokenHash, name, scopes, created_at as createdAt, revoked_at as revokedAt FROM project_publish_tokens WHERE token_hash = ? AND revoked_at IS NULL').get(tokenHash) as any; return row ? { ...row, scopes: JSON.parse(row.scopes) as string[] } : null }
  async listProjectPublishTokens(projectSlug: string) { const rows = this.db.prepare('SELECT id, project_slug as projectSlug, name, scopes, created_at as createdAt, revoked_at as revokedAt FROM project_publish_tokens WHERE project_slug = ? ORDER BY created_at DESC').all(projectSlug) as any[]; return rows.map((row) => ({ ...row, scopes: JSON.parse(row.scopes) })) }
  async revokeProjectPublishToken(projectSlug: string, id: string) { const result = this.db.prepare('UPDATE project_publish_tokens SET revoked_at = ? WHERE id = ? AND project_slug = ? AND revoked_at IS NULL').run(new Date().toISOString(), id, projectSlug) as { changes?: number }; return Number(result.changes ?? 0) > 0 }

  async revokeApiKey(accountId: string, id: string) {
    const result = this.db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), id, accountId) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }

  async listStoredProjects() {
    const rows = this.db.prepare('SELECT project_json as projectJson FROM project_documents ORDER BY updated_at DESC').all() as Array<{ projectJson: string }>
    return rows.map((row) => JSON.parse(row.projectJson) as Project)
  }

  async getStoredProject(slug: string) {
    const row = this.db.prepare('SELECT project_json as projectJson FROM project_documents WHERE slug = ?').get(slug) as { projectJson: string } | undefined
    return row ? JSON.parse(row.projectJson) as Project : null
  }

  async saveStoredProject(project: Project) {
    const now = new Date().toISOString()
    this.db.prepare('INSERT INTO project_documents (slug, project_json, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET project_json = excluded.project_json, updated_at = excluded.updated_at').run(project.slug, JSON.stringify(project), now, now)
  }

  async deleteStoredProject(slug: string) {
    const result = this.db.prepare('DELETE FROM project_documents WHERE slug = ?').run(slug) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }

  async listOrganizations(accountId?: string) {
    if (accountId) return this.db.prepare('SELECT o.id, o.slug, o.name, o.description, o.avatar_url as avatarUrl, o.created_at as createdAt, o.owner_id as ownerId FROM organizations o JOIN organization_members m ON m.organization_id = o.id WHERE m.account_id = ? ORDER BY o.name').all(accountId) as OrganizationRecord[]
    return this.db.prepare('SELECT id, slug, name, description, avatar_url as avatarUrl, created_at as createdAt, owner_id as ownerId FROM organizations ORDER BY name').all() as OrganizationRecord[]
  }
  async getOrganization(slugOrId: string) {
    return (this.db.prepare('SELECT id, slug, name, description, avatar_url as avatarUrl, created_at as createdAt, owner_id as ownerId FROM organizations WHERE slug = ? OR id = ?').get(slugOrId, slugOrId) as OrganizationRecord | undefined) ?? null
  }
  async createOrganization(organization: OrganizationRecord) {
    this.db.prepare('INSERT INTO organizations (id, slug, name, description, avatar_url, created_at, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(organization.id, organization.slug, organization.name, organization.description, organization.avatarUrl ?? null, organization.createdAt, organization.ownerId)
  }
  async listOrganizationMembers(organizationId: string) {
    return this.db.prepare('SELECT m.organization_id as organizationId, m.account_id as accountId, a.email, m.role FROM organization_members m JOIN accounts a ON a.id = m.account_id WHERE m.organization_id = ? ORDER BY CASE m.role WHEN \'owner\' THEN 0 WHEN \'admin\' THEN 1 ELSE 2 END, a.email').all(organizationId) as OrganizationMember[]
  }
  async setOrganizationMember(organizationId: string, accountId: string, role: OrganizationMemberRole) {
    this.db.prepare('INSERT INTO organization_members (organization_id, account_id, role) VALUES (?, ?, ?) ON CONFLICT(organization_id, account_id) DO UPDATE SET role = excluded.role').run(organizationId, accountId, role)
  }

  async listProjectMembers(projectId: string) {
    return this.db.prepare('SELECT pm.project_id as projectId, pm.account_id as accountId, a.email, pm.role FROM project_members pm JOIN accounts a ON a.id = pm.account_id WHERE pm.project_id = ? ORDER BY CASE pm.role WHEN \'owner\' THEN 0 WHEN \'admin\' THEN 1 ELSE 2 END, a.email').all(projectId) as ProjectMember[]
  }

  async setProjectMember(projectId: string, accountId: string, role: ProjectMemberRole) {
    this.db.prepare('INSERT INTO project_members (project_id, account_id, role) VALUES (?, ?, ?) ON CONFLICT(project_id, account_id) DO UPDATE SET role = excluded.role').run(projectId, accountId, role)
  }

  async removeProjectMember(projectId: string, accountId: string) {
    const result = this.db.prepare('DELETE FROM project_members WHERE project_id = ? AND account_id = ?').run(projectId, accountId) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }

  async createInvitation(invitation: ProjectInvitation) {
    this.db.prepare('INSERT INTO project_invitations (id, project_id, project_slug, inviter_id, invitee_id, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(invitation.id, invitation.projectId, invitation.projectSlug, invitation.inviterId, invitation.inviteeId, invitation.email, invitation.role, invitation.status, invitation.createdAt)
  }
  async listInvitations(accountId: string, email: string) {
    return this.db.prepare("SELECT id, project_id as projectId, project_slug as projectSlug, inviter_id as inviterId, invitee_id as inviteeId, email, role, status, created_at as createdAt FROM project_invitations WHERE status = 'pending' AND (invitee_id = ? OR email = ?) ORDER BY created_at DESC").all(accountId, email.toLowerCase()) as ProjectInvitation[]
  }
  async respondInvitation(id: string, accountId: string, status: 'accepted' | 'declined') {
    const invitation = this.db.prepare("SELECT id, project_id as projectId, project_slug as projectSlug, inviter_id as inviterId, invitee_id as inviteeId, email, role, status, created_at as createdAt FROM project_invitations WHERE id = ? AND status = 'pending'").get(id) as ProjectInvitation | undefined
    if (!invitation || (invitation.inviteeId && invitation.inviteeId !== accountId)) return false
    this.db.prepare('UPDATE project_invitations SET status = ? WHERE id = ?').run(status, id)
    if (status === 'accepted') await this.setProjectMember(invitation.projectId, accountId, invitation.role)
    return true
  }
  async createNotification(notification: SiteNotification) {
    this.db.prepare('INSERT INTO notifications (id, account_id, type, title, body, data, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(notification.id, notification.accountId, notification.type, notification.title, notification.body, JSON.stringify(notification.data), notification.readAt, notification.createdAt)
  }
  async listNotifications(accountId: string) {
    const rows = this.db.prepare('SELECT id, account_id as accountId, type, title, body, data, read_at as readAt, created_at as createdAt FROM notifications WHERE account_id = ? ORDER BY created_at DESC LIMIT 100').all(accountId) as Array<{ id: string; accountId: string; type: string; title: string; body: string; data: string; readAt: string | null; createdAt: string }>
    return rows.map((item) => ({ ...item, data: JSON.parse(item.data) as Record<string, unknown> }))
  }
  async markNotificationRead(accountId: string, id: string) {
    const result = this.db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND account_id = ?').run(new Date().toISOString(), id, accountId) as { changes?: number }
    return Number(result.changes ?? 0) > 0
  }
  async isProjectFavorite(accountId: string, projectSlug: string) {
    return Boolean(this.db.prepare('SELECT 1 as found FROM project_favorites WHERE account_id = ? AND project_slug = ?').get(accountId, projectSlug))
  }
  async setProjectFavorite(accountId: string, projectSlug: string, favorite: boolean) {
    if (favorite) this.db.prepare('INSERT INTO project_favorites (account_id, project_slug, created_at) VALUES (?, ?, ?) ON CONFLICT(account_id, project_slug) DO NOTHING').run(accountId, projectSlug, new Date().toISOString())
    else this.db.prepare('DELETE FROM project_favorites WHERE account_id = ? AND project_slug = ?').run(accountId, projectSlug)
    return favorite
  }
  async listProjectFavorites(accountId: string) {
    return this.db.prepare('SELECT account_id as accountId, project_slug as projectSlug, created_at as createdAt FROM project_favorites WHERE account_id = ? ORDER BY created_at DESC').all(accountId) as ProjectFavorite[]
  }
  async getProjectEngagement(projectSlug: string): Promise<ProjectEngagement> {
    const downloads = this.db.prepare('SELECT COUNT(*) as count FROM download_events WHERE project_slug = ?').get(projectSlug) as { count: number }
    const favorites = this.db.prepare('SELECT COUNT(*) as count FROM project_favorites WHERE project_slug = ?').get(projectSlug) as { count: number }
    return { downloads: Number(downloads.count), favorites: Number(favorites.count) }
  }
  async recordDownload(event: DownloadEvent) {
    this.db.prepare('INSERT INTO download_events (id, project_slug, file_id, version_id, account_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(event.id, event.projectSlug, event.fileId, event.versionId, event.accountId, event.source, event.createdAt)
  }
  async getDashboardStats(projectSlugs?: string[]): Promise<DashboardStats> {
    if (projectSlugs && projectSlugs.length === 0) return { downloads: 0, favorites: 0, topDownloads: [], topFavorites: [] }
    const filter = projectSlugs?.length ? ` WHERE project_slug IN (${projectSlugs.map(() => '?').join(',')})` : ''
    const bindings = projectSlugs ?? []
    const downloads = this.db.prepare(`SELECT COUNT(*) as count FROM download_events${filter}`).get(...bindings) as { count: number }
    const favorites = this.db.prepare(`SELECT COUNT(*) as count FROM project_favorites${filter}`).get(...bindings) as { count: number }
    const topDownloads = this.db.prepare(`SELECT project_slug as projectSlug, COUNT(*) as count FROM download_events${filter} GROUP BY project_slug ORDER BY count DESC LIMIT 5`).all(...bindings) as Array<{ projectSlug: string; count: number }>
    const topFavorites = this.db.prepare(`SELECT project_slug as projectSlug, COUNT(*) as count FROM project_favorites${filter} GROUP BY project_slug ORDER BY count DESC LIMIT 5`).all(...bindings) as Array<{ projectSlug: string; count: number }>
    return { downloads: Number(downloads.count), favorites: Number(favorites.count), topDownloads, topFavorites }
  }
  async getAppSetting(key: string) {
    const row = this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }
  async setAppSetting(key: string, value: string) {
    this.db.prepare('INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, value, new Date().toISOString())
  }
  async createYggSession(session: import('./auth.js').YggSessionRecord) { this.db.prepare('INSERT INTO ygg_sessions (id, account_id, profile_id, server_id, ip, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(session.id, session.accountId, session.profileId, session.serverId, session.ip, session.createdAt, session.expiresAt) }
  async hasYggSession(profileId: string, serverId: string) { const now = new Date().toISOString(); this.db.prepare('DELETE FROM ygg_sessions WHERE expires_at <= ?').run(now); return Boolean(this.db.prepare('SELECT id FROM ygg_sessions WHERE profile_id = ? AND server_id = ? AND expires_at > ? LIMIT 1').get(profileId, serverId, now)) }
  async revokeYggToken(tokenHash: string, accountId: string | null, revokedAt: string, expiresAt: string | null) { this.db.prepare('INSERT OR IGNORE INTO ygg_revoked_tokens (token_hash, account_id, revoked_at, expires_at) VALUES (?, ?, ?, ?)').run(tokenHash, accountId, revokedAt, expiresAt) }
  async isYggTokenRevoked(tokenHash: string) { const now = new Date().toISOString(); return Boolean(this.db.prepare('SELECT token_hash FROM ygg_revoked_tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)').get(tokenHash, now)) }
  async saveMojangToken(accountId: string, ciphertext: string, updatedAt: string, expiresAt: string | null) { this.db.prepare('INSERT INTO mojang_oauth_tokens (account_id, refresh_token_ciphertext, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET refresh_token_ciphertext = excluded.refresh_token_ciphertext, updated_at = excluded.updated_at, expires_at = excluded.expires_at').run(accountId, ciphertext, updatedAt, updatedAt, expiresAt) }

  async findAccountByEmail(email: string) {
    const account = this.db.prepare('SELECT id, email, password_hash as passwordHash, created_at as createdAt, verified_at as verifiedAt, role, metadata_json as metadataJson FROM accounts WHERE email = ?').get(email) as (AccountRecord & { metadataJson?: string }) | undefined
    return account ? { ...account, metadata: account.metadataJson ? JSON.parse(account.metadataJson) as AccountMetadata : {} } : null
  }

  async getAccount(id: string) {
    const account = this.db.prepare('SELECT id, email, password_hash as passwordHash, created_at as createdAt, verified_at as verifiedAt, role, metadata_json as metadataJson FROM accounts WHERE id = ?').get(id) as (AccountRecord & { metadataJson?: string }) | undefined
    return account ? { ...account, metadata: account.metadataJson ? JSON.parse(account.metadataJson) as AccountMetadata : {} } : null
  }

  async createAccount(account: AccountRecord) {
    this.db.prepare('INSERT INTO accounts (id, email, password_hash, created_at, verified_at, role, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(account.id, account.email, account.passwordHash, account.createdAt, account.verifiedAt, account.role, JSON.stringify(account.metadata ?? {}))
  }

  async createSession(session: SessionRecord) {
    this.db.prepare('INSERT INTO sessions (id_hash, account_id, expires_at) VALUES (?, ?, ?)').run(session.idHash, session.accountId, session.expiresAt)
  }

  async getSession(idHash: string) {
    const session = this.db.prepare('SELECT id_hash as idHash, account_id as accountId, expires_at as expiresAt FROM sessions WHERE id_hash = ?').get(idHash) as SessionRecord | undefined
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      if (session) await this.deleteSession(idHash)
      return null
    }
    return session
  }

  async deleteSession(idHash: string) {
    this.db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash)
  }
}

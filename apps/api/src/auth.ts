import type { AccountMetadata, Organization, Project } from '@andrea/contracts'

export type AccountRole = 'user' | 'developer' | 'admin' | 'root'

export type AccountRecord = {
  id: string
  email: string
  passwordHash: string
  createdAt: string
  verifiedAt: string | null
  role: AccountRole
  metadata?: AccountMetadata
}

export type SessionRecord = {
  idHash: string
  accountId: string
  expiresAt: string
}

export type AccountSummary = Pick<AccountRecord, 'id' | 'email' | 'createdAt' | 'verifiedAt' | 'role'>
export type OrganizationRecord = Organization
export type OrganizationMemberRole = 'owner' | 'admin' | 'member'
export type OrganizationMember = { organizationId: string; accountId: string; email: string; role: OrganizationMemberRole }
export type ApiKeyRecord = {
  id: string
  accountId: string
  keyHash: string
  name: string
  scopes: string[]
  createdAt: string
  revokedAt: string | null
}
export type ApiKeySummary = Omit<ApiKeyRecord, 'accountId' | 'keyHash'>
export type ProjectMemberRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'member'
export type ProjectMember = { projectId: string; accountId: string; email: string; role: ProjectMemberRole }
export type ProjectInvitation = { id: string; projectId: string; projectSlug: string; inviterId: string; inviteeId: string | null; email: string; role: Exclude<ProjectMemberRole, 'owner'>; status: 'pending' | 'accepted' | 'declined'; createdAt: string }
export type SiteNotification = { id: string; accountId: string; type: string; title: string; body: string; data: Record<string, unknown>; readAt: string | null; createdAt: string }
export type YggSessionRecord = { id: string; accountId: string; profileId: string; serverId: string; ip: string | null; createdAt: string; expiresAt: string }
export type ProjectFavorite = { accountId: string; projectSlug: string; createdAt: string }
export type DownloadEvent = { id: string; projectSlug: string; fileId: string; versionId: string; accountId: string | null; source: string | null; createdAt: string }
export type ProjectEngagement = { downloads: number; favorites: number }
export type DashboardStats = { downloads: number; favorites: number; topDownloads: Array<{ projectSlug: string; count: number }>; topFavorites: Array<{ projectSlug: string; count: number }> }

export interface AccountStore {
  countAccounts(): Promise<number>
  listAccounts(): Promise<AccountSummary[]>
  updateRole(id: string, role: AccountRole): Promise<boolean>
  setAccountVerified(id: string, verifiedAt: string | null): Promise<boolean>
  updateAccountMetadata(id: string, metadata: AccountMetadata): Promise<boolean>
  deleteAccount(id: string): Promise<boolean>
  listApiKeys(accountId: string): Promise<ApiKeySummary[]>
  createApiKey(key: ApiKeyRecord): Promise<void>
  revokeApiKey(accountId: string, id: string): Promise<boolean>
  listStoredProjects(): Promise<Project[]>
  getStoredProject(slug: string): Promise<Project | null>
  saveStoredProject(project: Project): Promise<void>
  deleteStoredProject(slug: string): Promise<boolean>
  listOrganizations(accountId?: string): Promise<OrganizationRecord[]>
  getOrganization(slug: string): Promise<OrganizationRecord | null>
  createOrganization(organization: OrganizationRecord): Promise<void>
  listOrganizationMembers(organizationId: string): Promise<OrganizationMember[]>
  setOrganizationMember(organizationId: string, accountId: string, role: OrganizationMemberRole): Promise<void>
  listProjectMembers(projectId: string): Promise<ProjectMember[]>
  setProjectMember(projectId: string, accountId: string, role: ProjectMemberRole): Promise<void>
  removeProjectMember(projectId: string, accountId: string): Promise<boolean>
  createInvitation(invitation: ProjectInvitation): Promise<void>
  listInvitations(accountId: string, email: string): Promise<ProjectInvitation[]>
  respondInvitation(id: string, accountId: string, status: 'accepted' | 'declined'): Promise<boolean>
  createNotification(notification: SiteNotification): Promise<void>
  listNotifications(accountId: string): Promise<SiteNotification[]>
  markNotificationRead(accountId: string, id: string): Promise<boolean>
  isProjectFavorite(accountId: string, projectSlug: string): Promise<boolean>
  setProjectFavorite(accountId: string, projectSlug: string, favorite: boolean): Promise<boolean>
  listProjectFavorites(accountId: string): Promise<ProjectFavorite[]>
  getProjectEngagement(projectSlug: string): Promise<ProjectEngagement>
  recordDownload(event: DownloadEvent): Promise<void>
  getDashboardStats(projectSlugs?: string[]): Promise<DashboardStats>
  getAppSetting(key: string): Promise<string | null>
  setAppSetting(key: string, value: string): Promise<void>
  createYggSession(session: YggSessionRecord): Promise<void>
  hasYggSession(profileId: string, serverId: string): Promise<boolean>
  revokeYggToken(tokenHash: string, accountId: string | null, revokedAt: string, expiresAt: string | null): Promise<void>
  isYggTokenRevoked(tokenHash: string): Promise<boolean>
  saveMojangToken(accountId: string, ciphertext: string, updatedAt: string, expiresAt: string | null): Promise<void>
  findAccountByEmail(email: string): Promise<AccountRecord | null>
  getAccount(id: string): Promise<AccountRecord | null>
  createAccount(account: AccountRecord): Promise<void>
  createSession(session: SessionRecord): Promise<void>
  getSession(idHash: string): Promise<SessionRecord | null>
  deleteSession(idHash: string): Promise<void>
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const iterations = 210_000
const defaultJwtSecret = 'development-only-change-this-jwt-secret'

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

const fromBase64Url = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const constantTimeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index]
  return result === 0
}

export const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return `pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`
}

export const verifyPassword = async (password: string, encoded: string) => {
  const [algorithm, iterationText, saltText, hashText] = encoded.split('$')
  if (algorithm !== 'pbkdf2-sha256' || !iterationText || !saltText || !hashText) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(saltText), iterations: Number(iterationText) },
    key,
    256,
  )
  return constantTimeEqual(new Uint8Array(bits), fromBase64Url(hashText))
}

export const hashSessionId = async (sessionId: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(sessionId))
  return toBase64Url(new Uint8Array(digest))
}

export const hashApiKey = hashSessionId

const base64UrlEncode = (value: string) => toBase64Url(encoder.encode(value))
const base64UrlDecode = (value: string) => decoder.decode(fromBase64Url(value))
const jwtKey = async (secret: string) => crypto.subtle.importKey('raw', encoder.encode(secret || defaultJwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

export const createJwt = async (payload: { sub: string; email: string; role: AccountRole }, secret?: string, ttlSeconds = 900) => {
  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }))
  const unsigned = `${header}.${body}`
  const signature = await crypto.subtle.sign('HMAC', await jwtKey(secret ?? defaultJwtSecret), encoder.encode(unsigned))
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`
}

export const verifyJwt = async (token: string | undefined, secret?: string) => {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const unsigned = `${parts[0]}.${parts[1]}`
  if (!await crypto.subtle.verify('HMAC', await jwtKey(secret ?? defaultJwtSecret), fromBase64Url(parts[2]), encoder.encode(unsigned))) return null
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { sub?: string; email?: string; role?: AccountRole; exp?: number }
    if (!payload.sub || !payload.email || !payload.role || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export class MemoryAccountStore implements AccountStore {
  private readonly accounts = new Map<string, AccountRecord>()
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly apiKeys = new Map<string, ApiKeyRecord>()
  private readonly projects = new Map<string, Project>()
  private readonly organizations = new Map<string, OrganizationRecord>()
  private readonly organizationMembers = new Map<string, { accountId: string; role: OrganizationMemberRole }>()
  private readonly projectMembers = new Map<string, { accountId: string; role: ProjectMemberRole }>()
  private readonly invitations = new Map<string, ProjectInvitation>()
  private readonly notifications = new Map<string, SiteNotification>()
  private readonly favorites = new Map<string, ProjectFavorite>()
  private readonly downloads = new Map<string, DownloadEvent>()
  private readonly appSettings = new Map<string, string>()
  private readonly yggSessions = new Map<string, YggSessionRecord>()
  private readonly revokedYggTokens = new Map<string, { expiresAt: string | null }>()

  async findAccountByEmail(email: string) {
    return [...this.accounts.values()].find((account) => account.email === email) ?? null
  }

  async countAccounts() {
    return this.accounts.size
  }

  async listAccounts() {
    return [...this.accounts.values()].map(({ id, email, createdAt, verifiedAt, role }) => ({ id, email, createdAt, verifiedAt, role }))
  }

  async updateRole(id: string, role: AccountRole) {
    const account = this.accounts.get(id)
    if (!account) return false
    account.role = role
    return true
  }
  async setAccountVerified(id: string, verifiedAt: string | null) { const account = this.accounts.get(id); if (!account) return false; account.verifiedAt = verifiedAt; return true }

  async updateAccountMetadata(id: string, metadata: AccountMetadata) {
    const account = this.accounts.get(id)
    if (!account) return false
    account.metadata = metadata
    return true
  }

  async deleteAccount(id: string) {
    const existed = this.accounts.delete(id)
    if (existed) for (const [key, session] of this.sessions) if (session.accountId === id) this.sessions.delete(key)
    if (existed) for (const [key, apiKey] of this.apiKeys) if (apiKey.accountId === id) this.apiKeys.delete(key)
    if (existed) for (const [key, favorite] of this.favorites) if (favorite.accountId === id) this.favorites.delete(key)
    return existed
  }

  async listApiKeys(accountId: string) {
    return [...this.apiKeys.values()]
      .filter((key) => key.accountId === accountId)
      .map(({ accountId: _accountId, keyHash: _keyHash, ...summary }) => summary)
  }

  async createApiKey(key: ApiKeyRecord) { this.apiKeys.set(key.id, key) }

  async revokeApiKey(accountId: string, id: string) {
    const key = this.apiKeys.get(id)
    if (!key || key.accountId !== accountId || key.revokedAt) return false
    key.revokedAt = new Date().toISOString()
    return true
  }

  async listStoredProjects() { return [...this.projects.values()] }
  async getStoredProject(slug: string) { return this.projects.get(slug) ?? null }
  async saveStoredProject(project: Project) { this.projects.set(project.slug, project) }
  async deleteStoredProject(slug: string) { return this.projects.delete(slug) }

  async listOrganizations(accountId?: string) {
    const all = [...this.organizations.values()]
    if (!accountId) return all
    return all.filter((organization) => this.organizationMembers.has(`${organization.id}:${accountId}`))
  }
  async getOrganization(slugOrId: string) { return [...this.organizations.values()].find((organization) => organization.slug === slugOrId || organization.id === slugOrId) ?? null }
  async createOrganization(organization: OrganizationRecord) { this.organizations.set(organization.id, organization) }
  async listOrganizationMembers(organizationId: string) {
    return [...this.organizationMembers.entries()]
      .filter(([key]) => key.startsWith(`${organizationId}:`))
      .map(([, member]) => ({ organizationId, accountId: member.accountId, email: this.accounts.get(member.accountId)?.email ?? '', role: member.role }))
      .filter((member) => Boolean(member.email))
  }
  async setOrganizationMember(organizationId: string, accountId: string, role: OrganizationMemberRole) { this.organizationMembers.set(`${organizationId}:${accountId}`, { accountId, role }) }

  async listProjectMembers(projectId: string) {
    return [...this.projectMembers.entries()]
      .filter(([key]) => key.startsWith(`${projectId}:`))
      .map(([, member]) => ({ projectId, accountId: member.accountId, email: this.accounts.get(member.accountId)?.email ?? '', role: member.role }))
      .filter((member) => Boolean(member.email))
  }
  async setProjectMember(projectId: string, accountId: string, role: ProjectMemberRole) { this.projectMembers.set(`${projectId}:${accountId}`, { accountId, role }) }
  async removeProjectMember(projectId: string, accountId: string) { return this.projectMembers.delete(`${projectId}:${accountId}`) }

  async createInvitation(invitation: ProjectInvitation) { this.invitations.set(invitation.id, invitation) }
  async listInvitations(accountId: string, email: string) { return [...this.invitations.values()].filter((item) => item.status === 'pending' && (item.inviteeId === accountId || item.email === email.toLowerCase())) }
  async respondInvitation(id: string, accountId: string, status: 'accepted' | 'declined') {
    const invitation = this.invitations.get(id)
    if (!invitation || invitation.status !== 'pending' || (invitation.inviteeId && invitation.inviteeId !== accountId)) return false
    invitation.status = status
    if (status === 'accepted') await this.setProjectMember(invitation.projectId, accountId, invitation.role)
    return true
  }
  async createNotification(notification: SiteNotification) { this.notifications.set(notification.id, notification) }
  async listNotifications(accountId: string) { return [...this.notifications.values()].filter((item) => item.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  async markNotificationRead(accountId: string, id: string) { const item = this.notifications.get(id); if (!item || item.accountId !== accountId) return false; item.readAt = new Date().toISOString(); return true }
  async isProjectFavorite(accountId: string, projectSlug: string) { return this.favorites.has(`${accountId}:${projectSlug}`) }
  async setProjectFavorite(accountId: string, projectSlug: string, favorite: boolean) {
    const key = `${accountId}:${projectSlug}`
    if (favorite) this.favorites.set(key, { accountId, projectSlug, createdAt: new Date().toISOString() })
    else this.favorites.delete(key)
    return favorite
  }
  async listProjectFavorites(accountId: string) { return [...this.favorites.values()].filter((item) => item.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  async getProjectEngagement(projectSlug: string) {
    return { downloads: [...this.downloads.values()].filter((item) => item.projectSlug === projectSlug).length, favorites: [...this.favorites.values()].filter((item) => item.projectSlug === projectSlug).length }
  }
  async recordDownload(event: DownloadEvent) { this.downloads.set(event.id, event) }
  async getDashboardStats(projectSlugs?: string[]) {
    if (projectSlugs && projectSlugs.length === 0) return { downloads: 0, favorites: 0, topDownloads: [], topFavorites: [] }
    const allowed = projectSlugs ? new Set(projectSlugs) : null
    const downloads = [...this.downloads.values()].filter((item) => !allowed || allowed.has(item.projectSlug))
    const favorites = [...this.favorites.values()].filter((item) => !allowed || allowed.has(item.projectSlug))
    const count = (items: Array<{ projectSlug: string }>) => [...items.reduce((map, item) => map.set(item.projectSlug, (map.get(item.projectSlug) ?? 0) + 1), new Map<string, number>())].map(([projectSlug, count]) => ({ projectSlug, count })).sort((a, b) => b.count - a.count).slice(0, 5)
    return { downloads: downloads.length, favorites: favorites.length, topDownloads: count(downloads), topFavorites: count(favorites) }
  }
  async getAppSetting(key: string) { return this.appSettings.get(key) ?? null }
  async setAppSetting(key: string, value: string) { this.appSettings.set(key, value) }
  async createYggSession(session: YggSessionRecord) { this.yggSessions.set(session.id, session) }
  async hasYggSession(profileId: string, serverId: string) { const now = Date.now(); return [...this.yggSessions.values()].some((item) => item.profileId === profileId && item.serverId === serverId && Date.parse(item.expiresAt) > now) }
  async revokeYggToken(tokenHash: string, _accountId: string | null, _revokedAt: string, expiresAt: string | null) { this.revokedYggTokens.set(tokenHash, { expiresAt }) }
  async isYggTokenRevoked(tokenHash: string) { const item = this.revokedYggTokens.get(tokenHash); if (!item) return false; if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) { this.revokedYggTokens.delete(tokenHash); return false } return true }
  async saveMojangToken(accountId: string, ciphertext: string, updatedAt: string, expiresAt: string | null) { this.appSettings.set(`mojang-token:${accountId}`, JSON.stringify({ ciphertext, updatedAt, expiresAt })) }

  async getAccount(id: string) {
    return this.accounts.get(id) ?? null
  }

  async createAccount(account: AccountRecord) {
    this.accounts.set(account.id, account)
  }

  async createSession(session: SessionRecord) {
    this.sessions.set(session.idHash, session)
  }

  async getSession(idHash: string) {
    const session = this.sessions.get(idHash)
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      this.sessions.delete(idHash)
      return null
    }
    return session
  }

  async deleteSession(idHash: string) {
    this.sessions.delete(idHash)
  }
}

type D1DatabaseLike = {
  prepare(query: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> } }
}

export class D1AccountStore implements AccountStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async countAccounts() {
    const result = await this.db.prepare('SELECT COUNT(*) as count FROM accounts').bind().first<{ count: number | string }>()
    return Number(result?.count ?? 0)
  }

  async listAccounts() {
    const result = await this.db.prepare('SELECT id, email, created_at as createdAt, verified_at as verifiedAt, role FROM accounts ORDER BY created_at DESC').bind().all<AccountSummary>()
    return result.results ?? []
  }

  async updateRole(id: string, role: AccountRole) {
    const existing = await this.getAccount(id)
    if (!existing) return false
    await this.db.prepare('UPDATE accounts SET role = ? WHERE id = ?').bind(role, id).run()
    return true
  }
  async setAccountVerified(id: string, verifiedAt: string | null) {
    const result = await this.db.prepare('UPDATE accounts SET verified_at = ? WHERE id = ?').bind(verifiedAt, id).run() as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) > 0
  }

  async updateAccountMetadata(id: string, metadata: AccountMetadata) {
    const result = await this.db.prepare('UPDATE accounts SET metadata_json = ? WHERE id = ?').bind(JSON.stringify(metadata), id).run() as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) > 0
  }

  async deleteAccount(id: string) {
    await this.db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(id).run()
    await this.db.prepare('DELETE FROM api_keys WHERE account_id = ?').bind(id).run()
    await this.db.prepare('DELETE FROM project_favorites WHERE account_id = ?').bind(id).run()
    const result = await this.db.prepare('DELETE FROM accounts WHERE id = ?').bind(id).run() as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) > 0
  }

  async listApiKeys(accountId: string) {
    const result = await this.db.prepare('SELECT id, name, scopes, created_at as createdAt, revoked_at as revokedAt FROM api_keys WHERE account_id = ? ORDER BY created_at DESC').bind(accountId).all<{ id: string; name: string; scopes: string; createdAt: string; revokedAt: string | null }>()
    return (result.results ?? []).map((key) => ({ ...key, scopes: JSON.parse(key.scopes) as string[] }))
  }

  async createApiKey(key: ApiKeyRecord) {
    await this.db.prepare('INSERT INTO api_keys (id, account_id, key_hash, name, scopes, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(key.id, key.accountId, key.keyHash, key.name, JSON.stringify(key.scopes), key.createdAt, key.revokedAt).run()
  }

  async revokeApiKey(accountId: string, id: string) {
    const result = await this.db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL').bind(new Date().toISOString(), id, accountId).run() as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) > 0
  }

  async listStoredProjects() {
    try {
      const result = await this.db.prepare('SELECT project_json as projectJson FROM project_documents ORDER BY updated_at DESC').bind().all<{ projectJson: string }>()
      return (result.results ?? []).map((row) => JSON.parse(row.projectJson) as Project)
    } catch {
      return []
    }
  }

  async getStoredProject(slug: string) {
    try {
      const row = await this.db.prepare('SELECT project_json as projectJson FROM project_documents WHERE slug = ?').bind(slug).first<{ projectJson: string }>()
      return row ? JSON.parse(row.projectJson) as Project : null
    } catch {
      return null
    }
  }

  async saveStoredProject(project: Project) {
    const now = new Date().toISOString()
    await this.db.prepare('INSERT INTO project_documents (slug, project_json, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET project_json = excluded.project_json, updated_at = excluded.updated_at').bind(project.slug, JSON.stringify(project), now, now).run()
  }

  async deleteStoredProject(slug: string) {
    const result = await this.db.prepare('DELETE FROM project_documents WHERE slug = ?').bind(slug).run() as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) > 0
  }

  async listOrganizations(accountId?: string) {
    const query = accountId
      ? 'SELECT o.id, o.slug, o.name, o.description, o.avatar_url as avatarUrl, o.created_at as createdAt, o.owner_id as ownerId FROM organizations o JOIN organization_members m ON m.organization_id = o.id WHERE m.account_id = ? ORDER BY o.name'
      : 'SELECT id, slug, name, description, avatar_url as avatarUrl, created_at as createdAt, owner_id as ownerId FROM organizations ORDER BY name'
    const result = accountId
      ? await this.db.prepare(query).bind(accountId).all<OrganizationRecord>()
      : await this.db.prepare(query).bind().all<OrganizationRecord>()
    return result.results ?? []
  }
  async getOrganization(slugOrId: string) {
    return this.db.prepare('SELECT id, slug, name, description, avatar_url as avatarUrl, created_at as createdAt, owner_id as ownerId FROM organizations WHERE slug = ? OR id = ?').bind(slugOrId, slugOrId).first<OrganizationRecord>()
  }
  async createOrganization(organization: OrganizationRecord) {
    await this.db.prepare('INSERT INTO organizations (id, slug, name, description, avatar_url, created_at, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(organization.id, organization.slug, organization.name, organization.description, organization.avatarUrl ?? null, organization.createdAt, organization.ownerId).run()
  }
  async listOrganizationMembers(organizationId: string) {
    const result = await this.db.prepare('SELECT m.organization_id as organizationId, m.account_id as accountId, a.email, m.role FROM organization_members m JOIN accounts a ON a.id = m.account_id WHERE m.organization_id = ? ORDER BY CASE m.role WHEN \'owner\' THEN 0 WHEN \'admin\' THEN 1 ELSE 2 END, a.email').bind(organizationId).all<OrganizationMember>()
    return result.results ?? []
  }
  async setOrganizationMember(organizationId: string, accountId: string, role: OrganizationMemberRole) {
    await this.db.prepare('INSERT INTO organization_members (organization_id, account_id, role) VALUES (?, ?, ?) ON CONFLICT(organization_id, account_id) DO UPDATE SET role = excluded.role').bind(organizationId, accountId, role).run()
  }

  async listProjectMembers(projectId: string) {
    const result = await this.db.prepare('SELECT pm.project_id as projectId, pm.account_id as accountId, a.email, pm.role FROM project_members pm JOIN accounts a ON a.id = pm.account_id WHERE pm.project_id = ? ORDER BY CASE pm.role WHEN \'owner\' THEN 0 WHEN \'admin\' THEN 1 ELSE 2 END, a.email').bind(projectId).all<ProjectMember>()
    return result.results ?? []
  }

  async setProjectMember(projectId: string, accountId: string, role: ProjectMemberRole) {
    await this.db.prepare('INSERT INTO project_members (project_id, account_id, role) VALUES (?, ?, ?) ON CONFLICT(project_id, account_id) DO UPDATE SET role = excluded.role').bind(projectId, accountId, role).run()
  }

  async removeProjectMember(projectId: string, accountId: string) {
    const result = await this.db.prepare('DELETE FROM project_members WHERE project_id = ? AND account_id = ?').bind(projectId, accountId).run() as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) > 0
  }

  async createInvitation(invitation: ProjectInvitation) {
    await this.db.prepare('INSERT INTO project_invitations (id, project_id, project_slug, inviter_id, invitee_id, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(invitation.id, invitation.projectId, invitation.projectSlug, invitation.inviterId, invitation.inviteeId, invitation.email, invitation.role, invitation.status, invitation.createdAt).run()
  }
  async listInvitations(accountId: string, email: string) {
    const result = await this.db.prepare('SELECT id, project_id as projectId, project_slug as projectSlug, inviter_id as inviterId, invitee_id as inviteeId, email, role, status, created_at as createdAt FROM project_invitations WHERE status = \'pending\' AND (invitee_id = ? OR email = ?) ORDER BY created_at DESC').bind(accountId, email.toLowerCase()).all<ProjectInvitation>()
    return result.results ?? []
  }
  async respondInvitation(id: string, accountId: string, status: 'accepted' | 'declined') {
    const invitation = await this.db.prepare('SELECT id, project_id as projectId, project_slug as projectSlug, inviter_id as inviterId, invitee_id as inviteeId, email, role, status, created_at as createdAt FROM project_invitations WHERE id = ? AND status = \'pending\'').bind(id).first<ProjectInvitation>()
    if (!invitation || (invitation.inviteeId && invitation.inviteeId !== accountId)) return false
    await this.db.prepare('UPDATE project_invitations SET status = ? WHERE id = ?').bind(status, id).run()
    if (status === 'accepted') await this.setProjectMember(invitation.projectId, accountId, invitation.role)
    return true
  }
  async createNotification(notification: SiteNotification) {
    await this.db.prepare('INSERT INTO notifications (id, account_id, type, title, body, data, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(notification.id, notification.accountId, notification.type, notification.title, notification.body, JSON.stringify(notification.data), notification.readAt, notification.createdAt).run()
  }
  async listNotifications(accountId: string) {
    const result = await this.db.prepare('SELECT id, account_id as accountId, type, title, body, data, read_at as readAt, created_at as createdAt FROM notifications WHERE account_id = ? ORDER BY created_at DESC LIMIT 100').bind(accountId).all<{ id: string; accountId: string; type: string; title: string; body: string; data: string; readAt: string | null; createdAt: string }>()
    return (result.results ?? []).map((item) => ({ ...item, data: JSON.parse(item.data) as Record<string, unknown> }))
  }
  async markNotificationRead(accountId: string, id: string) {
    const result = await this.db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND account_id = ?').bind(new Date().toISOString(), id, accountId).run() as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) > 0
  }
  async isProjectFavorite(accountId: string, projectSlug: string) {
    const row = await this.db.prepare('SELECT 1 as found FROM project_favorites WHERE account_id = ? AND project_slug = ?').bind(accountId, projectSlug).first<{ found: number }>()
    return Boolean(row)
  }
  async setProjectFavorite(accountId: string, projectSlug: string, favorite: boolean) {
    if (favorite) await this.db.prepare('INSERT INTO project_favorites (account_id, project_slug, created_at) VALUES (?, ?, ?) ON CONFLICT(account_id, project_slug) DO NOTHING').bind(accountId, projectSlug, new Date().toISOString()).run()
    else await this.db.prepare('DELETE FROM project_favorites WHERE account_id = ? AND project_slug = ?').bind(accountId, projectSlug).run()
    return favorite
  }
  async listProjectFavorites(accountId: string) {
    const result = await this.db.prepare('SELECT account_id as accountId, project_slug as projectSlug, created_at as createdAt FROM project_favorites WHERE account_id = ? ORDER BY created_at DESC').bind(accountId).all<ProjectFavorite>()
    return result.results ?? []
  }
  async getProjectEngagement(projectSlug: string) {
    const downloads = await this.db.prepare('SELECT COUNT(*) as count FROM download_events WHERE project_slug = ?').bind(projectSlug).first<{ count: number | string }>()
    const favorites = await this.db.prepare('SELECT COUNT(*) as count FROM project_favorites WHERE project_slug = ?').bind(projectSlug).first<{ count: number | string }>()
    return { downloads: Number(downloads?.count ?? 0), favorites: Number(favorites?.count ?? 0) }
  }
  async recordDownload(event: DownloadEvent) {
    await this.db.prepare('INSERT INTO download_events (id, project_slug, file_id, version_id, account_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(event.id, event.projectSlug, event.fileId, event.versionId, event.accountId, event.source, event.createdAt).run()
  }
  async getDashboardStats(projectSlugs?: string[]) {
    const filter = projectSlugs?.length ? ` WHERE project_slug IN (${projectSlugs.map(() => '?').join(',')})` : ''
    const bindings = projectSlugs ?? []
    const downloads = await this.db.prepare(`SELECT COUNT(*) as count FROM download_events${filter}`).bind(...bindings).first<{ count: number | string }>()
    const favorites = await this.db.prepare(`SELECT COUNT(*) as count FROM project_favorites${filter}`).bind(...bindings).first<{ count: number | string }>()
    const topDownloads = await this.db.prepare(`SELECT project_slug as projectSlug, COUNT(*) as count FROM download_events${filter} GROUP BY project_slug ORDER BY count DESC LIMIT 5`).bind(...bindings).all<{ projectSlug: string; count: number | string }>()
    const topFavorites = await this.db.prepare(`SELECT project_slug as projectSlug, COUNT(*) as count FROM project_favorites${filter} GROUP BY project_slug ORDER BY count DESC LIMIT 5`).bind(...bindings).all<{ projectSlug: string; count: number | string }>()
    return { downloads: Number(downloads?.count ?? 0), favorites: Number(favorites?.count ?? 0), topDownloads: (topDownloads.results ?? []).map((item) => ({ projectSlug: item.projectSlug, count: Number(item.count) })), topFavorites: (topFavorites.results ?? []).map((item) => ({ projectSlug: item.projectSlug, count: Number(item.count) })) }
  }
  async getAppSetting(key: string) {
    try {
      const row = await this.db.prepare('SELECT value FROM app_meta WHERE key = ?').bind(key).first<{ value: string }>()
      return row?.value ?? null
    } catch { return null }
  }
  async setAppSetting(key: string, value: string) {
    await this.db.prepare('INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(key, value, new Date().toISOString()).run()
  }
  async createYggSession(session: YggSessionRecord) { await this.db.prepare('INSERT INTO ygg_sessions (id, account_id, profile_id, server_id, ip, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(session.id, session.accountId, session.profileId, session.serverId, session.ip, session.createdAt, session.expiresAt).run() }
  async hasYggSession(profileId: string, serverId: string) { await this.db.prepare('DELETE FROM ygg_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run(); const row = await this.db.prepare('SELECT id FROM ygg_sessions WHERE profile_id = ? AND server_id = ? AND expires_at > ? LIMIT 1').bind(profileId, serverId, new Date().toISOString()).first<{ id: string }>(); return Boolean(row) }
  async revokeYggToken(tokenHash: string, accountId: string | null, revokedAt: string, expiresAt: string | null) { await this.db.prepare('INSERT INTO ygg_revoked_tokens (token_hash, account_id, revoked_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(token_hash) DO NOTHING').bind(tokenHash, accountId, revokedAt, expiresAt).run() }
  async isYggTokenRevoked(tokenHash: string) { const row = await this.db.prepare('SELECT token_hash FROM ygg_revoked_tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)').bind(tokenHash, new Date().toISOString()).first<{ token_hash: string }>(); return Boolean(row) }
  async saveMojangToken(accountId: string, ciphertext: string, updatedAt: string, expiresAt: string | null) { await this.db.prepare('INSERT INTO mojang_oauth_tokens (account_id, refresh_token_ciphertext, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET refresh_token_ciphertext = excluded.refresh_token_ciphertext, updated_at = excluded.updated_at, expires_at = excluded.expires_at').bind(accountId, ciphertext, updatedAt, updatedAt, expiresAt).run() }

  async findAccountByEmail(email: string) {
    const account = await this.db.prepare('SELECT id, email, password_hash as passwordHash, created_at as createdAt, verified_at as verifiedAt, role, metadata_json as metadataJson FROM accounts WHERE email = ?').bind(email).first<AccountRecord & { metadataJson?: string }>()
    return account ? { ...account, metadata: account.metadataJson ? JSON.parse(account.metadataJson) as AccountMetadata : {} } : null
  }

  async getAccount(id: string) {
    const account = await this.db.prepare('SELECT id, email, password_hash as passwordHash, created_at as createdAt, verified_at as verifiedAt, role, metadata_json as metadataJson FROM accounts WHERE id = ?').bind(id).first<AccountRecord & { metadataJson?: string }>()
    return account ? { ...account, metadata: account.metadataJson ? JSON.parse(account.metadataJson) as AccountMetadata : {} } : null
  }

  async createAccount(account: AccountRecord) {
    await this.db.prepare('INSERT INTO accounts (id, email, password_hash, created_at, verified_at, role, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(account.id, account.email, account.passwordHash, account.createdAt, account.verifiedAt, account.role, JSON.stringify(account.metadata ?? {})).run()
  }

  async createSession(session: SessionRecord) {
    await this.db.prepare('INSERT INTO sessions (id_hash, account_id, expires_at) VALUES (?, ?, ?)').bind(session.idHash, session.accountId, session.expiresAt).run()
  }

  async getSession(idHash: string) {
    const session = await this.db.prepare('SELECT id_hash as idHash, account_id as accountId, expires_at as expiresAt FROM sessions WHERE id_hash = ?').bind(idHash).first<SessionRecord>()
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      if (session) await this.deleteSession(idHash)
      return null
    }
    return session
  }

  async deleteSession(idHash: string) {
    await this.db.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(idHash).run()
  }
}

export const accountView = (account: AccountRecord) => ({
  id: account.id,
  email: account.email,
  createdAt: account.createdAt,
  verifiedAt: account.verifiedAt,
  role: account.role,
  metadata: account.metadata ?? {},
})


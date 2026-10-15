import { projectSchema, externalProjectId, externalVersionId, resolveDependencies, type Catalog, type Dependency, type DependencyRequest, type ExternalDependency, type Project } from '@andrea/contracts'

export class ExternalProviderError extends Error {
  constructor(public code: string, message: string) { super(message) }
}
type Provider = ExternalDependency['provider']
type RemoteVersion = { id: string; project_id: string; version_number: string; version_type: string; game_versions: string[]; loaders: string[]; date_published: string; status?: string; dependencies: Array<{ project_id?: string; version_id?: string; dependency_type: Dependency['dependencyType'] }>; files: Array<{ filename: string; url: string; primary: boolean; size: number; hashes: { sha1?: string; sha512?: string } }> }
type CfFile = { id: number; modId: number; displayName: string; fileName: string; fileDate: string; releaseType: number; isAvailable: boolean; gameVersions: string[]; downloadUrl: string | null; fileLength: number; hashes: Array<{ algo: number; value: string }>; dependencies: Array<{ modId: number; relationType: number }> }
const cfLoaders: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }
const safeDownload = (url: string | null | undefined, provider: Provider) => {
  if (!url) return undefined
  const u = new URL(url)
  const domain = provider === 'modrinth' ? 'modrinth.com' : 'forgecdn.net'
  return u.protocol === 'https:' && !u.username && !u.password && (u.hostname === domain || u.hostname.endsWith(`.${domain}`)) ? url : undefined
}

// A request-scoped client: fixed upstream origins, bounded requests/response size and no credential forwarding.
export function externalProviderClient(env: { CURSEFORGE_API_KEY?: string }, fetcher: typeof fetch = fetch) {
  let requests = 0
  const deadline = Date.now() + 20_000
  const cache = new Map<string, unknown>()
  async function json<T>(provider: Provider, path: string, body?: unknown): Promise<T> {
    const key = `${provider}:${path}:${JSON.stringify(body) || ''}`
    if (cache.has(key)) return cache.get(key) as T
    if (++requests > 60 || Date.now() >= deadline) throw new ExternalProviderError('EXTERNAL_LIMIT', 'External dependency lookup budget exceeded; pin releases or reduce the dependency graph')
    if (provider === 'curseforge' && !env.CURSEFORGE_API_KEY) throw new ExternalProviderError('CF_KEY_REQUIRED', 'CurseForge integration requires the server CURSEFORGE_API_KEY')
    const origin = provider === 'modrinth' ? 'https://api.modrinth.com/v2' : 'https://api.curseforge.com/v1'
    try {
      const response = await fetcher(`${origin}${path}`, { ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LunaPost/0.1 (external dependency resolver)', ...(provider === 'curseforge' ? { 'x-api-key': env.CURSEFORGE_API_KEY! } : {}) }, redirect: 'error', signal: AbortSignal.timeout(Math.min(8_000, Math.max(1, deadline - Date.now()))) })
      if (!response.ok) throw new ExternalProviderError(response.status === 429 ? 'EXTERNAL_RATE_LIMIT' : 'EXTERNAL_UPSTREAM', `${provider} returned HTTP ${response.status}`)
      if (Number(response.headers.get('content-length')) > 4_000_000) throw new ExternalProviderError('EXTERNAL_LIMIT', 'Provider response is too large')
      const reader = response.body?.getReader(); let size = 0; const chunks: Uint8Array[] = []
      if (reader) { try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 4_000_000) { await reader.cancel(); throw new ExternalProviderError('EXTERNAL_LIMIT', 'Provider response is too large') }; chunks.push(part.value) } } finally { reader.releaseLock() } }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      const data = JSON.parse(new TextDecoder().decode(bytes)); cache.set(key, data); return data as T
    } catch (e) { if (e instanceof ExternalProviderError) throw e; throw new ExternalProviderError('EXTERNAL_UPSTREAM', `${provider} lookup failed or returned invalid metadata`) }
  }

  async function load(ref: ExternalDependency, input: Pick<DependencyRequest, 'loader' | 'gameVersion'>): Promise<{ project: Project; downloads: Record<string, string>; reference: ExternalDependency }> {
    const downloads: Record<string, string> = {}
    const provider = ref.provider
    if (provider === 'modrinth') {
      const p = await json<{ id: string; slug: string; title: string; description: string; client_side: string; server_side: string }>(provider, `/project/${encodeURIComponent(ref.projectId)}`)
      const query = new URLSearchParams({ loaders: JSON.stringify([input.loader]), game_versions: JSON.stringify([input.gameVersion]) })
      const versions = await json<RemoteVersion[]>(provider, `/project/${encodeURIComponent(p.id)}/version?${query}`)
      if (versions.length > 300) throw new ExternalProviderError('EXTERNAL_LIMIT', 'Too many Modrinth releases for this environment')
      if (ref.versionId && !versions.some(v => v.id === ref.versionId)) versions.push(await json<RemoteVersion>(provider, `/version/${encodeURIComponent(ref.versionId)}`))
      const mapped = []
      for (const v of versions) {
        if (v.project_id !== p.id) throw new ExternalProviderError('EXTERNAL_REFERENCE', 'Modrinth version does not belong to the selected project')
        const dependencies: Dependency[] = []
        for (const d of v.dependencies || []) {
          let projectId = d.project_id
          if (!projectId && d.version_id) projectId = (await json<RemoteVersion>(provider, `/version/${encodeURIComponent(d.version_id)}`)).project_id
          if (!projectId) { if (d.dependency_type === 'required') throw new ExternalProviderError('EXTERNAL_REFERENCE', 'Modrinth required dependency has no project or version'); continue }
          dependencies.push({ dependencyType: d.dependency_type, external: { provider, projectId, versionId: d.version_id || undefined } })
        }
        mapped.push({ id: externalVersionId(provider, v.id), version: v.version_number, type: v.version_type, status: v.status || 'listed', gameVersions: v.game_versions, loaders: v.loaders, publishedAt: v.date_published, dependencies, files: v.files.map((f, i) => {
          const id = `external:${provider}:${v.id}:${i}`; const url = safeDownload(f.url, provider); if (url) downloads[id] = url
          return { id, name: f.filename, size: f.size, primary: f.primary, sha1: f.hashes.sha1, sha512: f.hashes.sha512, sources: [], fileType: 'mod' }
        }) })
      }
      const reference = { ...ref, projectId: p.id }
      return { reference, downloads, project: projectSchema.parse({ id: externalProjectId(reference), slug: p.slug, title: p.title, description: p.description, type: 'mod', clientSide: p.client_side, serverSide: p.server_side, loaders: [input.loader], gameVersions: [input.gameVersion], versions: mapped }) }
    }
    const { data: p } = await json<{ data: { id: number; name: string; slug: string; summary: string; gameId: number; allowModDistribution?: boolean } }>(provider, `/mods/${encodeURIComponent(ref.projectId)}`)
    if (p.gameId !== 432) throw new ExternalProviderError('EXTERNAL_REFERENCE', 'CurseForge project is not a Minecraft project')
    const loaderId = cfLoaders[input.loader.toLowerCase()]
    if (!loaderId) throw new ExternalProviderError('EXTERNAL_ENVIRONMENT', 'Unsupported CurseForge loader')
    const files: CfFile[] = []
    for (let index = 0; ; index += 50) {
      const query = new URLSearchParams({ gameVersion: input.gameVersion, modLoaderType: String(loaderId), pageSize: '50', index: String(index) })
      const page = await json<{ data: CfFile[]; pagination: { totalCount: number } }>(provider, `/mods/${p.id}/files?${query}`)
      files.push(...page.data)
      if (files.length >= page.pagination.totalCount) break
      if (!page.data.length || index >= 250) throw new ExternalProviderError('EXTERNAL_LIMIT', 'Too many CurseForge releases for this environment')
    }
    if (ref.versionId && !files.some(f => String(f.id) === ref.versionId)) files.push((await json<{ data: CfFile }>(provider, `/mods/${p.id}/files/${encodeURIComponent(ref.versionId)}`)).data)
    const reference = { ...ref, projectId: String(p.id) }
    const versions = files.map(f => {
      if (f.modId !== p.id) throw new ExternalProviderError('EXTERNAL_REFERENCE', 'CurseForge file does not belong to the selected project')
      const id = externalVersionId(provider, String(f.id)); const url = p.allowModDistribution === false ? undefined : safeDownload(f.downloadUrl, provider); if (url) downloads[id] = url
      return { id, version: f.displayName, type: ({ 1: 'release', 2: 'beta', 3: 'alpha' } as Record<number,string>)[f.releaseType], status: f.isAvailable ? 'listed' : 'archived', loaders: Object.keys(cfLoaders).filter(l => f.gameVersions.some(g => g.toLowerCase() === l)), gameVersions: f.gameVersions, publishedAt: f.fileDate, dependencies: f.dependencies.map(d => ({ dependencyType: ({ 1: 'embedded', 2: 'optional', 3: 'required', 4: 'optional', 5: 'incompatible', 6: 'embedded' } as Record<number,string>)[d.relationType], external: { provider, projectId: String(d.modId) } })), files: [{ id, name: f.fileName, size: f.fileLength, primary: true, sha1: f.hashes.find(h => h.algo === 1)?.value, sources: [], fileType: 'mod' }] }
    })
    return { reference, downloads, project: projectSchema.parse({ id: externalProjectId(reference), slug: p.slug, title: p.name, description: p.summary, type: 'mod', loaders: [input.loader], gameVersions: [input.gameVersion], versions }) }
  }
  async function installedReference(id: string): Promise<ExternalDependency> {
    const match = /^external:(modrinth|curseforge):([a-zA-Z0-9_-]+)$/.exec(id)
    if (!match) throw new ExternalProviderError('EXTERNAL_REFERENCE', 'Invalid external installed version ID')
    const provider = match[1] as Provider; const versionId = match[2]
    if (provider === 'modrinth') return { provider, projectId: (await json<RemoteVersion>(provider, `/version/${encodeURIComponent(versionId)}`)).project_id, versionId }
    if (!/^\d+$/.test(versionId)) throw new ExternalProviderError('EXTERNAL_REFERENCE', 'Invalid CurseForge file ID')
    const { data } = await json<{ data: CfFile[] }>(provider, '/mods/files', { fileIds: [Number(versionId)] })
    const file = data.find(f => String(f.id) === versionId)
    if (!file) throw new ExternalProviderError('EXTERNAL_REFERENCE', 'Installed CurseForge file not found')
    return { provider, projectId: String(file.modId), versionId }
  }
  return { load, installedReference }
}

export async function resolveWithExternal(catalog: Catalog, input: DependencyRequest, env: { CURSEFORGE_API_KEY?: string }, fetcher: typeof fetch = fetch) {
  const client = externalProviderClient(env, fetcher)
  const expanded = structuredClone(catalog)
  const downloads: Record<string, string> = {}
  try {
    for (const id of input.installedVersions.filter(id => id.startsWith('external:'))) {
      const ref = await client.installedReference(id); const remote = await client.load(ref, input)
      const existing = expanded.projects.find(p => p.id === remote.project.id)
      if (existing) existing.versions = [...existing.versions, ...remote.project.versions.filter(v => !existing.versions.some(e => e.id === v.id))]
      else expanded.projects.push(remote.project)
      Object.assign(downloads, remote.downloads)
    }
  } catch(e) {
    return { ...resolveDependencies(expanded, input, downloads), success: false, installable: false, manifest: [], errors: [{ code: e instanceof ExternalProviderError ? e.code : 'EXTERNAL_METADATA', path: [], message: e instanceof ExternalProviderError ? e.message : 'Invalid external installed version' }] }
  }
  const failures = new Map<string, { code: string; path: string[]; message: string }>()
  const refKey = (ref: ExternalDependency) => `${externalProjectId(ref)}:${ref.versionId || ''}`
  for (let i = 0; i < 30; i++) {
    const result = resolveDependencies(expanded, input, downloads)
    if (result.success || !result.unresolvedExternal.length) return result
    const pending = result.unresolvedExternal.filter(ref => !failures.has(refKey(ref)))
    if (!pending.length) return { ...result, errors: [...result.unresolvedExternal.map(ref => failures.get(refKey(ref))!), ...result.errors] }
    for (const ref of pending) {
      try {
        const remote = await client.load(ref, input)
        if (remote.reference.projectId !== ref.projectId) throw new ExternalProviderError('EXTERNAL_REFERENCE', 'Bind the canonical provider project ID using the editor lookup first')
        const existing = expanded.projects.find(p => p.id === remote.project.id)
        if (existing) existing.versions = [...existing.versions, ...remote.project.versions.filter(v => !existing.versions.some(e => e.id === v.id))]
        else expanded.projects.push(remote.project)
        Object.assign(downloads, remote.downloads)
      } catch (e) {
        failures.set(refKey(ref), { code: e instanceof ExternalProviderError ? e.code : 'EXTERNAL_METADATA', path: [externalProjectId(ref)], message: e instanceof ExternalProviderError ? e.message : 'Provider returned unsupported metadata' })
      }
    }
  }
  const result = resolveDependencies(expanded, input, downloads)
  return { ...result, success: false, installable: false, manifest: [], errors: [{ code: 'EXTERNAL_LIMIT', path: [], message: 'External dependency graph exceeds 30 expansion rounds' }] }
}

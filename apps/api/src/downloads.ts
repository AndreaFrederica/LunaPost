import type { Context, Hono } from 'hono'
import type { DownloadEvent } from './auth.js'
import { launcherFile, type Catalog, type CdnRule, type FileRecord, type Project, type Source, type Version } from '@andrea/contracts'

export type DownloadEnv = { Bindings: { PUBLIC_BASE_URL?: string } }

function publicOrigin(c: Context<any>) {
  // Behind a reverse proxy configure the canonical URL; never trust forwarded host headers.
  const url = new URL(c.env?.PUBLIC_BASE_URL || c.req.url)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid PUBLIC_BASE_URL')
  return url.origin
}

function selectSource(sources: Source[], country?: string, requested?: string) {
  const region = country === 'CN' ? 'CN'
    : ['JP', 'KR', 'SG', 'TW', 'HK'].includes(country ?? '') ? 'APAC'
    : ['US', 'CA', 'MX'].includes(country ?? '') ? 'NA'
    : ['GB', 'DE', 'FR', 'NL', 'SE', 'FI', 'NO', 'ES', 'IT'].includes(country ?? '') ? 'EU' : 'GLOBAL'
  const candidates = requested ? sources.filter((source) => source.id === requested) : sources
  const score = (source: Source) => source.region === region ? 100 : source.region === 'GLOBAL' ? 50 : 0
  return [...candidates].sort((a, b) => score(b) - score(a) || b.priority - a.priority)[0]
}

type FileContext = { project: Project; version: Version; file: FileRecord }

const renderCdnTemplate = (rule: CdnRule, project: Project, version: Version, file: FileRecord) => {
  const values: Record<string, string> = {
    fileId: file.id,
    filename: file.name,
    projectSlug: project.slug,
    versionId: version.id,
    version: version.version,
  }
  const rendered = rule.template.replace(/\{(fileId|filename|projectSlug|versionId|version)\}/g, (_, key: string) => encodeURIComponent(values[key]))
  try {
    const url = new URL(rendered)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.href
  } catch {
    return null
  }
}

const sourcesFor = ({ project, version, file }: FileContext): Source[] => {
  const configured = (project.cdnRules ?? []).filter((rule) => rule.enabled).flatMap((rule) => {
    const url = renderCdnTemplate(rule, project, version, file)
    return url ? [{ id: rule.id, kind: 'cdn' as const, region: rule.region, url, priority: rule.priority }] : []
  })
  const existing = new Set(file.sources.map((source) => source.id))
  return [...file.sources, ...configured.filter((source) => !existing.has(source.id))]
}

const findFile = (catalog: Catalog, fileId: string): FileContext | null => {
  for (const project of catalog.projects) {
    for (const version of project.versions) {
      const file = version.files.find((item) => item.id === fileId)
      if (file) return { project, version, file }
    }
  }
  return null
}

export function registerDownloads(app: Hono<any>, getCatalog: (c: Context<any>) => Catalog | Promise<Catalog>, recordDownload?: (c: Context<any>, event: Omit<DownloadEvent, 'id' | 'createdAt'>) => Promise<void>) {
  const record = async (c: Context<any>, context: FileContext, source?: string) => {
    const country = (c.req.raw.cf as { country?: string } | undefined)?.country
    if (!selectSource(sourcesFor(context), country, source)) return
    if (recordDownload) await recordDownload(c, { projectSlug: context.project.slug, fileId: context.file.id, versionId: context.version.id, accountId: null, source: source ?? null })
  }
  const fail = (c: Context<any>, code: string, message: string, status: 400 | 404 | 409 | 503) => c.json({ error: { code, message } }, status)
  const redirect = (c: Context<any>, file: FileRecord) => {
    const requested = c.req.query('source')
    const country = (c.req.raw.cf as { country?: string } | undefined)?.country
    const source = selectSource(file.sources, country, requested)
    if (!source) return fail(c, requested ? 'SOURCE_NOT_FOUND' : 'SOURCE_UNAVAILABLE', 'No matching download source', requested ? 404 : 503)
    // A stable public URL must not permanently cache a mutable mirror location.
    c.header('Cache-Control', 'no-store')
    c.header('X-File-Id', file.id)
    return c.redirect(source.url, 302)
  }

  app.get('/api/v1/files/:fileId', async (c) => {
    const context = findFile(await getCatalog(c), c.req.param('fileId'))
    if (!context) return fail(c, 'NOT_FOUND', 'File not found', 404)
    c.header('Cache-Control', 'no-store')
    return c.json(launcherFile(context.file, publicOrigin(c), sourcesFor(context)))
  })

  app.get('/api/v1/files/:fileId/sources', async (c) => {
    const context = findFile(await getCatalog(c), c.req.param('fileId'))
    if (!context) return fail(c, 'NOT_FOUND', 'File not found', 404)
    const sources = sourcesFor(context)
    const country = (c.req.raw.cf as { country?: string } | undefined)?.country
    const selected = selectSource(sources, country, c.req.query('source'))
    return c.json({ file: launcherFile(context.file, publicOrigin(c), sources), selected, mirrors: sources, region: country ?? 'GLOBAL' })
  })

  app.get('/api/v1/files/:fileId/download', async (c) => {
    const context = findFile(await getCatalog(c), c.req.param('fileId'))
    if (!context) return fail(c, 'NOT_FOUND', 'File not found', 404)
    await record(c, context, c.req.query('source'))
    return redirect(c, { ...context.file, sources: sourcesFor(context) })
  })

  const resolveProjectFile = async (c: Context<any>, asDownload: boolean) => {
    const project = (await getCatalog(c)).projects.find((p) => p.slug === c.req.param('slug'))
    if (!project) return fail(c, 'NOT_FOUND', 'Project not found', 404)
    const versionId = c.req.query('version_id')
    const loader = c.req.query('loader')
    const gameVersion = c.req.query('game_version')
    const channel = c.req.query('channel') ?? 'release'
    if (!['release', 'beta', 'alpha'].includes(channel)) return fail(c, 'INVALID_CHANNEL', 'Expected release, beta or alpha', 400)
    let versions = project.versions.filter((v) =>
      (versionId ? v.id === versionId : v.type === channel) &&
      (!loader || v.loaders.includes(loader)) && (!gameVersion || v.gameVersions.includes(gameVersion)))
    if (!versions.length) return fail(c, 'NOT_FOUND', 'No compatible version', 404)
    if (versions.length > 1) {
      if (versionId || versions.some((v) => !v.publishedAt)) return fail(c, 'AMBIGUOUS_VERSION', 'Specify version_id or add publishedAt timestamps', 409)
      versions = [...versions].sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!) || a.id.localeCompare(b.id))
    }
    const version = versions[0]
    const fileId = c.req.query('file_id')
    const primary = version.files.filter((f) => f.primary)
    const files = fileId ? version.files.filter((f) => f.id === fileId) : primary.length ? primary : version.files
    if (!files.length) return fail(c, 'NOT_FOUND', 'File not found in selected version', 404)
    if (files.length !== 1) return fail(c, 'AMBIGUOUS_FILE', 'Specify file_id or designate a single primary artifact', 409)
    const selectedFile = { ...files[0], sources: sourcesFor({ project, version, file: files[0] }) }
    if (asDownload) { await record(c, { project, version, file: selectedFile }, c.req.query('source')); return redirect(c, selectedFile) }
    c.header('Cache-Control', 'no-store')
    return c.json({ project_id: project.id, version_id: version.id, version: version.version,
      game_versions: version.gameVersions, loaders: version.loaders, file: launcherFile(selectedFile, publicOrigin(c)) })
  }
  app.get('/api/v1/projects/:slug/resolve', async (c) => resolveProjectFile(c, false))
  app.get('/api/v1/projects/:slug/download', async (c) => resolveProjectFile(c, true))
}

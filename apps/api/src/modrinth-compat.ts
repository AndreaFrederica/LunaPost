import type { Context, Hono } from 'hono'
import { launcherFile, type Catalog, type Project, type Version } from '@andrea/contracts'

type CompatEnv = { Bindings: { PUBLIC_BASE_URL?: string } }

const projectResponse = (project: Project, origin: string) => ({
  id: project.id,
  slug: project.slug,
  project_type: project.type,
  team: '',
  title: project.title,
  description: project.description,
  body: project.body ?? project.description,
  published: '2026-10-14T00:00:00.000Z',
  updated: '2026-10-14T00:00:00.000Z',
  approved: project.status === 'approved' ? '2026-10-14T00:00:00.000Z' : null,
  status: project.status,
  client_side: project.clientSide,
  server_side: project.serverSide,
  downloads: project.downloads,
  followers: project.followers,
  categories: project.categories,
  versions: project.versions.map((version) => version.id),
  game_versions: project.gameVersions,
  loaders: project.loaders,
  icon_url: project.iconUrl ?? null,
  issues_url: project.issuesUrl ?? null,
  source_url: project.sourceUrl ?? project.repositoryUrl ?? null,
  wiki_url: `${origin}/projects/${encodeURIComponent(project.slug)}/wiki`,
  discord_url: project.discordUrl ?? null,
  donation_urls: project.donationUrls,
  license: { id: project.license ?? 'NOASSERTION', name: project.license ?? 'No license specified', url: null },
  gallery: project.gallery.map((url, index) => ({ url, featured: index === 0, title: null, description: null, created: null, ordering: index })),
  color: project.color ?? null,
  thread_id: null,
})

const versionResponse = (project: Project, version: Version, origin: string) => ({
  id: version.id,
  project_id: project.id,
  author_id: '',
  featured: version.featured || version.type === 'release',
  name: `${project.title} ${version.version}`,
  description: version.description ?? null,
  version_number: version.version,
  changelog: version.changelog ?? '',
  dependencies: version.dependencies.filter(d => !d.external && !d.appliesTo && !d.when && !d.versionConstraint && ['required', 'optional', 'incompatible', 'embedded'].includes(d.dependencyType)).map((dependency) => ({ dependency_type: dependency.dependencyType, project_id: dependency.projectId ?? null, version_id: dependency.versionId ?? null, file_name: dependency.fileName ?? null })),
  modpost_dependencies: version.dependencies,
  modpost_loader_bridges: version.loaderBridges ?? [],
  game_versions: version.gameVersions,
  loaders: version.loaders,
  date_published: version.publishedAt ?? '2026-10-14T00:00:00.000Z',
  downloads: 0,
  version_type: version.type,
  status: version.status,
  requested_status: 'listed',
  files: version.files.map((file) => launcherFile(file, origin)),
})

const getOrigin = (c: Context<any>) => new URL(c.env.PUBLIC_BASE_URL || c.req.url).origin

export function registerModrinthCompat(app: Hono<any>, getCatalog: (c: Context<any>) => Catalog | Promise<Catalog>, prefix: string) {
  app.get(`${prefix}/project/:id`, async (c) => {
    const id = c.req.param('id')
    const project = (await getCatalog(c)).projects.find((item) => item.id === id || item.slug === id)
    if (!project) return c.json({ error: 'Project not found' }, 404)
    return c.json(projectResponse(project, getOrigin(c)))
  })

  app.get(`${prefix}/project/:id/version`, async (c) => {
    const id = c.req.param('id')
    const project = (await getCatalog(c)).projects.find((item) => item.id === id || item.slug === id)
    if (!project) return c.json({ error: 'Project not found' }, 404)
    const gameVersions = c.req.queries('game_versions') ?? []
    const loaders = c.req.queries('loaders') ?? []
    const versionType = c.req.query('version_type')
    const versions = project.versions.filter((version) =>
      (!gameVersions.length || gameVersions.some((item) => version.gameVersions.includes(item))) &&
      (!loaders.length || loaders.some((item) => version.loaders.includes(item))) &&
      (!versionType || version.type === versionType),
    )
    return c.json(versions.map((version) => versionResponse(project, version, getOrigin(c))))
  })

  app.get(`${prefix}/version/:id`, async (c) => {
    const result = (await getCatalog(c)).projects.flatMap((project) => project.versions.map((version) => ({ project, version })))
      .find((item) => item.version.id === c.req.param('id'))
    if (!result) return c.json({ error: 'Version not found' }, 404)
    return c.json(versionResponse(result.project, result.version, getOrigin(c)))
  })

  app.get(`${prefix}/version_file`, async (c) => {
    const hash = (c.req.query('hash') ?? '').toLowerCase()
    const result = (await getCatalog(c)).projects.flatMap((project) => project.versions.flatMap((version) => version.files.map((file) => ({ project, version, file }))))
      .find((item) => item.file.sha1?.toLowerCase() === hash || item.file.sha512?.toLowerCase() === hash)
    if (!result) return c.json({ error: 'File not found' }, 404)
    return c.json(versionResponse(result.project, result.version, getOrigin(c)))
  })

  app.get(`${prefix}/search`, async (c) => {
    const query = (c.req.query('query') ?? '').toLowerCase()
    const projectTypeFilter = c.req.query('project_type')
    const hits = (await getCatalog(c)).projects.filter((project) =>
      (!query || `${project.title} ${project.slug} ${project.description}`.toLowerCase().includes(query)) &&
      (!projectTypeFilter || project.type === projectTypeFilter),
    ).map((project) => ({ ...projectResponse(project, getOrigin(c)), author: '', display_categories: project.categories }))
    const offset = Math.max(0, Number(c.req.query('offset') ?? 0))
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 10)))
    return c.json({ hits: hits.slice(offset, offset + limit), offset, limit, total_hits: hits.length })
  })

  app.get(`${prefix}/tag/game_version`, async (c) => c.json([...new Set((await getCatalog(c)).projects.flatMap((project) => project.gameVersions))].map((version) => ({ version }))))
  app.get(`${prefix}/tag/loader`, async (c) => c.json([...new Set((await getCatalog(c)).projects.flatMap((project) => project.loaders))].map((loader) => ({ name: loader, supported_project_types: ['mod'] }))))
  app.get(`${prefix}/tag/category`, async (c) => c.json([...new Set((await getCatalog(c)).projects.flatMap((project) => project.categories))].map((name) => ({ name, project_type: 'mod' }))))
  app.get(`${prefix}/tag/project_type`, async (c) => c.json([{ name: 'mod' }, { name: 'modpack' }, { name: 'resourcepack' }, { name: 'shader' }, { name: 'plugin' }, { name: 'tool' }]))
  app.get(`${prefix}/tag/license`, async (c) => c.json([...new Set((await getCatalog(c)).projects.map((project) => project.license).filter(Boolean))].map((id) => ({ id, name: id, url: null }))))
}

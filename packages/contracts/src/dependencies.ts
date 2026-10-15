import { z } from 'zod'
import { valid, validRange, rcompare, satisfies } from 'semver'
import { parse as parseToml } from 'smol-toml'
import type { Catalog, Dependency, Project, Version, ExternalDependency } from './index.js'

export const externalProjectId = (ref: ExternalDependency) => `external:${ref.provider}:${ref.projectId}`
export const externalVersionId = (provider: ExternalDependency['provider'], id: string) => `external:${provider}:${id}`
export const externalProjectUrl = (ref: ExternalDependency) => ref.provider === 'modrinth' ? `https://modrinth.com/mod/${encodeURIComponent(ref.projectId)}` : `https://www.curseforge.com/projects/${encodeURIComponent(ref.projectId)}`
export type ImportedDependency = { modId: string; rawRange: string; dependency: Dependency }
export function parseModDependencies(text: string): ImportedDependency[] {
  if (text.length > 1_000_000) throw new Error('Metadata too large')
  const json = text.trim().startsWith('{')
  const data = json ? JSON.parse(text) : parseToml(text)
  const rows: Array<{ id: string; range: string; type: Dependency['dependencyType']; side?: 'both' | 'client' | 'server' }> = []
  if (json) {
    for (const [key,type] of Object.entries({ depends: 'required', recommends: 'recommended', suggests: 'optional', breaks: 'incompatible', conflicts: 'incompatible' } as const)) {
      for (const [id,value] of Object.entries(data[key] || {})) rows.push({ id, range: Array.isArray(value) ? value.join(' || ') : String(value), type })
    }
  } else {
    for (const entries of Object.values(data.dependencies || {})) for (const d of (Array.isArray(entries) ? entries : [])) {
      rows.push({ id: d.modId, range: String(d.versionRange || '*'), type: d.type === 'incompatible' ? 'incompatible' : d.type === 'optional' || d.mandatory === false ? 'optional' : 'required', side: d.side === 'CLIENT' ? 'client' : d.side === 'SERVER' ? 'server' : 'both' })
    }
  }
  return rows.map(row => {
    let range = row.range
    const interval = range.match(/^([\[(])([^,]*),([^\])]*)([\])])$/)
    if (interval) range = [interval[2] ? `${interval[1] === '[' ? '>=' : '>'}${interval[2]}` : '', interval[3] ? `${interval[4] === ']' ? '<=' : '<'}${interval[3]}` : ''].filter(Boolean).join(' ') || '*'
    if (/^\[[^,]+\]$/.test(range)) range = range.slice(1,-1)
    if (!validRange(range)) throw new Error(`Unsupported range for ${row.id}: ${row.range}; declare an exact version or version set manually`)
    return { modId: row.id, rawRange: row.range, dependency: { dependencyType: row.type, versionConstraint: { scheme: 'semver', range }, appliesTo: row.side ? { side: row.side } : undefined } }
  })
}

export const dependencyRequestSchema = z.object({
  versionId: z.string().min(1), gameVersion: z.string().min(1), loader: z.string().min(1),
  loaderVersion: z.string().optional(), side: z.enum(['client', 'server']),
  selectedOptionalDependencies: z.array(z.string()).max(200).default([]),
  enabledFeatures: z.array(z.string()).max(100).default([]),
  installedVersions: z.array(z.string()).max(200).default([]),
  fileSelections: z.record(z.string(), z.string()).default({}),
})
export type DependencyRequest = z.infer<typeof dependencyRequestSchema>
type Node = { project: Project; version: Version }
export type DependencyProblem = { code: string; path: string[]; message: string }
export const matchesDependency = (d: Dependency, v: Version) => (!d.versionId || d.versionId === v.id) && (!d.external?.versionId || externalVersionId(d.external.provider, d.external.versionId) === v.id) && (!d.versionConstraint || (d.versionConstraint.scheme === 'exact' ? d.versionConstraint.versions.includes(v.version) : Boolean(valid(v.version)) && satisfies(v.version, d.versionConstraint.range)))
export function validateDependencies(project: Project, catalog: Catalog): string[] {
  const errors: string[] = []
  if (project.id.startsWith('external:') || project.versions.some(v => v.id.startsWith('external:') || v.files.some(f => f.id.startsWith('external:')))) errors.push('The external: namespace is reserved')
  const projects = [...catalog.projects.filter(p => p.id !== project.id), project]
  const versionIds = new Set<string>()
  for (const p of projects) for (const v of p.versions) {
    if (versionIds.has(v.id)) errors.push(`Duplicate version ID: ${v.id}`)
    versionIds.add(v.id)
  }
  for (const v of project.versions) {
    const destinations = new Set<string>()
    for (const b of v.loaderBridges || []) {
      if (!v.loaders.includes(b.fromLoader) || b.fromLoader === b.toLoader || v.loaders.includes(b.toLoader)) errors.push(`${v.id}: invalid bridge loader pair`)
      if (destinations.has(b.toLoader)) errors.push(`${v.id}: use one bridge per target loader`)
      destinations.add(b.toLoader)
      const target = projects.find(p => p.id === b.viaProjectId)
      if (!target || target.id === project.id) errors.push(`${v.id}: invalid bridge project`)
      if (target && b.viaVersionId && !target.versions.some(v => v.id === b.viaVersionId)) errors.push(`${v.id}: unknown bridge version`)
      if (b.gameVersions?.some(g => !v.gameVersions.includes(g))) errors.push(`${v.id}: bridge game version outside release`)
    }
  }
  for (const v of project.versions) for (const d of v.dependencies) {
    const target = d.projectId ? projects.find(p => p.id === d.projectId) : projects.find(p => p.versions.some(v => v.id === d.versionId))
    if (!d.external && !target && !(d.fileName && !d.projectId && !d.versionId)) errors.push(`${v.id}: unknown dependency ${d.projectId || d.versionId || '(empty)'}`)
    if (target && d.versionId && !target.versions.some(v => matchesDependency(d, v))) errors.push(`${v.id}: invalid version reference ${d.versionId}`)
    if (target?.id === project.id && d.dependencyType === 'required') errors.push(`${v.id}: self dependency`)
    if (d.appliesTo?.loaders?.some(l => !v.loaders.includes(l) && !v.loaderBridges?.some(b => b.toLoader === l))) errors.push(`${v.id}: dependency loader outside release`)
    if (d.appliesTo?.gameVersions?.some(g => !v.gameVersions.includes(g))) errors.push(`${v.id}: dependency game version outside release`)
  }
  return errors
}

export function resolveDependencies(catalog: Catalog, input: DependencyRequest, externalDownloads: Record<string, string> = {}) {
  const unresolvedExternal = new Map<string, ExternalDependency>()
  const all: Node[] = catalog.projects.flatMap(project => project.versions.filter(v => v.status === 'listed' || v.status === 'unlisted').map(version => ({ project, version })))
  const pinnedVersion = (d: Dependency) => d.external?.versionId ? externalVersionId(d.external.provider, d.external.versionId) : d.versionId
  const declaredPins = new Set(all.flatMap(n => n.version.dependencies.map(pinnedVersion)).filter(Boolean))
  const byVersion = new Map(all.map(n => [n.version.id, n]))
  const root = byVersion.get(input.versionId)
  let attempts = 0
  const deadline = Date.now() + 1500
  let problem: DependencyProblem = { code: 'NOT_FOUND', path: [input.versionId], message: 'Version not found' }
  const bridgeFor = (n: Node) => n.version.loaders.includes(input.loader) ? undefined : n.version.loaderBridges?.find(b => b.toLoader === input.loader && n.version.loaders.includes(b.fromLoader) && (!b.gameVersions?.length || b.gameVersions.includes(input.gameVersion)) && (!b.side || b.side === 'both' || b.side === input.side))
  const compatible = (n: Node) => n.version.gameVersions.includes(input.gameVersion) && (n.version.loaders.includes(input.loader) || Boolean(bridgeFor(n))) && n.project[input.side === 'client' ? 'clientSide' : 'serverSide'] !== 'unsupported'
  const declarations = (n: Node): Dependency[] => {
    const b = bridgeFor(n)
    return b ? [...n.version.dependencies, { id: `bridge:${n.version.id}:${b.toLoader}`, projectId: b.viaProjectId, versionId: b.viaVersionId, dependencyType: 'required', versionConstraint: b.viaRange ? { scheme: 'semver', range: b.viaRange } : undefined, reason: b.reason || `${b.fromLoader} → ${b.toLoader}` }] : n.version.dependencies
  }
  const applicable = (d: Dependency, selected: Map<string, Node>, owner: Node) => {
    const a = d.appliesTo
    return (!a?.loaders?.length || a.loaders.includes(input.loader) || Boolean(bridgeFor(owner) && a.loaders.includes(bridgeFor(owner)!.fromLoader))) && (!a?.gameVersions?.length || a.gameVersions.includes(input.gameVersion)) && (!a?.side || a.side === 'both' || a.side === input.side) && (!d.when?.feature || input.enabledFeatures.includes(d.when.feature)) && (!d.when?.installedProjectIds?.length || d.when.installedProjectIds.every(id => selected.has(id)))
  }
  const targetId = (d: Dependency) => d.external ? externalProjectId(d.external) : d.projectId || (d.versionId ? byVersion.get(d.versionId)?.project.id : undefined)
  const loaderVersionFor = (d: Dependency, n: Node) => bridgeFor(n) && d.appliesTo?.loaders?.includes(bridgeFor(n)!.fromLoader) && !d.appliesTo.loaders.includes(input.loader) ? bridgeFor(n)!.fromLoaderVersion : input.loaderVersion
  type Edge = { from: string; to?: string; dependency: Dependency; active: boolean }
  const walk = (selected: Map<string, Node>, paths: Map<string, string[]>): Map<string, Node> | null => {
    if (++attempts > 5000 || Date.now() > deadline || selected.size > 200) { problem = { code: 'LIMIT', path: [], message: 'Dependency resolution limit exceeded' }; return null }
    for (const n of selected.values()) for (const d of declarations(n)) {
      if (!applicable(d, selected, n)) continue
      const id = targetId(d)
      const path = [...(paths.get(n.project.id) || []), id || d.fileName || '?']
      const loaderVersion = loaderVersionFor(d, n)
      if (d.appliesTo?.loaderRange && (!loaderVersion || !valid(loaderVersion))) { problem = { code: 'LOADER_VERSION_REQUIRED', path, message: 'Specify a semantic loader version (or the bridge source loader version)' }; return null }
      if (d.appliesTo?.loaderRange && !satisfies(loaderVersion!, d.appliesTo.loaderRange)) continue
      const bridgeRequirement = d.id === `bridge:${n.version.id}:${input.loader}` && Boolean(bridgeFor(n))
      const chosen = id ? selected.get(id) : undefined
      if (d.dependencyType === 'incompatible') {
        if (chosen && matchesDependency(d, chosen.version)) { problem = { code: 'INCOMPATIBLE', path, message: `Conflicts with ${chosen.version.id}` }; return null }
        continue
      }
      if (d.dependencyType === 'embedded' || d.dependencyType === 'integration') continue
      const required = d.dependencyType === 'required' || input.selectedOptionalDependencies.includes(d.id || id || '')
      if (!required && !chosen) continue
      if (!id) { if (!required) continue; problem = { code: 'UNRESOLVED', path, message: 'Dependency has no resolvable project/version ID' }; return null }
      if (d.external?.versionId && !byVersion.has(externalVersionId(d.external.provider, d.external.versionId))) unresolvedExternal.set(`${id}:${d.external.versionId}`, d.external)
      if (chosen) {
        if (!matchesDependency(d, chosen.version) || (bridgeRequirement && !chosen.version.loaders.includes(input.loader))) { problem = { code: 'VERSION_CONFLICT', path, message: `Constraint conflicts with ${chosen.version.id}; selected via ${(paths.get(id) || []).join(' → ')}` }; return null }
        continue
      }
      const candidates = all.filter(c => c.project.id === id && (c.version.status === 'listed' || Boolean(declaredPins.has(c.version.id) && c.version.status === 'unlisted')) && (!bridgeRequirement || c.version.loaders.includes(input.loader)) && compatible(c) && matchesDependency(d, c.version)).sort((a,b) => valid(a.version.version) && valid(b.version.version) ? rcompare(a.version.version,b.version.version) : (b.version.publishedAt || '').localeCompare(a.version.publishedAt || '') || a.version.id.localeCompare(b.version.id))
      if (!candidates.length) { if (d.external && (!catalog.projects.some(p => p.id === id) || Boolean(d.external.versionId && !byVersion.has(externalVersionId(d.external.provider, d.external.versionId))))) unresolvedExternal.set(`${id}:${d.external.versionId || ''}`, d.external); problem = { code: 'MISSING', path, message: 'No compatible dependency release' }; return null }
      for (const candidate of candidates) {
        const next = new Map(selected); next.set(id, candidate)
        const nextPaths = new Map(paths); nextPaths.set(id, path)
        const result = walk(next, nextPaths)
        if (result) return result
        if (problem.code === 'LIMIT') return null
      }
      return null
    }
    for (const n of selected.values()) {
      if (n.version.status !== 'unlisted' || n.version.id === input.versionId || input.installedVersions.includes(n.version.id)) continue
      const explicitlyRequired = [...selected.values()].some(owner => declarations(owner).some(d => pinnedVersion(d) === n.version.id && applicable(d, selected, owner) && !['incompatible','integration','embedded'].includes(d.dependencyType)))
      if (!explicitlyRequired) { problem = { code: 'MISSING', path: [n.project.id], message: 'Unlisted releases require an active exact version reference' }; return null }
    }
    return selected
  }
  const initial = new Map<string, Node>()
  const paths = new Map<string, string[]>()
  let invalid = !root
  for (const id of [input.versionId, ...input.installedVersions]) {
    const n = byVersion.get(id)
    if (!n || !compatible(n) || (initial.has(n.project.id) && initial.get(n.project.id)!.version.id !== id)) { invalid = true; problem = { code: 'INVALID_ENVIRONMENT', path: [id], message: 'Unknown, conflicting or incompatible installed/root version' }; continue }
    initial.set(n.project.id,n); paths.set(n.project.id,[n.project.id])
  }
  const selected = invalid ? null : walk(initial, paths)
  const edges: Edge[] = []
  const warnings: DependencyProblem[] = []
  const manifest: Array<{ projectId: string; versionId: string; fileId: string; name: string; url: string; sha1?: string; sha512?: string }> = []
  if (selected) for (const n of selected.values()) {
    for (const d of declarations(n)) {
      const loaderVersion = loaderVersionFor(d, n)
      const active = applicable(d, selected, n) && (!d.appliesTo?.loaderRange || Boolean(loaderVersion && valid(loaderVersion) && satisfies(loaderVersion,d.appliesTo.loaderRange)))
      edges.push({ from: n.project.id, to: targetId(d), dependency: d, active })
      const target = selected.get(targetId(d) || '')
      if (active && d.dependencyType === 'integration' && target && !matchesDependency(d,target.version)) warnings.push({ code: 'INTEGRATION_UNAVAILABLE', path: [n.project.id,target.project.id], message: d.reason || 'Installed version does not support this integration' })
    }
    if (input.installedVersions.includes(n.version.id)) continue
    const files = n.version.files.filter(f => f.reviewStatus === 'approved' && f.fileType !== 'source-jar')
    const explicit = input.fileSelections[n.version.id]
    const choices = explicit ? files.filter(f => f.id === explicit) : files.some(f => f.primary) ? files.filter(f => f.primary) : files
    if (choices.length !== 1) { warnings.push({ code: 'FILE_SELECTION_REQUIRED', path: [n.project.id,n.version.id], message: 'Select exactly one installable file' }); continue }
    const f = choices[0]
    if (n.project.id.startsWith('external:') && !externalDownloads[f.id]) { warnings.push({ code: 'EXTERNAL_DOWNLOAD_UNAVAILABLE', path: [n.project.id,n.version.id], message: 'Provider does not allow a direct download; open the original project to install manually' }); continue }
    manifest.push({ projectId: n.project.id, versionId: n.version.id, fileId: f.id, name: f.name, url: externalDownloads[f.id] || `/api/v1/files/${encodeURIComponent(f.id)}/download`, sha1: f.sha1, sha512: f.sha512 })
  }
  const visit = (id: string, stack: string[], done: Set<string>) => {
    if (stack.includes(id)) { warnings.push({ code: 'CYCLE', path: [...stack,id], message: 'Circular dependency; each project is installed once' }); return }
    if (done.has(id)) return
    done.add(id)
    for (const e of edges.filter(e => e.active && e.from === id && e.dependency.dependencyType === 'required' && e.to && selected?.has(e.to))) visit(e.to!, [...stack,id], done)
  }
  if (selected && root) visit(root.project.id, [], new Set())
  return { unresolvedExternal: selected ? [] : [...unresolvedExternal.values()], success: Boolean(selected), installable: Boolean(selected) && !warnings.some(w => ['FILE_SELECTION_REQUIRED', 'EXTERNAL_DOWNLOAD_UNAVAILABLE'].includes(w.code)), nodes: [...(selected?.values() || [])].map(n => ({ projectId: n.project.id, slug: n.project.slug, externalUrl: n.project.id.startsWith('external:') ? externalProjectUrl({ provider: n.project.id.split(':')[1] as ExternalDependency['provider'], projectId: n.project.id.split(':')[2] }) : undefined, title: n.project.title, versionId: n.version.id, version: n.version.version, bridge: bridgeFor(n), files: n.version.files.map(f => ({ id: f.id, name: f.name })) })), edges, errors: selected ? [] : [problem], warnings, manifest: selected ? manifest : [] }
}

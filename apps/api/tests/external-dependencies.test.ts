import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogSchema, dependencySchema, dependencyRequestSchema, projectSchema, validateDependencies } from '@andrea/contracts'
import { externalProviderClient, resolveWithExternal } from '../src/external-dependencies.js'
import { createApp } from '../src/app.js'
import { MemoryAccountStore, createJwt } from '../src/auth.js'

const input = dependencyRequestSchema.parse({ versionId: 'root', loader: 'fabric', gameVersion: '1.20.1', side: 'client' })
const ref = (projectId = 'library', provider = 'modrinth', extra = {}) => ({ dependencyType: 'required', external: { provider, projectId, ...extra } })
const catalog = (dependencies: unknown[]) => catalogSchema.parse({ schemaVersion: 1, catalogRevision: 'test', generatedAt: new Date().toISOString(), projects: [projectSchema.parse({ id: 'root', slug: 'root', title: 'Root', description: '', type: 'mod', loaders: ['fabric'], gameVersions: ['1.20.1'], versions: [{ id: 'root', version: '1.0.0', type: 'release', loaders: ['fabric'], gameVersions: ['1.20.1'], dependencies, files: [{ id: 'root-file', name: 'root.jar', primary: true, sources: [] }] }] })] })
const mrVersion = (project = 'library', id = 'v1', dependencies: unknown[] = []) => ({ id, project_id: project, version_number: '1.0.0', version_type: 'release', status: 'listed', game_versions: ['1.20.1'], loaders: ['fabric'], date_published: '2026-01-01T00:00:00.000Z', dependencies, files: [{ filename: 'mod.jar', url: `https://cdn.modrinth.com/data/${project}/${id}/mod.jar`, primary: true, size: 100, hashes: { sha1: 'a'.repeat(40) } }] })
const cfFile = (url: string | null = 'https://edge.forgecdn.net/files/1/mod.jar') => ({ id: 77, modId: 12, displayName: 'Fabric release 1', fileName: 'mod.jar', fileDate: '2026-01-01T00:00:00.000Z', releaseType: 1, isAvailable: true, gameVersions: ['1.20.1', 'Fabric'], downloadUrl: url, fileLength: 10, hashes: [{ algo: 1, value: 'b'.repeat(40) }], dependencies: [] })
function fetchFixture(versions = [mrVersion()], cfUrl: string | null = 'https://edge.forgecdn.net/files/1/mod.jar') {
  const calls: string[] = []
  const fetcher: typeof fetch = async (url, init) => {
    const u = new URL(String(url)); calls.push(u.href)
    assert.equal(init?.redirect, 'error')
    if (u.hostname === 'api.curseforge.com') {
      assert.equal(new Headers(init?.headers).get('x-api-key'), 'test-secret')
      if (u.pathname === '/v1/mods/12') return Response.json({ data: { id: 12, gameId: 432, name: 'CF Library', slug: 'cf-library', summary: '', allowModDistribution: true } })
      if (u.pathname === '/v1/mods/files') return Response.json({ data: [cfFile(cfUrl)] })
      if (u.pathname.endsWith('/files/77')) return Response.json({ data: cfFile(cfUrl) })
      if (u.pathname === '/v1/mods/12/files') return Response.json({ data: [cfFile(cfUrl)], pagination: { totalCount: 1 } })
    }
    assert.equal(u.hostname, 'api.modrinth.com')
    assert.equal(new Headers(init?.headers).has('x-api-key'), false)
    if (u.pathname.includes('/version/')) { const v = versions.find(v => v.id === u.pathname.split('/').at(-1)); return v ? Response.json(v) : new Response('', { status: 404 }) }
    const project = u.pathname.split('/')[3]
    if (u.pathname.endsWith('/version')) return Response.json(versions.filter(v => v.project_id === project && v.status === 'listed'))
    return Response.json({ id: project === 'library-slug' ? 'library' : project, slug: project, title: `MR ${project}`, description: '', client_side: 'optional', server_side: 'optional' })
  }
  return { fetcher, calls }
}

test('external schema rejects mixed targets and unsafe/non-numeric provider references', () => {
  assert.equal(dependencySchema.safeParse({ ...ref(), projectId: 'local' }).success, false)
  assert.equal(dependencySchema.safeParse(ref('https://evil.example')).success, false)
  assert.equal(dependencySchema.safeParse(ref('slug', 'curseforge')).success, false)
  const c = catalog([ref()]); assert.deepEqual(validateDependencies(c.projects[0], c), [])
})

test('MR resolves transitive requirements with canonical IDs, hashes and original CDN downloads', async () => {
  const { fetcher } = fetchFixture([mrVersion('library', 'v1', [{ project_id: 'child', dependency_type: 'required' }]), mrVersion('child', 'v2')])
  const result = await resolveWithExternal(catalog([ref()]), input, {}, fetcher)
  assert.equal(result.installable, true)
  assert.equal(result.nodes.length, 3)
  assert.equal(result.manifest.find(f => f.projectId === 'external:modrinth:child')?.sha1, 'a'.repeat(40))
  assert.match(result.manifest[1].url, /^https:\/\/cdn.modrinth.com/)
  assert.match(result.nodes[1].externalUrl!, /^https:\/\/modrinth.com/)
})

test('unused optional external dependencies do not require upstream access; pins and conflicts remain enforced', async () => {
  const { fetcher, calls } = fetchFixture()
  assert.equal((await resolveWithExternal(catalog([{ ...ref(), dependencyType: 'optional', id: 'opt' }]), input, {}, fetcher)).installable, true)
  assert.equal(calls.length, 0)
  const selected = await resolveWithExternal(catalog([{ ...ref(), dependencyType: 'optional', id: 'opt' }]), { ...input, selectedOptionalDependencies: ['opt'] }, {}, fetcher)
  assert.equal(selected.nodes.length, 2)
  const conflict = await resolveWithExternal(catalog([ref(), { ...ref(), dependencyType: 'incompatible' }]), input, {}, fetcher)
  assert.equal(conflict.success, false); assert.equal(conflict.errors[0].code, 'INCOMPATIBLE')
  const mismatch = await resolveWithExternal(catalog([ref('library', 'modrinth', { versionId: 'other' })]), input, {}, fetchFixture([mrVersion(), mrVersion('wrong-project', 'other')]).fetcher)
  assert.equal(mismatch.success, false); assert.equal(mismatch.errors[0].code, 'EXTERNAL_REFERENCE')
})

test('external installed versions are pinned and not downloaded again; unlisted exact releases can resolve', async () => {
  const v = { ...mrVersion(), status: 'unlisted' }; const { fetcher } = fetchFixture([v])
  const pinned = await resolveWithExternal(catalog([ref('library', 'modrinth', { versionId: 'v1' })]), input, {}, fetcher)
  assert.equal(pinned.installable, true)
  const installed = await resolveWithExternal(catalog([ref()]), { ...input, installedVersions: ['external:modrinth:v1'] }, {}, fetcher)
  assert.equal(installed.installable, true); assert.equal(installed.manifest.length, 1)
})

test('a later exact unlisted constraint hydrates the pinned version before reporting conflict', async () => {
  const v = { ...mrVersion('library', 'hidden'), status: 'unlisted' }
  const result = await resolveWithExternal(catalog([ref(), ref('library', 'modrinth', { versionId: 'hidden' })]), input, {}, fetchFixture([mrVersion(), v]).fetcher)
  assert.equal(result.installable, true)
  assert.equal(result.nodes[1].versionId, 'external:modrinth:hidden')
})

test('CF authenticates server-side and missing key/denied downloads fail explicitly', async () => {
  const missing = await resolveWithExternal(catalog([ref('12', 'curseforge')]), input, {}, fetchFixture().fetcher)
  assert.equal(missing.errors[0].code, 'CF_KEY_REQUIRED')
  const normal = await resolveWithExternal(catalog([ref('12', 'curseforge', { versionId: '77' })]), input, { CURSEFORGE_API_KEY: 'test-secret' }, fetchFixture().fetcher)
  assert.equal(normal.installable, true); assert.match(normal.manifest[1].url, /forgecdn.net/)
  assert.equal(JSON.stringify(normal).includes('test-secret'), false)
  const unavailable = await resolveWithExternal(catalog([ref('12', 'curseforge')]), input, { CURSEFORGE_API_KEY: 'test-secret' }, fetchFixture(undefined, null).fetcher)
  assert.equal(unavailable.success, true); assert.equal(unavailable.installable, false); assert.equal(unavailable.warnings[0].code, 'EXTERNAL_DOWNLOAD_UNAVAILABLE')
})

test('provider failures, unsafe URLs and wrong environments never produce an installable plan', async () => {
  const limited = await resolveWithExternal(catalog([ref()]), input, {}, async () => new Response('', { status: 429 }))
  assert.equal(limited.errors[0].code, 'EXTERNAL_RATE_LIMIT')
  const v = mrVersion(); v.files[0].url = 'https://evil.example/mod.jar'
  assert.equal((await resolveWithExternal(catalog([ref()]), input, {}, fetchFixture([v]).fetcher)).installable, false)
  v.loaders = ['forge']
  assert.equal((await resolveWithExternal(catalog([ref()]), input, {}, fetchFixture([v]).fetcher)).success, false)
})

test('lookup canonicalizes MR slug, API persists references and resolves without creating local mirror projects', async () => {
  const store = new MemoryAccountStore(); await store.createAccount({ id: 'root', email: 'root@example.com', passwordHash: '', role: 'root', createdAt: new Date().toISOString(), verifiedAt: null })
  const app = createApp({ authStore: store, externalFetch: fetchFixture().fetcher })
  const env = { CATALOG_JSON: JSON.stringify({ ...catalog([]), projects: [] }) }
  const lookup = await app.request('/api/v1/dependencies/external?provider=modrinth&projectId=library-slug&loader=fabric&gameVersion=1.20.1', {}, env)
  assert.equal(lookup.status, 200); assert.equal((await lookup.json()).reference.projectId, 'library')
  const token = await createJwt({ sub: 'root', email: 'root@example.com', role: 'root' })
  const created = await app.request('/api/v1/admin/projects', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(catalog([ref()]).projects[0]) }, env)
  assert.equal(created.status, 201)
  const response = await app.request('/api/v1/dependencies/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }, env)
  assert.equal((await response.json()).installable, true)
  assert.equal((await store.listStoredProjects()).length, 1)
})

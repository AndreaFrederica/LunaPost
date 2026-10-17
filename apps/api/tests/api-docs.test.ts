import assert from 'node:assert/strict'
import test from 'node:test'
import { projectSchema, type ApiDocumentation } from '@andrea/contracts'
import { createApp } from '../src/app.js'
import { createJwt, hashApiKey, MemoryAccountStore, type AccountRole } from '../src/auth.js'
import { projectExample } from '../src/docs/guides.js'

async function fixture() {
  const store = new MemoryAccountStore()
  const env = { JWT_SECRET: 'api-docs-test-secret' }
  const headers: Record<string, { Authorization: string }> = {}
  for (const [id, role] of Object.entries({ root: 'root', admin: 'admin', owner: 'developer', editor: 'developer', newcomer: 'developer', user: 'user' })) {
    const email = `${id}@example.test`
    await store.createAccount({ id, email, role: role as AccountRole, passwordHash: '', createdAt: new Date().toISOString(), verifiedAt: null })
    headers[id] = { Authorization: `Bearer ${await createJwt({ sub: id, email, role: role as AccountRole }, env.JWT_SECRET)}` }
  }
  const project = projectSchema.parse({ ...projectExample, ownerId: 'owner', ownerType: 'account' })
  await store.saveStoredProject(project)
  await store.setProjectMember(project.id, 'owner', 'owner')
  await store.setProjectMember(project.id, 'editor', 'editor')
  const app = createApp({ authStore: store })
  const request = (name?: string, suffix = '') => app.request(`/api/v1/docs${suffix}`, { headers: name ? headers[name] : undefined }, env)
  const document = async (name?: string, suffix = '') => (await (await request(name, suffix)).json()) as ApiDocumentation
  return { store, env, app, headers, request, document }
}

test('JSON and Markdown enforce account roles and never share root content with other users', async () => {
  const f = await fixture()
  const root = await f.document('root')
  assert.ok(root.endpoints.some(item => item.path === '/api/v1/admin/database/import'))
  for (const name of [undefined, 'user', 'newcomer', 'editor', 'owner', 'admin']) {
    const response = await f.request(name, '?role=root')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0')
    assert.equal(response.headers.get('cdn-cache-control'), 'no-store')
    assert.match(response.headers.get('vary')!, /Authorization/)
    assert.match(response.headers.get('vary')!, /Cookie/)
    const body = await response.text()
    assert.ok(!body.includes('/api/v1/admin/database/'), `${name} received root database documentation`)
    assert.ok(!body.includes('/api/v1/admin/accounts/:id/minecraft-profile'))
    if (name !== 'admin') assert.ok(!body.includes('/api/v1/admin/settings'))
    const md = await f.request(name, '?format=markdown&lang=en-US&role=root')
    assert.match(md.headers.get('content-type')!, /text\/markdown/)
    const markdown = await md.text()
    assert.ok(markdown.startsWith('# Developer API'))
    assert.ok(!markdown.includes('/api/v1/admin/database/'))
  }
  assert.equal((await f.request('root', '?format=html')).status, 400)
})

test('project editor, owner, new developer and ordinary account receive different operations', async () => {
  const f = await fixture()
  const has = (doc: ApiDocumentation, path: string) => doc.endpoints.some(item => item.path === path)
  const editor = await f.document('editor', '?project=example-mod')
  assert.ok(has(editor, '/api/v1/projects/:slug/publish'))
  assert.ok(!has(editor, '/api/v1/projects/:slug/publish-tokens'))
  assert.ok(!editor.guides.find(guide => guide.id === 'authentication')?.code)
  const owner = await f.document('owner', '?project=example-mod')
  assert.ok(has(owner, '/api/v1/projects/:slug/publish-tokens'))
  const newcomer = await f.document('newcomer')
  assert.ok(has(newcomer, '/api/v1/admin/projects'))
  assert.ok(!has(newcomer, '/api/v1/projects/:slug/publish'))
  assert.equal((await f.request('newcomer', '?project=example-mod')).status, 404)
  assert.equal((await f.request('user', '?project=example-mod')).status, 404)
  const user = await f.document('user')
  assert.ok(!has(user, '/api/v1/admin/projects'))
  assert.ok(!user.guides.some(guide => ['actions-example', 'release-modes', 'direct-upload'].includes(guide.id)))
})

test('API key scopes, project-bound tokens, revocation and current database roles are respected', async () => {
  const f = await fixture()
  await f.store.createApiKey({ id: 'read-key', accountId: 'owner', name: 'read', keyHash: await hashApiKey('read-key-secret'), scopes: ['read'], createdAt: new Date().toISOString(), revokedAt: null })
  const keyDoc = await (await f.app.request('/api/v1/docs', { headers: { Authorization: 'Bearer read-key-secret' } }, f.env)).json() as ApiDocumentation
  assert.ok(!keyDoc.endpoints.some(item => item.scope))
  assert.ok(!keyDoc.guides.some(guide => ['create-project', 'release-modes', 'actions-example'].includes(guide.id)))
  await f.store.createProjectPublishToken({ id: 'publish-key', accountId: 'owner', projectSlug: 'example-mod', name: 'CI', tokenHash: await hashApiKey('publish-key-secret'), scopes: ['release:write'], createdAt: new Date().toISOString(), revokedAt: null })
  const init = { headers: { Authorization: 'Bearer publish-key-secret' } }
  const doc = await (await f.app.request('/api/v1/docs', init, f.env)).json() as ApiDocumentation
  assert.equal(doc.viewer.project, 'example-mod')
  assert.ok(doc.endpoints.some(item => item.path === '/api/v1/projects/:slug/publish'))
  assert.ok(!doc.endpoints.some(item => item.path === '/api/v1/projects/:slug/publish-tokens'))
  assert.equal((await f.app.request('/api/v1/docs?project=another-project', init, f.env)).status, 403)
  assert.ok(!(await f.store.listApiKeys('owner')).some(key => key.id === 'publish-key'))
  assert.ok(!JSON.stringify(await f.store.listProjectPublishTokens('example-mod')).includes('tokenHash'))
  assert.equal(await f.store.revokeProjectPublishToken('another-project', 'publish-key'), false)
  assert.equal(await f.store.revokeProjectPublishToken('example-mod', 'publish-key'), true)
  assert.equal(((await (await f.app.request('/api/v1/docs', init, f.env)).json()) as ApiDocumentation).viewer.role, 'guest')
  await f.store.revokeApiKey('owner', 'read-key')
  assert.equal(((await (await f.app.request('/api/v1/docs', { headers: { Authorization: 'Bearer read-key-secret' } }, f.env)).json()) as ApiDocumentation).viewer.role, 'guest')
  await f.store.updateRole('root', 'user')
  const demoted = await f.document('root') // Old JWT still claims root.
  assert.equal(demoted.viewer.role, 'user')
  assert.ok(!demoted.endpoints.some(item => item.access === 'root'))
})

test('direct-upload documentation follows configured groups; business endpoints still enforce access', async () => {
  const f = await fixture()
  const before = await f.document('user')
  assert.ok(!before.endpoints.some(item => item.access === 'direct'))
  const { settings } = await (await f.app.request('/api/v1/admin/settings', { headers: f.headers.root }, f.env)).json() as any
  settings.storage.directUpload.roles = ['user']
  await f.store.setAppSetting('site_settings', JSON.stringify(settings))
  assert.ok((await f.document('user')).endpoints.some(item => item.access === 'direct'))
  assert.ok(!(await f.document('admin')).endpoints.some(item => item.access === 'direct'))
  assert.equal((await f.app.request('/api/v1/admin/database/export', { headers: f.headers.admin }, f.env)).status, 403)
  assert.equal((await f.app.request('/api/v1/admin/settings', { headers: f.headers.user }, f.env)).status, 403)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { exampleCatalog } from '@andrea/contracts/catalog'
import { createApp } from '../src/app.js'
import { createJwt, MemoryAccountStore } from '../src/auth.js'

test('project favorites and download events are persisted and exposed to dashboard', async () => {
  const store = new MemoryAccountStore()
  const account = { id: 'engagement-user', email: 'engagement@example.com', passwordHash: '', createdAt: new Date().toISOString(), verifiedAt: null, role: 'admin' as const }
  await store.createAccount(account)
  const token = await createJwt({ sub: account.id, email: account.email, role: account.role })
  const app = createApp({ authStore: store })
  const headers = { Authorization: `Bearer ${token}` }
  const env = {}
  const slug = exampleCatalog.projects[0].slug
  const file = exampleCatalog.projects[0].versions[0].files[0]

  let response = await app.request(`/api/v1/projects/${slug}/favorite`, { method: 'PUT', headers }, env)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).favorite, true)

  response = await app.request('/api/v1/account/favorites', { headers }, env)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).projects[0].slug, slug)

  response = await app.request(`/api/v1/files/${file.id}/download`, { headers }, env)
  assert.equal(response.status, 302)

  response = await app.request('/api/v1/admin/overview', { headers }, env)
  const overview = await response.json() as { downloads: number; favorites: number; topDownloads: Array<{ projectSlug: string }> }
  assert.equal(overview.downloads, 1)
  assert.equal(overview.favorites, 1)
  assert.equal(overview.topDownloads[0].projectSlug, slug)
})

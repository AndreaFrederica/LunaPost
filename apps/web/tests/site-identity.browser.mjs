import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const project = JSON.parse(readFileSync(new URL('../../../catalog/catalog.json', import.meta.url))).projects.find(p => p.slug === 'luna-launcher')
let settings = { appearance: { roundedProjectIcons: true, siteName: 'LunaPost', siteIconUrl: '/assets/projects/luna-launcher/icon.png' }, registration: { enabled: true, requireInviteCode: false, requireApproval: false, inviteCodes: [] }, moderation: { projectCreation: 'full', fileSubmission: 'full', automatic: { failMode: 'manual', maxFileSize: 536870912, blockedExtensions: [], requireHashes: false, requireSource: true } }, ygg: { enabled: true, allowLocalAccounts: true, upstreams: [] } }
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname
  if (path === '/api/v1/admin/settings' && route.request().method() === 'PUT') settings = route.request().postDataJSON()
  const data = path === '/api/v1/settings' ? { settings: { appearance: settings.appearance, registration: settings.registration } }
    : path === '/api/v1/admin/settings' ? { settings }
    : path === '/api/v1/me' ? { account: { id: 'root', email: 'root@example.com', role: 'root', metadata: {} } }
    : path === '/api/v1/admin/overview' ? { accounts: 1, projects: 1, versions: 1, files: 1 }
    : path.endsWith('/accounts') ? { accounts: [] }
    : path.endsWith('/reviews') ? { reviews: [] }
    : path.endsWith('/members') ? { members: [] }
    : path.endsWith('/notifications') ? { notifications: [] }
    : path.endsWith('/invitations') ? { invitations: [] }
    : path === '/api/v1/admin/projects' || path === '/api/v1/projects' ? { projects: [project], total: 1 }
    : path.startsWith('/api/v1/projects/') ? project : {}
  await route.fulfill({ json: data })
})
try {
  await page.goto('http://127.0.0.1:9012/')
  assert.equal(await page.locator('.brand-name').innerText(), 'LunaPost')
  assert.equal(await page.locator('.brand-mark img').getAttribute('src'), '/assets/projects/luna-launcher/icon.png')
  await page.goto('http://127.0.0.1:9012/admin')
  await page.getByRole('tab', { name: '站点设置' }).click()
  const identityInputs = page.locator('.site-identity-settings input')
  assert.equal(await identityInputs.nth(0).inputValue(), 'LunaPost')
  await identityInputs.nth(0).fill('LunaPost QA')
  const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith('/api/v1/admin/settings'))
  await page.getByRole('button', { name: '保存站点设置' }).click()
  await saved
  await page.goto('http://127.0.0.1:9012/')
  assert.equal(await page.locator('.brand-name').innerText(), 'LunaPost QA')
  assert.equal(await page.title(), 'LunaPost QA')
  assert.deepEqual(errors, [])
  console.log('site identity browser checks passed: default LunaPost/icon, root fields, persistence, header and title')
} finally { await browser.close() }

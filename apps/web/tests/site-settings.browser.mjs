import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const project = JSON.parse(readFileSync(new URL('../../../catalog/catalog.json', import.meta.url))).projects.find(p => p.slug === 'revo-ui')
let settings = { appearance: { roundedProjectIcons: true }, moderation: { projectCreation: 'full', fileSubmission: 'full', automatic: { failMode: 'manual', maxFileSize: 536870912, blockedExtensions: [], requireHashes: false, requireSource: true } } }
const originalModeration = structuredClone(settings.moderation)
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.addInitScript(() => localStorage.setItem('andrea-theme', 'dark'))
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname
  if (path === '/api/v1/admin/settings' && route.request().method() === 'PUT') settings = route.request().postDataJSON()
  const data = path === '/api/v1/admin/settings' ? { settings }
    : path === '/api/v1/settings' ? { settings: { appearance: settings.appearance } }
    : path === '/api/v1/me' ? { account: { id: 'qa', email: 'qa@example.com', role: 'root', metadata: {} } }
    : path === '/api/v1/admin/overview' ? { accounts: 1, projects: 1, files: 1, versions: 1 }
    : path.endsWith('/accounts') ? { accounts: [] }
    : path.endsWith('/reviews') ? { reviews: [] }
    : path.endsWith('/members') ? { members: [] }
    : path.endsWith('/notifications') ? { notifications: [] }
    : path.endsWith('/invitations') ? { invitations: [] }
    : path.startsWith('/api/v1/users/') ? { profile: { id: 'qa', handle: 'qa', displayName: 'QA', bio: '', createdAt: '2026-01-01' }, projects: [project] }
    : path.startsWith('/api/v1/organizations/') ? { organization: { id: 'qa', slug: 'qa', name: 'QA', createdAt: '2026-01-01' }, members: [], projects: [project] }
    : path.startsWith('/api/v1/projects/') ? project
    : path.endsWith('/projects') ? { projects: [project], total: 1 } : {}
  await route.fulfill({ json: data })
})
const base = process.env.WEB_URL || 'http://127.0.0.1:9012'
const output = new URL('../../../tmp/site-settings-qa/', import.meta.url)
mkdirSync(output, { recursive: true })
const screenshot = name => page.screenshot({ path: fileURLToPath(new URL(name, output)), animations: 'disabled' })
const checkIcon = async (selector, rounded) => {
  const icon = page.locator(selector).first()
  await icon.waitFor()
  await page.waitForFunction(value => document.documentElement.dataset.roundedProjectIcons === String(value), rounded)
  const styles = await icon.evaluate(el => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), background: getComputedStyle(el).backgroundColor }))
  assert.equal(styles.radius > 0, rounded)
  assert.equal(styles.background, 'rgba(0, 0, 0, 0)')
}
try {
  for (const rounded of [true, false, true]) {
    await page.goto(`${base}/admin`)
    await page.getByRole('tab', { name: '站点设置' }).click()
    const toggle = page.getByRole('switch', { name: '项目图标圆角' })
    await toggle.waitFor()
    if ((await toggle.getAttribute('aria-checked') === 'true') !== rounded) await toggle.click()
    const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/settings') && response.request().method() === 'PUT')
    await page.getByRole('button', { name: '保存站点设置' }).click()
    await saved
    await page.waitForFunction(value => document.documentElement.dataset.roundedProjectIcons === String(value), rounded)
    assert.deepEqual(settings.moderation, originalModeration)
    await screenshot(`settings-${rounded}.png`)
    for (const [path, icon] of [['/', '.discover-card-icon.has-image'], ['/projects/revo-ui', '.project-large-icon.has-image'], ['/users/qa', '.profile-project-icon.has-image'], ['/organizations/qa', '.profile-project-icon.has-image']]) {
      await page.goto(`${base}${path}`)
      await checkIcon(icon, rounded)
      if (path === '/') {
        const gap = await page.locator('.discover-card-content').first().evaluate(el => el.querySelector('p').getBoundingClientRect().top - el.querySelector('.discover-card-title').getBoundingClientRect().bottom)
        assert.ok(gap <= 6, `Title/description gap was ${gap}px`)
        assert.ok(await page.locator('.discover-card-title h2').first().evaluate(el => parseFloat(getComputedStyle(el).lineHeight) < 30))
        await screenshot(`list-${rounded}.png`)
      }
    }
  }
  for (const theme of ['dark', 'light']) {
    await page.goto(base)
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
    await page.setViewportSize({ width: 390, height: 844 })
    await checkIcon('.discover-card-icon.has-image', true)
    await page.locator('.discover-card').first().scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await screenshot(`mobile-${theme}.png`)
  }
  assert.deepEqual(errors, [])
  console.log('Passed: admin toggle save/reload, all project icon locations, preserved moderation, title spacing, dark/light mobile layouts.')
} finally { await browser.close() }

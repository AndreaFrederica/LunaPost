// Run against a local Vite server with node --import tsx tests/api-docs.browser.mjs.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { endpoints } from '../../api/src/docs/reference.ts'
import { createApp } from '../../api/src/app.ts'
import { createJwt, MemoryAccountStore } from '../../api/src/auth.ts'

const base = process.env.API_DOCS_TEST_URL || 'http://127.0.0.1:9023'
const store = new MemoryAccountStore()
const env = { JWT_SECRET: 'docs-browser-test', PUBLIC_BASE_URL: base }
const tokens = {}
for (const role of ['root', 'user']) {
  const email = `${role}@example.test`
  await store.createAccount({ id: role, email, role, passwordHash: '', createdAt: new Date().toISOString(), verifiedAt: null })
  tokens[role] = await createJwt({ sub: role, email, role }, env.JWT_SECRET)
}
const api = createApp({ authStore: store })
let activeRole = 'root'
let failDocumentation = false
let documentationRequests = 0
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/v1/**', async route => {
  const path = new URL(route.request().url()).pathname
  if (path.endsWith('/docs') && new URL(route.request().url()).searchParams.get('format') !== 'markdown') documentationRequests += 1
  if (path.endsWith('/auth/logout')) activeRole = null
  if (path.endsWith('/docs') && failDocumentation) return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } })
  const response = await api.request(route.request().url(), { method: route.request().method(), headers: activeRole ? { Authorization: `Bearer ${tokens[activeRole]}` } : {} }, env)
  return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
})
const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Page must not overflow horizontally')
try {
  await page.goto(`${base}/api`)
  await expect(page.locator('.api-endpoint')).toHaveCount(endpoints.length)
  await expect(page.locator('.api-intro')).toContainText(base)
  await page.locator('#quickstart').getByRole('button', { name: '复制代码' }).click()
  assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes(`export BASE='${base}'`))
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click()
  const markdown = await downloaded
  assert.equal(markdown.suggestedFilename(), 'api-zh-CN.md')
  await page.locator('.api-search input').fill('direct-uploads')
  const requestsBeforeNavigation = documentationRequests
  const documentLayout = await page.locator('.api-docs-layout').elementHandle()
  const settledNavigation = async hash => {
    await expect(page).toHaveURL(`${base}/api${hash}`)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(documentationRequests, requestsBeforeNavigation, 'Section navigation must not refetch documentation')
    assert.ok(await documentLayout.evaluate(element => element.isConnected), 'Section navigation must preserve the document DOM')
    await expect(page.locator('.api-search input')).toHaveValue('direct-uploads')
    await expect.poll(() => page.locator(hash).evaluate(element => {
      const target = Math.min(element.getBoundingClientRect().top + window.scrollY - 90, document.documentElement.scrollHeight - window.innerHeight)
      return Math.abs(window.scrollY - target)
    })).toBeLessThan(2)
  }
  await page.locator('.api-docs-nav').getByRole('link', { name: 'COS 直传：文件不经过 Worker', exact: true }).click()
  await settledNavigation('#direct-upload')
  assert.equal(await page.locator('#direct-upload').evaluate(element => element.open), true)
  await page.locator('.api-docs-nav a[href="#quickstart"]').click()
  await settledNavigation('#quickstart')
  await page.locator('.api-docs-nav a[href="#reference"]').click()
  await settledNavigation('#reference')
  await page.goBack()
  await settledNavigation('#quickstart')
  await page.goForward()
  await settledNavigation('#reference')
  await page.locator('.api-search input').fill('release:write')
  await expect(page.locator('.api-endpoint')).toHaveCount(endpoints.filter(item => item.scope === 'release:write' || [...item.input, ...(item.note ?? [])].join(' ').includes('release:write')).length)
  await page.locator('.api-search input').fill('not-an-endpoint')
  await expect(page.locator('.api-empty')).toBeVisible()
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(page.locator('.api-endpoint')).toHaveCount(endpoints.length)
  await page.getByLabel('请求方法', { exact: true }).click()
  await page.getByRole('option', { name: 'DELETE', exact: true }).click()
  await expect(page.locator('.api-endpoint')).toHaveCount(endpoints.filter(item => item.method === 'DELETE').length)
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await page.locator('.api-search input').fill('direct-uploads')
  const firstEndpoint = page.locator('.api-endpoint').first()
  await firstEndpoint.scrollIntoViewIfNeeded()
  const motion = await firstEndpoint.evaluate(async element => {
    const summary = element.querySelector('summary')
    const closedHeight = element.getBoundingClientRect().height
    summary.click()
    const animation = element.getAnimations()[0]
    if (!animation) throw new Error('Opening should animate')
    await new Promise(resolve => setTimeout(resolve, 80))
    const middleHeight = element.getBoundingClientRect().height
    summary.click() // Reverse without jumping to the fully open height.
    const reversedHeight = element.getBoundingClientRect().height
    summary.click() // Rapidly reverse again; the last click must win.
    await Promise.all(element.getAnimations().map(item => item.finished))
    return { closedHeight, middleHeight, reversedHeight, openHeight: element.getBoundingClientRect().height, open: element.open }
  })
  assert.ok(motion.middleHeight > motion.closedHeight && motion.middleHeight < motion.openHeight, 'Expansion must have intermediate heights')
  assert.ok(Math.abs(motion.middleHeight - motion.reversedHeight) < 2, 'Reversing must preserve the current height')
  assert.equal(motion.open, true)
  await firstEndpoint.locator('summary').focus()
  await page.keyboard.press('Space')
  await expect(firstEndpoint).not.toHaveAttribute('open', '')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await firstEndpoint.locator('summary').press('Enter')
  assert.equal(await firstEndpoint.evaluate(element => element.open && element.getAnimations().length === 0), true, 'Reduced motion expands immediately')
  await firstEndpoint.locator('summary').press('Enter')
  assert.equal(await firstEndpoint.evaluate(element => !element.open && element.getAnimations().length === 0), true, 'Reduced motion collapses immediately')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await firstEndpoint.locator('summary').click()
  await firstEndpoint.evaluate(element => Promise.all(element.getAnimations().map(item => item.finished)))
  await noOverflow()
  await page.locator('#reference').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(tmpdir(), 'lunapost-api-docs-desktop.png') })

  await page.evaluate(() => { localStorage.setItem('andrea-locale', 'en-US'); localStorage.setItem('andrea-theme', 'dark') })
  await page.goto(`${base}/api#actions-example`)
  await page.reload()
  await expect(page.locator('#actions-example')).toHaveAttribute('open', '')
  await expect(page.locator('#actions-example summary')).toContainText('Publish from GitHub Actions')
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow()
  await page.screenshot({ path: join(tmpdir(), 'lunapost-api-docs-mobile-dark.png') })
  await page.locator('.api-search input').fill('direct-uploads')
  await page.locator('.api-endpoint summary').first().click()
  await page.locator('#reference').scrollIntoViewIfNeeded()
  await noOverflow()
  await page.screenshot({ path: join(tmpdir(), 'lunapost-api-docs-mobile-reference.png') })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  activeRole = 'user'
  await page.evaluate(async () => { const { useAuthStore } = await import('/src/stores/auth.ts'); await useAuthStore().load() })
  await expect(page.locator('.api-intro')).toContainText('Current role：user')
  assert.ok(!(await page.locator('.api-docs-content').innerText()).includes('/api/v1/admin/database/'))
  await expect(page.locator('#actions-example')).toHaveCount(0)
  await page.locator('.account-button').click()
  await page.getByText('Sign out', { exact: true }).click()
  await expect(page.locator('.api-intro')).toContainText('Current role：guest')
  await expect(page.locator('#authentication')).toHaveCount(0)
  // A failed refresh must clear the previous document instead of falling back
  // to privileged text embedded in the client.
  failDocumentation = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  await expect(page.locator('.api-endpoint')).toHaveCount(0)
  failDocumentation = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.api-intro')).toContainText('Current role：guest')
  assert.deepEqual(errors, [])
  console.log(`API docs browser checks passed: ${endpoints.length} root endpoints, smooth navigation, reversible expansion, keyboard and reduced motion, search, filters, copy, Markdown download, English, mobile, root-to-user changes, logout and failed refresh`)
} catch (error) {
  console.error('Page:', page.url(), 'Errors:', errors)
  throw error
} finally { await browser.close() }

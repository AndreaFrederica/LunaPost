import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'

const catalog = JSON.parse(readFileSync(new URL('../../../catalog/catalog.json', import.meta.url), 'utf8'))
const project = catalog.projects.find(p => p.slug === 'luna-launcher')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' })
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname
  const data = path.endsWith('/members') ? { members: [] }
    : /\/projects\/luna-launcher(?:\.json)?$/.test(path) ? project
    : path === '/api/v1/projects' ? { projects: [project], total: 1 }
    : path === '/api/v1/me' ? { account: null } : {}
  await route.fulfill({ json: data })
})
const base = process.env.WEB_URL || 'http://127.0.0.1:9012'
const output = new URL('../../../tmp/markdown-qa/', import.meta.url)
mkdirSync(output, { recursive: true })
try {
  await page.goto(`${base}/projects/luna-launcher`)
  await page.locator('.project-markdown table').first().waitFor({ timeout: 60000 })
  assert.equal(await page.locator('.project-markdown picture source').count(), 2)
  assert.ok(await page.locator('.project-markdown pre .hljs').count() > 0)
  assert.ok(!await page.locator('.project-markdown').innerText().then(text => text.includes('<picture>')))
  assert.equal(await page.locator('.project-large-icon').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => { localStorage.setItem('andrea-theme', theme) }, theme)
    await page.reload()
    await page.locator('.project-markdown picture img').waitFor()
    await page.waitForFunction(() => {
      const image = document.querySelector('.project-markdown picture img')
      return image?.complete && image.naturalWidth > 0
    }, undefined, { timeout: 60000 })
    assert.match(await page.locator('.project-markdown picture img').evaluate(image => image.currentSrc), theme === 'dark' ? /logo-darkmode\.svg/ : /logo\.source\.svg/)
    await page.screenshot({ path: new URL(`desktop-${theme}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: new URL('mobile.png', output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.goto(base)
  await page.locator('.discover-card-icon.has-image').waitFor()
  assert.equal(await page.locator('.discover-card-icon').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
  assert.deepEqual(errors, [])
  console.log('Browser checks passed: Luna README, dark/light layouts, mobile overflow, transparent project icons.')
} finally { await browser.close() }

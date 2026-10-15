import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const catalog = JSON.parse(readFileSync(new URL('../../../catalog/catalog.json', import.meta.url)))
const project = { ...catalog.projects[0], license: '', licenses: [], description: '' }
await page.addInitScript(() => localStorage.setItem('andrea-editor-mode', 'textarea'))
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname
  const data = path === '/api/v1/me' ? { account: { id: 'qa', email: 'qa@example.com', role: 'root' } }
    : path.endsWith('/members') ? { members: [] }
    : path.endsWith('/organizations') ? { organizations: [] }
    : path.endsWith('/notifications') ? { notifications: [] }
    : path.endsWith('/invitations') ? { invitations: [] }
    : path.startsWith('/api/v1/projects/') ? project
    : path === '/api/v1/projects' ? { projects: [], total: 0 } : { users: [] }
  await route.fulfill({ json: data })
})
const output = new URL('../../../tmp/fields-qa/', import.meta.url)
mkdirSync(output, { recursive: true })
const base = process.env.WEB_URL || 'http://127.0.0.1:9012'
const color = input => input.evaluate(el => getComputedStyle(el, '::placeholder').color)
const transparent = 'rgba(0, 0, 0, 0)'
const field = label => page.locator('.q-field').filter({ has: page.locator('.q-field__label', { hasText: new RegExp(`^${label}$`) }) }).filter({ visible: true }).first()
const blur = () => page.locator('h1').click()
const checkFloating = async (container) => {
  await container.evaluate(async el => {
    const label = el.querySelector('.q-field__label')
    await Promise.all(label.getAnimations().map(animation => animation.finished))
  })
  assert.ok(await container.evaluate(el => el.classList.contains('q-field--float')))
  assert.notEqual(await container.locator('.q-field__label').evaluate(el => getComputedStyle(el).transform), 'none')
}

try {
  for (const theme of ['dark', 'light']) {
    await page.goto(`${base}/admin/projects/${project.slug}/edit`)
    await page.evaluate(theme => localStorage.setItem('andrea-theme', theme), theme)
    await page.reload()
    const license = field('兼容许可证标识')
    const input = license.locator('input')
    await input.waitFor({ timeout: 60000 })
    assert.equal(await input.inputValue(), '')
    assert.equal(await color(input), transparent, `${theme}: empty label must not overlap placeholder`)
    if (theme === 'dark') {
      const oldRule = await page.addStyleTag({ content: "html[data-theme='dark'] .q-field__native::placeholder { color: #858d9b !important; opacity: 1; }" })
      assert.notEqual(await color(input), transparent, 'The old rule must reproduce the bug')
      await license.screenshot({ path: fileURLToPath(new URL('before.png', output)) })
      await oldRule.evaluate(el => el.remove())
    }
    await input.focus()
    await checkFloating(license)
    assert.notEqual(await color(input), transparent)
    await input.fill('MIT')
    await blur()
    await checkFloating(license)
    await input.fill('')
    await blur()
    assert.equal(await color(input), transparent)
    await page.screenshot({ path: fileURLToPath(new URL(`editor-${theme}.png`, output)) })

    // Multiline fields use the same floating-label state as single-line inputs.
    const description = field('项目描述')
    const textarea = description.locator('textarea')
    await textarea.evaluate(el => el.setAttribute('placeholder', '输入多行描述'))
    assert.equal(await color(textarea), transparent)
    await textarea.focus()
    await checkFloating(description)
    assert.notEqual(await color(textarea), transparent)
    await textarea.fill('第一行\n第二行')
    await blur()
    await checkFloating(description)

    await page.getByRole('tab', { name: '许可证', exact: true }).click()
    await page.getByRole('button', { name: '添加许可证', exact: true }).click()
    const spdx = field('SPDX 标识')
    const denseInput = spdx.locator('input')
    assert.equal(await color(denseInput), transparent)
    await denseInput.focus()
    await checkFloating(spdx)
    assert.notEqual(await color(denseInput), transparent)

    await page.getByRole('tab', { name: '参与者', exact: true }).click()
    const memberSearch = field('搜索成员')
    await checkFloating(memberSearch)
    assert.notEqual(await color(memberSearch.locator('input[placeholder]')), transparent, 'Stack-label select keeps its search prompt visible')

    await page.goto(base)
    const search = page.locator('.filter-search input')
    await search.waitFor()
    assert.notEqual(await color(search), transparent, 'Unlabeled search retains its placeholder')
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/admin/projects/${project.slug}/edit`)
  const license = field('兼容许可证标识')
  await license.waitFor()
  assert.equal(await color(license.locator('input')), transparent)
  await license.scrollIntoViewIfNeeded()
  await page.screenshot({ path: fileURLToPath(new URL('mobile.png', output)) })
  assert.deepEqual(errors, [])
  console.log('Passed: dark/light, empty/focused/filled/cleared inputs, dense input, textarea, stack-label select, unlabeled search and mobile.')
} finally { await browser.close() }

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html>', { url: 'https://modpost.example/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
const { markdownToHtml } = await import('../src/lib/markdown.ts')
const render = (text, options) => {
  const element = document.createElement('div')
  element.innerHTML = markdownToHtml(text, options)
  return element
}

test('GFM tables, alignment, tasks, strikethrough and autolinks', () => {
  const result = render('| Name | Value |\n| :--- | ---: |\n| item | 42 |\n\n- [x] Done\n- [ ] Pending\n\n~~removed~~ https://example.com')
  assert.equal(result.querySelectorAll('td').length, 2)
  assert.equal(result.querySelectorAll('input:disabled').length, 2)
  assert.equal(result.querySelector('input').checked, true)
  assert.equal(result.querySelector('del').textContent, 'removed')
  assert.equal(result.querySelector('a').href, 'https://example.com/')
  assert.equal(result.querySelectorAll('th')[1].getAttribute('align'), 'right')
})

test('nested lists, reference links, multiline paragraphs and headings', () => {
  const result = render('# Title\n\n# Title\n\n###### Small\n\n- Parent\n  - Child\n\nfirst line\nsecond line\n\n[link][ref]\n\n[ref]: https://example.com')
  assert.equal(result.querySelectorAll('ul ul li').length, 1)
  assert.equal(result.querySelectorAll('h1')[1].id, 'title-1')
  assert.equal(result.querySelector('h6').textContent, 'Small')
  assert.match(result.querySelector('p').textContent, /first line\nsecond line/)
  assert.equal(result.querySelector('a').href, 'https://example.com/')
})

test('safe HTML pictures, responsive images, alignment and collapsible details', () => {
  const result = render('<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="./logo.svg 1x, ./logo@2x.svg 2x"><img src="./logo.svg" width="60%"></picture></p>\n\n<details><summary>More</summary>Text <kbd>Ctrl</kbd></details>', { repositoryUrl: 'https://github.com/owner/repo' })
  assert.equal(result.querySelector('p').getAttribute('align'), 'center')
  assert.equal(result.querySelector('img').getAttribute('width'), '60%')
  assert.equal(result.querySelector('img').src, 'https://raw.githubusercontent.com/owner/repo/HEAD/logo.svg')
  assert.match(result.querySelector('source').getAttribute('srcset'), /HEAD\/logo@2x.svg 2x/)
  assert.ok(result.querySelector('details summary'))
})

test('relative links use the README directory, absolute and anchor URLs stay intact', () => {
  const result = render('[guide](../guide.md) ![logo](img/logo.svg) [section](#title) [external](https://example.com)', { readmeUrl: 'https://github.com/owner/repo/blob/dev/docs/README.md' })
  assert.equal(result.querySelector('a').href, 'https://github.com/owner/repo/blob/dev/guide.md')
  assert.equal(result.querySelector('img').src, 'https://raw.githubusercontent.com/owner/repo/dev/docs/img/logo.svg')
  assert.equal(result.querySelectorAll('a')[1].getAttribute('href'), '#title')
  assert.equal(result.querySelectorAll('a')[2].href, 'https://example.com/')
})

test('picture color scheme follows the app theme override', () => {
  for (const theme of ['light', 'dark']) {
    const result = render('<picture><source media="(prefers-color-scheme: dark)" srcset="dark.svg"><source media="(prefers-color-scheme: light)" srcset="light.svg"><img src="default.svg"></picture>', { theme })
    assert.equal(result.querySelector('source[media="all"]').getAttribute('srcset'), `${theme}.svg`)
    assert.equal(result.querySelectorAll('source[media="not all"]').length, 1)
  }
})

test('code highlighting escapes HTML and unknown languages stay readable', () => {
  const result = render('```javascript\nconst x = "<img onerror=alert(1)>"\n```\n\n~~~unknown\n<script>alert(1)</script>\n~~~')
  assert.ok(result.querySelector('.hljs-keyword'))
  assert.equal(result.querySelectorAll('script, img').length, 0)
  assert.match(result.querySelectorAll('code')[1].textContent, /<script>/)
})

test('GitHub alerts and footnotes with working backlinks', () => {
  const result = render('> [!WARNING]\n> Watch out\n\nText[^note].\n\n[^note]: Footnote text.')
  assert.ok(result.querySelector('.markdown-alert-warning'))
  assert.ok(result.querySelector('.footnotes'))
  for (const link of result.querySelectorAll('a[href^="#"]')) {
    assert.ok([...result.querySelectorAll('[id]')].some(node => '#' + node.id === link.getAttribute('href')))
  }
})

test('untrusted HTML cannot run scripts, inject CSS or expose active form controls', () => {
  const result = render('<script>alert(1)</script><iframe src="https://evil.example"></iframe><img src="x" onerror="alert(1)"><a href="javascript:alert(1)" target="_blank">bad</a><p style="position:fixed">text</p><input type="password"><input type="checkbox"><form action="https://evil.example"><button>Submit</button></form>')
  assert.equal(result.querySelectorAll('script, iframe, style, form, button, input[type="password"], [onerror], [style], [href^="javascript:"]').length, 0)
  assert.equal(result.querySelector('input').disabled, true)
  assert.equal(result.querySelector('a').getAttribute('rel'), 'noopener noreferrer')
})

test('actual Luna README renders pictures and tables instead of escaped markup', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../../catalog/catalog.json', import.meta.url), 'utf8'))
  const project = catalog.projects.find(p => p.slug === 'luna-launcher')
  const result = render(project.body, { repositoryUrl: project.repositoryUrl })
  assert.ok(result.querySelector('picture source'))
  assert.ok(result.querySelector('table'))
  assert.match(result.querySelector('img').src, /raw\.githubusercontent\.com\/AndreaFrederica\/LunaLauncher\/HEAD\/program_info/)
  assert.ok(!result.textContent.includes('<picture>'))
})

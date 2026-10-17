import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import ts from 'typescript'
import { endpoints } from '../../api/src/docs/reference.ts'
import { searchEndpoints } from '../src/lib/api-reference.ts'
import { projectExample, versionExample, dependencyExample, dependencyRequestExample, createGuides, actionsWorkflow } from '../../api/src/docs/guides.ts'
import { projectSchema, versionSchema, dependencySchema, dependencyRequestSchema } from '@andrea/contracts'

test('reference covers registered backend routes with no invented endpoints', () => {
  const root = new URL('../../api/src/', import.meta.url)
  const files = readdirSync(root, { recursive: true }).filter(name => String(name).endsWith('.ts'))
  const sources = files.map(name => ts.createSourceFile(String(name), readFileSync(new URL(String(name).replaceAll('\\', '/'), root), 'utf8'), ts.ScriptTarget.Latest, true))
  const prefixes = []
  const registered = []
  const visit = node => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'registerModrinthCompat' && ts.isStringLiteral(node.arguments[2])) prefixes.push(node.arguments[2].text)
      const expr = node.expression
      if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'app' && ['get', 'post', 'put', 'patch', 'delete'].includes(expr.name.text)) {
        const path = node.arguments[0]
        if (ts.isStringLiteralLike(path)) {
          // The API process root returns service metadata; the deployed root is the web app.
          if (path.text !== '/') registered.push([expr.name.text.toUpperCase(), path.text])
        } else if (ts.isTemplateExpression(path)) {
          assert.equal(path.getText().startsWith('`${prefix}/'), true, `Unrecognized route expression: ${path.getText()}`)
          registered.push([expr.name.text.toUpperCase(), path.getText().slice(1, -1)])
        } else assert.fail(`Unrecognized route: ${path.getText()}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  sources.forEach(visit)
  assert.equal(prefixes.length, 2)
  const actual = registered.flatMap(([method, path]) => path.includes('${prefix}') ? prefixes.map(prefix => `${method} ${path.replace('${prefix}', prefix)}`) : [`${method} ${path}`]).sort()
  const documented = endpoints.map(item => `${item.method} ${item.path}`).sort()
  assert.equal(new Set(documented).size, documented.length, 'Duplicate documentation')
  assert.deepEqual(documented, actual)
})

test('documented payload examples conform to shared backend contracts', () => {
  projectSchema.parse(projectExample)
  versionSchema.parse(versionExample)
  dependencySchema.parse(dependencyExample)
  dependencyRequestSchema.parse(dependencyRequestExample)
})

test('reference search supports translated features, scopes and method filters', () => {
  assert.ok(searchEndpoints(endpoints, '直传', 'uploads').some(item => item.path.endsWith('/direct-uploads')))
  assert.ok(searchEndpoints(endpoints, 'release:write', '', 'POST').some(item => item.path.endsWith('/publish')))
  assert.equal(searchEndpoints(endpoints, 'publish-tokens', 'publishing', 'DELETE').length, 1)
  assert.equal(searchEndpoints(endpoints, 'does-not-exist', '').length, 0)
})

test('guides use the configured API base and preserve GitHub expressions', () => {
  const guides = createGuides('https://example.test')
  assert.ok(guides[0].code.includes('export BASE="https://example.test"'))
  assert.ok(actionsWorkflow.includes('${{ secrets.LUNAPOST_TOKEN }}'))
  assert.ok(actionsWorkflow.includes('${BASE%/}'))
  assert.ok(actionsWorkflow.includes('github|managed|hybrid'))
})

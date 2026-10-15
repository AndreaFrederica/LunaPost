import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'

const cwd = fileURLToPath(new URL('..', import.meta.url))
for (const name of ['@andrea/contracts', '@andrea/web']) {
  const result = spawnSync('pnpm', ['--filter', name, 'build'], {
    cwd, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, VITE_API_BASE_URL: '', VITE_STATIC_MODE: 'false' },
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
// A previous static-catalog build may have left generated files in public/.
// Dynamic deployments must only expose the authoritative Worker API.
writeFileSync(new URL('../apps/web/dist/.assetsignore', import.meta.url), '/api/**\n/catalog.json\n')

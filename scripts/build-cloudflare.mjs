import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('..', import.meta.url))
for (const name of ['@andrea/contracts', '@andrea/web']) {
  const result = spawnSync('pnpm', ['--filter', name, 'build'], {
    cwd, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, VITE_API_BASE_URL: '', VITE_STATIC_MODE: 'false' },
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

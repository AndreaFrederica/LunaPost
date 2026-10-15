import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const catalogBuild = spawn(command, ['catalog:build'], {
  cwd: root,
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

catalogBuild.on('exit', (catalogCode) => {
  if (catalogCode !== 0) process.exit(catalogCode ?? 1)
  const webBuild = spawn(command, ['--filter', '@andrea/web', 'build'], {
    cwd: root,
    env: { ...process.env, VITE_STATIC_MODE: 'true' },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
  webBuild.on('exit', (webCode) => process.exit(webCode ?? 1))
})

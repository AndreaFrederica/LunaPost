import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { SqliteAccountStore } from './sqlite-auth.js'
import { NodeFileStorage } from './node-storage.js'

const port = Number(process.env.API_PORT ?? 8787)
const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml')) ? process.cwd() : resolve(process.cwd(), '../..')
const configuredAuthDbPath = process.env.AUTH_DB_PATH ?? './data/auth.sqlite'
const authDbPath = isAbsolute(configuredAuthDbPath) ? configuredAuthDbPath : resolve(workspaceRoot, configuredAuthDbPath)
const storageRoot = isAbsolute(process.env.STORAGE_DIR ?? './data/files') ? (process.env.STORAGE_DIR ?? './data/files') : resolve(workspaceRoot, process.env.STORAGE_DIR ?? './data/files')
const app = createApp({ authStore: new SqliteAccountStore(authDbPath), storage: new NodeFileStorage(storageRoot) })
const configuredCatalogPath = process.env.CATALOG_JSON_PATH ?? 'catalog/catalog.json'
const catalogPath = isAbsolute(configuredCatalogPath) ? configuredCatalogPath : resolve(workspaceRoot, configuredCatalogPath)
const catalogJson = process.env.CATALOG_JSON ?? (existsSync(catalogPath) ? readFileSync(catalogPath, 'utf8') : undefined)
const runtimeEnv = { CURSEFORGE_API_KEY: process.env.CURSEFORGE_API_KEY, CATALOG_JSON: catalogJson, PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL, JWT_SECRET: process.env.JWT_SECRET, MODERATION_API_TOKEN: process.env.MODERATION_API_TOKEN, YGG_TEXTURE_PRIVATE_KEY: process.env.YGG_TEXTURE_PRIVATE_KEY, YGG_TEXTURE_PUBLIC_KEY: process.env.YGG_TEXTURE_PUBLIC_KEY, MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID, OAUTH_ENCRYPTION_KEY: process.env.OAUTH_ENCRYPTION_KEY }

serve({ fetch: (request) => app.fetch(request, runtimeEnv), port }, (info) => {
  console.log(`Andrea Modpost API listening on http://localhost:${info.port}`)
})

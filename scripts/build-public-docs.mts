import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildDocumentation, documentationMarkdown } from '../apps/api/src/docs/documentation.js'

// Static exports can only contain the anonymous view. Never export staff docs.
const document = buildDocumentation(process.env.VITE_API_BASE_URL || process.env.PUBLIC_BASE_URL || '', {
  role: 'guest', scopes: undefined, project: null, projectBound: false,
  canEdit: false, canManage: false, directUpload: false, initialized: true,
})
const directory = resolve(import.meta.dirname, '../apps/web/public/api/v1')
await mkdir(directory, { recursive: true })
await writeFile(resolve(directory, 'docs.json'), JSON.stringify(document))
for (const locale of ['zh-CN', 'en-US']) await writeFile(resolve(directory, `docs.${locale}.md`), documentationMarkdown(document, locale))
console.log(`Exported ${document.endpoints.length} public documentation routes`)

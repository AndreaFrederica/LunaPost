import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourcePath = join(root, 'catalog', 'catalog.json')
const publicRoot = join(root, 'apps', 'web', 'public')
const apiRoot = join(publicRoot, 'api', 'v1')
const catalog = JSON.parse(await readFile(sourcePath, 'utf8'))

const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

await rm(join(publicRoot, 'catalog.json'), { force: true })
await rm(apiRoot, { recursive: true, force: true })
await writeJson(join(publicRoot, 'catalog.json'), catalog)
await writeJson(join(apiRoot, 'catalog.json'), catalog)
await writeJson(join(apiRoot, 'projects.json'), {
  projects: catalog.projects,
  total: catalog.projects.length,
  catalogRevision: catalog.catalogRevision,
})

for (const project of catalog.projects) {
  await writeJson(join(apiRoot, 'projects', `${project.slug}.json`), project)
  await writeJson(join(apiRoot, 'projects', project.slug, 'versions.json'), { versions: project.versions })
}

console.log(`Generated static catalog for ${catalog.projects.length} project(s) at ${apiRoot}`)

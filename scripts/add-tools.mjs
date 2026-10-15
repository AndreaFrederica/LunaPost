import { readFile, writeFile } from 'node:fs/promises'
const path = 'catalog/catalog.json'
const catalog = JSON.parse(await readFile(path, 'utf8'))
const repos = [
  { slug: 'luna-launcher', title: 'Luna Launcher', repo: 'https://github.com/AndreaFrederica/LunaLauncher', description: '面向 Minecraft 玩家与开发者的独立启动器工具。', categories: ['launcher', 'utility'] },
  { slug: 'actinium', title: 'Actinium', repo: 'https://github.com/Q-Engineering-Source/Actinium', description: 'Q Engineering Source 的独立开发工具与工程项目。', categories: ['utility', 'developer-tools'] },
  { slug: 'neo-font-render', title: 'NeoFontRender', repo: 'https://github.com/AndreaFrederica/NeoFontRender', description: '用于 Minecraft 与桌面工具的现代字体渲染工具。', categories: ['library', 'graphics', 'utility'] },
]
for (const item of repos) {
  if (catalog.projects.some((project) => project.slug === item.slug)) continue
  const version = '0.1.0'
  const fileName = `${item.slug}-${version}.zip`
  catalog.projects.push({
    id: item.slug, slug: item.slug, title: item.title, type: 'tool', description: item.description,
    ownerType: 'account', body: `# ${item.title}\n\n${item.description}\n\n源码与发布信息请参阅 [GitHub 仓库](${item.repo})。`,
    categories: item.categories, keywords: ['tool', 'open-source'], clientSide: 'optional', serverSide: 'optional', status: 'approved', featured: false,
    downloads: 0, followers: 0, iconUrls: [], gallery: [], repositoryUrl: item.repo, sourceUrl: item.repo, issuesUrl: `${item.repo}/issues`,
    cdnRules: [], donationUrls: [], links: [{ id: `${item.slug}-github`, label: 'GitHub', url: item.repo, icon: 'code', group: 'source' }], license: 'See repository', loaders: [], gameVersions: [],
    versions: [{ id: `${item.slug}-${version}`, version, type: 'release', status: 'listed', featured: true, dependencies: [], gameVersions: [], loaders: [], changelog: '首个 Andrea Modpost 工具条目。', publishedAt: '2026-10-15T00:00:00.000Z', files: [{ id: `${item.slug}-${version}-archive`, name: fileName, primary: true, fileType: 'unknown', reviewStatus: 'approved', metadata: { repository: item.repo }, sources: [{ id: 'github-release', kind: 'github_release', region: 'GLOBAL', url: `${item.repo}/releases/latest/download/${fileName}`, priority: 10 }] }] }],
  })
}
await writeFile(path, JSON.stringify(catalog, null, 2) + '\n')

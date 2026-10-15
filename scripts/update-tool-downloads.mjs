import { readFile, writeFile } from 'node:fs/promises'
const path='catalog/catalog.json'; const c=JSON.parse(await readFile(path,'utf8'))
for (const p of c.projects.filter(x=>x.type==='tool')) { const source=p.versions[0].files[0].sources[0]; source.url=`${p.repositoryUrl}/archive/refs/heads/main.zip`; p.versions[0].files[0].name=`${p.slug}-main.zip` }
await writeFile(path,JSON.stringify(c,null,2)+'\n')

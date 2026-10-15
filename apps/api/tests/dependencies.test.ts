import assert from 'node:assert/strict'
import test from 'node:test'
import { projectSchema, catalogSchema, dependencyRequestSchema, dependencySchema, resolveDependencies, validateDependencies, parseModDependencies, type Project } from '@andrea/contracts'
import { createApp } from '../src/app.js'
import { createJwt, MemoryAccountStore } from '../src/auth.js'
const version = (id: string, dependencies: unknown[] = [], number = '1.0.0', loaders = ['fabric']) => ({ id, version: number, type:'release', loaders, gameVersions:['1.20.1'], dependencies, files:[{ id:`${id}-jar`, name:`${id}.jar`, primary:true, sources:[{ id:'source', kind:'custom_http',url:'https://example.com/mod.jar' }] }] })
const project = (id: string, versions = [version(id)]) => projectSchema.parse({ id, slug:id,title:id,description:id,type:'mod',loaders:['fabric','forge'],gameVersions:['1.20.1'],versions })
const catalog = (...projects: Project[]) => catalogSchema.parse({ schemaVersion:1,catalogRevision:'test',generatedAt:new Date().toISOString(),projects })
const input = (extra = {}) => dependencyRequestSchema.parse({ versionId:'a', loader:'fabric',gameVersion:'1.20.1',side:'client',...extra })
const required = (projectId: string, extra = {}) => ({ projectId, dependencyType:'required', ...extra })
const range = (range: string) => ({ versionConstraint:{ scheme:'semver',range } })

test('backtracks across a diamond and produces one artifact per project', () => {
  const c = catalog(project('a',[version('a',[required('b'),required('c',range('<2.0.0'))])]),project('b',[version('b-new',[required('c',range('>=2.0.0'))],'2.0.0'),version('b-old',[required('c',range('<2.0.0'))])]),project('c',[version('c-new',[],'2.0.0'),version('c-old')]))
  const r = resolveDependencies(c,input())
  assert.equal(r.installable,true)
  assert.equal(r.nodes.find(n => n.projectId === 'b')?.versionId,'b-old')
  assert.equal(r.nodes.find(n => n.projectId === 'c')?.versionId,'c-old')
  assert.equal(r.manifest.length,3)
})
test('reports conflicting paths without producing an installation manifest', () => {
  const c = catalog(project('a',[version('a',[required('b'),required('c',range('<2.0.0'))])]),project('b',[version('b',[required('c',range('>=2.0.0'))])]),project('c',[version('c',[],'2.0.0'),version('c-old')]))
  const r = resolveDependencies(c,input()); assert.equal(r.success,false); assert.equal(r.errors[0].code,'VERSION_CONFLICT'); assert.match(r.errors[0].message,/selected via/); assert.deepEqual(r.manifest,[])
})
test('loader, side, game and loader-version conditions apply independently', () => {
  const c = catalog(project('a',[version('a',[required('b',{appliesTo:{loaders:['forge']}}),required('missing',{appliesTo:{side:'server'}}),required('missing2',{appliesTo:{gameVersions:['1.21.1']}}),required('c',{appliesTo:{loaderRange:'>=0.16.0'}})])]),project('b',[version('b',[],'1.0.0',['forge'])]),project('c'))
  assert.equal(resolveDependencies(c,input()).errors[0].code,'LOADER_VERSION_REQUIRED')
  assert.equal(resolveDependencies(c,input({loaderVersion:'0.15.0'})).nodes.length,1)
  assert.equal(resolveDependencies(c,input({loaderVersion:'0.16.0'})).nodes.length,2)
  assert.equal(resolveDependencies(c,input({loader:'forge'})).success,false)
})
test('optional dependencies are opt-in; embedded and integration do not auto-install', () => {
  const c = catalog(project('a',[version('a',[{projectId:'b',dependencyType:'optional'}, {projectId:'c',dependencyType:'embedded'}, {projectId:'d',dependencyType:'integration'}])]),project('b'),project('c'),project('d'))
  assert.equal(resolveDependencies(c,input()).manifest.length,1)
  assert.equal(resolveDependencies(c,input({selectedOptionalDependencies:['b']})).manifest.length,2)
})
test('conditional dependencies are reevaluated after graph expansion', () => {
  const c = catalog(project('a',[version('a',[required('c',{when:{installedProjectIds:['b'],feature:'integration'}}),required('b')])]),project('b'),project('c'))
  assert.equal(resolveDependencies(c,input()).nodes.length,2)
  assert.equal(resolveDependencies(c,input({enabledFeatures:['integration']})).nodes.length,3)
})
test('installed versions remain pinned and incompatible edges reject them', () => {
  const c = catalog(project('a',[version('a',[{projectId:'b',dependencyType:'incompatible',...range('>=2.0.0')}])]),project('b',[version('b',[],'2.0.0')]))
  assert.equal(resolveDependencies(c,input({installedVersions:['b']})).errors[0].code,'INCOMPATIBLE')
})
test('cycles terminate and are reported', () => {
  const c = catalog(project('a',[version('a',[required('b')])]),project('b',[version('b',[required('a')])]))
  const r = resolveDependencies(c,input()); assert.equal(r.success,true); assert.equal(r.manifest.length,2); assert.equal(r.warnings[0].code,'CYCLE')
})
test('arbitrary release names require exact sets, not semver coercion', () => {
  const c = catalog(project('a',[version('a',[required('b',{versionConstraint:{scheme:'exact',versions:['r6']}})])]),project('b',[version('b',[],'r6')]))
  assert.equal(resolveDependencies(c,input()).success,true)
  assert.equal(dependencySchema.safeParse(required('b',range('not a range'))).success,false)
})
test('ambiguous artifacts require selection; sources are never selected', () => {
  const p = project('a'); p.versions[0].files[0].primary = false
  p.versions[0].files.push({...p.versions[0].files[0],id:'second',name:'second.jar'})
  assert.equal(resolveDependencies(catalog(p),input()).installable,false)
  const r = resolveDependencies(catalog(p),input({fileSelections:{a:'second'}}))
  assert.equal(r.installable,true); assert.equal(r.manifest[0].fileId,'second')
  p.versions[0].files[1].fileType = 'source-jar'
  assert.equal(resolveDependencies(catalog(p),input({fileSelections:{a:'second'}})).installable,false)
})
test('validation rejects wrong version ownership and preserves old declarations', () => {
  const b = project('b'); const a = project('a',[version('a',[required('b',{versionId:'a'})])])
  assert.equal(validateDependencies(a,catalog(a,b)).length,1)
  assert.equal(dependencySchema.parse({projectId:'b'}).dependencyType,'required')
})
test('metadata import handles Fabric alternatives and Forge Maven intervals without inventing project IDs', () => {
  const fabric = parseModDependencies(JSON.stringify({depends:{library:['>=1.0.0 <2.0.0','>=3.0.0']},suggests:{menu:'*'}}))
  assert.equal(fabric[0].dependency.projectId,undefined); assert.equal(fabric[1].dependency.dependencyType,'optional')
  const forge = parseModDependencies('[[dependencies.demo]]\nmodId = "library"\nmandatory = true\nversionRange = "[1.0.0,2.0.0)"\nside = "CLIENT"')
  assert.deepEqual(forge[0].dependency.versionConstraint,{scheme:'semver',range:'>=1.0.0 <2.0.0'})
  assert.equal(forge[0].dependency.appliesTo?.side,'client')
  assert.throws(() => parseModDependencies('{"depends":{"library":"banana"}}'))
})
test('API visibility, reverse references, declarations and project save validation', async () => {
  const store = new MemoryAccountStore(); const a = project('a',[version('a',[required('b')])]); const b = project('b'); b.status='draft'
  await store.saveStoredProject(a); await store.saveStoredProject(b)
  const app = createApp({authStore:store}); const env = {CATALOG_JSON:JSON.stringify(catalog())}
  const response = await app.request('/api/v1/dependencies/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input())},env)
  assert.equal((await response.json()).success,false)
  assert.equal((await app.request('/api/v1/projects/b/dependents',{},env)).status,404)
  assert.equal((await app.request('/api/v1/projects/a/versions/a/dependencies',{},env)).status,200)
  await store.createAccount({id:'root',email:'root@example.com',role:'root',passwordHash:'',createdAt:new Date().toISOString(),verifiedAt:null})
  const token = await createJwt({sub:'root',email:'root@example.com',role:'root'})
  const headers = {Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
  const invalid = project('new',[version('new',[required('missing')])])
  assert.equal((await app.request('/api/v1/admin/projects',{method:'POST',headers,body:JSON.stringify(invalid)},env)).status,400)
  const reverse = await app.request('/api/v1/projects/b/dependents',{headers},env)
  assert.equal((await reverse.json()).dependents[0].projectId,'a')
})

test('explicit cross-loader bridge installs middleware and retains native dependencies', () => {
  const a = project('a',[version('a',[required('library',{appliesTo:{loaders:['fabric']}})])])
  const library = project('library')
  const bridge = {fromLoader:'fabric',toLoader:'forge',viaProjectId:'middleware',viaRange:'>=1.0.0 <2.0.0',gameVersions:['1.20.1'],side:'client' as const}
  a.versions[0].loaderBridges=[bridge]; library.versions[0].loaderBridges=[bridge]
  const middleware = project('middleware',[version('middleware',[],'1.0.0',['forge'])])
  const r = resolveDependencies(catalog(a,library,middleware),input({loader:'forge'}))
  assert.equal(r.installable,true); assert.equal(r.nodes.length,3)
  assert.equal(r.nodes.find(n => n.projectId === 'a')?.bridge?.viaProjectId,'middleware')
  assert.equal(r.manifest.filter(f => f.projectId === 'middleware').length,1)
  assert.equal(resolveDependencies(catalog(a,library),input({loader:'forge'})).success,false)
  assert.equal(resolveDependencies(catalog(a,library,middleware),input({loader:'forge',side:'server'})).success,false)
  assert.equal(resolveDependencies(catalog(a,library,middleware),input({loader:'neoforge'})).success,false)
  library.versions[0].loaderBridges=[]
  assert.equal(resolveDependencies(catalog(a,library,middleware),input({loader:'forge'})).success,false)
})
test('middleware version conflicts reject the bridge and native runs do not install it', () => {
  const a = project('a'); a.versions[0].loaderBridges=[{fromLoader:'fabric',toLoader:'forge',viaProjectId:'middleware',viaRange:'<2.0.0'}]
  const middleware = project('middleware',[version('middleware',[],'2.0.0',['forge'])])
  assert.equal(resolveDependencies(catalog(a,middleware),input({loader:'forge'})).success,false)
  assert.equal(resolveDependencies(catalog(a,middleware),input()).manifest.length,1)
})

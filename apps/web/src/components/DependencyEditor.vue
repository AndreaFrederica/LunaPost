<template>
  <section class="q-mt-lg">
    <div class="row items-center justify-between"><h3 class="text-subtitle1">{{ label('依赖与联动', 'Dependencies and integrations') }}</h3><q-btn flat icon="add" :label="label('添加依赖', 'Add dependency')" @click="add" /></div>
    <q-expansion-item :label="label('跨加载器中间层', 'Cross-loader bridges')" icon="swap_horiz"><q-card-section>
      <p>{{ label('仅声明实际验证过的组合。中间层会自动成为必需依赖；原加载器的依赖仍会检查，不会被忽略。', 'Declare tested combinations only. The middleware becomes a required dependency; original loader dependencies remain checked.') }}</p>
      <div v-for="(b,i) in version.loaderBridges" :key="i" class="row q-col-gutter-sm q-my-md">
        <q-select class="col-6 col-md-3" v-model="b.fromLoader" :options="version.loaders" outlined dense :label="label('原生加载器', 'Native loader')" />
        <q-input class="col-6 col-md-3" v-model="b.toLoader" outlined dense :label="label('目标加载器', 'Target loader')" />
        <q-input class="col-12" v-model="b.fromLoaderVersion" outlined dense :label="label('中间层提供的原加载器 API 版本（可选）', 'Source loader API version provided by bridge (optional)')" />
        <q-input class="col-12 col-md-6" v-model="b.viaProjectId" outlined dense :label="label('中间层项目 ID', 'Middleware project ID')" />
        <q-input class="col-6" v-model="b.viaVersionId" outlined dense :label="label('中间层精确版本 ID', 'Middleware exact version ID')" />
        <q-input class="col-6" v-model="b.viaRange" outlined dense :label="label('中间层版本范围', 'Middleware version range')" />
        <q-select class="col-6" v-model="b.gameVersions" :options="version.gameVersions" multiple outlined dense :label="label('支持的游戏版本', 'Supported game versions')" />
        <q-select class="col-6" v-model="b.side" :options="['both','client','server']" outlined dense :label="label('运行环境', 'Side')" />
        <q-input class="col-10" v-model="b.reason" outlined dense :label="label('兼容说明', 'Compatibility notes')" />
        <q-btn class="col-2" flat icon="delete" @click="version.loaderBridges?.splice(i,1)" />
      </div>
      <q-btn outline icon="add" :label="label('添加桥接组合', 'Add bridge')" @click="(version.loaderBridges ||= []).push({ fromLoader: version.loaders[0] || '', toLoader: '', viaProjectId: '', side: 'both' })" />
    </q-card-section></q-expansion-item>
    <q-card v-for="(d, i) in modelValue" :key="i" flat bordered class="q-mb-md"><q-card-section class="row q-col-gutter-sm">
      <q-select class="col-12" :model-value="d.external?.provider || 'local'" :options="[{ label: label('站内项目', 'Local project'), value: 'local' }, { label: 'Modrinth', value: 'modrinth' }, { label: 'CurseForge', value: 'curseforge' }]" emit-value map-options outlined dense :label="label('依赖来源', 'Dependency source')" @update:model-value="value => setSource(d, value)" />
      <template v-if="d.external">
        <q-input class="col-9" v-model="d.external.projectId" outlined dense :label="d.external.provider === 'modrinth' ? label('MR 项目 ID 或 slug（查询后绑定）', 'MR project ID or slug (lookup to bind)') : label('CF 项目数字 ID', 'CF numeric project ID')" @update:model-value="() => { if(d.external) d.external.versionId = undefined }" />
        <q-btn class="col-3" flat :label="label('查询并绑定', 'Look up and bind')" @click="bindExternal(d)" />
        <q-select class="col-12 col-md-6" v-model="d.external.versionId" :options="externalReleases[`${d.external.provider}:${d.external.projectId}`] || []" option-label="version" option-value="id" emit-value map-options clearable outlined dense :label="label('外部精确版本 / 文件（可选）', 'External release / file (optional)')" @clear="d.external.versionId = undefined" />
        <a class="col-12" :href="externalProjectUrl(d.external)" target="_blank" rel="noopener noreferrer">{{ label('打开原站项目', 'Open original project') }}</a>
      </template>
      <q-select v-else class="col-12 col-md-5" :model-value="d.projectId" use-input input-debounce="250" :options="options" option-label="title" option-value="id" emit-value map-options outlined dense :label="label('搜索项目', 'Search projects')" @filter="search" @update:model-value="value => { d.projectId = value; d.versionId = undefined }" />
      <q-select class="col-10 col-md-5" v-model="d.dependencyType" :options="types" emit-value map-options outlined dense :label="label('关系', 'Relationship')" />
      <q-btn class="col-2" flat icon="delete" :aria-label="label('删除依赖', 'Remove dependency')" @click="emit('update:modelValue', modelValue.filter((_, n) => n !== i))" />
      <q-select v-if="!d.external" class="col-12 col-md-6" v-model="d.versionId" :options="(releases[d.projectId || ''] || []).map(v => ({ label: `${v.version} · ${v.loaders.join('/')} · ${v.gameVersions.join('/')}`, value: v.id }))" emit-value map-options clearable outlined dense :label="label('精确发布版本（可选）', 'Exact release (optional)')" @popup-show="loadReleases(d.projectId)" @clear="d.versionId = undefined" />
      <q-select class="col-12 col-md-6" :model-value="d.versionConstraint?.scheme || 'any'" :options="['any', 'semver', 'exact']" outlined dense :label="label('版本约束', 'Version constraint')" @update:model-value="value => d.versionConstraint = value === 'any' ? undefined : value === 'semver' ? { scheme: 'semver', range: '*' } : { scheme: 'exact', versions: [] }" />
      <q-input v-if="d.versionConstraint?.scheme === 'semver'" class="col-12" v-model="d.versionConstraint.range" outlined dense label="SemVer" placeholder=">=1.0.0 &lt;2.0.0" />
      <q-input v-if="d.versionConstraint?.scheme === 'exact'" class="col-12" :model-value="d.versionConstraint.versions.join(', ')" outlined dense :label="label('允许的版本号（逗号分隔）', 'Allowed versions (comma separated)')" @update:model-value="value => { if (d.versionConstraint?.scheme === 'exact') d.versionConstraint.versions = csv(value) }" />
      <q-select class="col-12 col-md-4" :model-value="d.appliesTo?.loaders || []" :options="[...version.loaders,...(version.loaderBridges || []).map(b => b.toLoader)]" multiple outlined dense :label="label('适用加载器（空为全部）', 'Applicable loaders (empty: all)')" @update:model-value="value => d.appliesTo = { ...d.appliesTo, loaders: value }" />
      <q-select class="col-12 col-md-4" :model-value="d.appliesTo?.gameVersions || []" :options="version.gameVersions" multiple outlined dense :label="label('适用游戏版本', 'Applicable game versions')" @update:model-value="value => d.appliesTo = { ...d.appliesTo, gameVersions: value }" />
      <q-select class="col-12 col-md-4" :model-value="d.appliesTo?.side || 'both'" :options="['both', 'client', 'server']" outlined dense :label="label('运行环境', 'Environment')" @update:model-value="value => d.appliesTo = { ...d.appliesTo, side: value }" />
      <q-input class="col-12 col-md-6" :model-value="d.appliesTo?.loaderRange || ''" outlined dense :label="label('加载器版本范围', 'Loader version range')" @update:model-value="value => d.appliesTo = { ...d.appliesTo, loaderRange: String(value || '') || undefined }" />
      <q-input class="col-12 col-md-6" :model-value="d.when?.feature || ''" outlined dense :label="label('启用功能时生效', 'Enable when feature is selected')" @update:model-value="value => d.when = { ...d.when, feature: String(value || '') || undefined }" />
      <q-input class="col-12" :model-value="d.when?.installedProjectIds?.join(', ') || ''" outlined dense :label="label('这些项目已安装时生效（项目 ID）', 'Activate when projects are installed (IDs)')" @update:model-value="value => d.when = { ...d.when, installedProjectIds: csv(value) }" />
      <q-input class="col-12" v-model="d.reason" outlined dense :label="label('用途 / 联动功能说明', 'Purpose / integration description')" />
    </q-card-section></q-card>
    <q-banner v-if="importError" role="alert" class="q-my-sm">{{ importError }}</q-banner>
    <q-expansion-item :label="label('导入 Mod 元数据', 'Import mod metadata')" icon="upload_file"><q-card-section>
      <q-input v-model="metadata" type="textarea" outlined autogrow :label="label('粘贴 fabric.mod.json 或 mods.toml', 'Paste fabric.mod.json or mods.toml')" />
      <q-btn class="q-mt-sm" outline :label="label('导入并映射 Mod ID', 'Import and map mod IDs')" @click="importMetadata" />
      <div v-if="importError" role="alert">{{ importError }}</div>
      <div v-for="item in imported" :key="item.modId" class="row q-col-gutter-sm q-my-sm">
        <div class="col-4">{{ item.modId }} · {{ item.rawRange }}</div><q-input class="col-6" v-model="item.projectId" outlined dense :label="label('站内项目 ID', 'Local project ID')" /><q-btn class="col-2" flat icon="add" :disable="!item.projectId" @click="appendImported(item)" />
      </div>
    </q-card-section></q-expansion-item>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Dependency, Version, Project } from '@andrea/contracts'
import { externalProjectUrl, parseModDependencies, type ImportedDependency } from '@andrea/contracts'
import { listProjects, getProject } from '../lib/api'
import { lookupExternal } from '../lib/dependencies'
import { useI18n } from '../i18n'
const props = defineProps<{ modelValue: Dependency[]; version: Version }>()
const emit = defineEmits<{ 'update:modelValue': [Dependency[]] }>()
const { locale } = useI18n(); const label = (zh: string, en: string) => locale.value === 'zh-CN' ? zh : en
const types = computed(() => ['required','optional','recommended','integration','incompatible','embedded'].map((value,i) => ({ value, label: locale.value === 'zh-CN' ? ['必需','可选','推荐','联动','冲突','内嵌'][i] : value })))
const options = ref<Project[]>([])
const releases = ref<Record<string,Version[]>>({})
const loadReleases = async (id?: string) => { if (!id) return; try { const p = options.value.find(p => p.id === id); if (p) { releases.value[id] = (await getProject(p.slug)).versions; return }; const response = await listProjects({ query:id,limit:100 }); const match = response.projects.find(p => p.id === id); if(match) releases.value[id] = (await getProject(match.slug)).versions } catch (e) { importError.value = String(e) } }
const search = async (query: string, update: (fn: () => void) => void) => { try { const result = await listProjects({ query, limit: 30 }); update(() => options.value = result.projects) } catch { update(() => options.value = []) } }
const externalReleases = ref<Record<string, Array<{ id:string; version:string }>>>({})
const setSource = (d: Dependency, source: 'local' | 'modrinth' | 'curseforge') => {
  d.projectId = undefined; d.versionId = undefined; d.fileName = undefined
  d.external = source === 'local' ? undefined : { provider: source, projectId: '' }
}
const bindExternal = async (d: Dependency) => {
  if (!d.external) return
  const snapshot = JSON.stringify(d.external)
  try {
    const data = await lookupExternal(d.external, props.version.loaders[0] || '', props.version.gameVersions[0] || '')
    if (JSON.stringify(d.external) !== snapshot) return
    d.external = data.reference
    externalReleases.value[`${data.reference.provider}:${data.reference.projectId}`] = data.versions
    importError.value = ''
  } catch(e) { importError.value = String(e) }
}
const csv = (v: unknown) => String(v || '').split(',').map(s => s.trim()).filter(Boolean)
const add = () => emit('update:modelValue', [...props.modelValue, { id: crypto.randomUUID(), dependencyType: 'required' }])
const metadata = ref(''); const importError = ref(''); const imported = ref<Array<ImportedDependency & { projectId: string }>>([])
const importMetadata = () => { try { imported.value = parseModDependencies(metadata.value).map(d => ({ ...d, projectId: '' })); importError.value = '' } catch (e) { importError.value = String(e) } }
const appendImported = (item: ImportedDependency & { projectId: string }) => { emit('update:modelValue', [...props.modelValue, { ...item.dependency, id: crypto.randomUUID(), projectId: item.projectId }]); imported.value = imported.value.filter(d => d !== item) }
</script>


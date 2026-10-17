<template>
  <q-page class="page-shell api-docs-page q-py-xl">
    <div class="api-docs-hero">
      <div>
        <div class="text-overline text-secondary">{{ t('apiDocs.eyebrow', { site: siteName }) }}</div>
        <h1 class="text-h3 text-weight-bold q-my-sm">{{ t('apiDocs.title') }}</h1>
        <p>{{ text(bi('查看当前账户可访问的接口与接入指南。文档由服务端根据权限提供。', 'Explore the endpoints and guides available to your account, authorized by the server.')) }}</p>
      </div>
      <q-btn unelevated color="primary" icon="key" :label="t('apiDocs.manageKey')" to="/account" />
    </div>
    <div v-if="loading" class="api-docs-section" role="status"><q-spinner class="q-mr-sm" />{{ text(bi('正在获取文档…', 'Loading documentation…')) }}</div>
    <div v-else-if="error" class="api-docs-section" role="alert">
      <p>{{ text(bi('暂时无法获取文档，请重试。', 'Documentation could not be loaded. Please retry.')) }}</p>
      <q-btn outline color="primary" :label="text(bi('重试', 'Retry'))" @click="loadDocs" />
    </div>
    <div v-if="documentation" class="api-docs-layout">
      <nav class="api-docs-nav" :aria-label="t('apiDocs.contents')">
        <div class="text-overline text-grey-6 q-mb-sm">{{ t('apiDocs.contents') }}</div>
        <a v-for="guide in guides" :key="guide.id" :href="`#${guide.id}`" :aria-current="route.hash === `#${guide.id}` ? 'location' : undefined" @click="navigateSection($event, guide.id)">{{ text(guide.title) }}</a>
        <a href="#reference" :aria-current="route.hash === '#reference' ? 'location' : undefined" @click="navigateSection($event, 'reference')">{{ text(bi('可访问接口目录', 'Available endpoints')) }} · {{ endpoints.length }}</a>
      </nav>
      <main class="api-docs-content">
        <section class="api-docs-section api-intro">
          <h2>{{ text(bi('API 服务地址', 'API base URL')) }}</h2>
          <code>{{ base }}</code>
          <p>{{ text(bi('仅显示当前权限可访问的文档。登录或切换账户后会重新获取；项目操作仍需对应项目权限。', 'Only documentation available to your current permissions is shown. Signing in or changing accounts reloads it; project operations still require project permissions.')) }}</p>
          <p v-if="staticDocs">{{ text(bi('静态站点仅提供公开文档快照；受限文档需访问动态站点。', 'Static sites contain only public documentation. Use the dynamic site for restricted documentation.')) }}</p>
          <p>{{ text(bi('当前身份', 'Current role')) }}：{{ documentation.viewer.role }}<template v-if="documentation.viewer.project"> · {{ documentation.viewer.project }}</template></p>
          <q-btn flat dense color="primary" icon="download" :loading="downloading" :label="text(bi('导出 Markdown', 'Export Markdown'))" @click="downloadMarkdown" />
          <p v-if="downloadError" role="alert">{{ text(bi('文档导出失败，请重试。', 'Export failed. Please retry.')) }}</p>
          <a href="#reference" @click="navigateSection($event, 'reference')">{{ text(bi('跳到接口目录', 'Jump to endpoints')) }} →</a>
        </section>
        <details v-for="guide in guides" :id="guide.id" :key="guide.id" v-animated-details class="api-docs-section api-guide" :open="guide.id === 'quickstart' || undefined">
          <summary><h2>{{ text(guide.title) }}</h2><q-icon name="expand_more" aria-hidden="true" /></summary>
          <div class="api-guide-body">
            <p v-for="(paragraph, index) in guide.paragraphs" :key="index">{{ text(paragraph) }}</p>
            <template v-if="guide.payload"><p><code>{{ guide.payloadLabel }}</code></p><ApiCodeBlock :code="guide.payload" /></template>
            <ApiCodeBlock v-if="guide.code" :code="guide.code" />
          </div>
        </details>
        <section id="reference" class="api-docs-section api-reference">
          <h2>{{ text(bi('可访问接口目录', 'Available endpoints')) }}</h2>
          <p>{{ text(bi('路径参数在 URL 中替换，? 标记可选字段。输出列是响应结构摘要；具体发布请求见上方示例。', 'Replace path parameters in the URL; ? marks optional fields. Outputs summarize response shapes; see the guides for complete publishing examples.')) }}</p>
          <div class="api-filters">
            <q-input v-model="search" outlined dense clearable :label="text(bi('搜索接口、功能或 scope', 'Search endpoints, features or scopes'))" class="api-search">
              <template #prepend><q-icon name="search" /></template>
            </q-input>
            <q-select v-model="selectedGroup" outlined dense emit-value map-options :options="groupOptions" :label="text(bi('功能分类', 'Category'))" />
            <q-select v-model="method" outlined dense emit-value map-options :options="methodOptions" :label="text(bi('请求方法', 'Method'))" />
          </div>
          <div class="api-result-bar">
            <span role="status">{{ text(bi(`显示 ${filtered.length} / ${endpoints.length} 个接口`, `Showing ${filtered.length} / ${endpoints.length} endpoints`)) }}</span>
            <q-btn v-if="search || selectedGroup || method" flat dense color="primary" :label="text(bi('清除筛选', 'Clear filters'))" @click="clearFilters" />
          </div>
          <p v-if="!filtered.length" class="api-empty">{{ text(bi('没有匹配的接口，请尝试其他关键词或清除筛选。', 'No matching endpoints. Try another keyword or clear the filters.')) }}</p>
          <section v-for="group in visibleGroups" :key="group.id" class="api-endpoint-group">
            <h3>{{ text(group.title) }} <span>{{ group.items.length }}</span></h3>
            <details v-for="item in group.items" :key="`${item.method} ${item.path}`" v-animated-details class="api-endpoint">
              <summary>
                <q-badge :color="methodColor(item.method)" :label="item.method" />
                <code>{{ item.path }}</code>
                <span class="api-endpoint-title">{{ text(item.title) }}</span>
                <q-icon name="expand_more" aria-hidden="true" />
              </summary>
              <dl>
                <dt>{{ text(bi('权限', 'Access')) }}</dt><dd>{{ text(accessLabels[item.access] ?? bi('受限', 'Restricted')) }}<code v-if="item.scope" class="api-scope">{{ item.scope }}</code></dd>
                <dt>{{ text(bi('请求', 'Request')) }}</dt><dd>{{ text(item.input) }}</dd>
                <dt>{{ text(bi('响应', 'Response')) }}</dt><dd><code>{{ item.output }}</code></dd>
              </dl>
              <p v-if="item.note" class="api-endpoint-note">{{ text(item.note) }}</p>
            </details>
          </section>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { ApiDocumentation } from '@andrea/contracts'
import { useRoute, useRouter } from 'vue-router'
import { siteName } from '../lib/site-settings'
import { useI18n } from '../i18n'
import ApiCodeBlock from '../components/ApiCodeBlock.vue'
import { bi, searchEndpoints, type GroupId, type LocalizedText } from '../lib/api-reference'
import { useAuthStore } from '../stores/auth'
import { getAccessToken } from '../lib/auth'
import { prefersReducedMotion, setDetailsOpen, vAnimatedDetails } from '../lib/animated-details'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const text = (value: LocalizedText) => value[locale.value === 'zh-CN' ? 0 : 1]
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/u, '')
const staticDocs = import.meta.env.VITE_STATIC_MODE === 'true' && !apiBase
const documentation = shallowRef<ApiDocumentation | null>(null)
const loading = ref(true)
const error = ref(false)
const downloading = ref(false)
const downloadError = ref(false)
let generation = 0
let requestController: AbortController | undefined
let downloadController: AbortController | undefined
const base = computed(() => documentation.value?.baseUrl || new URL(apiBase || window.location.origin, window.location.origin).href.replace(/\/+$/u, ''))
const guides = computed(() => documentation.value?.guides ?? [])
const endpoints = computed(() => documentation.value?.endpoints ?? [])
const groups = computed(() => documentation.value?.groups ?? [])
const accessLabels = computed(() => documentation.value?.accessLabels ?? {})
const search = ref<string | null>('')
const selectedGroup = ref<GroupId | ''>('')
const method = ref('')
const groupOptions = computed(() => [{ label: text(bi('全部分类', 'All categories')), value: '' }, ...groups.value.map(group => ({ label: text(group.title), value: group.id }))])
const methodOptions = computed(() => [{ label: text(bi('全部方法', 'All methods')), value: '' }, ...['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => ({ label: value, value }))])
const filtered = computed(() => searchEndpoints(endpoints.value, search.value ?? '', selectedGroup.value, method.value, accessLabels.value))
const visibleGroups = computed(() => groups.value.map(group => ({ ...group, items: filtered.value.filter(item => item.group === group.id) })).filter(group => group.items.length))
const methodColor = (value: string) => ({ GET: 'positive', POST: 'primary', PUT: 'deep-orange', PATCH: 'purple', DELETE: 'negative' }[value] ?? 'grey')
function clearFilters() { search.value = ''; selectedGroup.value = ''; method.value = '' }
let navigation = 0
async function scrollToSection(id: string) {
  const current = ++navigation
  await nextTick()
  if (id !== 'reference' && !guides.value.some(guide => guide.id === id)) return
  const element = document.getElementById(id)
  if (element instanceof HTMLDetailsElement) await setDetailsOpen(element, true)
  // Finish expanding before calculating the destination, especially near the
  // bottom of the document. A newer navigation cancels this pending scroll.
  if (current === navigation && element?.isConnected) {
    element.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' })
  }
}
function navigateSection(event: MouseEvent, id: string) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const hash = `#${id}`
  if (route.hash === hash) void scrollToSection(id)
  else void router.push({ path: route.path, query: route.query, hash })
}
watch([() => route.hash, documentation], ([hash]) => {
  void scrollToSection(hash.slice(1))
}, { immediate: true })
function docsUrl(format = 'json') {
  if (staticDocs) return format === 'markdown' ? `/api/v1/docs.${locale.value}.md` : '/api/v1/docs.json'
  const params = new URLSearchParams({ format, lang: locale.value })
  if (typeof route.query.project === 'string') params.set('project', route.query.project)
  return `${apiBase}/api/v1/docs?${params}`
}
function docsHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
function clearDocument() {
  navigation += 1
  generation += 1
  requestController?.abort()
  downloadController?.abort()
  documentation.value = null
  downloading.value = false
  downloadError.value = false
}
async function loadDocs() {
  clearDocument()
  clearFilters()
  const current = generation
  const controller = new AbortController()
  requestController = controller
  loading.value = true
  error.value = false
  try {
    const response = await fetch(docsUrl(), { credentials: 'include', headers: docsHeaders(), cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error('Documentation request failed')
    const data = await response.json() as ApiDocumentation
    if (!Array.isArray(data.endpoints) || !Array.isArray(data.guides) || !Array.isArray(data.groups) || !data.viewer || !data.accessLabels) throw new Error('Invalid documentation response')
    if (auth.loaded && !auth.account && data.viewer.role !== 'guest') throw new Error('Session changed; reload required')
    if (staticDocs && !data.baseUrl) {
      data.baseUrl = window.location.origin
      data.guides = data.guides.map(guide => ({ ...guide, code: guide.code?.replace("export BASE=''", `export BASE='${window.location.origin.replaceAll("'", "'\\''")}'`) }))
    }
    if (current === generation) documentation.value = data
  } catch {
    if (current === generation) error.value = true
  } finally {
    if (current === generation) loading.value = false
  }
}
async function downloadMarkdown() {
  const current = generation
  downloadController?.abort()
  const controller = new AbortController()
  downloadController = controller
  downloading.value = true
  downloadError.value = false
  try {
    const response = await fetch(docsUrl('markdown'), { credentials: 'include', headers: docsHeaders(), cache: 'no-store', signal: controller.signal })
    if (!response.ok || (!staticDocs && !response.headers.get('content-type')?.includes('text/markdown'))) throw new Error('Export failed')
    const content = await response.text()
    if (staticDocs && !content.startsWith('# ')) throw new Error('Invalid static document')
    const blob = new Blob([staticDocs ? content.replace("export BASE=''", `export BASE='${window.location.origin}'`) : content], { type: 'text/markdown;charset=utf-8' })
    if (current !== generation) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `api-${locale.value}.md`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { if (current === generation) downloadError.value = true }
  finally { if (current === generation) downloading.value = false }
}
// A role is only a reload trigger here; the server alone selects the content.
// Compare each value separately: a getter returning a new array would also
// trigger on hash-only route changes and clear the document during navigation.
watch([() => auth.account?.id, () => auth.account?.role, () => auth.loaded, () => route.query.project], loadDocs, { immediate: true, flush: 'sync' })
onMounted(() => {
  window.addEventListener('focus', loadDocs)
  window.addEventListener('pageshow', loadDocs)
  window.addEventListener('pagehide', clearDocument)
})
onUnmounted(() => {
  clearDocument()
  window.removeEventListener('focus', loadDocs)
  window.removeEventListener('pageshow', loadDocs)
  window.removeEventListener('pagehide', clearDocument)
})
</script>

<style scoped lang="scss">
.api-docs-content { min-width: 0; }
.api-docs-nav { max-height: calc(100vh - 110px); overflow-y: auto; font-size: 13px; }
.api-docs-nav a { transition: color 180ms ease, background-color 180ms ease; }
.api-docs-nav a[aria-current="location"] { color: var(--q-primary); background: color-mix(in srgb, var(--q-primary) 10%, transparent); }
.api-intro > code { overflow-wrap: anywhere; }
.api-intro a { color: var(--q-primary); }
.api-guide > summary { display: flex; align-items: center; justify-content: space-between; cursor: pointer; gap: 12px; }
.api-guide > summary h2 { margin: 0; font-size: 1.1rem; line-height: 1.5; }
summary { list-style: none; }
summary::-webkit-details-marker { display: none; }
summary:focus-visible { outline: 2px solid var(--q-primary); outline-offset: 5px; border-radius: 4px; }
details { box-sizing: border-box; }
summary > .q-icon:last-child { transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1); }
details[data-expanded="true"] > summary > .q-icon:last-child { transform: rotate(180deg); }
.api-guide-body { min-width: 0; }
.api-guide-body p:last-of-type { margin-bottom: 0; }
.api-filters { display: grid; grid-template-columns: minmax(0, 1fr) 190px 120px; gap: 12px; }
.api-search { min-width: 0; }
.api-result-bar { display: flex; justify-content: space-between; align-items: center; min-height: 42px; color: var(--app-muted); font-size: 13px; }
.api-empty { padding: 24px 0; text-align: center; }
.api-endpoint-group { margin-top: 24px; }
.api-endpoint-group h3 { font-size: 17px; font-weight: 600; margin: 0 0 12px; line-height: 1.5; }
.api-endpoint-group h3 span { color: var(--app-muted); font-size: 12px; margin-left: 6px; }
.api-endpoint { margin-top: 8px; padding: 0; overflow: hidden; }
.api-endpoint > summary { display: grid; grid-template-columns: 58px minmax(0, 1fr) 20px; align-items: center; gap: 8px 12px; cursor: pointer; padding: 15px; }
.api-endpoint summary .q-badge { justify-self: start; font-size: 10px; }
.api-endpoint summary > code { overflow-wrap: anywhere; font-size: 12px; }
.api-endpoint-title { grid-column: 2; color: var(--app-muted); font-size: 13px; }
.api-endpoint summary > .q-icon { grid-column: 3; grid-row: 1 / 3; }
.api-endpoint dl { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 12px; margin: 0; padding: 16px; border-top: 1px solid var(--app-border); font-size: 13px; line-height: 1.8; }
.api-endpoint dt { color: var(--app-muted); }
.api-endpoint dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.api-endpoint dd code { font-weight: 400; }
.api-scope { display: inline-block; padding: 0 7px; margin-left: 8px; background: color-mix(in srgb, var(--q-primary) 10%, transparent); border-radius: 5px; }
.api-endpoint-note { font-size: 13px; padding: 0 16px 16px; margin: 0; }
@media (max-width: 1000px) { .api-filters { grid-template-columns: minmax(0, 1fr) 110px; } .api-search { grid-column: 1 / -1; } }
@media (max-width: 700px) {
  .api-docs-nav { max-height: none; }
  .api-filters { grid-template-columns: minmax(0, 1fr) 140px; }
  .api-docs-section { padding: 18px; }
  .api-docs-hero h1 { font-size: 2rem; }
  .api-endpoint > summary { padding: 12px; grid-template-columns: 45px minmax(0, 1fr) 16px; gap: 8px; }
  .api-endpoint dl { grid-template-columns: 1fr; gap: 4px; padding: 12px; }
  .api-endpoint dd { margin-bottom: 10px; }
}
</style>

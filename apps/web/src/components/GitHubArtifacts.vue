<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '../i18n'

interface Props {
  owner: string
  repo: string
  perPage?: number
}

interface WorkflowRun {
  id: number
  head_branch: string | null
  head_sha: string
}

interface Artifact {
  id: number
  name: string
  size_in_bytes: number
  created_at: string
  expires_at: string
  expired: boolean
  workflow_run: WorkflowRun | null
}

interface ArtifactResponse {
  total_count: number
  artifacts: Artifact[]
}

const props = withDefaults(defineProps<Props>(), { perPage: 30 })
const { t, locale } = useI18n()
const artifacts = ref<Artifact[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const totalCount = ref(0)
let controller: AbortController | undefined

const pageCount = () => Math.max(1, Math.ceil(totalCount.value / props.perPage))
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`
}
const formatDate = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const runUrl = (artifact: Artifact) => artifact.workflow_run
  ? `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/actions/runs/${artifact.workflow_run.id}`
  : `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/actions`

const loadArtifacts = async () => {
  controller?.abort()
  const currentController = new AbortController()
  controller = currentController
  loading.value = true
  error.value = ''

  try {
    const url = new URL(`https://api.github.com/repos/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/actions/artifacts`)
    url.searchParams.set('per_page', String(props.perPage))
    url.searchParams.set('page', String(page.value))
    const response = await fetch(url, {
      signal: currentController.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) {
      if (response.status === 403) throw new Error(t('project.githubActionsRateLimited'))
      if (response.status === 404) throw new Error(t('project.githubActionsNotFound'))
      throw new Error(t('project.githubActionsRequestFailed', { status: response.status }))
    }
    const data = await response.json() as ArtifactResponse
    artifacts.value = data.artifacts.filter((artifact) => !artifact.expired)
    totalCount.value = data.total_count
  } catch (cause) {
    if (currentController.signal.aborted) return
    error.value = cause instanceof Error ? cause.message : String(cause)
    artifacts.value = []
  } finally {
    if (controller === currentController) loading.value = false
  }
}

const changePage = (next: number) => {
  if (loading.value || next < 1 || next > pageCount()) return
  page.value = next
  void loadArtifacts()
}

watch(() => [props.owner, props.repo, props.perPage], () => {
  page.value = 1
  void loadArtifacts()
}, { immediate: true })
</script>

<template>
  <section class="github-artifacts">
    <div class="github-artifacts-toolbar">
      <div>
        <div class="github-artifacts-title"><q-icon name="hub" /> {{ t('project.githubActionsTitle') }}</div>
        <div class="github-artifacts-repository">{{ owner }}/{{ repo }}</div>
      </div>
      <q-btn flat dense no-caps icon="refresh" :label="t('project.githubActionsRefresh')" :loading="loading" @click="loadArtifacts" />
    </div>

    <q-banner v-if="error" rounded class="github-artifacts-message github-artifacts-error" role="alert">
      <template #avatar><q-icon name="error_outline" /></template>
      {{ error }}
    </q-banner>
    <div v-else-if="loading && !artifacts.length" class="github-artifacts-message">
      <q-spinner color="primary" size="1.6rem" />
      <span>{{ t('project.githubActionsLoading') }}</span>
    </div>

    <div v-else-if="artifacts.length" class="github-artifacts-list">
      <a v-for="artifact in artifacts" :key="artifact.id" class="github-artifact" :href="runUrl(artifact)" target="_blank" rel="noopener noreferrer">
        <div class="github-artifact-main">
          <div class="github-artifact-name"><q-icon name="inventory_2" /> <strong>{{ artifact.name }}</strong></div>
          <div class="github-artifact-meta">
            <span>{{ formatSize(artifact.size_in_bytes) }}</span>
            <span>{{ formatDate(artifact.created_at) }}</span>
            <span v-if="artifact.workflow_run?.head_branch"><q-icon name="account_tree" /> {{ artifact.workflow_run.head_branch }}</span>
            <span v-if="artifact.workflow_run?.head_sha"><q-icon name="commit" /> {{ artifact.workflow_run.head_sha.slice(0, 7) }}</span>
          </div>
        </div>
        <q-icon name="open_in_new" class="github-artifact-open" />
      </a>
    </div>
    <div v-else class="github-artifacts-message">
      <q-icon name="inventory_2" size="1.6rem" />
      <span>{{ t('project.githubActionsEmpty') }}</span>
    </div>

    <div class="github-artifacts-footer">
      <span>{{ t('project.githubActionsPage', { page: page, total: pageCount() }) }}</span>
      <div class="github-artifacts-pagination">
        <q-btn flat dense round icon="chevron_left" :aria-label="t('project.githubActionsPrevious')" :disable="page <= 1 || loading" @click="changePage(page - 1)" />
        <q-btn flat dense round icon="chevron_right" :aria-label="t('project.githubActionsNext')" :disable="page >= pageCount() || loading" @click="changePage(page + 1)" />
      </div>
    </div>
    <p class="github-artifacts-note">{{ t('project.githubActionsHint') }}</p>
  </section>
</template>

<style scoped>
.github-artifacts { min-height: 280px; padding: 20px; color: var(--app-text); }
.github-artifacts-toolbar, .github-artifact, .github-artifacts-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.github-artifacts-toolbar { padding-bottom: 16px; border-bottom: 1px solid var(--app-border); }
.github-artifacts-title { display: flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 750; }
.github-artifacts-title .q-icon { color: var(--app-primary-strong); }
.github-artifacts-repository { margin-top: 4px; color: var(--app-muted); font: .78rem/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
.github-artifacts-list { margin-top: 4px; }
.github-artifact { padding: 15px 2px; color: inherit; text-decoration: none; border-bottom: 1px solid var(--app-border); transition: color .16s ease, background-color .16s ease; }
.github-artifact:hover { color: var(--app-primary-strong); background: color-mix(in srgb, var(--app-primary) 5%, transparent); }
.github-artifact-main { min-width: 0; }
.github-artifact-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
.github-artifact-name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.github-artifact-name .q-icon { flex: 0 0 auto; color: var(--app-muted); }
.github-artifact-meta { display: flex; flex-wrap: wrap; gap: 5px 13px; margin-top: 6px; color: var(--app-muted); font-size: .76rem; }
.github-artifact-meta span { display: inline-flex; align-items: center; gap: 3px; }
.github-artifact-meta .q-icon { font-size: 14px; }
.github-artifact-open { flex: 0 0 auto; color: var(--app-muted); }
.github-artifacts-message { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 190px; color: var(--app-muted); text-align: center; }
.github-artifacts-error { justify-content: flex-start; min-height: 0; margin-top: 16px; color: var(--app-danger, #e5534b); background: color-mix(in srgb, var(--app-danger, #e5534b) 8%, transparent); }
.github-artifacts-footer { margin-top: 14px; color: var(--app-muted); font-size: .78rem; }
.github-artifacts-pagination { display: flex; gap: 2px; }
.github-artifacts-note { margin: 12px 0 0; color: var(--app-muted); font-size: .75rem; line-height: 1.5; }
@media (max-width: 600px) {
  .github-artifacts { padding: 16px; }
  .github-artifact { align-items: flex-start; }
  .github-artifact-open { margin-top: 2px; }
}
</style>

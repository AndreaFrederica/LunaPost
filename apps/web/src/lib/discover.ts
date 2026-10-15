import { computed, reactive, ref } from 'vue'
import type { Project } from '@andrea/contracts'
import { listProjects } from './api'
import { discoverResultMatches } from '../discoverPreferences'

/**
 * Data layer for the Discover page. It owns the request parameters, the result that is currently on screen, and the option
 * values the filter panel offers. The page only reads this state and calls the actions; it never decides what to fetch or
 * whether a response should replace what is rendered.
 */

export type DiscoverFilters = {
  query: string
  type: string
  loaders: string[]
  categories: string[]
  gameVersion: string | null
  environment: string | null
  sort: string
}

export const filters = reactive<DiscoverFilters>({ query: '', type: 'all', loaders: [], categories: [], gameVersion: null, environment: null, sort: 'relevance' })

export const projects = ref<Project[]>([])
export const total = ref(0)
export const page = ref(1)
export const pageSize = 20
export const viewMode = ref<'list' | 'grid'>('list')
export const loading = ref(false)
export const error = ref('')

// Option values mirror what the catalogue currently offers for the active query, so a value that no longer exists disappears again.
// They derive from the stored result rather than the raw response, which means an unchanged response keeps the lists exactly as they
// are and nothing has to be measured or animated.
const uniqueValues = (values: string[]) => values.filter((value, index, list) => value && list.indexOf(value) === index)
export const loaderOptionValues = computed(() => uniqueValues(projects.value.flatMap((project) => project.loaders ?? [])))
export const categoryOptionValues = computed(() => uniqueValues(projects.value.flatMap((project) => project.categories ?? [])))
export const gameVersionOptionValues = computed(() => uniqueValues(projects.value.flatMap((project) => project.gameVersions ?? [])).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })))

// The last response, used to decide whether a new one has to be rendered at all.
let lastResult: { projects: Project[]; total: number } | null = null

export const buildRequestParams = (offset: number) => ({
  query: filters.query.trim() || undefined,
  type: filters.type === 'all' ? undefined : filters.type,
  loader: filters.loaders,
  category: filters.categories,
  gameVersion: filters.gameVersion ?? undefined,
  clientSide: filters.environment?.startsWith('client:') ? filters.environment.slice(7) : undefined,
  serverSide: filters.environment?.startsWith('server:') ? filters.environment.slice(7) : undefined,
  sort: filters.sort,
  offset,
  limit: pageSize,
})

export const fetchProjects = async () => {
  // Only a refresh that already rendered a result may skip the loading state; the first load still shows it.
  loading.value = lastResult === null
  error.value = ''
  try {
    const result = await listProjects(buildRequestParams((page.value - 1) * pageSize))
    if (!discoverResultMatches(lastResult, result)) {
      projects.value = result.projects
      total.value = result.total
      lastResult = structuredClone({ projects: result.projects, total: result.total })
    }
  } catch {
    error.value = 'apiError'
  } finally {
    loading.value = false
  }
}

export const setType = (type: string) => { filters.type = type; page.value = 1; void fetchProjects() }
export const setPage = (value: number) => { page.value = value; void fetchProjects() }
export const clearFilters = () => {
  filters.query = ''
  filters.type = 'all'
  filters.loaders = []
  filters.categories = []
  filters.gameVersion = null
  filters.environment = null
  page.value = 1
  void fetchProjects()
}

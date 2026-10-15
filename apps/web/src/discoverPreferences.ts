import { ref } from 'vue'

/** How the Discover result list decides that a response is unchanged. */
export type DiscoverFreezePolicy = 'deep' | 'id'

const FREEZE_KEY = 'andrea-discover-freeze'
const POLICY_KEY = 'andrea-discover-freeze-policy'
const SCROLL_KEY = 'andrea-discover-scroll'

const storedFreeze = typeof window !== 'undefined' ? window.localStorage.getItem(FREEZE_KEY) : null
const storedPolicy = typeof window !== 'undefined' ? window.localStorage.getItem(POLICY_KEY) : null
const storedScroll = typeof window !== 'undefined' ? window.localStorage.getItem(SCROLL_KEY) : null

/** Keep the rendered Discover list when a response is equivalent to what is already on screen. */
export const freezeDiscoverList = ref(storedFreeze !== 'off')
/** 'deep' compares every rendered field; 'id' only compares the project id order and the total. */
export const discoverFreezePolicy = ref<DiscoverFreezePolicy>(storedPolicy === 'id' ? 'id' : 'deep')

export const setFreezeDiscoverList = (enabled: boolean) => {
  freezeDiscoverList.value = enabled
  if (typeof window !== 'undefined') window.localStorage.setItem(FREEZE_KEY, enabled ? 'on' : 'off')
}

export const setDiscoverFreezePolicy = (policy: DiscoverFreezePolicy) => {
  discoverFreezePolicy.value = policy === 'id' ? 'id' : 'deep'
  if (typeof window !== 'undefined') window.localStorage.setItem(POLICY_KEY, discoverFreezePolicy.value)
}

/** 'page': the whole document scrolls (default, friendly to readers and assistive tech).
 *  'results': the two columns are given a scrollable height up front, so only the result list scrolls inside it. */
export type DiscoverScrollMode = 'page' | 'results'
export const discoverScrollMode = ref<DiscoverScrollMode>(storedScroll === 'results' ? 'results' : 'page')
export const setDiscoverScrollMode = (mode: DiscoverScrollMode) => {
  discoverScrollMode.value = mode === 'results' ? 'results' : 'page'
  if (typeof window !== 'undefined') window.localStorage.setItem(SCROLL_KEY, discoverScrollMode.value)
}

/** Stable stringify so key order in the API payload cannot fake a change. */
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

/**
 * Returns true when the new page is equivalent to what is already rendered, so the caller can skip touching the
 * reactive list and Vue will not rebuild the cards.
 */
export const discoverResultMatches = (previous: { projects: unknown[]; total: number } | null, next: { projects: unknown[]; total: number }) => {
  if (!previous) return false
  if (discoverFreezePolicy.value === 'id') {
    if (previous.total !== next.total || previous.projects.length !== next.projects.length) return false
    return previous.projects.every((project, index) => (project as { id?: unknown }).id === (next.projects[index] as { id?: unknown }).id)
  }
  return canonical(previous) === canonical(next)
}

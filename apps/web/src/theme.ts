import { computed, ref } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const stored = typeof window !== 'undefined' ? window.localStorage.getItem('andrea-theme') : null
const mode = ref<ThemeMode>(stored === 'light' || stored === 'dark' ? stored : 'system')
const systemDark = ref(typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true)
const resolvedTheme = computed<'light' | 'dark'>(() => mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value)

const applyTheme = () => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.style.colorScheme = resolvedTheme.value
}

export const useTheme = () => {
  const setThemeMode = (next: ThemeMode) => {
    mode.value = next
    if (typeof window !== 'undefined') window.localStorage.setItem('andrea-theme', next)
    applyTheme()
  }
  return { mode, resolvedTheme, isDark: computed(() => resolvedTheme.value === 'dark'), setThemeMode, applyTheme }
}

if (typeof window !== 'undefined') {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const updateSystemTheme = (event: MediaQueryListEvent) => { systemDark.value = event.matches; if (mode.value === 'system') applyTheme() }
  media.addEventListener?.('change', updateSystemTheme)
}
applyTheme()

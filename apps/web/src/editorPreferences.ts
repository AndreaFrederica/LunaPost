import { ref } from 'vue'

const stored = typeof window !== 'undefined' ? window.localStorage.getItem('andrea-editor-mode') : null
export const useMonacoEditor = ref(stored !== 'textarea')
export const setMonacoEditor = (enabled: boolean) => {
  useMonacoEditor.value = enabled
  if (typeof window !== 'undefined') window.localStorage.setItem('andrea-editor-mode', enabled ? 'monaco' : 'textarea')
}

<template>
  <div class="api-code-block">
    <div class="api-code-toolbar">
      <q-btn flat dense size="sm" :icon="copied ? 'check' : 'content_copy'" :label="label" @click="copy" />
      <span role="status">{{ failed ? (locale === 'zh-CN' ? '复制失败，请手动选择文本' : 'Copy failed; select the text manually') : '' }}</span>
    </div>
    <pre class="api-code"><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { copyToClipboard } from 'quasar'
import { useI18n } from '../i18n'
const props = defineProps<{ code: string }>()
const { locale } = useI18n()
const copied = ref(false)
const failed = ref(false)
const label = computed(() => locale.value === 'zh-CN' ? (copied.value ? '已复制' : '复制代码') : (copied.value ? 'Copied' : 'Copy code'))
async function copy() {
  try { await copyToClipboard(props.code); copied.value = true; failed.value = false }
  catch { copied.value = false; failed.value = true }
}
</script>

<style scoped>
.api-code-block { min-width: 0; margin-top: 16px; }
.api-code-toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 12px; color: var(--app-muted); }
.api-code { margin-top: 4px; white-space: pre; max-width: 100%; }
</style>

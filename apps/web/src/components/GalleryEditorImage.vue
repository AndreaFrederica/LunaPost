<template>
  <div class="gallery-editor-item">
    <button type="button" class="gallery-editor-preview" :disabled="!source || !loaded" :aria-label="t('projectEditor.previewImage', { number })" @click="previewOpen = true">
      <q-img v-if="source" :key="source" :src="source" :ratio="16 / 9" fit="contain" :alt="t('projectEditor.imageNumber', { number })" @load="loaded = true" @error="loaded = false">
        <template #loading><q-spinner color="primary" size="28px" /></template>
        <template #error>
          <div class="gallery-editor-message absolute-full"><q-icon name="broken_image" size="30px" /><span>{{ t('projectEditor.imageLoadFailed') }}</span></div>
        </template>
      </q-img>
      <div v-else class="gallery-editor-message gallery-editor-placeholder"><q-icon name="add_photo_alternate" size="32px" /><span>{{ t('projectEditor.imagePreviewHint') }}</span></div>
      <span v-if="loaded" class="gallery-editor-zoom" aria-hidden="true"><q-icon name="zoom_in" size="22px" /></span>
    </button>
    <div class="gallery-editor-toolbar">
      <span>{{ t('projectEditor.imageNumber', { number }) }}</span>
      <q-btn flat round dense color="negative" icon="delete_outline" :aria-label="t('projectEditor.deleteImage')" @click="$emit('remove')" />
    </div>
    <q-input :model-value="modelValue" outlined dense type="url" :label="t('projectEditor.imageUrl')" @update:model-value="$emit('update:modelValue', String($event ?? ''))" />
    <q-dialog v-model="previewOpen" maximized transition-show="fade" transition-hide="fade">
      <div class="gallery-lightbox">
        <q-btn round flat icon="close" color="white" class="gallery-lightbox-close" :aria-label="t('project.closePreview')" @click="previewOpen = false" />
        <q-img :src="source" fit="contain" class="gallery-lightbox-image" :alt="t('projectEditor.imageNumber', { number })">
          <template #loading><q-spinner color="primary" size="36px" /></template>
          <template #error><div class="gallery-editor-message absolute-full"><q-icon name="broken_image" size="36px" /><span>{{ t('projectEditor.imageLoadFailed') }}</span></div></template>
        </q-img>
      </div>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'

const props = defineProps<{ modelValue: string; number: number }>()
defineEmits<{ 'update:modelValue': [value: string]; remove: [] }>()
const { t } = useI18n()
const loaded = ref(false)
const previewOpen = ref(false)
const source = computed(() => {
  const value = props.modelValue.trim()
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) && (/^https?:\/\//i.test(value) || value.startsWith('/')) ? url.href : ''
  } catch { return '' }
})
watch(source, () => { loaded.value = false; previewOpen.value = false }, { flush: 'sync' })
</script>

<style scoped>
.gallery-editor-preview { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; padding: 0; border: 0; border-radius: var(--app-radius-sm); background: var(--app-surface-muted); color: var(--app-muted); cursor: zoom-in; }
.gallery-editor-preview:disabled { cursor: default; }
.gallery-editor-preview:focus-visible { outline: 2px solid var(--q-primary); outline-offset: 3px; }
.gallery-editor-message { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px; color: var(--app-muted); background: var(--app-surface-muted); font-size: 13px; font-weight: 400; line-height: 1.5; text-align: center; }
.gallery-editor-placeholder { height: 100%; }
.gallery-editor-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--app-muted); font-size: 13px; }
.gallery-editor-zoom { position: absolute; right: 10px; bottom: 10px; display: grid; place-items: center; padding: 6px; border-radius: 8px; background: #0009; color: #fff; opacity: .7; transition: opacity 180ms ease; }
.gallery-editor-preview:hover .gallery-editor-zoom, .gallery-editor-preview:focus-visible .gallery-editor-zoom { opacity: 1; }
</style>

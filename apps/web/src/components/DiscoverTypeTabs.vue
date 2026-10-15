<template>
  <nav ref="typeTabs" class="type-tabs" :class="{ sliding: indicatorReady }">
    <span class="type-tab-indicator" :style="indicatorStyle" aria-hidden="true" />
    <button v-for="item in typeOptions" :key="item.value" :class="{ active: filters.type === item.value }" @click="setType(item.value)">
      <q-icon :name="item.icon" size="18px" /> {{ item.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import { filters, setType } from '../lib/discover'

// The active tab is highlighted by one pill that follows the real button box, so the component has to measure that box.
const { t } = useI18n()
const typeOptions = computed(() => [
  { label: t('discover.all'), value: 'all', icon: 'explore' },
  { label: t('discover.mods'), value: 'mod', icon: 'extension' },
  { label: t('discover.modpacks'), value: 'modpack', icon: 'inventory_2' },
  { label: t('discover.resourcepacks'), value: 'resourcepack', icon: 'palette' },
  { label: t('discover.shaders'), value: 'shader', icon: 'blur_on' },
  { label: t('discover.plugins'), value: 'plugin', icon: 'dns' },
  { label: t('discover.tools'), value: 'tool', icon: 'construction' },
])

const typeTabs = ref<HTMLElement | null>(null)
const indicatorReady = ref(false)
const WIDE_TABS = '(min-width: 901px)'
const indicatorStyle = ref<Record<string, string>>({ transform: 'translateX(0px)', width: '0px' })

const syncIndicator = () => {
  const nav = typeTabs.value
  if (!nav) return
  const active = nav.querySelector<HTMLElement>('button.active')
  if (!active || !window.matchMedia(WIDE_TABS).matches) { indicatorReady.value = false; return }
  indicatorStyle.value = { transform: `translateX(${active.offsetLeft}px)`, width: `${active.offsetWidth}px` }
  indicatorReady.value = true
}
const onViewportResize = () => { syncIndicator(); requestAnimationFrame(syncIndicator) }
let observer: ResizeObserver | null = null

watch([typeOptions, () => filters.type], () => nextTick(syncIndicator))
onMounted(() => {
  nextTick(() => { syncIndicator(); requestAnimationFrame(syncIndicator) })
  window.addEventListener('resize', onViewportResize)
  if (typeof ResizeObserver !== 'undefined' && typeTabs.value) { observer = new ResizeObserver(() => syncIndicator()); observer.observe(typeTabs.value) }
})
onBeforeUnmount(() => { window.removeEventListener('resize', onViewportResize); observer?.disconnect() })
</script>

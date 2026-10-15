<template>
  <aside class="filter-panel">
    <div class="filter-panel-title"><span>{{ t('discover.filters') }}</span><q-btn v-if="hasFilters" flat dense color="primary" :label="t('discover.clear')" @click="clearFilters" /></div>
    <q-input v-model="filters.query" dense outlined rounded :placeholder="t('discover.search')" class="filter-search" @keyup.enter="fetchProjects"><template #prepend><q-icon name="search" /></template></q-input>
    <q-separator class="q-my-md" />
    <div v-for="group in groups" :key="group.key" class="filter-group" :class="{ 'is-collapsed': !open[group.key] }">
      <button type="button" class="filter-title" :aria-expanded="open[group.key]" @click="toggle(group.key)">
        <span>{{ group.label }}</span><span v-if="group.count()" class="filter-count">{{ group.count() }}</span>
        <q-icon name="expand_more" class="filter-chevron" size="19px" />
      </button>
      <div class="filter-group-body"><div class="filter-group-inner">
        <q-select v-if="group.key === 'gameVersion'" v-model="filters.gameVersion" dense outlined clearable emit-value map-options :label="group.label" :placeholder="t('discover.allVersions')" :options="gameVersionOptions" @update:model-value="fetchProjects" />
        <q-select v-else-if="group.key === 'environment'" v-model="filters.environment" dense outlined clearable emit-value map-options :label="group.label" :placeholder="t('discover.allEnvironments')" :options="environmentOptions" @update:model-value="fetchProjects" />
        <TransitionGroup v-else-if="group.key === 'loader'" tag="div" name="option-item" class="option-list">
          <q-checkbox v-for="option in loaderOptions" :key="option.value" v-model="selectedLoaders" :val="option.value" :label="option.label" :class="{ 'is-unavailable': option.unavailable }" color="primary" @update:model-value="fetchProjects" />
        </TransitionGroup>
        <TransitionGroup v-else tag="div" name="option-item" class="option-list">
          <q-checkbox v-for="option in categoryOptions" :key="option.value" v-model="selectedCategories" :val="option.value" :label="option.label" :class="{ 'is-unavailable': option.unavailable }" color="primary" @update:model-value="fetchProjects" />
        </TransitionGroup>
      </div></div>
    </div>
    <div class="filter-note"><q-icon name="tune" /><span>{{ t('discover.note') }}</span></div>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from '../i18n'
import {
  categoryOptionValues, clearFilters, fetchProjects, filters, gameVersionOptionValues, loaderOptionValues,
} from '../lib/discover'

// View state only: which sections are expanded. Every value the panel edits lives in the data layer.
const { t } = useI18n()
const open = reactive<Record<string, boolean>>({ gameVersion: true, loader: true, category: true, environment: true })
const toggle = (key: string) => { open[key] = !open[key] }
const hasFilters = computed(() => Boolean(filters.query || filters.type !== 'all' || filters.loaders.length || filters.categories.length || filters.gameVersion || filters.environment))

const categories = ['adventure', 'optimization', 'technology', 'magic', 'decoration', 'library', 'utility', 'storage', 'worldgen', 'food', 'social']
const categoryLabel = (value: string) => categories.includes(value) ? t(`category.${value}`) : value
const gameVersionOptions = computed(() => gameVersionOptionValues.value.map((value) => ({ label: value, value })))
// An option the current result no longer offers stays in the list while it is selected, muted but still clickable, so the filter is
// always visible and can be unchecked on its own.
const optionList = (available: { label: string; value: string }[], selected: string[]) => [
  ...available.map((option) => ({ ...option, unavailable: false })),
  ...selected.filter((value) => !available.some((option) => option.value === value)).map((value) => ({ label: value, value, unavailable: true })),
]
const loaderOptions = computed(() => optionList(loaderOptionValues.value.map((value) => ({ label: value, value })), filters.loaders))
const categoryOptions = computed(() => optionList(categoryOptionValues.value.map((value) => ({ label: categoryLabel(value), value })), filters.categories))
const environmentOptions = computed(() => [
  { label: `${t('discover.client')} · ${t('common.required')}`, value: 'client:required' },
  { label: `${t('discover.client')} · ${t('common.optional')}`, value: 'client:optional' },
  { label: `${t('discover.server')} · ${t('common.required')}`, value: 'server:required' },
  { label: `${t('discover.server')} · ${t('common.optional')}`, value: 'server:optional' },
  { label: `${t('discover.clientServer')} · ${t('common.optional')}`, value: 'both:optional' },
])

const groups = computed(() => [
  { key: 'gameVersion', label: t('discover.gameVersion'), count: () => (filters.gameVersion ? 1 : 0) },
  { key: 'loader', label: t('discover.loader'), count: () => filters.loaders.length },
  { key: 'category', label: t('discover.category'), count: () => filters.categories.length },
  { key: 'environment', label: t('discover.environment'), count: () => (filters.environment ? 1 : 0) },
])
// Writable mirrors bind v-model straight to the data layer.
const selectedLoaders = computed({ get: () => filters.loaders, set: (value: string[]) => { filters.loaders = value } })
const selectedCategories = computed({ get: () => filters.categories, set: (value: string[]) => { filters.categories = value } })
</script>

<template>
  <q-page class="discover-page" :class="{ 'discover-page--own-scroll': discoverScrollMode === 'results' }">
    <div class="discover-shell">
      <section class="discover-heading">
        <div><div class="eyebrow">{{ t('discover.eyebrow', { site: siteName }) }}</div><h1>{{ t('discover.title') }}</h1><p>{{ t('discover.subtitle') }}</p></div>
        <div class="heading-actions"><q-btn v-if="auth.canPublish" outline color="primary" icon="add" :label="t('discover.publish')" to="/admin/projects/new" /><q-btn flat round icon="refresh" :loading="loading" @click="fetchProjects" /></div>
      </section>
      <DiscoverTypeTabs />
      <div class="discover-layout" :class="{ 'discover-layout--own-scroll': discoverScrollMode === 'results' }">
        <DiscoverFilterPanel />
        <DiscoverResults />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import DiscoverTypeTabs from '../components/DiscoverTypeTabs.vue'
import DiscoverFilterPanel from '../components/DiscoverFilterPanel.vue'
import DiscoverResults from '../components/DiscoverResults.vue'
import { useI18n } from '../i18n'
import { useAuthStore } from '../stores/auth'
import { fetchProjects, loading } from '../lib/discover'
import { siteName } from '../lib/site-settings'
import { discoverScrollMode } from '../discoverPreferences'

const auth = useAuthStore()
const { t } = useI18n()

onMounted(() => { void fetchProjects() })
</script>

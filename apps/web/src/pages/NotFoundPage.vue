<template>
  <q-page class="page-shell not-found-page q-py-xl">
    <div class="not-found-card">
      <div class="not-found-code">{{ t('notFound.code') }}</div>
      <h1 class="text-h4 text-weight-bold q-my-sm">{{ t('notFound.title') }}</h1>
      <p class="not-found-description">{{ t('notFound.description') }}</p>
      <div class="not-found-actions">
        <q-btn unelevated no-caps color="primary" text-color="dark" icon="explore" :label="t('notFound.home')" to="/" />
        <q-btn flat no-caps color="primary" icon="arrow_back" :label="t('notFound.back')" @click="goBack" />
      </div>
      <div class="not-found-path">{{ path }}</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '../i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
// Showing the attempted path makes a mistyped or stale link obvious.
const path = computed(() => route.fullPath)
const goBack = () => { if (window.history.length > 1) router.back(); else void router.push('/') }
</script>

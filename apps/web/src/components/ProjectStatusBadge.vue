<template>
  <q-badge v-if="status && status !== 'approved'" :color="color" :label="label" class="status-badge" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'

// Only ever rendered for a project the viewer is allowed to see: the API hides non-approved projects from everyone else.
const props = defineProps<{ status?: string }>()
const { t } = useI18n()
const color = computed(() => ({ pending: 'orange-9', rejected: 'negative', draft: 'grey-7', archived: 'grey-8' }[props.status ?? ''] ?? 'grey-7'))
const label = computed(() => t(`status.${props.status}`))
</script>

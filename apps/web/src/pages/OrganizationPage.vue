<template>
  <q-page class="profile-page">
    <div class="profile-shell">
      <q-btn flat dense icon="arrow_back" label="返回 Discover" to="/" class="profile-back" />
      <q-banner v-if="error" rounded class="bg-red-1 text-red-9 q-mb-md">{{ error }}</q-banner>
      <template v-if="organization">
        <section class="profile-hero"><q-avatar size="104px" class="profile-avatar" color="primary" text-color="dark"><q-img v-if="organization.avatarUrl" :src="organization.avatarUrl" fit="cover" /><span v-else>{{ organization.name.slice(0, 1).toUpperCase() }}</span></q-avatar><div class="profile-identity"><div class="profile-eyebrow">ORGANIZATION</div><h1>{{ organization.name }}</h1><div class="profile-handle">@{{ organization.slug }}</div><p :class="{ 'profile-muted': !organization.description }">{{ organization.description || '这个组织还没有填写简介。' }}</p><div class="profile-meta"><span><q-icon name="event" /> 建立于 {{ formatDate(organization.createdAt) }}</span><span><q-icon name="inventory_2" /> {{ projects.length }} 个项目</span><span><q-icon name="people" /> {{ members.length }} 位成员</span></div></div></section>
        <div class="profile-layout"><main class="profile-main"><div class="profile-section-heading"><div><div class="profile-eyebrow">PROJECTS</div><h2>组织项目</h2></div></div><div v-if="projects.length" class="profile-project-grid"><article v-for="project in projects" :key="project.id" class="profile-project-card" @click="router.push(`/projects/${project.slug}`)"><div class="profile-project-icon" :class="{ 'has-image': project.iconUrl || project.iconUrls?.[0] }" :style="project.color ? { background: project.color } : undefined"><q-img v-if="project.iconUrl || project.iconUrls?.[0]" :src="project.iconUrl || project.iconUrls[0]" fit="cover" /><span v-else>{{ project.title.slice(0, 1).toUpperCase() }}</span></div><div class="profile-project-body"><div class="profile-project-title"><h3>{{ project.title }}</h3><span>{{ project.type }}</span></div><p>{{ project.description }}</p><div class="profile-project-meta"><span><q-icon name="download" /> {{ compactNumber(project.downloads ?? 0) }}</span><span><q-icon name="new_releases" /> {{ project.versions.length }} 个版本</span></div></div></article></div><q-card v-else flat bordered class="profile-empty"><q-icon name="inventory_2" size="42px" color="grey-6" /><div class="text-h6 q-mt-sm">还没有公开项目</div></q-card></main><aside class="profile-sidebar"><q-card flat bordered class="profile-info-card"><h2>成员</h2><div v-for="member in members" :key="member.accountId" class="profile-info-row"><q-icon name="person" /><span>{{ member.email.split('@')[0] }} · {{ member.role }}</span></div></q-card></aside></div>
      </template>
      <q-spinner v-else-if="!error" color="primary" size="2rem" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Organization, Project } from '@andrea/contracts'
import { getOrganization, type OrganizationMember } from '../lib/account'

const route = useRoute(); const router = useRouter(); const organization = ref<Organization>(); const members = ref<OrganizationMember[]>([]); const projects = ref<Project[]>([]); const error = ref('')
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)); const compactNumber = (value: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
onMounted(async () => { try { const result = await getOrganization(String(route.params.slug)); organization.value = result.organization; members.value = result.members; projects.value = result.projects } catch (cause) { error.value = cause instanceof Error ? cause.message : '找不到这个组织。' } })
</script>

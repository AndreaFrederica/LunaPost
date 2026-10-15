<template>
  <q-page class="profile-page">
    <div class="profile-shell">
      <q-btn flat dense icon="arrow_back" label="返回 Discover" to="/" class="profile-back" />
      <q-banner v-if="error" rounded class="bg-red-1 text-red-9 q-mb-md">{{ error }}</q-banner>
      <template v-if="profile">
        <section class="profile-hero">
          <q-avatar size="104px" class="profile-avatar" color="primary" text-color="dark">
            <q-img v-if="profile.avatarUrl" :src="profile.avatarUrl" fit="cover" />
            <span v-else>{{ profile.displayName.slice(0, 1).toUpperCase() }}</span>
          </q-avatar>
          <div class="profile-identity">
            <div class="profile-eyebrow">PUBLIC PROFILE</div>
            <h1>{{ profile.displayName }}</h1>
            <div class="profile-handle">@{{ profile.handle }}</div>
            <p v-if="profile.bio">{{ profile.bio }}</p>
            <p v-else class="profile-muted">这个用户还没有填写个人简介。</p>
            <div class="profile-meta"><span><q-icon name="event" /> 加入于 {{ formatDate(profile.createdAt) }}</span><span><q-icon name="inventory_2" /> {{ projects.length }} 个项目</span><span v-if="profile.location"><q-icon name="location_on" /> {{ profile.location }}</span><a v-if="profile.websiteUrl" :href="profile.websiteUrl" target="_blank"><q-icon name="language" /> 个人网站</a><a v-if="profile.githubUrl" :href="profile.githubUrl" target="_blank"><q-icon name="code" /> GitHub</a><a v-for="link in profile.links ?? []" :key="link.id || link.url" :href="link.url" target="_blank" rel="noopener"><q-icon :name="link.icon || 'link'" /> {{ link.label }}</a></div>
          </div>
        </section>
        <div class="profile-layout">
          <main class="profile-main">
            <div class="profile-section-heading"><div><div class="profile-eyebrow">PROJECTS</div><h2>项目</h2></div><q-badge color="primary" text-color="dark" :label="String(projects.length)" /></div>
            <div v-if="projects.length" class="profile-project-grid">
              <article v-for="project in projects" :key="project.id" class="profile-project-card" @click="router.push(`/projects/${project.slug}`)">
                <div class="profile-project-icon" :class="{ 'has-image': project.iconUrl || project.iconUrls?.[0] }" :style="project.color ? { background: project.color } : undefined"><q-img v-if="project.iconUrl || project.iconUrls?.[0]" :src="project.iconUrl || project.iconUrls[0]" fit="cover" /><span v-else>{{ project.title.slice(0, 1).toUpperCase() }}</span></div>
                <div class="profile-project-body"><div class="profile-project-title"><h3>{{ project.title }}</h3><span>{{ project.type }}</span></div><p>{{ project.description }}</p><div class="profile-project-meta"><span><q-icon name="download" /> {{ compactNumber(project.downloads ?? 0) }}</span><span><q-icon name="update" /> {{ project.versions.length }} 个版本</span></div></div>
              </article>
            </div>
            <q-card v-else flat bordered class="profile-empty"><q-icon name="inventory_2" size="42px" color="grey-6" /><div class="text-h6 q-mt-sm">还没有公开项目</div><p>这个用户还没有发布或参与项目。</p></q-card>
          </main>
          <aside class="profile-sidebar"><q-card flat bordered class="profile-info-card"><h2>关于</h2><div class="profile-info-row"><q-icon name="alternate_email" /><span>@{{ profile.handle }}</span></div><div class="profile-info-row"><q-icon name="calendar_today" /><span>加入于 {{ formatDate(profile.createdAt) }}</span></div></q-card></aside>
        </div>
      </template>
      <q-spinner v-else-if="!error" color="primary" size="2rem" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Project } from '@andrea/contracts'
import { getUserProfile, type PublicProfile } from '../lib/api'

const route = useRoute(); const router = useRouter(); const profile = ref<PublicProfile>(); const projects = ref<Project[]>([]); const error = ref('')
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value))
const compactNumber = (value: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
onMounted(async () => {
  try { const result = await getUserProfile(String(route.params.id)); profile.value = result.profile; projects.value = result.projects } catch (cause) { error.value = cause instanceof Error ? cause.message : '找不到这个用户。' }
})
</script>

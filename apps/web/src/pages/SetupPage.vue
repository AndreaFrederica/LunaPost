<template>
  <q-page class="page-shell q-py-xl">
    <div class="auth-card q-mx-auto">
      <div class="text-overline text-primary">FIRST RUN SETUP</div>
      <h1 class="text-h4 text-weight-bold q-mt-sm">站点初始化</h1>
      <p class="text-grey-7">创建站点信息和首个管理员账户。初始化完成后，此页面会自动锁定。</p>

      <q-banner v-if="status?.initialized" rounded class="bg-green-1 text-green-9 q-mb-md">
        服务已经初始化，请前往登录页面。
        <template #action><q-btn flat label="登录" to="/auth" /></template>
      </q-banner>
      <q-banner v-else-if="error" rounded class="bg-red-1 text-red-9 q-mb-md">{{ error }}</q-banner>
      <q-form v-else class="q-gutter-md" @submit.prevent="submit">
        <q-input v-model="formSiteName" outlined label="站点名称" required />
        <q-input v-if="status?.requiresToken" v-model="token" outlined label="初始化令牌" type="password" required />
        <q-input v-model="email" outlined type="email" label="管理员邮箱" autocomplete="email" required />
        <q-input v-model="password" outlined type="password" label="管理员密码（至少 8 位）" autocomplete="new-password" minlength="8" required />
        <q-btn type="submit" color="primary" unelevated class="full-width" label="完成初始化" :loading="loading" />
      </q-form>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSetupStatus, initialize, type SetupStatus } from '../lib/setup'
import { useAuthStore } from '../stores/auth'

const status = ref<SetupStatus>()
const auth = useAuthStore()
const formSiteName = ref('')
const token = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const load = async () => {
  try {
    status.value = await getSetupStatus()
  } catch {
    error.value = '无法连接 API，请先启动服务端。'
  }
}

const submit = async () => {
  loading.value = true
  error.value = ''
  try {
    const result = await initialize({ siteName: formSiteName.value, token: token.value || undefined, email: email.value, password: password.value })
    auth.setAccount(result.account)
    status.value = { initialized: true, requiresToken: false }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '初始化失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

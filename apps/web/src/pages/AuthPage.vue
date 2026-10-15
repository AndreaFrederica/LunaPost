<template>
  <q-page class="page-shell q-py-xl">
    <div class="auth-card q-mx-auto">
      <div class="text-overline text-primary">ACCOUNT</div>
      <h1 class="text-h4 text-weight-bold q-mt-sm">{{ isRegister ? t('auth.registerTitle') : t('auth.signInTitle', { site: siteName }) }}</h1>
      <p class="text-grey-7">账户用于管理项目、Wiki Fork 和 API Key。</p>

      <q-banner v-if="error" rounded class="bg-red-1 text-red-9 q-mb-md">{{ error }}</q-banner>
      <q-form class="q-gutter-md" @submit.prevent="submit">
        <q-input v-model="email" type="email" outlined label="邮箱" autocomplete="email" required />
        <q-input v-model="password" outlined :type="showPassword ? 'text' : 'password'" label="密码" :autocomplete="isRegister ? 'new-password' : 'current-password'" required>
          <template #append>
            <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" />
          </template>
        </q-input>
        <q-input v-if="isRegister && requireInviteCode" v-model="inviteCode" outlined label="邀请码" autocomplete="off" required />
        <q-banner v-if="isRegister && !registrationEnabled" rounded class="bg-orange-1 text-orange-10">当前站点暂未开放注册。</q-banner>
        <q-btn type="submit" color="primary" unelevated class="full-width" :loading="loading" :label="isRegister ? '注册' : '登录'" />
      </q-form>

      <q-separator class="q-my-lg" />
      <q-btn flat color="primary" class="full-width" :label="isRegister ? '已有账户？去登录' : '还没有账户？注册'" @click="toggleMode" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getPublicRegistrationSettings, login, register } from '../lib/auth'
import { siteName } from '../lib/site-settings'
import { useI18n } from '../i18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()

const router = useRouter()
const auth = useAuthStore()
const isRegister = ref(false)
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const inviteCode = ref('')
const registrationEnabled = ref(true)
const requireInviteCode = ref(false)

const toggleMode = () => {
  isRegister.value = !isRegister.value
  error.value = ''
}

const loadRegistrationSettings = async () => { try { const result = await getPublicRegistrationSettings(); registrationEnabled.value = result.settings.registration.enabled; requireInviteCode.value = result.settings.registration.requireInviteCode } catch { /* use defaults while API is unavailable */ } }

const submit = async () => {
  loading.value = true
  error.value = ''
  try {
    if (isRegister.value && !registrationEnabled.value) throw new Error('当前站点暂未开放注册。')
    if (isRegister.value) {
      const result = await register(email.value, password.value, inviteCode.value)
      if (result.pendingApproval) { error.value = '注册成功，账户正在等待管理员审核。'; return }
      auth.setAccount(result.account)
    } else {
      const result = await login(email.value, password.value)
      auth.setAccount(result.account)
    }
    await auth.load()
    await router.push('/')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}
loadRegistrationSettings()
</script>

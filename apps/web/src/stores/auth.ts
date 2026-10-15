import { defineStore } from 'pinia'
import { getMe, logout } from '../lib/auth'
import type { AccountView } from '@andrea/contracts'

let pendingLoad: Promise<void> | null = null
let authGeneration = 0

export const useAuthStore = defineStore('auth', {
  state: () => ({ account: null as AccountView | null, loaded: false, loading: false }),
  getters: {
    isAuthenticated: (state) => Boolean(state.account),
    isAdmin: (state) => state.account?.role === 'admin' || state.account?.role === 'root',
    isRoot: (state) => state.account?.role === 'root',
    canPublish: (state) => state.account?.role === 'root' || state.account?.role === 'admin' || state.account?.role === 'developer',
  },
  actions: {
    async load() {
      if (pendingLoad) return pendingLoad
      this.loading = true
      const generation = authGeneration
      pendingLoad = (async () => {
        try {
          const account = (await getMe()).account
          if (generation === authGeneration) this.account = account
        } catch {
          if (generation === authGeneration) this.account = null
        } finally {
          if (generation === authGeneration) this.loaded = true
          this.loading = false
          pendingLoad = null
        }
      })()
      return pendingLoad
    },
    setAccount(account: AccountView | null) {
      authGeneration += 1
      this.account = account
      this.loaded = true
    },
    async signOut() {
      await logout().catch(() => undefined)
      this.setAccount(null)
    },
  },
})

import { defineStore } from 'pinia'
import api from '../api/axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: null,
    loading: false,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
    isAdmin: (state) => Boolean(state.user?.is_admin),
    isSuperAdmin: (state) => Boolean(state.user?.is_super_admin),
    managedShopSlugs: (state) => state.user?.managed_shop_slugs || [],
    primaryAdminShopSlug: (state) => {
      if (state.user?.is_super_admin) return 'default'
      return state.user?.admin_shop_slug || state.user?.managed_shop_slugs?.[0] || null
    },
    canAccessShopAdmin: (state) => (slug) => {
      if (!state.user?.is_admin) return false
      if (state.user.is_super_admin) return true
      return (state.user.managed_shop_slugs || []).includes(slug)
    },
  },
  actions: {
    setToken(token) {
      this.token = token || ''
      if (this.token) {
        localStorage.setItem('token', this.token)
      } else {
        localStorage.removeItem('token')
      }
    },
    async fetchMe() {
      if (!this.token) return null
      this.loading = true
      try {
        const { data } = await api.get('/api/auth/me')
        const { token, ...profile } = data
        this.user = profile
        if (token) this.setToken(token)
        return profile
      } catch (error) {
        this.logout()
        throw error
      } finally {
        this.loading = false
      }
    },
    logout() {
      this.user = null
      this.setToken('')
    },
  },
})

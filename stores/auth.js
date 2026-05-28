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
        this.user = data
        return data
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

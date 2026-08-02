import { defineStore } from 'pinia'
import api from '../api/axios'

export const useShopStore = defineStore('shop', {
  state: () => ({
    slug: localStorage.getItem('shopSlug') || '',
    shop: null,
    shops: [],
    loading: false,
    error: '',
  }),
  getters: {
    isReady: (state) => Boolean(state.slug && state.shop),
    shopName: (state) => state.shop?.name || state.slug,
  },
  actions: {
    setSlug(slug) {
      const normalized = String(slug || '').trim().toLowerCase()
      this.slug = normalized
      if (normalized) {
        localStorage.setItem('shopSlug', normalized)
      } else {
        localStorage.removeItem('shopSlug')
      }
    },
    async fetchShops() {
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.get('/api/shops')
        this.shops = data || []
        return this.shops
      } catch (err) {
        this.error = err?.response?.data?.error || 'โหลดรายการร้านไม่สำเร็จ'
        throw err
      } finally {
        this.loading = false
      }
    },
    async loadShop(slug) {
      const normalized = String(slug || '').trim().toLowerCase()
      if (!normalized) {
        this.shop = null
        this.slug = ''
        localStorage.removeItem('shopSlug')
        return null
      }
      this.setSlug(normalized)
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.get(`/api/shops/${encodeURIComponent(normalized)}`)
        this.shop = data
        return data
      } catch (err) {
        this.shop = null
        this.error = err?.response?.data?.error || 'ไม่พบร้าน'
        throw err
      } finally {
        this.loading = false
      }
    },
    clear() {
      this.slug = ''
      this.shop = null
      this.error = ''
      localStorage.removeItem('shopSlug')
    },
  },
})

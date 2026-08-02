import { defineStore } from 'pinia'
import api from '../api/axios'
import { formatUiText } from '../utils/formatUiText'

const FALLBACK = {
  ui_brand_main: 'Nail',
  ui_brand_accent: 'Thuean',
  ui_tagline: 'จองคิวง่าย · สะสมแต้ม',
  ui_page_title: 'Nail Thuean',
  ui_logo_url: '',
  ui_hero_image_url: '',
  ui_color_primary: '#C4847A',
  ui_color_primary_dark: '#A66B62',
  ui_color_primary_light: '#F5E8E6',
}

function applyTheme(settings) {
  const root = document.documentElement
  const primary = settings.ui_color_primary || FALLBACK.ui_color_primary
  const dark = settings.ui_color_primary_dark || FALLBACK.ui_color_primary_dark
  const light = settings.ui_color_primary_light || FALLBACK.ui_color_primary_light
  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-primary-dark', dark)
  root.style.setProperty('--color-primary-light', light)
  document.title = settings.ui_page_title || FALLBACK.ui_page_title
}

export const useUiSettingsStore = defineStore('uiSettings', {
  state: () => ({
    settings: { ...FALLBACK },
    loadedForSlug: '',
    loading: false,
  }),
  getters: {
    t: (state) => (key, vars) => formatUiText(state.settings[key] ?? '', vars),
    brandMain: (state) => state.settings.ui_brand_main || FALLBACK.ui_brand_main,
    brandAccent: (state) => state.settings.ui_brand_accent || FALLBACK.ui_brand_accent,
    tagline: (state) => state.settings.ui_tagline || FALLBACK.ui_tagline,
    logoUrl: (state) => state.settings.ui_logo_url || '',
    heroImageUrl: (state) => state.settings.ui_hero_image_url || '',
    get: (state) => (key, fallback = '') => state.settings[key] ?? fallback,
  },
  actions: {
    async fetch() {
      this.loading = true
      try {
        const { data } = await api.get('/api/bookings/ui-settings')
        this.settings = { ...FALLBACK, ...(data || {}) }
        this.loadedForSlug = localStorage.getItem('shopSlug') || ''
        applyTheme(this.settings)
        return this.settings
      } catch {
        applyTheme(FALLBACK)
        return this.settings
      } finally {
        this.loading = false
      }
    },
    applyLocal(partial) {
      this.settings = { ...this.settings, ...partial }
      applyTheme(this.settings)
    },
    reset() {
      this.settings = { ...FALLBACK }
      this.loadedForSlug = ''
    },
  },
})

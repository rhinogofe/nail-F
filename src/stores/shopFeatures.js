import { defineStore } from 'pinia'
import api from '../api/axios'

const FALLBACK_FEATURES = {
  nav_reviews: true,
  nav_location: true,
  nav_chat: true,
  tab_bookings: true,
  tab_revenue: true,
  tab_services: true,
  tab_settings: true,
  tab_ui: true,
  tab_blocks: true,
  tab_reviews: true,
  tab_renewal: true,
  tab_manual: true,
  tab_users: true,
  settings_deposit: true,
  settings_coupon: true,
  settings_line: true,
  settings_chat_notify: true,
  settings_unpaid: true,
  settings_locations: true,
  settings_use_coupon: true,
  blocks_shop_hours: true,
  blocks_day_hours: true,
  blocks_slot_display: true,
  blocks_advance: true,
  blocks_bulk: true,
  blocks_calendar: true,
  feat_payment_slip: true,
  feat_coupon_points: true,
  feat_extend_booking: true,
}

export const useShopFeaturesStore = defineStore('shopFeatures', {
  state: () => ({
    features: { ...FALLBACK_FEATURES },
    loadedForSlug: '',
  }),
  getters: {
    isEnabled: (state) => (key) => state.features[key] !== false,
    navReviews: (state) => state.features.nav_reviews !== false,
    navChat: (state) => state.features.nav_chat !== false,
    navLocation: (state) => state.features.nav_location !== false,
    tabEnabled: (state) => (tabKey) => {
      const map = {
        bookings: 'tab_bookings',
        revenue: 'tab_revenue',
        services: 'tab_services',
        settings: 'tab_settings',
        ui: 'tab_ui',
        blocks: 'tab_blocks',
        reviews: 'tab_reviews',
        renewal: 'tab_renewal',
        manual: 'tab_manual',
        users: 'tab_users',
        features: 'tab_features',
      }
      const key = map[tabKey]
      if (!key) return true
      return state.features[key] !== false
    },
    settingsSectionEnabled: (state) => (sectionKey) => {
      const map = {
        deposit: 'settings_deposit',
        coupon: 'settings_coupon',
        line: 'settings_line',
        'chat-notify': 'settings_chat_notify',
        unpaid: 'settings_unpaid',
        locations: 'settings_locations',
        'use-coupon': 'settings_use_coupon',
      }
      const key = map[sectionKey]
      if (!key) return true
      return state.features[key] !== false
    },
    blocksSectionEnabled: (state) => (sectionKey) => {
      const map = {
        'shop-hours': 'blocks_shop_hours',
        'day-hours': 'blocks_day_hours',
        'slot-display': 'blocks_slot_display',
        advance: 'blocks_advance',
        bulk: 'blocks_bulk',
        calendar: 'blocks_calendar',
      }
      const key = map[sectionKey]
      if (!key) return true
      return state.features[key] !== false
    },
  },
  actions: {
    applyFromUiSettings(data) {
      const incoming = data?.shop_features
      if (incoming && typeof incoming === 'object') {
        this.features = { ...FALLBACK_FEATURES, ...incoming }
      }
      this.loadedForSlug = localStorage.getItem('shopSlug') || ''
    },
    async fetchForAdmin() {
      try {
        const { data } = await api.get('/api/bookings/ui-settings')
        this.applyFromUiSettings(data)
        return this.features
      } catch {
        return this.features
      }
    },
    reset() {
      this.features = { ...FALLBACK_FEATURES }
      this.loadedForSlug = ''
    },
  },
})

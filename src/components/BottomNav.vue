<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatUnread } from '../composables/useChatUnread'
import { useUiSettingsStore } from '../stores/uiSettings'
import { useShopFeaturesStore } from '../stores/shopFeatures'

defineProps({
  active: {
    type: String,
    default: 'bookings',
  },
})

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiSettingsStore()
const shopFeatures = useShopFeaturesStore()
const { unreadCount } = useChatUnread()

const shopSlug = computed(() => route.params.shopSlug || localStorage.getItem('shopSlug') || 'default')
const showAdminNav = computed(() => auth.canAccessShopAdmin(shopSlug.value))
const showReviewsNav = computed(() => shopFeatures.navReviews)
const showLocationNav = computed(() => shopFeatures.navLocation && ui.showShopLocationNav)
const showChatNav = computed(() => shopFeatures.navChat)
const locationNavLabel = computed(() => ui.shopLocationNavLabel)

function go(path) {
  const target = `/${shopSlug.value}${path}`
  if (route.path === target) return
  router.replace(target)
}
</script>

<template>
  <nav class="bottom-nav" aria-label="เมนูหลัก">
    <button
      type="button"
      class="nav-item"
      :class="{ active: active === 'bookings' }"
      :aria-current="active === 'bookings' ? 'page' : undefined"
      @click="go('/bookings')"
    >
      <i class="ti ti-calendar" aria-hidden="true"></i>
      <span>จอง</span>
    </button>
    <button
      v-if="showReviewsNav"
      type="button"
      class="nav-item"
      :class="{ active: active === 'reviews' }"
      :aria-current="active === 'reviews' ? 'page' : undefined"
      @click="go('/reviews')"
    >
      <i class="ti ti-star" aria-hidden="true"></i>
      <span>รีวิว</span>
    </button>
    <button
      v-if="showLocationNav"
      type="button"
      class="nav-item"
      :class="{ active: active === 'location' }"
      :aria-current="active === 'location' ? 'page' : undefined"
      @click="go('/location')"
    >
      <i class="ti ti-map-pin" aria-hidden="true"></i>
      <span>{{ locationNavLabel }}</span>
    </button>
    <button
      v-if="showChatNav"
      type="button"
      class="nav-item"
      :class="{ active: active === 'chat' }"
      :aria-current="active === 'chat' ? 'page' : undefined"
      @click="go('/chat')"
    >
      <i class="ti ti-message-circle" aria-hidden="true"></i>
      <span>แชท</span>
      <span v-if="unreadCount > 0" class="nav-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>
    <button
      type="button"
      class="nav-item"
      :class="{ active: active === 'profile' }"
      :aria-current="active === 'profile' ? 'page' : undefined"
      @click="go('/profile')"
    >
      <i class="ti ti-user" aria-hidden="true"></i>
      <span>บัญชี</span>
    </button>
    <button
      v-if="showAdminNav"
      type="button"
      class="nav-item"
      :class="{ active: active === 'admin' }"
      :aria-current="active === 'admin' ? 'page' : undefined"
      @click="go('/admin')"
    >
      <i class="ti ti-shield" aria-hidden="true"></i>
      <span>แอดมิน</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: var(--page-max-width);
  min-height: var(--bottom-nav-total);
  padding-bottom: var(--bottom-nav-safe);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--color-border);
  box-shadow: var(--shadow-nav);
  display: flex;
  z-index: var(--z-nav);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: var(--text-label);
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: color var(--transition);
  position: relative;
  min-height: var(--bottom-nav-height);
  padding: var(--space-1) var(--space-1) var(--space-2);
}

.nav-item i {
  font-size: 20px;
  line-height: 1;
}

.nav-item span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item.active {
  color: var(--color-primary);
  font-weight: 600;
  background: color-mix(in srgb, var(--color-primary-light) 65%, transparent);
  border-radius: var(--radius-md);
  margin: var(--space-1);
  padding-bottom: var(--space-1);
}

.nav-item.active i {
  transform: translateY(-1px);
}

.nav-item:active:not(.active) {
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .nav-item.active i {
    transform: none;
  }
}

.nav-badge {
  position: absolute;
  top: 6px;
  left: calc(50% + 10px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--color-error);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  border: 2px solid var(--color-surface-elevated);
}

@media (hover: hover) {
  .nav-item:hover:not(.active) {
    color: var(--color-text-secondary);
  }
}

@media (min-width: 900px) {
  .bottom-nav {
    top: 0;
    bottom: 0;
    left: max(0px, calc((100vw - min(var(--page-wide-max), 100vw)) / 2));
    transform: none;
    width: var(--sidebar-width);
    max-width: none;
    min-height: 100svh;
    height: 100svh;
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-3);
    padding-top: max(var(--space-5), env(safe-area-inset-top, 0px));
    padding-bottom: max(var(--space-4), env(safe-area-inset-bottom, 0px));
    border-top: none;
    border-right: 1px solid var(--color-border);
    box-shadow: none;
    background: var(--color-surface-elevated);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    overflow-y: auto;
  }

  .nav-item {
    flex: 0 0 auto;
    flex-direction: row;
    justify-content: flex-start;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--touch-min);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-caption);
  }

  .nav-item.active {
    margin: 0;
    padding: var(--space-2) var(--space-3);
  }

  .nav-item.active i {
    transform: none;
  }

  .nav-badge {
    top: 50%;
    left: auto;
    right: var(--space-2);
    transform: translateY(-50%);
  }

  @media (hover: hover) {
    .nav-item:hover:not(.active) {
      background: color-mix(in srgb, var(--color-primary-light) 45%, transparent);
      color: var(--color-text-primary);
    }
  }
}
</style>

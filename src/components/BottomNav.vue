<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatUnread } from '../composables/useChatUnread'

defineProps({
  active: {
    type: String,
    default: 'bookings',
  },
})

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { unreadCount } = useChatUnread()

const shopSlug = computed(() => route.params.shopSlug || localStorage.getItem('shopSlug') || 'default')
const showAdminNav = computed(() => auth.canAccessShopAdmin(shopSlug.value))

function go(path) {
  router.push(`/${shopSlug.value}${path}`)
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
      <span v-if="active === 'bookings'" class="nav-dot" aria-hidden="true"></span>
      <i class="ti ti-calendar" aria-hidden="true"></i>
      <span>จอง</span>
    </button>
    <button
      type="button"
      class="nav-item"
      :class="{ active: active === 'reviews' }"
      :aria-current="active === 'reviews' ? 'page' : undefined"
      @click="go('/reviews')"
    >
      <span v-if="active === 'reviews'" class="nav-dot" aria-hidden="true"></span>
      <i class="ti ti-star" aria-hidden="true"></i>
      <span>รีวิว</span>
    </button>
    <button
      type="button"
      class="nav-item"
      :class="{ active: active === 'chat' }"
      :aria-current="active === 'chat' ? 'page' : undefined"
      @click="go('/chat')"
    >
      <span v-if="active === 'chat'" class="nav-dot" aria-hidden="true"></span>
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
      <span v-if="active === 'profile'" class="nav-dot" aria-hidden="true"></span>
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
      <span v-if="active === 'admin'" class="nav-dot" aria-hidden="true"></span>
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
  max-width: 430px;
  height: var(--bottom-nav-height);
  background: var(--color-surface-elevated);
  border-top: 1px solid var(--color-border);
  display: flex;
  padding-bottom: env(safe-area-inset-bottom, 0);
  z-index: 30;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: var(--text-label);
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: color var(--transition);
  position: relative;
  min-height: var(--touch-min);
  padding-top: 6px;
}

.nav-item i {
  font-size: 20px;
  line-height: 1;
}

.nav-dot {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-primary);
}

.nav-item.active {
  color: var(--color-primary);
}

.nav-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 22px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.nav-item:hover:not(.active) {
  color: var(--color-text-secondary);
}
</style>

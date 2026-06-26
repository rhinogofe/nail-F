<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

defineProps({
  active: {
    type: String,
    default: 'bookings',
  },
})

const router = useRouter()
const auth = useAuthStore()
</script>

<template>
  <nav class="bottom-nav" aria-label="เมนูหลัก">
    <button
      type="button"
      class="nav-item"
      :class="{ active: active === 'bookings' }"
      :aria-current="active === 'bookings' ? 'page' : undefined"
      @click="router.push('/bookings')"
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
      @click="router.push('/reviews')"
    >
      <span v-if="active === 'reviews'" class="nav-dot" aria-hidden="true"></span>
      <i class="ti ti-star" aria-hidden="true"></i>
      <span>รีวิว</span>
    </button>
    <button
      type="button"
      class="nav-item"
      :class="{ active: active === 'profile' }"
      :aria-current="active === 'profile' ? 'page' : undefined"
      @click="router.push('/profile')"
    >
      <span v-if="active === 'profile'" class="nav-dot" aria-hidden="true"></span>
      <i class="ti ti-user" aria-hidden="true"></i>
      <span>บัญชี</span>
    </button>
    <button
      v-if="auth.isAdmin"
      type="button"
      class="nav-item"
      :class="{ active: active === 'admin' }"
      :aria-current="active === 'admin' ? 'page' : undefined"
      @click="router.push('/admin')"
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

.nav-item:hover:not(.active) {
  color: var(--color-text-secondary);
}
</style>

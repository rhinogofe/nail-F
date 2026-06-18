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

function logout() {
  auth.logout()
  router.push('/login')
}
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
      <i class="ti ti-calendar" aria-hidden="true"></i>
      <span>จองคิว</span>
    </button>
    <button
      type="button"
      class="nav-item"
      :class="{ active: active === 'reviews' }"
      :aria-current="active === 'reviews' ? 'page' : undefined"
      @click="router.push('/reviews')"
    >
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
      <i class="ti ti-user" aria-hidden="true"></i>
      <span>บัญชี</span>
    </button>
    <button
      v-if="auth.isAdmin"
      type="button"
      class="nav-item"
      @click="router.push('/admin')"
    >
      <i class="ti ti-shield" aria-hidden="true"></i>
      <span>แอดมิน</span>
    </button>
    <button type="button" class="nav-item" @click="logout">
      <i class="ti ti-logout" aria-hidden="true"></i>
      <span>ออกจากระบบ</span>
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
  background: #fff;
  border-top: 0.5px solid #f1e8f0;
  display: flex;
  padding: 8px 0 max(14px, env(safe-area-inset-bottom));
  z-index: 30;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 500;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s;
}

.nav-item i {
  font-size: 20px;
}

.nav-item.active {
  color: #e11d48;
}

.nav-item:hover:not(.active) {
  color: #475569;
}
</style>

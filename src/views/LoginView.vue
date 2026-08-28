<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useShopStore } from '../stores/shop'
import { useUiSettingsStore } from '../stores/uiSettings'
import api from '../api/axios'
import defaultShopImage from '../assets/S__22888451.jpg'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const shopStore = useShopStore()
const ui = useUiSettingsStore()
const name = ref('')
const phone = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const shopSlug = computed(() => route.params.shopSlug || shopStore.slug || 'default')
const logoSrc = computed(() => ui.logoUrl || defaultShopImage)
const heroSrc = computed(() => ui.heroImageUrl || defaultShopImage)
const displayName = computed(() => {
  const main = ui.brandMain
  const accent = ui.brandAccent
  if (accent) return `${main}${accent}`
  return shopStore.shopName || main
})

const shopExpired = computed(() => Boolean(shopStore.shop?.usage_expired))
const shopExpiryMessage = computed(() => shopStore.error || 'สาขานี้หมดระยะเวลาใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ')

function bookingsPath() {
  return `/${shopSlug.value}/bookings`
}

function loginPath() {
  return `/${shopSlug.value}/login`
}

onMounted(async () => {
  const token = route.query.token
  if (typeof token === 'string' && token) {
    auth.setToken(token)
    try {
      await auth.fetchMe()
      router.replace(bookingsPath())
    } catch {
      router.replace(loginPath())
    }
  }
})

async function loginWithPhone() {
  errorMessage.value = ''
  const payload = {
    name: name.value.trim(),
    phone: phone.value.trim(),
  }

  if (!payload.name || !payload.phone) {
    errorMessage.value = 'กรุณากรอกชื่อและเบอร์โทรให้ครบ'
    return
  }

  submitting.value = true
  try {
    const { data } = await api.post('/api/auth/phone-login', payload)
    auth.setToken(data.token)
    await auth.fetchMe()
    router.replace(bookingsPath())
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page app-page app-page--standalone center">
    <section class="card login-card login-pretty">
      <div class="login-hero-wrap">
        <img :src="heroSrc" :alt="`ภาพปก ${displayName}`" class="login-hero-image" />
      </div>
      <div class="login-body">
        <div class="brand-row">
          <div class="brand-icon">
            <img :src="logoSrc" :alt="`โลโก้ ${displayName}`" class="brand-logo-image" />
          </div>
          <div class="login-brand-copy">
            <h1 class="login-brand-title">
              {{ ui.brandMain }}<span v-if="ui.brandAccent" class="login-brand-accent">{{ ui.brandAccent }}</span>
            </h1>
            <p class="login-tagline">{{ ui.tagline }}</p>
          </div>
        </div>

        <p v-if="shopExpired" class="alert-banner error" role="alert">{{ shopExpiryMessage }}</p>
        <form v-else class="login-form" @submit.prevent="loginWithPhone">
          <label class="field">
            <i class="ti ti-user field-icon" aria-hidden="true"></i>
            <input
              v-model="name"
              type="text"
              name="name"
              autocomplete="name"
              placeholder="ชื่อผู้จอง"
              aria-label="ชื่อผู้จอง"
            />
          </label>
          <label class="field">
            <i class="ti ti-phone field-icon" aria-hidden="true"></i>
            <input
              v-model="phone"
              type="tel"
              name="tel"
              autocomplete="tel"
              inputmode="tel"
              placeholder="เบอร์โทร"
              aria-label="เบอร์โทร"
            />
          </label>
          <p class="login-hint">ชื่อและเบอร์ตรงกับที่เคยใช้ = เข้าบัญชีเดิม · ไม่ตรง = บัญชีใหม่</p>
          <p v-if="errorMessage" class="alert-banner error" role="alert">{{ errorMessage }}</p>
          <button
            type="submit"
            class="btn primary login-submit"
            :disabled="submitting"
            :aria-busy="submitting"
          >
            {{ submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยชื่อและเบอร์' }}
          </button>

          <div class="login-divider" aria-hidden="true">
            <span>หรือ</span>
          </div>

          <RouterLink :to="`/${shopSlug}/register-shop`" class="login-register-btn">
            <span class="login-register-icon">
              <i class="ti ti-building-store" aria-hidden="true"></i>
            </span>
            <span class="login-register-text">
              <strong>สมัครร้านค้า</strong>
              <small>เปิดร้านใหม่ · ตั้งค่า UI · เริ่มรับจอง</small>
            </span>
            <i class="ti ti-chevron-right login-register-arrow" aria-hidden="true"></i>
          </RouterLink>

          <p class="login-privacy">ข้อมูลของคุณใช้เพื่อยืนยันตัวตนและติดต่อการจองเท่านั้น</p>
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100svh;
  display: grid;
  place-content: center;
  padding: var(--page-padding-x);
  background: transparent;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-3) 0 var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--text-caption);
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.login-register-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  text-decoration: none;
  color: inherit;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition), background var(--transition);
}

.login-register-btn:hover {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  box-shadow: var(--shadow-sm);
  background: var(--color-primary-light);
}

.login-register-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.login-register-btn:active {
  transform: scale(0.99);
}

.login-register-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  flex-shrink: 0;
}

.login-register-icon i {
  font-size: 20px;
}

.login-register-text {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.login-register-text strong {
  display: block;
  font-size: var(--text-body);
  color: var(--color-text-primary);
}

.login-register-text small {
  display: block;
  margin-top: 2px;
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.login-register-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>

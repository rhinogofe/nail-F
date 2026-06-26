<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import shopLogo from '../assets/S__22888451.jpg'
import shopHero from '../assets/S__22888451.jpg'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const name = ref('')
const phone = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const providers = [
  { key: 'line', label: 'เข้าสู่ระบบด้วย LINE', icon: 'L' },
  { key: 'facebook', label: 'เข้าสู่ระบบด้วย Facebook', icon: 'f' },
]

const loginLinks = computed(() =>
  providers.map((provider) => ({
    ...provider,
    href: `${apiBase}/api/auth/${provider.key}`,
  })),
)

onMounted(async () => {
  const token = route.query.token
  if (typeof token === 'string' && token) {
    auth.setToken(token)
    try {
      await auth.fetchMe()
      router.replace('/bookings')
    } catch {
      router.replace('/login')
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
    router.replace('/bookings')
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page center">
    <section class="card login-card login-pretty">
      <div class="login-hero-wrap">
        <img :src="shopHero" alt="Nail studio cover" class="login-hero-image" />
      </div>
      <div class="login-body">
        <div class="brand-row">
          <div class="brand-icon">
            <img :src="shopLogo" alt="Nail shop logo" class="brand-logo-image" />
          </div>
          <div>
            <h1 class="login-brand-title">Nail Thuean</h1>
            <p class="login-tagline">จองคิวง่าย · สะสมแต้ม</p>
          </div>
        </div>

        <div class="login-form">
          <label class="field">
            <i class="ti ti-user field-icon" aria-hidden="true"></i>
            <input v-model="name" type="text" placeholder="ชื่อผู้จอง" />
          </label>
          <label class="field">
            <i class="ti ti-phone field-icon" aria-hidden="true"></i>
            <input v-model="phone" type="tel" placeholder="เบอร์โทร" />
          </label>
          <button class="btn primary login-submit" :disabled="submitting" @click="loginWithPhone">
            {{ submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยชื่อและเบอร์' }}
          </button>
          <p v-if="errorMessage" class="error" style="margin-top:8px">{{ errorMessage }}</p>
        </div>
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
  background: var(--color-surface);
}
</style>

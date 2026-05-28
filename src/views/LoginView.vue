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

// OAuth ปิดไว้ก่อน — เปิดใช้เมื่อตั้งค่า env บน server แล้ว
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
  <main class="page center">
    <section class="card login-card login-pretty">
      <div class="login-hero-wrap">
        <img :src="shopHero" alt="Nail studio cover" class="login-hero-image" />
      </div>
      <div class="brand-row">
        <div class="brand-icon">
          <img :src="shopLogo" alt="Nail shop logo" class="brand-logo-image" />
        </div>
        <div>
          <h1>Nail Thuean</h1>
          <p class="muted">จองคิวง่าย พร้อมระบบสะสมแต้ม</p>
        </div>
      </div>

      <div class="login-form">
        <label class="field">
          <span class="field-icon">👤</span>
          <input v-model="name" type="text" placeholder="ชื่อผู้จอง" />
        </label>
        <label class="field">
          <span class="field-icon">📞</span>
          <input v-model="phone" type="tel" placeholder="เบอร์โทร" />
        </label>
        <button class="btn primary login-submit" :disabled="submitting" @click="loginWithPhone">
          {{ submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยชื่อและเบอร์' }}
        </button>
        <p v-if="errorMessage" class="error" style="margin-top:8px">{{ errorMessage }}</p>
      </div>
      <!-- <p class="muted divider-text">หรือเข้าสู่ระบบด้วย</p>

      <a
        v-for="provider in loginLinks"
        :key="provider.key"
        :href="provider.href"
        class="btn btn-provider provider-btn"
        :class="`provider-${provider.key}`"
      >
        <span class="provider-icon">{{ provider.icon }}</span>
        <span>{{ provider.label }}</span>
      </a> -->
    </section>
  </main>
</template>

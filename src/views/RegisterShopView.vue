<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useShopStore } from '../stores/shop'
import api from '../api/axios'
import { REGISTER_UI_FIELD_GROUPS, UI_FORM_DEFAULTS } from '../constants/uiSettingsFields'
import { compressImage } from '../utils/compressChatImage'
import { imageUrlHint } from '../utils/imageUrl'
import {
  formatHmLabel,
  formatLastBookingOptionLabel,
  MAX_SLOT_HOURS,
  MIN_SLOT_HOURS,
  normalizeBookingSlotHours,
  normalizeShopLastBookingHour,
  normalizeShopOpenHour,
} from '../utils/bookingSlots'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const shopStore = useShopStore()

const step = ref(1)
const registerPin = ref('')
const registerEnabled = ref(true)
const pinVerified = ref(false)
const name = ref('')
const phone = ref('')
const shopSlug = ref('')
const shopName = ref('')
const uiForm = ref({ ...UI_FORM_DEFAULTS })
const submitting = ref(false)
const errorMessage = ref('')
const uiImageUploading = ref('')
const pendingUiUploadKind = ref('')
const uiImageFileInput = ref(null)
const pendingLogoFile = ref(null)
const pendingHeroFile = ref(null)
const pendingKshopFile = ref(null)
const registerServices = ref([])
const serviceDraft = ref({
  option_name: '',
  description: '',
  price: 0,
  duration_min: 60,
})
const shopOpenHour = ref(9)
const shopLastBookingHour = ref(18)
const bookingSlotHours = ref(2)
const advanceDays = ref(30)

const uiFieldGroups = REGISTER_UI_FIELD_GROUPS
const scheduleStep = 3 + uiFieldGroups.length + 1
const serviceStep = scheduleStep + 1
const totalSteps = serviceStep
const openHourOptions = Array.from({ length: 20 }, (_, i) => i + 1)
const slotHourOptions = Array.from(
  { length: MAX_SLOT_HOURS - MIN_SLOT_HOURS + 1 },
  (_, i) => i + MIN_SLOT_HOURS,
)
const loginSlug = computed(() => route.params.shopSlug || 'default')

const groupIcons = {
  'แบรนด์ & รูปภาพ': 'ti-palette',
  'ชำระเงิน': 'ti-credit-card',
  'ชำระเงิน & LINE': 'ti-credit-card',
  'สีธีม': 'ti-color-swatch',
}

const currentUiGroupIndex = computed(() => step.value - 4)
const currentUiGroup = computed(() => {
  const idx = currentUiGroupIndex.value
  if (idx < 0 || idx >= uiFieldGroups.length) return null
  return uiFieldGroups[idx]
})

const isScheduleStep = computed(() => step.value === scheduleStep)
const isServiceStep = computed(() => step.value === serviceStep)
const isLastStep = computed(() => isServiceStep.value)

const lastBookingHourOptions = computed(() => {
  const open = normalizeShopOpenHour(shopOpenHour.value)
  const slot = normalizeBookingSlotHours(bookingSlotHours.value)
  return Array.from({ length: 23 }, (_, i) => i).filter((h) => h >= open + slot && h <= 22)
})

const stepTitle = computed(() => {
  if (step.value === 1) return 'รหัสสร้างร้าน'
  if (step.value === 2) return 'บัญชีเจ้าของ'
  if (step.value === 3) return 'ข้อมูลร้าน'
  if (isServiceStep.value) return 'เพิ่มบริการ'
  if (isScheduleStep.value) return 'เวลา & การจอง'
  return currentUiGroup.value?.title || 'ตั้งค่า UI'
})

const pageTitle = computed(() => {
  const brandTab = uiForm.value.ui_page_title?.trim()
  if (step.value >= 4 && currentUiGroupIndex.value === 0 && brandTab) {
    return brandTab
  }
  return `สมัครร้านค้า — ${stepTitle.value}`
})

const progressPct = computed(() => Math.round((step.value / totalSteps) * 100))

let savedDocumentTitle = ''

function loginPath() {
  return `/${loginSlug.value}/login`
}

function slugFromName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function onRegisterPinInput(event) {
  registerPin.value = String(event.target.value || '').replace(/\D/g, '').slice(0, 4)
}

function validateStepPin() {
  if (!/^\d{4}$/.test(registerPin.value)) {
    errorMessage.value = 'กรุณากรอกรหัส 4 หลัก'
    return false
  }
  return true
}

function validateStepOwner() {
  if (!name.value.trim() || !phone.value.trim()) {
    errorMessage.value = 'กรุณากรอกชื่อและเบอร์โทรให้ครบ'
    return false
  }
  return true
}

function validateStepShop() {
  if (!shopSlug.value.trim()) {
    errorMessage.value = 'กรุณาระบุ slug ร้าน (a-z, 0-9, -)'
    return false
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(shopSlug.value.trim())) {
    errorMessage.value = 'slug ใช้ได้เฉพาะตัวพิมพ์เล็ก a-z, 0-9 และ -'
    return false
  }
  if (!shopName.value.trim()) {
    errorMessage.value = 'กรุณาระบุชื่อร้าน'
    return false
  }
  return true
}

function uiFieldHasValue(key) {
  const val = String(uiForm.value[key] ?? '').trim()
  if (val === 'pending-upload') return true
  return val !== ''
}

function shouldShowRegisterField(field) {
  if (field.hideInRegister) return false
  if (!field.hideWhen) return true
  return !uiFieldHasValue(field.hideWhen)
}

function registerGroupFields(group) {
  if (!group) return []
  return group.fields.filter((field) => shouldShowRegisterField(field))
}

function validateServiceStep() {
  if (registerServices.value.length >= 1) return true
  errorMessage.value = 'กรุณาเพิ่มบริการอย่างน้อย 1 รายการ'
  return false
}

function resetServiceDraft() {
  serviceDraft.value = {
    option_name: '',
    description: '',
    price: 0,
    duration_min: 60,
  }
}

function addRegisterService() {
  const name = String(serviceDraft.value.option_name || '').trim()
  if (!name) {
    errorMessage.value = 'กรุณากรอกชื่อบริการ'
    return
  }

  const price = Number(serviceDraft.value.price)
  const durationMin = Number(serviceDraft.value.duration_min)
  if (!Number.isFinite(price) || price < 0) {
    errorMessage.value = 'ราคาไม่ถูกต้อง'
    return
  }
  if (!Number.isFinite(durationMin) || durationMin < 0) {
    errorMessage.value = 'ระยะเวลา (นาที) ต้องไม่ติดลบ'
    return
  }

  registerServices.value.push({
    option_name: name,
    description: String(serviceDraft.value.description || '').trim() || null,
    price,
    duration_min: durationMin,
    is_active: true,
    is_required: false,
  })
  resetServiceDraft()
  errorMessage.value = ''
}

function removeRegisterService(index) {
  registerServices.value.splice(index, 1)
}

function formatServicePrice(value) {
  return Number(value || 0).toLocaleString('th-TH')
}

async function createRegisterServices() {
  for (const service of registerServices.value) {
    await api.post('/api/admin/nailoptions', service)
  }
}

function validateScheduleStep() {
  shopOpenHour.value = normalizeShopOpenHour(shopOpenHour.value)
  bookingSlotHours.value = normalizeBookingSlotHours(bookingSlotHours.value)
  shopLastBookingHour.value = normalizeShopLastBookingHour(
    shopLastBookingHour.value,
    shopOpenHour.value,
    bookingSlotHours.value,
  )

  if (!Number.isInteger(advanceDays.value) || advanceDays.value < 1 || advanceDays.value > 365) {
    errorMessage.value = 'จำนวนวันจองล่วงหน้าต้องอยู่ระหว่าง 1-365'
    return false
  }
  return true
}

async function saveRegisterScheduleSettings() {
  await api.patch('/api/admin/settings/booking-slot-hours', { slot_hours: bookingSlotHours.value })
  await api.patch('/api/admin/settings/shop-hours', {
    open_hour: shopOpenHour.value,
    last_booking_hour: shopLastBookingHour.value,
  })
  await api.patch('/api/admin/settings/advance-days', { advance_days: advanceDays.value })
}

function validateUiGroup(group) {
  if (!group) return true
  for (const field of registerGroupFields(group)) {
    if (field.optional) continue
    const val = String(uiForm.value[field.key] ?? '').trim()
    const hasPendingUpload =
      (field.uploadKind === 'logo' && pendingLogoFile.value)
      || (field.uploadKind === 'hero' && pendingHeroFile.value)
      || (field.uploadKind === 'kshop_qr' && pendingKshopFile.value)
    if (!val && !hasPendingUpload) {
      errorMessage.value = `กรุณากรอก "${field.label}" ให้ครบ`
      return false
    }
  }
  return true
}

function validateAllUi() {
  for (const group of uiFieldGroups) {
    if (!validateUiGroup(group)) return false
  }
  return true
}

async function verifyRegisterPinStep() {
  errorMessage.value = ''
  if (!validateStepPin()) return false
  submitting.value = true
  try {
    await api.post('/api/auth/verify-register-pin', { pin: registerPin.value })
    pinVerified.value = true
    return true
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'รหัสไม่ถูกต้อง'
    return false
  } finally {
    submitting.value = false
  }
}

async function goStepOwner() {
  errorMessage.value = ''
  if (!validateStepOwner()) return

  submitting.value = true
  try {
    const { data } = await api.post('/api/auth/phone-login', {
      name: name.value.trim(),
      phone: phone.value.trim(),
    })
    auth.setToken(data.token)
    await auth.fetchMe()

    if (auth.isAdmin && (auth.managedShopSlugs?.length || auth.isSuperAdmin)) {
      errorMessage.value = 'บัญชีนี้มีร้านแล้ว กรุณาเข้าสู่ระบบแอดมิน'
      auth.logout()
      return
    }

    uiForm.value = {
      ...UI_FORM_DEFAULTS,
      ui_brand_main: name.value.trim(),
      ui_page_title: '',
    }
    shopName.value = name.value.trim()
    shopSlug.value = slugFromName(name.value)
    step.value = 3
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'สร้างบัญชีไม่สำเร็จ'
  } finally {
    submitting.value = false
  }
}

async function goNext() {
  errorMessage.value = ''

  if (step.value === 1) {
    if (await verifyRegisterPinStep()) step.value = 2
    return
  }

  if (step.value === 2) {
    await goStepOwner()
    return
  }

  if (step.value === 3) {
    if (!validateStepShop()) return
    if (!uiForm.value.ui_page_title?.trim()) {
      uiForm.value.ui_page_title = shopName.value.trim()
    }
    step.value = 4
    return
  }

  if (isServiceStep.value) {
    if (!validateServiceStep()) return
    await submitRegister()
    return
  }

  if (isScheduleStep.value) {
    if (!validateScheduleStep()) return
    step.value += 1
    return
  }

  if (currentUiGroup.value) {
    if (!validateUiGroup(currentUiGroup.value)) return
    step.value += 1
    return
  }
}

function triggerUiImageUpload(kind) {
  if (uiImageUploading.value) return
  pendingUiUploadKind.value = kind
  uiImageFileInput.value?.click()
}

async function onUiImageSelected(event) {
  const kind = pendingUiUploadKind.value
  const input = event.target
  const file = input.files?.[0]
  input.value = ''
  pendingUiUploadKind.value = ''
  if (!file || !kind) return

  uiImageUploading.value = kind
  errorMessage.value = ''
  try {
    const maxWidth = kind === 'logo' ? 800 : kind === 'kshop_qr' ? 1200 : 1920
    const { base64, mime } = await compressImage(file, { maxWidth, quality: 0.85 })
    if (kind === 'logo') {
      pendingLogoFile.value = { base64, mime }
      uiForm.value.ui_logo_url = 'pending-upload'
    } else if (kind === 'kshop_qr') {
      pendingKshopFile.value = { base64, mime }
      uiForm.value.ui_kshop_qr_url = 'pending-upload'
    } else {
      pendingHeroFile.value = { base64, mime }
      uiForm.value.ui_hero_image_url = 'pending-upload'
    }
  } catch (err) {
    errorMessage.value = err?.message || 'อ่านไฟล์รูปไม่สำเร็จ'
  } finally {
    uiImageUploading.value = ''
  }
}

async function uploadPendingImages(targetSlug) {
  const prevSlug = localStorage.getItem('shopSlug')
  localStorage.setItem('shopSlug', targetSlug)
  try {
    for (const kind of ['logo', 'hero', 'kshop_qr']) {
      const pending = kind === 'logo'
        ? pendingLogoFile.value
        : kind === 'hero'
          ? pendingHeroFile.value
          : pendingKshopFile.value
      if (!pending) continue
      const { data } = await api.post('/api/admin/settings/ui/upload', {
        kind,
        image_data: pending.base64,
        image_mime: pending.mime,
      })
      if (data.settings) {
        uiForm.value = { ...uiForm.value, ...data.settings }
      }
    }
  } finally {
    if (prevSlug) localStorage.setItem('shopSlug', prevSlug)
    else localStorage.removeItem('shopSlug')
  }
}

async function submitRegister() {
  if (!validateStepShop() || !validateAllUi() || !validateScheduleStep()) return
  if (!pinVerified.value || !/^\d{4}$/.test(registerPin.value)) {
    errorMessage.value = 'กรุณายืนยันรหัสสร้างร้านใหม่'
    step.value = 1
    return
  }

  submitting.value = true
  try {
    const payloadUi = { ...uiForm.value }
    if (payloadUi.ui_logo_url === 'pending-upload') payloadUi.ui_logo_url = ''
    if (payloadUi.ui_hero_image_url === 'pending-upload') payloadUi.ui_hero_image_url = ''
    if (payloadUi.ui_kshop_qr_url === 'pending-upload') payloadUi.ui_kshop_qr_url = ''

    if (!payloadUi.ui_page_title?.trim()) {
      payloadUi.ui_page_title = shopName.value.trim() || payloadUi.ui_brand_main?.trim() || 'Nail Thuean'
    }

    const { data } = await api.post('/api/auth/register-shop', {
      shop_slug: shopSlug.value.trim().toLowerCase(),
      shop_name: shopName.value.trim(),
      register_pin: registerPin.value,
      ui: payloadUi,
    })

    if (data.token) auth.setToken(data.token)
    if (data.user) auth.user = data.user

    localStorage.setItem('shopSlug', data.shop.slug)
    await shopStore.loadShop(data.shop.slug).catch(() => null)

    if (pendingLogoFile.value || pendingHeroFile.value || pendingKshopFile.value) {
      await uploadPendingImages(data.shop.slug)
    }

    await saveRegisterScheduleSettings()

    if (registerServices.value.length) {
      await createRegisterServices()
    }

    router.replace(`/${data.shop.slug}/admin`)
  } catch (error) {
    const fields = error?.response?.data?.fields
    if (fields?.length) {
      errorMessage.value = `กรุณากรอกข้อมูลให้ครบ (${fields.length} ช่องที่ยังว่าง)`
    } else {
      errorMessage.value = error?.response?.data?.error || 'สมัครร้านไม่สำเร็จ'
    }
  } finally {
    submitting.value = false
  }
}

function goBack() {
  errorMessage.value = ''
  if (step.value > 1) {
    step.value -= 1
    return
  }
  router.push(loginPath())
}

watch([shopOpenHour, bookingSlotHours], () => {
  const open = normalizeShopOpenHour(shopOpenHour.value)
  const slot = normalizeBookingSlotHours(bookingSlotHours.value)
  const minLast = open + slot
  if (shopLastBookingHour.value < minLast) {
    shopLastBookingHour.value = minLast
  } else if (shopLastBookingHour.value > 22) {
    shopLastBookingHour.value = 22
  }
})

watch(pageTitle, (title) => {
  document.title = title
})

onMounted(async () => {
  savedDocumentTitle = document.title
  document.title = pageTitle.value

  try {
    const { data } = await api.get('/api/auth/register-shop/config')
    registerEnabled.value = Boolean(data?.enabled)
    if (!registerEnabled.value) {
      errorMessage.value = 'ยังไม่เปิดรับสมัครร้าน กรุณาติดต่อผู้ดูแลระบบ'
    }
  } catch {
    registerEnabled.value = false
    errorMessage.value = 'โหลดสถานะสมัครร้านไม่สำเร็จ'
  }

  if (auth.token && !auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      auth.logout()
    }
  }
  if (auth.isLoggedIn && auth.isAdmin && (auth.managedShopSlugs?.length || auth.isSuperAdmin)) {
    router.replace(`/${auth.primaryAdminShopSlug || loginSlug.value}/admin`)
  }
})

onUnmounted(() => {
  document.title = savedDocumentTitle || 'Nail Thuean'
})
</script>

<template>
  <main class="register-page app-page app-page--standalone">
    <section class="card register-card">
      <div class="register-hero">
        <img :src="defaultShopImage" alt="" class="register-hero-img" />
        <div class="register-hero-overlay">
          <button type="button" class="register-back" @click="goBack">
            <i class="ti ti-arrow-left" aria-hidden="true"></i>
          </button>
          <div class="register-hero-text">
            <span class="register-hero-badge">
              <i class="ti ti-building-store" aria-hidden="true"></i>
              เปิดร้านใหม่
            </span>
            <h1>สมัครร้านค้า</h1>
            <p>{{ stepTitle }}</p>
          </div>
        </div>
      </div>

      <div class="register-body">
        <div class="register-progress-wrap">
          <div class="register-progress-track" aria-hidden="true">
            <div class="register-progress-fill" :style="{ width: `${progressPct}%` }"></div>
          </div>
          <p class="register-progress-label">ขั้นที่ {{ step }} / {{ totalSteps }}</p>
        </div>

        <p v-if="errorMessage" class="alert-banner error register-alert">{{ errorMessage }}</p>

        <!-- Step 1: PIN -->
        <div v-if="step === 1" class="register-panel">
          <div class="register-panel-head">
            <h2>รหัสสร้างร้าน</h2>
            <p class="muted">กรอกรหัส 4 หลักจากผู้ดูแลระบบ</p>
          </div>

          <label class="field register-pin-field">
            <i class="ti ti-lock field-icon" aria-hidden="true"></i>
            <input
              :value="registerPin"
              type="text"
              inputmode="numeric"
              maxlength="4"
              pattern="\d{4}"
              class="register-pin-input"
              placeholder="••••"
              autocomplete="off"
              :disabled="!registerEnabled"
              @input="onRegisterPinInput"
            />
          </label>

          <p class="register-note">
            <i class="ti ti-shield-lock" aria-hidden="true"></i>
            รหัสนี้ได้จากแอดมินหลัก — ใช้ครั้งเดียวต่อการสมัคร
          </p>

          <button
            type="button"
            class="btn primary register-cta"
            :disabled="submitting || !registerEnabled"
            @click="goNext"
          >
            {{ submitting ? 'กำลังตรวจสอบ...' : 'ถัดไป' }}
            <i v-if="!submitting" class="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Step 2: Owner -->
        <div v-else-if="step === 2" class="register-panel">
          <div class="register-panel-head">
            <h2>ข้อมูลเจ้าของร้าน</h2>
            <p class="muted">ใช้ชื่อและเบอร์โทรสำหรับเข้าสู่ระบบแอดมิน</p>
          </div>

          <div class="register-fields">
            <label class="field">
              <i class="ti ti-user field-icon" aria-hidden="true"></i>
              <input v-model="name" type="text" placeholder="ชื่อ-นามสกุล" />
            </label>
            <label class="field">
              <i class="ti ti-phone field-icon" aria-hidden="true"></i>
              <input v-model="phone" type="tel" placeholder="08xxxxxxxx" />
            </label>
          </div>

          <p class="register-note">
            <i class="ti ti-info-circle" aria-hidden="true"></i>
            ชื่อและเบอร์ตรงกับที่เคยใช้ = เข้าบัญชีเดิม
          </p>

          <button type="button" class="btn primary register-cta" :disabled="submitting" @click="goNext">
            {{ submitting ? 'กำลังดำเนินการ...' : 'ถัดไป' }}
            <i v-if="!submitting" class="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Step 3: Shop meta -->
        <div v-else-if="step === 3" class="register-panel">
          <div class="register-panel-head">
            <h2>ข้อมูลร้าน</h2>
            <p class="muted">ตั้งชื่อร้านและ URL ที่ลูกค้าจะใช้จองคิว</p>
          </div>

          <div class="register-meta-card">
            <label class="register-meta-field">
              <span>ชื่อร้าน</span>
              <input v-model="shopName" type="text" class="input" placeholder="ชื่อร้าน" />
            </label>
            <label class="register-meta-field">
              <span>URL ร้าน (slug)</span>
              <div class="register-slug-row">
                <span class="register-slug-prefix">/</span>
                <input v-model="shopSlug" type="text" class="input register-slug-input" placeholder="my-nail-shop" />
                <span class="register-slug-suffix">/bookings</span>
              </div>
            </label>
          </div>

          <button type="button" class="btn primary register-cta" :disabled="submitting" @click="goNext">
            ถัดไป
            <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Steps 4–5: UI groups -->
        <div v-else-if="currentUiGroup" class="register-panel">
          <div class="register-panel-head register-panel-head--group">
            <span class="register-group-icon">
              <i class="ti" :class="groupIcons[currentUiGroup.title] || 'ti-settings'" aria-hidden="true"></i>
            </span>
            <div>
              <h2>{{ currentUiGroup.title }}</h2>
              <p v-if="currentUiGroup.hint" class="muted">{{ currentUiGroup.hint }}</p>
            </div>
          </div>

          <div class="register-ui-fields">
            <label v-for="field in registerGroupFields(currentUiGroup)" :key="field.key" class="register-ui-field">
              <span class="register-ui-label">{{ field.label }}</span>

              <div v-if="field.uploadKind" class="register-upload-row">
                <input
                  v-model="uiForm[field.key]"
                  type="text"
                  class="input"
                  :placeholder="field.placeholder || 'URL รูป (ไม่บังคับ)'"
                />
                <button
                  type="button"
                  class="btn register-upload-btn"
                  :disabled="Boolean(uiImageUploading)"
                  @click="triggerUiImageUpload(field.uploadKind)"
                >
                  <i class="ti ti-upload" aria-hidden="true"></i>
                  {{ uiImageUploading === field.uploadKind ? '...' : 'อัปโหลด' }}
                </button>
              </div>

              <textarea
                v-else-if="field.multiline"
                v-model="uiForm[field.key]"
                class="input register-textarea"
                :rows="field.rows || 3"
                :placeholder="field.placeholder || ''"
              />

              <div v-else-if="field.type === 'color'" class="register-color-row">
                <input v-model="uiForm[field.key]" type="color" class="register-color-picker" />
                <input v-model="uiForm[field.key]" type="text" class="input" />
              </div>

              <input
                v-else
                v-model="uiForm[field.key]"
                :type="field.type || 'text'"
                class="input"
                :placeholder="field.placeholder || ''"
              />

              <p
                v-if="field.uploadKind && uiForm[field.key] === 'pending-upload'"
                class="register-upload-ok"
              >
                <i class="ti ti-check" aria-hidden="true"></i>
                เลือกรูปแล้ว — จะอัปโหลดเมื่อสมัครร้าน
              </p>
              <p
                v-if="(field.key === 'ui_logo_url' || field.key === 'ui_hero_image_url' || field.key === 'ui_kshop_qr_url') && imageUrlHint(uiForm[field.key])"
                class="register-url-warn"
              >
                {{ imageUrlHint(uiForm[field.key]) }}
              </p>
            </label>
          </div>

          <input
            ref="uiImageFileInput"
            type="file"
            accept="image/*"
            class="ui-image-file-input"
            @change="onUiImageSelected"
          />

          <button type="button" class="btn primary register-cta" :disabled="submitting" @click="goNext">
            ถัดไป
            <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Step 6: Schedule -->
        <div v-else-if="isScheduleStep" class="register-panel">
          <div class="register-panel-head register-panel-head--group">
            <span class="register-group-icon">
              <i class="ti ti-clock" aria-hidden="true"></i>
            </span>
            <div>
              <h2>เวลา & การจอง</h2>
              <p class="muted">ตั้งเวลาเปิด-ปิดร้าน ความยาวคิว และระยะเวลาที่ลูกค้าจองล่วงหน้าได้</p>
            </div>
          </div>

          <div class="register-meta-card register-schedule-form">
            <label class="register-meta-field">
              <span>เวลาเปิดร้าน</span>
              <select v-model.number="shopOpenHour" class="input">
                <option v-for="h in openHourOptions" :key="`open-${h}`" :value="h">
                  {{ formatHmLabel(h, 0) }}
                </option>
              </select>
            </label>
            <label class="register-meta-field">
              <span>จองสุดท้ายได้ถึง</span>
              <select v-model.number="shopLastBookingHour" class="input">
                <option v-for="h in lastBookingHourOptions" :key="`last-${h}`" :value="h">
                  {{ formatLastBookingOptionLabel(h, bookingSlotHours) }}
                </option>
              </select>
            </label>
            <label class="register-meta-field">
              <span>ความยาวคิว (ชม.)</span>
              <select v-model.number="bookingSlotHours" class="input">
                <option v-for="h in slotHourOptions" :key="`slot-${h}`" :value="h">
                  {{ h }} ชั่วโมง
                </option>
              </select>
            </label>
            <label class="register-meta-field">
              <span>จองล่วงหน้าได้ (วัน)</span>
              <input
                v-model.number="advanceDays"
                type="number"
                min="1"
                max="365"
                step="1"
                class="input"
              />
            </label>
          </div>

          <div class="register-schedule-preview">
            <i class="ti ti-clock" aria-hidden="true"></i>
            <span>
              ลูกค้าจองได้
              <strong>{{ formatHmLabel(shopOpenHour, 0) }} – {{ formatHmLabel(shopLastBookingHour, 0) }}</strong>
              (ปิดรับ {{ formatHmLabel(shopLastBookingHour + bookingSlotHours, 0) }})
              · คิวละ {{ bookingSlotHours }} ชม.
              · ล่วงหน้า {{ advanceDays }} วัน
            </span>
          </div>

          <button type="button" class="btn primary register-cta" :disabled="submitting" @click="goNext">
            ถัดไป
            <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Step 7: Services -->
        <div v-else-if="isServiceStep" class="register-panel">
          <div class="register-panel-head register-panel-head--group">
            <span class="register-group-icon">
              <i class="ti ti-list-check" aria-hidden="true"></i>
            </span>
            <div>
              <h2>เพิ่มบริการ</h2>
              <p class="muted">เพิ่มอย่างน้อย 1 บริการที่ลูกค้าจะเลือกจองได้</p>
            </div>
          </div>

          <div v-if="registerServices.length" class="register-service-list">
            <div
              v-for="(item, index) in registerServices"
              :key="`${item.option_name}-${index}`"
              class="register-service-item"
            >
              <div>
                <strong>{{ item.option_name }}</strong>
                <p class="register-service-meta muted">
                  {{ formatServicePrice(item.price) }} บาท
                  <template v-if="Number(item.duration_min) > 0"> · {{ item.duration_min }} นาที</template>
                </p>
              </div>
              <button
                type="button"
                class="register-service-remove"
                aria-label="ลบบริการ"
                @click="removeRegisterService(index)"
              >
                <i class="ti ti-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div class="register-meta-card register-service-form">
            <label class="register-meta-field">
              <span>ชื่อบริการ *</span>
              <input
                v-model="serviceDraft.option_name"
                type="text"
                class="input"
                placeholder="เช่น ทาสีเจลมือ"
              />
            </label>
            <label class="register-meta-field">
              <span>รายละเอียด</span>
              <input
                v-model="serviceDraft.description"
                type="text"
                class="input"
                placeholder="คำอธิบายสั้นๆ (ไม่บังคับ)"
              />
            </label>
            <div class="register-service-row">
              <label class="register-meta-field">
                <span>ราคา (บาท)</span>
                <input
                  v-model.number="serviceDraft.price"
                  type="number"
                  min="0"
                  step="1"
                  class="input"
                />
              </label>
              <label class="register-meta-field">
                <span>ระยะเวลา (นาที)</span>
                <input
                  v-model.number="serviceDraft.duration_min"
                  type="number"
                  min="0"
                  step="1"
                  class="input"
                />
              </label>
            </div>
            <button type="button" class="btn register-add-service-btn" @click="addRegisterService">
              <i class="ti ti-plus" aria-hidden="true"></i>
              เพิ่มบริการ
            </button>
          </div>

          <p class="register-note">
            <i class="ti ti-info-circle" aria-hidden="true"></i>
            บริการจะแสดงให้ลูกค้าเลือกจองทุกวัน · แก้ไขเพิ่มเติมได้ในแอดมินภายหลัง
          </p>

          <button type="button" class="btn primary register-cta" :disabled="submitting" @click="goNext">
            {{ submitting ? 'กำลังสร้างร้าน...' : 'สมัครร้านและเข้าแอดมิน' }}
            <i v-if="!submitting" class="ti ti-sparkles" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.register-page {
  display: grid;
  place-content: start center;
  padding: var(--page-padding-x);
  padding-top: var(--space-4);
  padding-bottom: calc(var(--space-8) + env(safe-area-inset-bottom));
}

.register-card {
  width: 100%;
  max-width: 440px;
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-login);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
}

.register-hero {
  position: relative;
  aspect-ratio: 16 / 7;
  overflow: hidden;
}

.register-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.register-hero-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: var(--space-4) var(--space-5) var(--space-5);
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--color-text-primary) 78%, transparent) 0%,
    color-mix(in srgb, var(--color-primary) 22%, transparent) 50%,
    transparent 100%
  );
}

.register-back {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, #fff 92%, transparent);
  color: var(--color-text-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition), background var(--transition);
}

.register-back:active {
  transform: scale(0.96);
}

.register-hero-text {
  color: #fff;
}

.register-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: color-mix(in srgb, #fff 18%, transparent);
  border: 1px solid color-mix(in srgb, #fff 28%, transparent);
  margin-bottom: var(--space-2);
}

.register-hero-text h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 600;
  line-height: 1.2;
}

.register-hero-text p {
  margin: 6px 0 0;
  font-size: var(--text-caption);
  opacity: 0.92;
}

.register-body {
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.register-progress-wrap {
  margin-bottom: var(--space-4);
}

.register-progress-track {
  height: 6px;
  border-radius: 999px;
  background: var(--color-border);
  overflow: hidden;
}

.register-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-dark));
  transition: width 0.35s ease;
}

.register-progress-label {
  margin: 8px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-align: center;
}

.register-alert {
  margin-bottom: var(--space-3);
}

.register-panel-head h2 {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 700;
}

.register-panel-head p {
  margin: 0 0 var(--space-4);
  font-size: var(--text-caption);
}

.register-panel-head--group {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.register-panel-head--group h2 {
  margin-bottom: 2px;
}

.register-panel-head--group p {
  margin: 0;
}

.register-group-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  display: grid;
  place-items: center;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 60%, transparent);
}

.register-fields {
  display: grid;
  gap: var(--space-3);
}

.register-pin-field {
  margin-bottom: var(--space-2);
}

.register-pin-input {
  width: 100%;
  border: 0;
  outline: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.45em;
  text-align: center;
  font-family: inherit;
  color: var(--color-text-primary);
  background: transparent;
  min-width: 0;
}

.register-fields .field {
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-elevated);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 80%, transparent);
}

.register-fields .field:focus-within {
  border-color: var(--color-primary);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 80%, transparent);
}

.register-panel :is(input.input, textarea.input, textarea.register-textarea) {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  font-size: var(--text-body);
  font-family: inherit;
  line-height: 1.45;
  color: var(--color-text-primary);
  background: var(--color-surface-elevated);
  outline: none;
  min-width: 0;
  transition:
    border-color var(--transition),
    box-shadow var(--transition),
    background var(--transition);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 85%, transparent);
}

.register-panel :is(input.input, textarea.input, textarea.register-textarea)::placeholder {
  color: var(--color-text-muted);
  opacity: 0.9;
}

.register-panel :is(input.input, textarea.input, textarea.register-textarea):focus {
  border-color: var(--color-primary);
  background: #fff;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 85%, transparent);
}

.register-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: var(--space-3) 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-primary-light);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  line-height: 1.45;
}

.register-note i {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-primary);
}

.register-cta {
  width: 100%;
  min-height: var(--btn-primary-height);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: var(--space-4);
  border-radius: var(--radius-lg);
}

.register-meta-card {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: linear-gradient(
    135deg,
    var(--color-primary-light) 0%,
    var(--color-surface-elevated) 100%
  );
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
  box-shadow: var(--shadow-sm);
}

.register-meta-field {
  display: grid;
  gap: 6px;
}

.register-meta-field > span {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.register-slug-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-elevated);
  min-height: calc(var(--touch-min) + 4px);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 85%, transparent);
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}

.register-slug-row:focus-within {
  border-color: var(--color-primary);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 85%, transparent);
}

.register-slug-prefix,
.register-slug-suffix {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.register-slug-input {
  border: none !important;
  box-shadow: none !important;
  padding-left: 0;
  padding-right: 0;
  min-width: 0;
}

.register-ui-fields {
  display: grid;
  gap: var(--space-4);
}

.register-ui-field {
  display: grid;
  gap: 8px;
}

.register-ui-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  padding-left: 2px;
}

.register-textarea {
  resize: vertical;
  min-height: 88px;
}

.register-upload-row {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
}

.register-upload-row .input {
  flex: 1;
  min-width: 0;
}

.register-upload-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  border-radius: var(--radius-lg);
  padding-inline: var(--space-3);
  min-height: calc(var(--touch-min) + 4px);
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-weight: 600;
}

.register-upload-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-light) 70%, #fff 30%);
}

.register-color-row {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
}

.register-color-row .input {
  flex: 1;
}

.register-color-picker {
  width: 48px;
  height: auto;
  min-height: calc(var(--touch-min) + 4px);
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-elevated);
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;
}

.register-upload-ok {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--color-primary-dark);
}

.register-url-warn {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.ui-image-file-input {
  display: none;
}

.register-service-list {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.register-service-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.register-service-item strong {
  display: block;
  font-size: 14px;
}

.register-service-meta {
  margin: 4px 0 0;
  font-size: 12px;
}

.register-service-remove {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-danger, #c0392b) 10%, transparent);
  color: var(--color-danger, #c0392b);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.register-service-form {
  margin-bottom: var(--space-3);
}

.register-service-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.register-add-service-btn {
  width: 100%;
  justify-content: center;
  gap: 6px;
}

.register-schedule-form {
  margin-bottom: var(--space-3);
}

.register-schedule-preview {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-primary-light) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border));
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.register-schedule-preview i {
  color: var(--color-primary);
  font-size: 16px;
  margin-top: 2px;
  flex-shrink: 0;
}

.register-schedule-preview strong {
  color: var(--color-text-primary);
}

@media (min-width: 480px) {
  .register-page {
    padding-top: var(--space-6);
  }
}
</style>

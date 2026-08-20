<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import generatePayload from 'promptpay-qr'
import Swal from 'sweetalert2'
import api from '../api/axios'
import { compressImage } from '../utils/compressChatImage'

const props = defineProps({
  isSuperAdmin: { type: Boolean, default: false },
  shopSlug: { type: String, default: '' },
  active: { type: Boolean, default: false },
  branchUsage: { type: Object, default: null },
  branchShops: { type: Array, default: () => [] },
  formatUsageExpiryDate: { type: Function, default: null },
})

const emit = defineEmits(['shops-changed'])

const isManager = computed(() => props.isSuperAdmin && props.shopSlug === 'default')
const isBranch = computed(() => props.shopSlug !== 'default')

const loading = ref(true)
const refreshing = ref(false)
const savingSettings = ref(false)
const submitting = ref(false)
const message = ref('')
const errorMessage = ref('')

const settings = ref({
  promptpay_id: '',
  description: '',
  qr_instruction: 'สแกน QR PromptPay แล้วอัปโหลดสลิปด้านล่าง',
  promptpay_account_name: '',
  price_per_month_no_line: 149,
  price_per_month_with_line: 249,
  banner_days_before: 7,
  special_packages: [],
  can_edit: false,
})

const settingsForm = ref({
  promptpay_id: '',
  description: '',
  qr_instruction: 'สแกน QR PromptPay แล้วอัปโหลดสลิปด้านล่าง',
  promptpay_account_name: '',
  price_per_month_no_line: 149,
  price_per_month_with_line: 249,
  banner_days_before: 7,
  special_packages: [],
})

const submissions = ref([])
const selectedTier = ref(null)
const selectedMonths = ref(null)
const selectedSpecialId = ref(null)
const qrCodeImage = ref('')
const qrError = ref('')

const slipPreview = ref('')
const slipMime = ref('')
const slipUploading = ref(false)
const slipFileInput = ref(null)

const slipUrlCache = new Map()
const slipObjectUrls = ref({})

const editingId = ref(null)
const editTier = ref('no_line')
const editMonths = ref(1)
const editSpecialId = ref('')
const editNote = ref('')
const actionLoadingId = ref('')

const renewalTiers = [
  {
    key: 'no_line',
    label: 'ไม่มีแจ้งเตือน LINE',
    hint: 'ใช้งานระบบจองได้ แต่ไม่ส่งแจ้งเตือนทาง LINE',
    icon: 'ti-bell-off',
  },
  {
    key: 'with_line',
    label: 'มีแจ้งเตือน LINE',
    hint: 'ส่งแจ้งเตือนคิวจองใหม่ทาง LINE',
    icon: 'ti-brand-line',
  },
]

const monthChoices = computed(() => Array.from({ length: 12 }, (_, i) => i + 1))

const tierRate = computed(() => ({
  no_line: Number(settings.value.price_per_month_no_line) || 0,
  with_line: Number(settings.value.price_per_month_with_line) || 0,
}))

const activeSpecialPackages = computed(() =>
  (settings.value.special_packages || []).filter((item) => item.active !== false && Number(item.price) > 0)
)

const selectedSpecial = computed(() =>
  activeSpecialPackages.value.find((item) => item.id === selectedSpecialId.value) || null
)

const hasRenewalSelection = computed(() =>
  !!selectedSpecialId.value || (!!selectedTier.value && !!selectedMonths.value)
)

const selectedPrice = computed(() => {
  if (selectedSpecial.value) return Number(selectedSpecial.value.price) || 0
  if (!selectedTier.value || !selectedMonths.value) return 0
  const rate = tierRate.value[selectedTier.value] || 0
  return rate * selectedMonths.value
})

const selectedSummaryLabel = computed(() => {
  if (selectedSpecial.value) {
    return `${selectedSpecial.value.label} · ${selectedSpecial.value.months} เดือน`
  }
  if (!selectedTier.value || !selectedMonths.value) return ''
  const tier = renewalTiers.find((item) => item.key === selectedTier.value)
  return `${tier?.label || selectedTier.value} · ${selectedMonths.value} เดือน`
})

const managerPackageChoices = computed(() => settings.value.special_packages || [])

function tierRateLabel(tierKey) {
  const rate = tierRate.value[tierKey] || 0
  return rate > 0 ? `${rate.toLocaleString('th-TH')} บาท/เดือน` : 'ยังไม่ตั้งราคา'
}

function priceForTierMonths(tierKey, months) {
  const rate = tierRate.value[tierKey] || 0
  return rate * months
}

function inferTierFromRow(row) {
  if (row.option_id && !String(row.option_id).startsWith('tier:')) return null
  if (row.includes_line_push === true) return 'with_line'
  if (row.includes_line_push === false) return 'no_line'
  if (String(row.option_id || '').startsWith('tier:')) {
    return String(row.option_id).replace('tier:', '')
  }
  return 'no_line'
}

function isSpecialSubmission(row) {
  return !!row.option_id && !String(row.option_id).startsWith('tier:')
}

function newPackageId() {
  return crypto.randomUUID()
}

function createEmptySpecialPackage() {
  return {
    id: newPackageId(),
    label: '',
    months: 1,
    price: 0,
    includes_line_push: false,
    active: true,
  }
}

function specialLineLabel(value) {
  if (value === true) return 'มี LINE'
  if (value === false) return 'ไม่มี LINE'
  return 'ไม่เปลี่ยน LINE'
}

function packageDisplayLabel(pkg) {
  if (!pkg) return '-'
  return `${pkg.label} (${pkg.months} เดือน · ${formatBaht(pkg.price)} · ${specialLineLabel(pkg.includes_line_push)})`
}

const statusLabel = {
  pending: 'รอตรวจ',
  confirmed: 'ยืนยันแล้ว',
  cancelled: 'ยกเลิก',
}

function formatBaht(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '-'
  return `${n.toLocaleString('th-TH')} บาท`
}

function formatExpiryDate(iso) {
  if (props.formatUsageExpiryDate) return props.formatUsageExpiryDate(iso)
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function branchUsageText(shop) {
  if (!shop?.usage_limit_days) return 'ไม่จำกัดวัน'
  if (shop.usage_expired) return 'หมดอายุแล้ว'
  if (shop.usage_days_remaining != null) {
    return `เหลือ ${shop.usage_days_remaining} วัน (หมด ${formatExpiryDate(shop.usage_expires_at)})`
  }
  return `${shop.usage_limit_days} วัน`
}

function branchUsageTone(shop) {
  if (shop?.usage_expired) return 'expired'
  if (shop?.usage_days_remaining != null && shop.usage_days_remaining <= 3) return 'warn'
  return 'ok'
}

function formatDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function applySettings(data) {
  const specialPackages = Array.isArray(data?.options)
    ? data.options.map((item) => ({ ...item }))
    : Array.isArray(data?.special_packages)
      ? data.special_packages.map((item) => ({ ...item }))
      : []
  settings.value = {
    promptpay_id: data?.promptpay_id || '',
    description: data?.description || '',
    qr_instruction: data?.qr_instruction || 'สแกน QR PromptPay แล้วอัปโหลดสลิปด้านล่าง',
    promptpay_account_name: data?.promptpay_account_name || '',
    price_per_month_no_line: Number(data?.price_per_month_no_line) || 149,
    price_per_month_with_line: Number(data?.price_per_month_with_line) || 249,
    banner_days_before: Number(data?.banner_days_before) ?? 7,
    special_packages: specialPackages,
    can_edit: !!data?.can_edit,
  }
  settingsForm.value = {
    promptpay_id: settings.value.promptpay_id,
    description: settings.value.description,
    qr_instruction: settings.value.qr_instruction,
    promptpay_account_name: settings.value.promptpay_account_name,
    price_per_month_no_line: settings.value.price_per_month_no_line,
    price_per_month_with_line: settings.value.price_per_month_with_line,
    banner_days_before: settings.value.banner_days_before,
    special_packages: specialPackages.map((item) => ({ ...item })),
  }
}

function addSpecialPackage() {
  settingsForm.value.special_packages.push(createEmptySpecialPackage())
}

function removeSpecialPackage(index) {
  settingsForm.value.special_packages.splice(index, 1)
}

function clearStandardSelection() {
  selectedTier.value = null
  selectedMonths.value = null
}

function clearSpecialSelection() {
  selectedSpecialId.value = null
}

function selectTier(tierKey) {
  if (!tierRate.value[tierKey]) return
  clearSpecialSelection()
  selectedTier.value = tierKey
}

function selectMonths(months) {
  clearSpecialSelection()
  selectedMonths.value = months
}

function selectSpecialPackage(packageId) {
  const item = activeSpecialPackages.value.find((pkg) => pkg.id === packageId)
  if (!item) return
  clearStandardSelection()
  selectedSpecialId.value = packageId
}

async function loadSettings({ silent = false } = {}) {
  try {
    const { data } = await api.get('/api/admin/usage-renewal/settings')
    applySettings(data)
  } catch (err) {
    if (!silent) throw err
  }
}

function submissionsSnapshot(rows) {
  return rows.map((r) => `${r.id}:${r.status}:${r.months}:${r.amount_baht}`).join('|')
}

let lastSubmissionsSnapshot = ''

async function loadSubmissions({ silent = false } = {}) {
  try {
    const { data } = await api.get('/api/admin/usage-renewal/submissions')
    const next = Array.isArray(data) ? data : []
    const snapshot = submissionsSnapshot(next)
    const changed = Boolean(lastSubmissionsSnapshot) && snapshot !== lastSubmissionsSnapshot
    lastSubmissionsSnapshot = snapshot
    submissions.value = next
    await preloadSlipUrls(submissions.value)
    if (silent && changed && isBranch.value) {
      emit('shops-changed')
    }
  } catch (err) {
    if (!silent) throw err
  }
}

async function refreshRenewalData({ silent = false } = {}) {
  if (silent) {
    if (refreshing.value) return
    refreshing.value = true
  } else {
    loading.value = true
    message.value = ''
    errorMessage.value = ''
  }
  try {
    if (!silent || isBranch.value) {
      await loadSettings({ silent })
    }
    await loadSubmissions({ silent })
    if (silent && isManager.value) {
      emit('shops-changed')
    }
  } catch (err) {
    if (!silent) {
      errorMessage.value = err?.response?.data?.error || 'โหลดข้อมูลต่ออายุไม่สำเร็จ'
    }
  } finally {
    if (silent) refreshing.value = false
    else loading.value = false
  }
}

async function loadAll() {
  await refreshRenewalData({ silent: false })
}

async function fetchSlipObjectUrl(filename) {
  if (!filename) return ''
  if (slipUrlCache.has(filename)) return slipUrlCache.get(filename)
  const { data } = await api.get(`/api/admin/usage-renewal/slips/${encodeURIComponent(filename)}`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data)
  slipUrlCache.set(filename, url)
  return url
}

async function preloadSlipUrls(rows) {
  const next = { ...slipObjectUrls.value }
  for (const row of rows) {
    if (!row.slip_filename || next[row.id]) continue
    try {
      next[row.id] = await fetchSlipObjectUrl(row.slip_filename)
    } catch {
      next[row.id] = ''
    }
  }
  slipObjectUrls.value = next
}

function revokeSlipUrls() {
  for (const url of slipUrlCache.values()) {
    URL.revokeObjectURL(url)
  }
  slipUrlCache.clear()
  slipObjectUrls.value = {}
}

async function generateQr() {
  qrError.value = ''
  qrCodeImage.value = ''
  if (!hasRenewalSelection.value || !selectedPrice.value) return

  const promptpayId = settings.value.promptpay_id
  if (!promptpayId) {
    qrError.value = 'แอดมินหลักยังไม่ได้ตั้ง PromptPay สำหรับต่ออายุ'
    return
  }

  try {
    const payload = generatePayload(promptpayId, { amount: selectedPrice.value })
    qrCodeImage.value = await QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: { dark: '#2D2424', light: '#FFFFFF' },
    })
  } catch {
    qrError.value = 'สร้าง QR ไม่สำเร็จ กรุณาติดต่อแอดมินหลัก'
  }
}

function triggerSlipUpload() {
  if (slipUploading.value || submitting.value) return
  slipFileInput.value?.click()
}

async function onSlipSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  slipUploading.value = true
  errorMessage.value = ''
  try {
    const { base64, mime } = await compressImage(file, { maxWidth: 1600, quality: 0.85 })
    slipPreview.value = `data:${mime};base64,${base64}`
    slipMime.value = mime
  } catch (err) {
    errorMessage.value = err?.message || 'อ่านรูปสลิปไม่สำเร็จ'
    slipPreview.value = ''
    slipMime.value = ''
  } finally {
    slipUploading.value = false
  }
}

function clearSlipPreview() {
  slipPreview.value = ''
  slipMime.value = ''
}

async function submitRenewal() {
  if (!hasRenewalSelection.value) {
    errorMessage.value = 'กรุณาเลือกแพ็กหรือแพ็กเกจพิเศษ'
    return
  }
  if (!selectedSpecialId.value && !selectedMonths.value) {
    errorMessage.value = 'กรุณาเลือกจำนวนเดือน'
    return
  }
  if (!slipPreview.value) {
    errorMessage.value = 'กรุณาอัปโหลดสลิปการชำระ'
    return
  }

  const result = await Swal.fire({
    title: 'ส่งคำขอต่ออายุ?',
    html: `<strong>${selectedSummaryLabel.value}</strong><br>${formatBaht(selectedPrice.value)}<br>แอดมินหลักจะตรวจสอบและยืนยัน`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ส่งคำขอ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!result.isConfirmed) return

  submitting.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const base64 = slipPreview.value.split(',')[1] || ''
    const payload = {
      image_data: base64,
      image_mime: slipMime.value,
    }
    if (selectedSpecialId.value) {
      payload.option_id = selectedSpecialId.value
    } else {
      payload.tier = selectedTier.value
      payload.months = selectedMonths.value
    }
    await api.post('/api/admin/usage-renewal/submissions', payload)
    message.value = 'ส่งสลิปแล้ว — รอแอดมินหลักยืนยัน'
    clearSlipPreview()
    clearStandardSelection()
    clearSpecialSelection()
    qrCodeImage.value = ''
    await loadSubmissions()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ส่งคำขอไม่สำเร็จ'
  } finally {
    submitting.value = false
  }
}

async function saveSettings() {
  const result = await Swal.fire({
    title: 'บันทึกการตั้งค่าต่ออายุ?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
  })
  if (!result.isConfirmed) return

  savingSettings.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const noLine = Math.floor(Number(settingsForm.value.price_per_month_no_line))
    const withLine = Math.floor(Number(settingsForm.value.price_per_month_with_line))
    if (!Number.isFinite(noLine) || noLine <= 0 || !Number.isFinite(withLine) || withLine <= 0) {
      errorMessage.value = 'กรุณาตั้งราคาต่อเดือนทั้งสองแพ็ก'
      savingSettings.value = false
      return
    }

    const bannerDays = Math.floor(Number(settingsForm.value.banner_days_before))
    if (!Number.isFinite(bannerDays) || bannerDays < 0) {
      errorMessage.value = 'กำหนดวันแสดงแบนเนอร์ไม่ถูกต้อง'
      savingSettings.value = false
      return
    }

    const specialPackages = settingsForm.value.special_packages
      .map((item) => ({
        id: item.id || newPackageId(),
        label: String(item.label || '').trim(),
        months: Math.floor(Number(item.months)),
        price: Math.floor(Number(item.price)),
        includes_line_push: item.includes_line_push === true,
        active: item.active !== false,
      }))
      .filter((item) => item.label && item.months >= 1 && item.months <= 12 && item.price > 0)

    const { data } = await api.patch('/api/admin/usage-renewal/settings', {
      promptpay_id: settingsForm.value.promptpay_id,
      description: settingsForm.value.description,
      qr_instruction: settingsForm.value.qr_instruction,
      promptpay_account_name: settingsForm.value.promptpay_account_name,
      price_per_month_no_line: noLine,
      price_per_month_with_line: withLine,
      banner_days_before: bannerDays,
      options: specialPackages,
    })
    applySettings(data.settings)
    message.value = 'บันทึกการตั้งค่าแล้ว'
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกไม่สำเร็จ'
  } finally {
    savingSettings.value = false
  }
}

function startEdit(row) {
  if (row.status === 'confirmed') return
  editingId.value = row.id
  if (isSpecialSubmission(row)) {
    editSpecialId.value = row.option_id
    editTier.value = 'no_line'
    editMonths.value = row.months
  } else {
    editSpecialId.value = ''
    editTier.value = inferTierFromRow(row) || 'no_line'
    editMonths.value = row.months
  }
  editNote.value = row.admin_note || ''
}

function cancelEdit() {
  editingId.value = null
}

async function patchSubmission(id, payload) {
  actionLoadingId.value = id
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/usage-renewal/submissions/${id}`, payload)
    if (data.submission) {
      const idx = submissions.value.findIndex((s) => s.id === id)
      if (idx >= 0) submissions.value[idx] = data.submission
    } else {
      await loadSubmissions()
    }
    if (data.shop) emit('shops-changed', data.shop)
    return data
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ดำเนินการไม่สำเร็จ'
    throw err
  } finally {
    actionLoadingId.value = ''
  }
}

async function confirmSubmission(row) {
  const label = row.option_label || `${row.months} เดือน`
  const result = await Swal.fire({
    title: 'ยืนยันต่ออายุ?',
    html: `สาขา <strong>${row.shop_name || row.shop_slug}</strong><br>${label} · ${formatBaht(row.amount_baht)}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!result.isConfirmed) return
  await patchSubmission(row.id, { status: 'confirmed' })
  const lineNote = row.includes_line_push ? ' (เปิด LINE)' : row.includes_line_push === false ? ' (ปิด LINE)' : ''
  message.value = `ยืนยันแล้ว — ต่ออายุ ${row.months} เดือนให้ ${row.shop_name || row.shop_slug}${lineNote}`
  editingId.value = null
}

async function cancelSubmission(row) {
  const result = await Swal.fire({
    title: 'ยกเลิกคำขอนี้?',
    text: `${row.shop_name || row.shop_slug} · ${row.months} เดือน`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยกเลิกคำขอ',
    cancelButtonText: 'ไม่',
  })
  if (!result.isConfirmed) return
  await patchSubmission(row.id, { status: 'cancelled' })
  message.value = 'ยกเลิกคำขอแล้ว'
  editingId.value = null
}

async function saveEdit(row) {
  const payload = { admin_note: editNote.value }
  if (editSpecialId.value) {
    payload.option_id = editSpecialId.value
  } else {
    payload.tier = editTier.value
    payload.months = editMonths.value
  }
  await patchSubmission(row.id, payload)
  message.value = 'แก้ไขรายการแล้ว'
  editingId.value = null
}

async function deleteSubmission(row) {
  const result = await Swal.fire({
    title: 'ลบรายการและสลิป?',
    html: `สาขา <strong>${row.shop_name || row.shop_slug}</strong><br>สลิปจะถูกลบถาวร`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#c0392b',
  })
  if (!result.isConfirmed) return

  actionLoadingId.value = row.id
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/usage-renewal/submissions/${row.id}`)
    const cached = slipObjectUrls.value[row.id]
    if (cached) {
      URL.revokeObjectURL(cached)
      slipUrlCache.delete(row.slip_filename)
    }
    submissions.value = submissions.value.filter((s) => s.id !== row.id)
    message.value = 'ลบรายการแล้ว'
    if (editingId.value === row.id) editingId.value = null
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ลบไม่สำเร็จ'
  } finally {
    actionLoadingId.value = ''
  }
}

watch([selectedTier, selectedMonths, selectedSpecialId], () => {
  void generateQr()
})

const RENEWAL_POLL_MS = 30000
let renewalPollTimer = null
const loadedOnce = ref(false)

function startRenewalPolling() {
  stopRenewalPolling()
  renewalPollTimer = setInterval(() => {
    void refreshRenewalData({ silent: true })
  }, RENEWAL_POLL_MS)
}

function stopRenewalPolling() {
  if (renewalPollTimer) {
    clearInterval(renewalPollTimer)
    renewalPollTimer = null
  }
}

function onRenewalWindowFocus() {
  if (props.active) void refreshRenewalData({ silent: true })
}

watch(
  () => props.active,
  (isActive) => {
    if (!isActive) {
      stopRenewalPolling()
      return
    }
    if (!loadedOnce.value) {
      loadedOnce.value = true
      void loadAll()
    } else {
      void refreshRenewalData({ silent: true })
    }
    startRenewalPolling()
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('focus', onRenewalWindowFocus)
})

onUnmounted(() => {
  stopRenewalPolling()
  window.removeEventListener('focus', onRenewalWindowFocus)
  revokeSlipUrls()
})
</script>

<template>
  <section class="card admin-section admin-renewal">
    <header class="admin-renewal-head">
      <div>
        <h3>ต่ออายุการใช้งาน</h3>
        <p v-if="isManager" class="muted">
          ตั้งราคาต่อเดือน 2 แพ็ก · เพิ่มแพ็กเกจพิเศษได้ · ยืนยันแล้วจะเปิด/ปิด LINE ให้สาขาตามแพ็ก
        </p>
        <p v-else-if="isBranch" class="muted">
          เลือกแพ็กมาตรฐานหรือแพ็กเกจพิเศษ · สแกน QR ชำระ · อัปโหลดสลิป
        </p>
      </div>
    </header>

    <p v-if="loading" class="muted">กำลังโหลด...</p>

    <template v-else>
      <p v-if="message" class="alert success">{{ message }}</p>
      <p v-if="errorMessage" class="alert error">{{ errorMessage }}</p>

      <!-- แอดมินหลัก: ตั้งค่า -->
      <div v-if="isManager" class="admin-renewal-settings card-inner">
        <h4>ตั้งค่าการต่ออายุ</h4>
        <div class="admin-form-row admin-renewal-form-grid">
          <label class="admin-label-grow">
            PromptPay / เบอร์โทร
            <input
              v-model="settingsForm.promptpay_id"
              type="text"
              class="admin-input"
              placeholder="เช่น 0812345678"
              inputmode="numeric"
            />
          </label>
          <label class="admin-label-grow admin-renewal-desc">
            ข้อความรายละเอียด (แสดงให้สาขา)
            <textarea
              v-model="settingsForm.description"
              class="admin-input admin-textarea"
              rows="3"
              placeholder="อธิบายขั้นตอนต่ออายุ..."
            />
          </label>
          <label class="admin-label-grow admin-renewal-desc">
            ข้อความใต้ QR (หน้าต่ออายุสาขา)
            <input
              v-model="settingsForm.qr_instruction"
              type="text"
              class="admin-input"
              placeholder="สแกน QR PromptPay แล้วอัปโหลดสลิปด้านล่าง"
            />
          </label>
          <label class="admin-label-grow admin-renewal-desc">
            ชื่อบัญชี PromptPay (แสดงใต้ข้อความ QR)
            <input
              v-model="settingsForm.promptpay_account_name"
              type="text"
              class="admin-input"
              placeholder="เช่น นายสมชาย ใจดี"
            />
          </label>
        </div>

        <div class="admin-renewal-tier-prices">
          <h4>ราคาต่อเดือน (2 แพ็ก)</h4>
          <div class="admin-form-row admin-renewal-form-grid">
            <label class="admin-label-grow">
              ไม่มีแจ้งเตือน LINE (บาท/เดือน)
              <input
                v-model.number="settingsForm.price_per_month_no_line"
                type="number"
                min="1"
                step="1"
                class="admin-input"
                placeholder="149"
              />
            </label>
            <label class="admin-label-grow">
              มีแจ้งเตือน LINE (บาท/เดือน)
              <input
                v-model.number="settingsForm.price_per_month_with_line"
                type="number"
                min="1"
                step="1"
                class="admin-input"
                placeholder="249"
              />
            </label>
          </div>
          <p class="muted admin-renewal-price-hint">
            ตัวอย่าง: 3 เดือน ไม่มี LINE = {{ formatBaht((settingsForm.price_per_month_no_line || 0) * 3) }}
            · มี LINE = {{ formatBaht((settingsForm.price_per_month_with_line || 0) * 3) }}
          </p>
        </div>

        <div class="admin-renewal-banner-setting">
          <label class="admin-label-grow">
            แสดงแบนเนอร์เตือนก่อนหมดอายุ (วัน)
            <input
              v-model.number="settingsForm.banner_days_before"
              type="number"
              min="0"
              max="365"
              step="1"
              class="admin-input"
              placeholder="7"
            />
          </label>
          <p class="muted admin-renewal-price-hint">
            สาขาจะเห็นแบนเนอร์ด้านบนเมื่อเหลือไม่เกิน {{ settingsForm.banner_days_before ?? 7 }} วัน · หมดอายุแล้วแสดงเสมอ
          </p>
        </div>

        <div class="admin-renewal-branches-usage card-inner">
          <h4>วันใช้งานแต่ละสาขา</h4>
          <p v-if="branchShops.length === 0" class="muted">ยังไม่มีสาขา</p>
          <ul v-else class="admin-renewal-branches-list">
            <li
              v-for="shop in branchShops"
              :key="shop.id"
              class="admin-renewal-branch-usage-row"
              :class="`tone-${branchUsageTone(shop)}`"
            >
              <strong>{{ shop.name }}</strong>
              <span class="muted">/{{ shop.slug }}</span>
              <span class="admin-renewal-branch-usage-val">{{ branchUsageText(shop) }}</span>
            </li>
          </ul>
        </div>

        <div class="admin-renewal-special-editor">
          <div class="admin-renewal-special-head">
            <div>
              <h4>แพ็กเกจพิเศษ</h4>
              <p class="muted admin-renewal-price-hint">
                โปรโมชั่นหรือราคาพิเศษ — กำหนดชื่อ เดือน ราคา และ LINE แยกจากแพ็กมาตรฐาน
              </p>
            </div>
            <button type="button" class="btn" @click="addSpecialPackage">
              <i class="ti ti-plus" aria-hidden="true"></i>
              เพิ่มแพ็กเกจพิเศษ
            </button>
          </div>

          <p v-if="settingsForm.special_packages.length === 0" class="muted">
            ยังไม่มีแพ็กเกจพิเศษ
          </p>

          <div v-else class="admin-renewal-special-list">
            <div
              v-for="(item, index) in settingsForm.special_packages"
              :key="item.id"
              class="admin-renewal-special-row"
            >
              <label class="admin-renewal-special-field admin-label-grow">
                ชื่อแพ็ก
                <input
                  v-model="item.label"
                  type="text"
                  class="admin-input"
                  placeholder="เช่น โปรเปิดร้าน / ส่วนลด 6 เดือน"
                />
              </label>
              <label class="admin-renewal-special-field">
                เดือน
                <input
                  v-model.number="item.months"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  class="admin-input"
                />
              </label>
              <label class="admin-renewal-special-field">
                ราคา (บาท)
                <input
                  v-model.number="item.price"
                  type="number"
                  min="1"
                  step="1"
                  class="admin-input"
                />
              </label>
              <label class="admin-renewal-special-field">
                LINE เมื่อยืนยัน
                <select v-model="item.includes_line_push" class="admin-input">
                  <option :value="false">ปิด LINE</option>
                  <option :value="true">เปิด LINE</option>
                </select>
              </label>
              <label class="admin-renewal-special-active">
                <input v-model="item.active" type="checkbox" />
                เปิด
              </label>
              <button
                type="button"
                class="btn danger"
                aria-label="ลบแพ็กเกจพิเศษ"
                @click="removeSpecialPackage(index)"
              >
                <i class="ti ti-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="btn primary"
          :disabled="savingSettings"
          @click="saveSettings"
        >
          {{ savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า' }}
        </button>
      </div>

      <!-- สาขา: เลือกเดือน + QR + อัปโหลดสลิป -->
      <div v-if="isBranch" class="admin-renewal-branch card-inner">
        <div
          v-if="branchUsage?.usage_limit_days"
          class="admin-renewal-usage-summary"
          :class="{
            expired: branchUsage.usage_expired,
            warn: !branchUsage.usage_expired && branchUsage.usage_days_remaining != null && branchUsage.usage_days_remaining <= 3,
          }"
        >
          <h4>วันใช้งานสาขานี้</h4>
          <p v-if="branchUsage.usage_expired" class="admin-renewal-usage-main expired">
            หมดอายุแล้ว ({{ formatExpiryDate(branchUsage.usage_expires_at) }})
          </p>
          <p v-else-if="branchUsage.usage_days_remaining != null" class="admin-renewal-usage-main">
            เหลือ <strong>{{ branchUsage.usage_days_remaining }}</strong> วัน
            · หมดอายุ {{ formatExpiryDate(branchUsage.usage_expires_at) }}
          </p>
          <p v-else class="muted">ไม่มีข้อมูลวันใช้งาน</p>
        </div>

        <p v-if="settings.description" class="admin-renewal-description">{{ settings.description }}</p>

        <h4>1. เลือกแพ็ก</h4>
        <div class="admin-renewal-tier-grid">
          <button
            v-for="tier in renewalTiers"
            :key="tier.key"
            type="button"
            class="admin-renewal-tier-card"
            :class="{ active: selectedTier === tier.key, disabled: !tierRate[tier.key] }"
            :disabled="!tierRate[tier.key]"
            @click="selectTier(tier.key)"
          >
            <i class="ti" :class="tier.icon" aria-hidden="true"></i>
            <strong>{{ tier.label }}</strong>
            <span>{{ tierRateLabel(tier.key) }}</span>
            <span class="muted admin-renewal-tier-hint">{{ tier.hint }}</span>
          </button>
        </div>

        <template v-if="selectedTier">
          <h4>2. เลือกจำนวนเดือน (1–12)</h4>
          <div class="admin-renewal-month-grid">
            <button
              v-for="months in monthChoices"
              :key="months"
              type="button"
              class="admin-renewal-month-btn"
              :class="{ active: selectedMonths === months }"
              @click="selectMonths(months)"
            >
              <strong>{{ months }}</strong>
              <span>{{ formatBaht(priceForTierMonths(selectedTier, months)) }}</span>
            </button>
          </div>
        </template>

        <div v-if="activeSpecialPackages.length" class="admin-renewal-special-branch">
          <h4>{{ selectedTier ? 'หรือเลือกแพ็กเกจพิเศษ' : 'แพ็กเกจพิเศษ' }}</h4>
          <div class="admin-renewal-special-grid">
            <button
              v-for="pkg in activeSpecialPackages"
              :key="pkg.id"
              type="button"
              class="admin-renewal-special-card"
              :class="{ active: selectedSpecialId === pkg.id }"
              @click="selectSpecialPackage(pkg.id)"
            >
              <strong>{{ pkg.label }}</strong>
              <span>{{ pkg.months }} เดือน · {{ formatBaht(pkg.price) }}</span>
              <span class="muted">{{ specialLineLabel(pkg.includes_line_push) }}</span>
            </button>
          </div>
        </div>

        <div v-if="hasRenewalSelection" class="admin-renewal-qr-block">
          <h4>{{ selectedSummaryLabel }}</h4>
          <p class="admin-renewal-total">รวม {{ formatBaht(selectedPrice) }}</p>
          <p v-if="settings.qr_instruction" class="muted">{{ settings.qr_instruction }}</p>
          <p v-if="settings.promptpay_account_name" class="admin-renewal-promptpay-name">
            ชื่อบัญชี PromptPay: {{ settings.promptpay_account_name }}
          </p>
          <p v-if="qrError" class="alert error">{{ qrError }}</p>
          <img
            v-else-if="qrCodeImage"
            :src="qrCodeImage"
            alt="QR PromptPay ต่ออายุ"
            class="admin-renewal-qr-img"
          />
          <p v-else class="muted">กำลังสร้าง QR...</p>
        </div>

        <div class="admin-renewal-slip-upload">
          <h4>อัปโหลดสลิปการชำระ</h4>
          <input
            ref="slipFileInput"
            type="file"
            accept="image/*"
            class="visually-hidden"
            @change="onSlipSelected"
          />
          <div class="admin-renewal-slip-actions">
            <button
              type="button"
              class="btn"
              :disabled="slipUploading || submitting"
              @click="triggerSlipUpload"
            >
              {{ slipUploading ? 'กำลังอ่านรูป...' : 'เลือกรูปสลิป' }}
            </button>
            <button
              v-if="slipPreview"
              type="button"
              class="btn ghost"
              @click="clearSlipPreview"
            >
              ล้างรูป
            </button>
          </div>
          <img
            v-if="slipPreview"
            :src="slipPreview"
            alt="ตัวอย่างสลิป"
            class="admin-renewal-slip-preview"
          />
          <button
            type="button"
            class="btn primary admin-renewal-submit"
            :disabled="submitting || !hasRenewalSelection || !slipPreview"
            @click="submitRenewal"
          >
            {{ submitting ? 'กำลังส่ง...' : 'ส่งคำขอต่ออายุ' }}
          </button>
        </div>
      </div>

      <!-- รายการส่งสลิป -->
      <div class="admin-renewal-submissions card-inner">
        <h4>{{ isManager ? 'รายการสลิปจากสาขา' : 'ประวัติการส่งสลิป' }}</h4>
        <p v-if="isManager" class="muted">
          รูปสลิปเก็บถาวรจนกว่าจะกดลบ · แสดงชื่อสาขาและจำนวนเดือนที่ต่อ
        </p>
        <p v-if="submissions.length === 0" class="muted">ยังไม่มีรายการ</p>

        <div v-else class="admin-renewal-list">
          <article
            v-for="row in submissions"
            :key="row.id"
            class="admin-renewal-item"
            :class="`status-${row.status}`"
          >
            <div class="admin-renewal-item-media">
              <a
                v-if="slipObjectUrls[row.id]"
                :href="slipObjectUrls[row.id]"
                target="_blank"
                rel="noopener noreferrer"
                class="admin-renewal-slip-link"
              >
                <img
                  :src="slipObjectUrls[row.id]"
                  :alt="`สลิป ${row.shop_name || row.shop_slug}`"
                  class="admin-renewal-slip-thumb"
                />
              </a>
              <div v-else class="admin-renewal-slip-missing muted">โหลดสลิปไม่ได้</div>
            </div>

            <div class="admin-renewal-item-body">
              <div class="admin-renewal-item-head">
                <strong v-if="isManager">{{ row.shop_name || row.shop_slug }}</strong>
                <span class="admin-renewal-badge" :class="row.status">{{ statusLabel[row.status] || row.status }}</span>
              </div>
              <p class="admin-renewal-meta">
                <strong>{{ row.option_label || `${row.months} เดือน` }}</strong>
                · {{ formatBaht(row.amount_baht) }}
                <span v-if="row.option_label" class="muted">({{ row.months }} เดือน)</span>
              </p>
              <p class="muted admin-renewal-meta">ส่งเมื่อ {{ formatDateTime(row.created_at) }}</p>
              <p v-if="row.admin_note" class="admin-renewal-note">หมายเหตุ: {{ row.admin_note }}</p>

              <div v-if="isManager && editingId === row.id" class="admin-renewal-edit">
                <label>
                  ประเภท
                  <select v-model="editSpecialId" class="admin-input">
                    <option value="">แพ็กมาตรฐาน</option>
                    <option
                      v-for="pkg in managerPackageChoices"
                      :key="pkg.id"
                      :value="pkg.id"
                    >
                      {{ packageDisplayLabel(pkg) }}
                    </option>
                  </select>
                </label>
                <template v-if="!editSpecialId">
                  <label>
                    แพ็กมาตรฐาน
                    <select v-model="editTier" class="admin-input">
                      <option value="no_line">ไม่มีแจ้งเตือน LINE</option>
                      <option value="with_line">มีแจ้งเตือน LINE</option>
                    </select>
                  </label>
                  <label>
                    จำนวนเดือน
                    <select v-model.number="editMonths" class="admin-input">
                      <option v-for="m in monthChoices" :key="m" :value="m">{{ m }} เดือน</option>
                    </select>
                  </label>
                </template>
                <label class="admin-label-grow">
                  หมายเหตุแอดมิน
                  <input v-model="editNote" type="text" class="admin-input" />
                </label>
                <div class="admin-renewal-item-actions">
                  <button type="button" class="btn primary" @click="saveEdit(row)">บันทึกแก้ไข</button>
                  <button type="button" class="btn ghost" @click="cancelEdit">ยกเลิก</button>
                </div>
              </div>

              <div v-else-if="isManager" class="admin-renewal-item-actions">
                <button
                  v-if="row.status === 'pending'"
                  type="button"
                  class="btn primary"
                  :disabled="actionLoadingId === row.id"
                  @click="confirmSubmission(row)"
                >
                  ยืนยัน
                </button>
                <button
                  v-if="row.status === 'pending'"
                  type="button"
                  class="btn"
                  :disabled="actionLoadingId === row.id"
                  @click="startEdit(row)"
                >
                  แก้ไข
                </button>
                <button
                  v-if="row.status === 'pending'"
                  type="button"
                  class="btn ghost"
                  :disabled="actionLoadingId === row.id"
                  @click="cancelSubmission(row)"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  class="btn danger"
                  :disabled="actionLoadingId === row.id"
                  @click="deleteSubmission(row)"
                >
                  ลบ
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin-renewal-head {
  margin-bottom: 12px;
}

.admin-renewal-head h3 {
  margin: 0 0 4px;
}

.admin-renewal-settings,
.admin-renewal-branch,
.admin-renewal-submissions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border, #eee);
}

.admin-renewal-form-grid {
  flex-wrap: wrap;
  gap: 12px;
}

.admin-renewal-desc {
  flex: 1 1 100%;
}

.admin-textarea {
  min-height: 72px;
  resize: vertical;
}

.admin-renewal-banner-setting {
  margin: 14px 0;
  padding-top: 14px;
  border-top: 1px solid var(--border, #eee);
}

.admin-renewal-branches-usage {
  margin: 16px 0;
  padding: 14px;
  background: var(--surface-2, #fafafa);
  border-radius: 10px;
}

.admin-renewal-branches-usage h4 {
  margin: 0 0 10px;
}

.admin-renewal-branches-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-renewal-branch-usage-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--border, #eee);
}

.admin-renewal-branch-usage-row.tone-expired {
  border-color: #f5c6cb;
  background: #fff5f5;
}

.admin-renewal-branch-usage-row.tone-warn {
  border-color: #ffeeba;
  background: #fffdf5;
}

.admin-renewal-branch-usage-val {
  margin-left: auto;
  font-size: 0.92rem;
}

.admin-renewal-usage-summary {
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 10px;
  background: rgba(196, 123, 123, 0.08);
  border: 1px solid rgba(196, 123, 123, 0.25);
}

.admin-renewal-usage-summary.expired {
  background: #fff5f5;
  border-color: #f5c6cb;
}

.admin-renewal-usage-summary.warn {
  background: #fffdf5;
  border-color: #ffeeba;
}

.admin-renewal-usage-summary h4 {
  margin: 0 0 6px;
  font-size: 0.95rem;
}

.admin-renewal-usage-main {
  margin: 0;
  font-size: 1.05rem;
}

.admin-renewal-usage-main.expired {
  color: #c0392b;
  font-weight: 600;
}

.admin-renewal-special-editor {
  margin: 16px 0;
  padding-top: 16px;
  border-top: 1px solid var(--border, #eee);
}

.admin-renewal-special-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.admin-renewal-special-head h4 {
  margin: 0 0 4px;
}

.admin-renewal-special-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-renewal-special-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border, #eee);
  border-radius: 10px;
  background: var(--surface-2, #fafafa);
}

.admin-renewal-special-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 100px;
}

.admin-renewal-special-active {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  font-size: 0.9rem;
}

.admin-renewal-special-branch {
  margin: 8px 0 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--border, #e8e0dc);
}

.admin-renewal-special-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.admin-renewal-special-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 12px;
  border: 1px solid var(--border, #e8e0dc);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}

.admin-renewal-special-card.active {
  border-color: var(--accent, #c47b7b);
  background: rgba(196, 123, 123, 0.08);
}

.admin-renewal-tier-prices {
  margin: 14px 0;
}

.admin-renewal-tier-prices h4 {
  margin: 0 0 8px;
}

.admin-renewal-tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.admin-renewal-tier-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px 12px;
  border: 1px solid var(--border, #e8e0dc);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}

.admin-renewal-tier-card .ti {
  font-size: 1.25rem;
  color: var(--accent, #c47b7b);
}

.admin-renewal-tier-card strong {
  font-size: 1rem;
}

.admin-renewal-tier-hint {
  font-size: 0.82rem;
  line-height: 1.35;
}

.admin-renewal-tier-card.active {
  border-color: var(--accent, #c47b7b);
  background: rgba(196, 123, 123, 0.08);
}

.admin-renewal-tier-card.disabled,
.admin-renewal-tier-card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-renewal-month-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.admin-renewal-month-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border: 1px solid var(--border, #e8e0dc);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}

.admin-renewal-month-btn strong {
  font-size: 1.1rem;
}

.admin-renewal-month-btn.active {
  border-color: var(--accent, #c47b7b);
  background: rgba(196, 123, 123, 0.08);
}

.admin-renewal-total {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 8px;
}

.admin-renewal-promptpay-name {
  margin: 0 0 8px;
  font-size: 0.9375rem;
}

.admin-renewal-price-hint {
  margin: 8px 0 0;
}

.admin-renewal-description {
  white-space: pre-wrap;
  background: var(--surface-2, #faf8f7);
  border-radius: 10px;
  padding: 12px 14px;
  margin: 0 0 14px;
}

.admin-renewal-qr-block {
  text-align: center;
  margin-bottom: 18px;
}

.admin-renewal-qr-img {
  width: min(280px, 100%);
  border-radius: 12px;
  border: 1px solid var(--border, #eee);
  background: #fff;
}

.admin-renewal-slip-upload h4,
.admin-renewal-qr-block h4 {
  margin: 0 0 8px;
}

.admin-renewal-slip-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.admin-renewal-slip-preview {
  display: block;
  max-width: min(320px, 100%);
  border-radius: 10px;
  border: 1px solid var(--border, #eee);
  margin-bottom: 12px;
}

.admin-renewal-submit {
  margin-top: 4px;
}

.admin-renewal-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 12px;
}

.admin-renewal-item {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border, #eee);
  border-radius: 12px;
  background: #fff;
}

@media (max-width: 560px) {
  .admin-renewal-item {
    grid-template-columns: 1fr;
  }
}

.admin-renewal-slip-link {
  display: block;
}

.admin-renewal-slip-thumb {
  width: 100%;
  max-width: 120px;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border, #eee);
}

.admin-renewal-slip-missing {
  width: 100%;
  max-width: 120px;
  aspect-ratio: 3 / 4;
  display: grid;
  place-items: center;
  border: 1px dashed var(--border, #ddd);
  border-radius: 8px;
  font-size: 0.8rem;
  text-align: center;
  padding: 8px;
}

.admin-renewal-item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.admin-renewal-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f0f0f0;
}

.admin-renewal-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.admin-renewal-badge.confirmed {
  background: #d4edda;
  color: #155724;
}

.admin-renewal-badge.cancelled {
  background: #f8d7da;
  color: #721c24;
}

.admin-renewal-meta {
  margin: 0 0 4px;
  font-size: 0.92rem;
}

.admin-renewal-note {
  margin: 6px 0 0;
  font-size: 0.88rem;
}

.admin-renewal-item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.admin-renewal-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>

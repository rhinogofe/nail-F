<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import api from '../api/axios'
import QRCode from 'qrcode'
import generatePayload from 'promptpay-qr'
import { useUnpaidCountdown } from '../composables/useUnpaidCountdown'
import { useShopRoute } from '../composables/useShopRoute'
import { useUiSettingsStore } from '../stores/uiSettings'
import { formatUiText } from '../utils/formatUiText'
import { dismissBlockingOverlays, scheduleOverlayCleanup } from '../utils/dismissBlockingOverlays'
import { resolveUiImageUrl } from '../utils/resolveUiImageUrl'
import { compressImage } from '../utils/compressChatImage'

const route = useRoute()
const router = useRouter()
const { shopSlug, shopPath } = useShopRoute()
const ui = useUiSettingsStore()

const bookingId = computed(() => route.params.bookingId)
const bookingDate = computed(() => route.query.date || '-')
const startHour = computed(() => route.query.start || '-')
const endHour = computed(() => route.query.end || '-')
const showBookedNotice = computed(() => route.query.booked === '1')
const bookedNoticeText = computed(() => ui.get(
  'ui_booking_success_text',
  'จองแล้ว รอชำระเงิน — กรุณาโอนและส่งสลิปทาง LINE เพื่อรอแอดมินยืนยัน'
))

const lineChatUrl = computed(() => ui.get('ui_line_chat_url', 'https://line.me'))
const bankName = computed(() => ui.get('ui_bank_name', 'ธนาคารกสิกรไทย'))
const bankAccountName = computed(() => ui.get('ui_bank_account_name', 'Nail Studio'))
const bankAccountNo = computed(() => ui.get('ui_bank_account_no', ''))
const depositAmount = ref(300)
const promptpayId = computed(() => ui.get('ui_promptpay_id', ''))
const kshopQrUrl = computed(() => {
  const raw = ui.get('ui_kshop_qr_url', '')
  return raw ? resolveUiImageUrl(raw, shopSlug.value) : ''
})
const useKshopQr = computed(() => !!kshopQrUrl.value)
const thaiQrLabel = computed(() => ui.get('ui_thai_qr_label', 'สแกน Thai QR เพื่อชำระมัดจำ'))
const paymentPageTitle = computed(() => ui.get('ui_payment_page_title', 'ชำระเงินมัดจำ'))
const lineButtonLabel = computed(() => ui.get('ui_line_button_label', 'ส่งสลิปทาง LINE'))
const paymentHint = computed(() => ui.get('ui_payment_hint', ''))
const copyAccountHint = computed(() => ui.get('ui_copy_account_hint', 'แตะเพื่อคัดลอก'))
const qrCodeImage = ref('')
const qrError = ref('')
const copyHint = ref('')
const paymentLoading = ref(true)
const paymentError = ref('')
const locationName = ref('')
const locationMapUrl = ref('')
const bookingStatus = ref('')
const bookingCreatedAt = ref('')
const unpaidSettings = ref({ enabled: true, expireHours: 24 })

const slipPreview = ref('')
const slipMime = ref('')
const slipUploading = ref(false)
const slipSubmitting = ref(false)
const slipDeleting = ref(false)
const slipLoading = ref(false)
const slipFileInput = ref(null)
const submittedSlip = ref(null)
const submittedSlipImageUrl = ref('')
const slipMessage = ref('')
const slipError = ref('')

const slipStatusLabels = {
  pending: 'รอแอดมินยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  cancelled: 'แอดมินยกเลิก — อัปโหลดใหม่ได้',
}

const unpaidCountdown = useUnpaidCountdown(() => unpaidSettings.value)

const isExpired = computed(() => {
  if (bookingStatus.value === 'cancelled') return true
  if (bookingStatus.value !== 'awaiting_payment') return false
  return unpaidCountdown.isExpired(bookingCreatedAt.value)
})

const canPay = computed(() => bookingStatus.value === 'awaiting_payment' && !isExpired.value)

const showSlipUpload = computed(() => {
  const raw = String(ui.get('ui_payment_slip_upload_enabled', '0')).trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
})

const canUploadNewSlip = computed(() => {
  if (!canPay.value || !showSlipUpload.value) return false
  if (!submittedSlip.value) return true
  return submittedSlip.value.status === 'cancelled'
})

const canDeleteSubmittedSlip = computed(() => {
  if (!submittedSlip.value || !canPay.value) return false
  return submittedSlip.value.status === 'pending' || submittedSlip.value.status === 'cancelled'
})

const submittedSlipStatusLabel = computed(() => {
  if (!submittedSlip.value) return ''
  return slipStatusLabels[submittedSlip.value.status] || submittedSlip.value.status
})

function formatSlipDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function revokeSubmittedSlipImage() {
  if (submittedSlipImageUrl.value) {
    URL.revokeObjectURL(submittedSlipImageUrl.value)
    submittedSlipImageUrl.value = ''
  }
}

async function loadSubmittedSlipImage() {
  revokeSubmittedSlipImage()
  if (!submittedSlip.value?.slip_filename) return
  try {
    const { data } = await api.get(
      `/api/bookings/${bookingId.value}/payment-slip/file`,
      { responseType: 'blob' }
    )
    submittedSlipImageUrl.value = URL.createObjectURL(data)
  } catch {
    /* แสดงรายการได้แม้โหลดรูปไม่สำเร็จ */
  }
}

async function loadPaymentSlip() {
  if (!showSlipUpload.value) return
  slipLoading.value = true
  try {
    const { data } = await api.get(`/api/bookings/${bookingId.value}/payment-slip`)
    submittedSlip.value = data?.slip || null
    if (submittedSlip.value) {
      await loadSubmittedSlipImage()
    } else {
      revokeSubmittedSlipImage()
    }
  } catch {
    submittedSlip.value = null
    revokeSubmittedSlipImage()
  } finally {
    slipLoading.value = false
  }
}

async function deletePaymentSlip() {
  if (!canDeleteSubmittedSlip.value || slipDeleting.value) return
  slipDeleting.value = true
  slipError.value = ''
  slipMessage.value = ''
  try {
    const { data } = await api.delete(`/api/bookings/${bookingId.value}/payment-slip`)
    submittedSlip.value = null
    revokeSubmittedSlipImage()
    slipMessage.value = data?.message || 'ลบสลิปแล้ว — อัปโหลดใหม่ได้'
  } catch (err) {
    slipError.value = err?.response?.data?.error || 'ลบสลิปไม่สำเร็จ'
  } finally {
    slipDeleting.value = false
  }
}

const countdownText = computed(() => {
  if (!unpaidSettings.value.enabled || bookingStatus.value !== 'awaiting_payment') return ''
  const ms = unpaidCountdown.getRemainingMs(bookingCreatedAt.value)
  if (ms == null) return ''
  return unpaidCountdown.formatRemaining(ms)
})

const paymentNoticeText = computed(() => {
  if (!unpaidSettings.value.enabled) {
    return ui.get('ui_payment_notice_off', 'กรุณาชำระมัดจำและส่งสลิปให้แอดมินยืนยัน')
  }
  return formatUiText(ui.get('ui_payment_notice_timer'), {
    hours: unpaidSettings.value.expireHours,
  })
})

const lineMessage = computed(() => {
  const text = formatUiText(ui.get('ui_line_message_template'), {
    bookingId: bookingId.value,
    date: bookingDate.value,
    start: `${startHour.value}:00`,
    end: `${endHour.value}:00`,
    amount: depositAmount.value,
  })
  return encodeURIComponent(text)
})

function openLine() {
  window.open(`${lineChatUrl.value}?text=${lineMessage.value}`, '_blank')
}

function triggerSlipUpload() {
  if (slipUploading.value || slipSubmitting.value || !canPay.value) return
  slipFileInput.value?.click()
}

async function onSlipSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  slipUploading.value = true
  slipError.value = ''
  slipMessage.value = ''
  try {
    const { base64, mime } = await compressImage(file, { maxWidth: 1600, quality: 0.85 })
    slipPreview.value = `data:${mime};base64,${base64}`
    slipMime.value = mime
  } catch (err) {
    slipError.value = err?.message || 'อ่านรูปสลิปไม่สำเร็จ'
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

async function submitPaymentSlip() {
  if (!slipPreview.value) {
    slipError.value = 'กรุณาเลือกรูปสลิปก่อน'
    return
  }
  slipSubmitting.value = true
  slipError.value = ''
  slipMessage.value = ''
  try {
    const base64 = slipPreview.value.split(',')[1] || ''
    const { data } = await api.post(`/api/bookings/${bookingId.value}/payment-slip`, {
      image_data: base64,
      image_mime: slipMime.value,
    })
    submittedSlip.value = data?.slip || null
    slipMessage.value = data?.message || 'อัปโหลดสลิปแล้ว — รอแอดมินยืนยัน'
    clearSlipPreview()
    if (submittedSlip.value) {
      await loadSubmittedSlipImage()
    }
  } catch (err) {
    slipError.value = err?.response?.data?.error || 'อัปโหลดสลิปไม่สำเร็จ'
  } finally {
    slipSubmitting.value = false
  }
}

function backToBooking() {
  dismissBlockingOverlays()
  scheduleOverlayCleanup()
  router.push(shopPath('/bookings'))
}

onBeforeRouteLeave(() => {
  dismissBlockingOverlays()
  scheduleOverlayCleanup()
})

async function copyAccountNo() {
  try {
    await navigator.clipboard.writeText(bankAccountNo.value)
    copyHint.value = ui.get('ui_copy_success', 'คัดลอกแล้ว')
    setTimeout(() => { copyHint.value = '' }, 2000)
  } catch {
    copyHint.value = 'คัดลอกไม่สำเร็จ'
  }
}

async function generateThaiQr() {
  qrError.value = ''
  qrCodeImage.value = ''

  if (useKshopQr.value) {
    qrCodeImage.value = kshopQrUrl.value
    return
  }

  if (!promptpayId.value) {
    qrError.value = ui.get('ui_qr_not_configured', 'ยังไม่ได้ตั้งค่า PromptPay ID')
    return
  }

  try {
    const payload = generatePayload(promptpayId.value, { amount: Number(depositAmount.value) })
    qrCodeImage.value = await QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: { dark: '#2D2424', light: '#FFFFFF' },
    })
  } catch {
    qrError.value = ui.get('ui_qr_generate_failed', 'สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบ PromptPay ID')
  }
}

let expiryTimer = null

onMounted(async () => {
  dismissBlockingOverlays()
  scheduleOverlayCleanup()
  paymentLoading.value = true
  paymentError.value = ''
  try {
    const [depositRes, infoRes] = await Promise.all([
      api.get('/api/bookings/deposit-setting'),
      api.get(`/api/bookings/${bookingId.value}/payment-info`),
    ])
    if (Number.isFinite(Number(depositRes.data?.deposit_amount)) && Number(depositRes.data.deposit_amount) > 0) {
      depositAmount.value = Number(depositRes.data.deposit_amount)
    }
    const info = infoRes.data
    bookingStatus.value = info?.booking?.status || ''
    bookingCreatedAt.value = info?.booking?.created_at || ''
    locationName.value = info?.location_name || ''
    locationMapUrl.value = info?.location_map_url || ''
    if (info?.unpaid_expire) {
      unpaidSettings.value = {
        enabled: info.unpaid_expire.enabled !== false,
        expireHours: Number(info.unpaid_expire.expire_hours) || 24,
      }
    }
    if (info?.is_expired || info?.booking?.status === 'cancelled') {
      bookingStatus.value = 'cancelled'
      paymentError.value = ui.get('ui_payment_expired', 'คิวนี้หมดเวลาชำระแล้ว ถูกยกเลิกอัตโนมัติ')
    } else if (info?.booking?.status !== 'awaiting_payment') {
      paymentError.value = ui.get('ui_payment_not_awaiting', 'คิวนี้ไม่อยู่ในสถานะรอชำระเงินแล้ว')
    }
  } catch (err) {
    paymentError.value = err?.response?.data?.error || 'โหลดข้อมูลคิวไม่สำเร็จ'
  } finally {
    paymentLoading.value = false
  }
  if (canPay.value) {
    await generateThaiQr()
    if (showSlipUpload.value) await loadPaymentSlip()
  }

  expiryTimer = setInterval(async () => {
    if (!canPay.value || !unpaidCountdown.isExpired(bookingCreatedAt.value)) return
    bookingStatus.value = 'cancelled'
    paymentError.value = ui.get('ui_payment_expired', 'คิวนี้หมดเวลาชำระแล้ว ถูกยกเลิกอัตโนมัติ')
    try {
      await api.get(`/api/bookings/${bookingId.value}/payment-info`)
    } catch {
      // sync ฝั่ง server แล้วแสดงข้อความ
    }
  }, 1000)
})

onUnmounted(() => {
  if (expiryTimer) clearInterval(expiryTimer)
  revokeSubmittedSlipImage()
})
</script>

<template>
  <div class="payment-page app-page app-page--standalone">
    <header class="back-header app-header">
      <div class="back-header-row">
        <button type="button" class="back-btn-icon" aria-label="กลับ" @click="backToBooking">
          <i class="ti ti-arrow-left" aria-hidden="true"></i>
        </button>
        <h1 class="back-title app-page-title">{{ paymentPageTitle }}</h1>
      </div>
    </header>

    <main class="payment-content">
      <div v-if="showBookedNotice" class="alert-banner success payment-booked-notice">
        <i class="ti ti-circle-check" aria-hidden="true"></i>
        <span>{{ bookedNoticeText }}</span>
      </div>

      <p v-if="paymentLoading" class="muted">กำลังโหลด...</p>

      <div v-else-if="paymentError" class="state-card payment-expired">
        <i class="ti ti-clock-off state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">{{ paymentError }}</p>
        <button type="button" class="btn ghost back-link" @click="backToBooking">กลับหน้าจอง</button>
      </div>

      <template v-else>
      <section class="summary-card">
        <div class="summary-row">
          <span class="summary-label"><i class="ti ti-calendar" aria-hidden="true"></i> วันที่</span>
          <span class="summary-val">{{ bookingDate }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label"><i class="ti ti-clock" aria-hidden="true"></i> เวลา</span>
          <span class="summary-val">{{ startHour }}:00 – {{ endHour }}:00</span>
        </div>
        <div v-if="locationName" class="summary-row">
          <span class="summary-label"><i class="ti ti-map-pin" aria-hidden="true"></i> สถานที่</span>
          <span class="summary-val summary-val-with-action">
            {{ locationName }}
            <a
              v-if="locationMapUrl"
              :href="locationMapUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="map-link-btn map-link-btn--inline"
            >
              <i class="ti ti-map-pin" aria-hidden="true"></i>
              ดูแผนที่
            </a>
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-label"><i class="ti ti-hash" aria-hidden="true"></i> Booking ID</span>
          <span class="summary-val">{{ bookingId }}</span>
        </div>
        <div class="summary-deposit">
          <span class="deposit-label">ยอดมัดจำ</span>
          <span class="deposit-amount tabular-nums">{{ depositAmount.toLocaleString('th-TH') }} บาท</span>
        </div>
        <p v-if="countdownText" class="countdown-badge payment-countdown">
          <i class="ti ti-hourglass-low" aria-hidden="true"></i>
          ชำระภายใน {{ countdownText }}
        </p>
      </section>

      <section class="qr-panel">
        <p class="qr-label">{{ thaiQrLabel }}</p>
        <div class="qr-card">
          <img v-if="qrCodeImage" :src="qrCodeImage" alt="QR ชำระมัดจำ" class="qr-image" />
          <p v-else class="qr-error">{{ qrError || 'กำลังสร้าง QR...' }}</p>
        </div>
      </section>

      <button type="button" class="bank-card" @click="copyAccountNo">
        <div class="bank-info">
          <p class="bank-name"><i class="ti ti-building-bank" aria-hidden="true"></i> {{ bankName }}</p>
          <p class="bank-detail">ชื่อบัญชี: {{ bankAccountName }}</p>
          <p class="bank-account">เลขบัญชี: {{ bankAccountNo }}</p>
        </div>
        <span class="copy-action">
          <i class="ti ti-copy" aria-hidden="true"></i>
          {{ copyHint || copyAccountHint }}
        </span>
      </button>

      <button type="button" class="btn-line line-cta" @click="openLine">
        <i class="ti ti-brand-line" aria-hidden="true"></i>
        {{ lineButtonLabel }}
      </button>

      <section v-if="showSlipUpload" class="slip-upload-panel">
        <p class="slip-upload-label">หรืออัปโหลดสลิปในระบบ</p>

        <p v-if="slipLoading" class="muted slip-loading">กำลังโหลดสลิป...</p>

        <article
          v-else-if="submittedSlip"
          class="slip-submitted-card"
          :class="`status-${submittedSlip.status}`"
        >
          <div class="slip-submitted-head">
            <strong>สลิปที่ส่งแล้ว</strong>
            <span class="slip-status-badge" :class="submittedSlip.status">
              {{ submittedSlipStatusLabel }}
            </span>
          </div>
          <p class="muted slip-submitted-meta">
            อัปโหลดเมื่อ {{ formatSlipDateTime(submittedSlip.created_at) }}
          </p>
          <a
            v-if="submittedSlipImageUrl"
            :href="submittedSlipImageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="slip-submitted-link"
          >
            <img
              :src="submittedSlipImageUrl"
              alt="สลิปที่อัปโหลด"
              class="slip-submitted-image"
            />
          </a>
          <p v-else class="muted slip-submitted-missing">โหลดรูปสลิปไม่ได้</p>
          <button
            v-if="canDeleteSubmittedSlip"
            type="button"
            class="btn ghost slip-delete-btn"
            :disabled="slipDeleting"
            @click="deletePaymentSlip"
          >
            <i class="ti ti-trash" aria-hidden="true"></i>
            {{ slipDeleting ? 'กำลังลบ...' : 'ลบสลิปเพื่ออัปโหลดใหม่' }}
          </button>
        </article>

        <template v-if="canUploadNewSlip">
        <input
          ref="slipFileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="slip-file-input"
          @change="onSlipSelected"
        />
        <div class="slip-upload-actions">
          <button
            type="button"
            class="btn primary slip-select-btn"
            :disabled="slipUploading || slipSubmitting"
            @click="triggerSlipUpload"
          >
            <i class="ti ti-upload" aria-hidden="true"></i>
            {{ slipUploading ? 'กำลังอ่านรูป...' : 'เลือกรูปสลิป' }}
          </button>
          <button
            v-if="slipPreview"
            type="button"
            class="btn ghost"
            :disabled="slipSubmitting"
            @click="clearSlipPreview"
          >
            ล้างรูป
          </button>
        </div>
        <img
          v-if="slipPreview"
          :src="slipPreview"
          alt="ตัวอย่างสลิป"
          class="slip-preview"
        />
        <button
          v-if="slipPreview"
          type="button"
          class="btn primary slip-submit-btn"
          :disabled="slipSubmitting"
          @click="submitPaymentSlip"
        >
          {{ slipSubmitting ? 'กำลังส่ง...' : 'ส่งสลิปให้แอดมินตรวจ' }}
        </button>
        </template>

        <p v-if="slipMessage" class="slip-success">{{ slipMessage }}</p>
        <p v-if="slipError" class="slip-error">{{ slipError }}</p>
      </section>

      <div class="payment-notice alert-banner warning">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
        <span>{{ paymentNoticeText }}</span>
      </div>

      <p class="payment-hint muted">
        {{ paymentHint }}
      </p>

      <button type="button" class="btn ghost back-link" @click="backToBooking">
        กลับหน้าจอง
      </button>
      </template>
    </main>
  </div>
</template>

<style scoped>
.payment-page {
  padding-bottom: max(var(--space-4), var(--bottom-nav-safe));
}

.back-title {
  margin: 0;
  min-width: 0;
}

.payment-content {
  padding: var(--page-padding-x);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.payment-booked-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.summary-card {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-body);
}

.summary-label {
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.summary-val {
  font-weight: 500;
  color: var(--color-text-primary);
}

.summary-val-with-action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 4px;
}

.map-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-light) 40%, white);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.map-link-btn--inline { margin-left: 8px; }

.summary-deposit {
  margin-top: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.deposit-label {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
}

.deposit-amount {
  font-size: var(--text-number);
  font-weight: 700;
  color: var(--color-primary);
}

.payment-countdown {
  margin: var(--space-2) 0 0;
  width: 100%;
  justify-content: center;
}

.payment-expired .state-card-icon {
  color: var(--color-error);
}

.payment-expired .state-card-title {
  color: var(--color-error);
}

.qr-panel {
  text-align: center;
}

.qr-label {
  margin: 0 0 var(--space-2);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--color-text-primary);
}

.qr-card {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
  display: grid;
  place-items: center;
}

.qr-image {
  width: 100%;
  max-width: 260px;
  border-radius: var(--radius-md);
  background: var(--color-on-primary);
  padding: var(--space-2);
  box-shadow: var(--shadow-sm);
}

.qr-error {
  color: var(--color-error);
  font-size: var(--text-caption);
  margin: 0;
}

.bank-card {
  width: 100%;
  text-align: left;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  box-shadow: var(--shadow-card);
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
  min-height: var(--touch-min);
}

.bank-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.bank-card:active {
  transform: scale(0.99);
}

.bank-name {
  margin: 0 0 var(--space-1);
  font-weight: 600;
  font-size: var(--text-body);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.bank-detail,
.bank-account {
  margin: 0 0 2px;
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.copy-action {
  flex-shrink: 0;
  font-size: var(--text-label);
  color: var(--color-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.copy-action i {
  font-size: 18px;
}

.line-cta i {
  font-size: 22px;
}

.slip-upload-panel {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  box-shadow: var(--shadow-card);
}

.slip-upload-label {
  margin: 0;
  font-weight: 600;
  font-size: var(--text-body);
  text-align: center;
}

.slip-loading {
  margin: 0;
  text-align: center;
  font-size: var(--text-caption);
}

.slip-submitted-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-muted) 40%, white);
}

.slip-submitted-card.status-pending {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.slip-submitted-card.status-cancelled {
  border-color: #cbd5e1;
}

.slip-submitted-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.slip-status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.slip-status-badge.pending {
  background: color-mix(in srgb, var(--color-primary) 15%, white);
  color: var(--color-primary);
}

.slip-status-badge.cancelled {
  background: #f1f5f9;
  color: #64748b;
}

.slip-submitted-meta {
  margin: 0;
  font-size: var(--text-caption);
}

.slip-submitted-link {
  display: block;
  margin: 0 auto;
}

.slip-submitted-image {
  width: 100%;
  max-width: 280px;
  margin: 0 auto;
  display: block;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.slip-submitted-missing {
  margin: 0;
  text-align: center;
  font-size: var(--text-caption);
}

.slip-delete-btn {
  width: 100%;
  min-height: var(--touch-min);
  color: var(--color-error);
  border-color: color-mix(in srgb, var(--color-error) 25%, var(--color-border));
}

.slip-delete-btn i {
  margin-right: 4px;
}

.slip-file-input {
  display: none;
}

.slip-upload-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}

.slip-select-btn,
.slip-submit-btn {
  width: 100%;
  min-height: var(--touch-min);
}

.slip-preview {
  width: 100%;
  max-width: 280px;
  margin: 0 auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.slip-success {
  margin: 0;
  color: #15803d;
  font-size: var(--text-caption);
  text-align: center;
}

.slip-error {
  margin: 0;
  color: var(--color-error);
  font-size: var(--text-caption);
  text-align: center;
}

.slip-hint {
  margin: 0;
  text-align: center;
  font-size: var(--text-caption);
}

.payment-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.payment-notice i {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.payment-hint {
  margin: 0;
  font-size: var(--text-caption);
  line-height: 1.45;
}

.back-link {
  width: 100%;
  min-height: var(--btn-secondary-height);
  font-size: var(--text-body);
  cursor: pointer;
}

.muted {
  color: var(--color-text-muted);
}
</style>

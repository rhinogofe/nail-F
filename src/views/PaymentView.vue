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

const route = useRoute()
const router = useRouter()
const { shopPath } = useShopRoute()
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
const bookingStatus = ref('')
const bookingCreatedAt = ref('')
const unpaidSettings = ref({ enabled: true, expireHours: 24 })

const unpaidCountdown = useUnpaidCountdown(() => unpaidSettings.value)

const isExpired = computed(() => {
  if (bookingStatus.value === 'cancelled') return true
  if (bookingStatus.value !== 'awaiting_payment') return false
  return unpaidCountdown.isExpired(bookingCreatedAt.value)
})

const canPay = computed(() => bookingStatus.value === 'awaiting_payment' && !isExpired.value)

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
  if (canPay.value) await generateThaiQr()

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
          <img v-if="qrCodeImage" :src="qrCodeImage" alt="Thai QR Code" class="qr-image" />
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

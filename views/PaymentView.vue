<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api/axios'
import QRCode from 'qrcode'
import generatePayload from 'promptpay-qr'

const route = useRoute()
const router = useRouter()

const bookingId = computed(() => route.params.bookingId)
const bookingDate = computed(() => route.query.date || '-')
const startHour = computed(() => route.query.start || '-')
const endHour = computed(() => route.query.end || '-')

const lineChatUrl = import.meta.env.VITE_LINE_CHAT_URL || 'https://line.me'
const bankName = import.meta.env.VITE_BANK_NAME || 'ธนาคารกสิกรไทย'
const bankAccountName = import.meta.env.VITE_BANK_ACCOUNT_NAME || 'Nail Studio'
const bankAccountNo = import.meta.env.VITE_BANK_ACCOUNT_NO || 'xxx-x-xxxxx-x'
const depositAmount = ref(Number(import.meta.env.VITE_DEPOSIT_AMOUNT || 300))
const promptpayId = import.meta.env.VITE_PROMPTPAY_ID || ''
const thaiQrLabel = import.meta.env.VITE_THAI_QR_LABEL || 'สแกน Thai QR เพื่อชำระมัดจำ'
const qrCodeImage = ref('')
const qrError = ref('')

const lineMessage = computed(() => {
  return encodeURIComponent(
    `ส่งสลิปมัดจำคิว\nBooking: ${bookingId.value}\nวันที่: ${bookingDate.value}\nเวลา: ${startHour.value}:00 - ${endHour.value}:00\nยอด: ${depositAmount.value} บาท`,
  )
})

function openLine() {
  window.open(`${lineChatUrl}?text=${lineMessage.value}`, '_blank')
}

function backToBooking() {
  router.push('/bookings')
}

async function generateThaiQr() {
  qrError.value = ''
  qrCodeImage.value = ''

  if (!promptpayId) {
    qrError.value = 'ยังไม่ได้ตั้งค่า PromptPay ID'
    return
  }

  try {
    const payload = generatePayload(promptpayId, { amount: Number(depositAmount.value) })
    qrCodeImage.value = await QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
  } catch {
    qrError.value = 'สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบ PromptPay ID'
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/api/bookings/deposit-setting')
    if (Number.isFinite(Number(data?.deposit_amount)) && Number(data.deposit_amount) > 0) {
      depositAmount.value = Number(data.deposit_amount)
    }
  } catch {
    // fallback to env default
  }
  await generateThaiQr()
})
</script>

<template>
  <main class="page">
    <section class="card">
      <h2>ชำระเงินมัดจำ</h2>
      <p class="muted">Booking ID: {{ bookingId }}</p>
      <p class="muted">คิวเวลา {{ startHour }}:00 - {{ endHour }}:00 วันที่ {{ bookingDate }}</p>
      <p class="success">ยอดมัดจำ {{ depositAmount }} บาท</p>

      <div class="card payment-qr-card" style="margin-top: 12px">
        <p><strong>{{ thaiQrLabel }}</strong></p>
        <img v-if="qrCodeImage" :src="qrCodeImage" alt="Thai QR Code" class="payment-qr-image" />
        <p v-else class="error">{{ qrError || 'กำลังสร้าง QR...' }}</p>
      </div>

      <div class="card" style="margin-top: 12px">
        <p><strong>{{ bankName }}</strong></p>
        <p>ชื่อบัญชี: {{ bankAccountName }}</p>
        <p>เลขบัญชี: {{ bankAccountNo }}</p>
      </div>

      <div class="row" style="margin-top: 12px">
        <button class="btn primary" @click="openLine">ส่งสลิปทาง LINE</button>
        <button class="btn" @click="backToBooking">กลับหน้าจอง</button>
      </div>

      <p class="muted" style="margin-top: 12px">
        หลังส่งสลิป แอดมินจะยืนยันการชำระเงิน และคิวจะเปลี่ยนเป็นพร้อมให้บริการ
      </p>
    </section>
  </main>
</template>

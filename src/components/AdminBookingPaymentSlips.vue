<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Swal from 'sweetalert2'
import api from '../api/axios'
import { compressImage } from '../utils/compressChatImage'

const props = defineProps({
  active: { type: Boolean, default: false },
  isSuperAdmin: { type: Boolean, default: false },
  shopSlug: { type: String, default: '' },
  bookingDate: { type: String, default: '' },
})

const emit = defineEmits(['changed'])

const slips = ref([])
const retentionDays = ref(3)
const loading = ref(false)
const actionLoadingId = ref('')
const message = ref('')
const errorMessage = ref('')

const slipUrlCache = new Map()
const slipObjectUrls = ref({})

const retentionInput = ref(3)
const retentionSaving = ref(false)

const statusLabel = {
  pending: 'รอตรวจ',
  confirmed: 'ยืนยันแล้ว',
  cancelled: 'ยกเลิก',
}

const SLIP_POLL_MS = 30000
let pollTimer = null
const loadedOnce = ref(false)

function formatDateTime(iso) {
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

function formatBookingDate(iso) {
  if (!iso) return '-'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTimeRange(row) {
  const sh = row.start_hour ?? 0
  const sm = row.start_minute ?? 0
  const eh = row.end_hour ?? sh
  const em = row.end_minute ?? 0
  const start = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
  const end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  return `${start} – ${end}`
}

async function fetchSlipObjectUrl(filename) {
  if (slipUrlCache.has(filename)) return slipUrlCache.get(filename)
  const { data } = await api.get(
    `/api/admin/bookings/payment-slips/files/${encodeURIComponent(filename)}`,
    { responseType: 'blob' }
  )
  const url = URL.createObjectURL(data)
  slipUrlCache.set(filename, url)
  return url
}

async function hydrateSlipUrls() {
  const next = { ...slipObjectUrls.value }
  for (const row of slips.value) {
    if (!row.slip_filename || next[row.id]) continue
    try {
      next[row.id] = await fetchSlipObjectUrl(row.slip_filename)
    } catch {
      /* ignore */
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

async function loadSlips({ silent = false } = {}) {
  if (!silent) loading.value = true
  errorMessage.value = ''
  try {
    const params = {}
    if (/^\d{4}-\d{2}-\d{2}$/.test(props.bookingDate)) {
      params.booking_date = props.bookingDate
    }
    const { data } = await api.get('/api/admin/bookings/payment-slips', { params })
    slips.value = data?.slips || []
    retentionDays.value = Number(data?.retention_days) || 3
    await hydrateSlipUrls()
  } catch (err) {
    if (!silent) errorMessage.value = err?.response?.data?.error || 'โหลดสลิปไม่สำเร็จ'
  } finally {
    if (!silent) loading.value = false
  }
}

async function loadRetentionSetting() {
  if (!props.isSuperAdmin) return
  try {
    const { data } = await api.get('/api/admin/settings/booking-slip-retention')
    retentionInput.value = Number(data?.retention_days) || 3
  } catch {
    /* ignore */
  }
}

async function saveRetentionDays() {
  retentionSaving.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.patch('/api/admin/settings/booking-slip-retention', {
      retention_days: retentionInput.value,
    })
    retentionDays.value = Number(data?.retention_days) || retentionInput.value
    message.value = `ตั้งค่าลบสลิปหลัง ${retentionDays.value} วันแล้ว`
    await loadSlips({ silent: true })
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกไม่สำเร็จ'
  } finally {
    retentionSaving.value = false
  }
}

async function confirmSlip(row) {
  const result = await Swal.fire({
    title: 'ยืนยันการชำระเงิน?',
    html: `${row.user_name || '-'}<br>${formatBookingDate(row.booking_date)} ${formatTimeRange(row)}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!result.isConfirmed) return

  actionLoadingId.value = row.id
  try {
    await api.patch(`/api/admin/bookings/payment-slips/${row.id}/confirm`)
    message.value = 'ยืนยันชำระเงินแล้ว'
    await loadSlips({ silent: true })
    emit('changed')
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ยืนยันไม่สำเร็จ'
  } finally {
    actionLoadingId.value = ''
  }
}

async function cancelSlip(row) {
  const result = await Swal.fire({
    title: 'ยกเลิกสลิปนี้?',
    text: 'ลูกค้ายังอยู่ในสถานะรอชำระเงิน สามารถอัปโหลดสลิปใหม่ได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยกเลิกสลิป',
    cancelButtonText: 'ไม่',
  })
  if (!result.isConfirmed) return

  actionLoadingId.value = row.id
  try {
    await api.patch(`/api/admin/bookings/payment-slips/${row.id}/cancel`)
    message.value = 'ยกเลิกสลิปแล้ว'
    await loadSlips({ silent: true })
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ยกเลิกไม่สำเร็จ'
  } finally {
    actionLoadingId.value = ''
  }
}

async function cancelBooking(row) {
  if (row.booking_status !== 'awaiting_payment') return

  const result = await Swal.fire({
    title: 'ยืนยันยกเลิกคิว?',
    html: `${row.user_name || '-'}<br>${formatBookingDate(row.booking_date)} ${formatTimeRange(row)}<br>คิวจะถูกยกเลิกและช่วงเวลานี้ว่างให้จองใหม่`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยกเลิกคิว',
    cancelButtonText: 'ไม่',
    confirmButtonColor: '#c0392b',
  })
  if (!result.isConfirmed) return

  actionLoadingId.value = row.id
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${row.booking_id}/cancel-unpaid`)
    message.value = data?.message || 'ยกเลิกคิวแล้ว'
    await loadSlips({ silent: true })
    emit('changed')
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ยกเลิกคิวไม่สำเร็จ'
  } finally {
    actionLoadingId.value = ''
  }
}

async function deleteSlip(row) {
  const result = await Swal.fire({
    title: 'ลบสลิป?',
    text: 'รูปสลิปจะถูกลบถาวร',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#c0392b',
  })
  if (!result.isConfirmed) return

  actionLoadingId.value = row.id
  try {
    await api.delete(`/api/admin/bookings/payment-slips/${row.id}`)
    const cached = slipObjectUrls.value[row.id]
    if (cached) {
      URL.revokeObjectURL(cached)
      slipUrlCache.delete(row.slip_filename)
    }
    slips.value = slips.value.filter((s) => s.id !== row.id)
    message.value = 'ลบสลิปแล้ว'
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ลบไม่สำเร็จ'
  } finally {
    actionLoadingId.value = ''
  }
}

async function loadAll() {
  revokeSlipUrls()
  await Promise.all([loadSlips(), loadRetentionSetting()])
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    void loadSlips({ silent: true })
  }, SLIP_POLL_MS)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function onWindowFocus() {
  if (props.active) void loadSlips({ silent: true })
}

watch(
  () => [props.active, props.bookingDate],
  ([isActive]) => {
    if (!isActive) {
      stopPolling()
      return
    }
    if (!loadedOnce.value) {
      loadedOnce.value = true
      void loadAll()
    } else {
      revokeSlipUrls()
      void loadSlips({ silent: true })
    }
    startPolling()
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('focus', onWindowFocus)
})

onUnmounted(() => {
  stopPolling()
  window.removeEventListener('focus', onWindowFocus)
  revokeSlipUrls()
})
</script>

<template>
  <div class="admin-booking-slips card-inner">
    <header class="admin-booking-slips-head">
      <div>
        <h4>{{ bookingDate ? `สลิปวันที่ ${formatBookingDate(bookingDate)}` : 'สลิปชำระเงิน (จอง)' }}</h4>
        <p class="muted">
          ลูกค้าอัปโหลดจากหน้าชำระเงิน · เก็บรูป {{ retentionDays }} วันแล้วลบอัตโนมัติ
        </p>
      </div>
    </header>

    <div
      v-if="isSuperAdmin && !bookingDate"
      class="admin-booking-slips-retention"
    >
      <label>
        ลบสลิปอัตโนมัติหลัง (วัน)
        <input
          v-model.number="retentionInput"
          type="number"
          min="1"
          max="90"
          class="admin-input admin-booking-slips-retention-input"
        />
      </label>
      <button
        type="button"
        class="btn primary"
        :disabled="retentionSaving"
        @click="saveRetentionDays"
      >
        {{ retentionSaving ? 'กำลังบันทึก...' : 'บันทึก' }}
      </button>
    </div>

    <p v-if="message" class="admin-booking-slips-msg success">{{ message }}</p>
    <p v-if="errorMessage" class="admin-booking-slips-msg error">{{ errorMessage }}</p>
    <p v-if="loading" class="muted">กำลังโหลดสลิป...</p>
    <p v-else-if="slips.length === 0" class="muted">ยังไม่มีสลิปในช่วง {{ retentionDays }} วันล่าสุด</p>

    <div v-else class="admin-booking-slips-list">
      <article
        v-for="row in slips"
        :key="row.id"
        class="admin-booking-slips-item"
        :class="`status-${row.status}`"
      >
        <div class="admin-booking-slips-media">
          <a
            v-if="slipObjectUrls[row.id]"
            :href="slipObjectUrls[row.id]"
            target="_blank"
            rel="noopener noreferrer"
            class="admin-booking-slips-link"
          >
            <img
              :src="slipObjectUrls[row.id]"
              :alt="`สลิป ${row.user_name}`"
              class="admin-booking-slips-thumb"
            />
          </a>
          <div v-else class="muted admin-booking-slips-missing">โหลดสลิปไม่ได้</div>
        </div>

        <div class="admin-booking-slips-body">
          <div class="admin-booking-slips-item-head">
            <strong>{{ row.user_name || '-' }}</strong>
            <span class="admin-booking-slips-badge" :class="row.status">
              {{ statusLabel[row.status] || row.status }}
            </span>
          </div>
          <p class="muted admin-booking-slips-meta">
            {{ formatBookingDate(row.booking_date) }} · {{ formatTimeRange(row) }}
          </p>
          <p class="muted admin-booking-slips-meta">
            {{ row.user_email || '' }} · คิว #{{ row.booking_id }}
          </p>
          <p class="muted admin-booking-slips-meta">อัปโหลด {{ formatDateTime(row.created_at) }}</p>

          <div class="admin-booking-slips-actions">
            <button
              v-if="row.status === 'pending'"
              type="button"
              class="btn primary"
              :disabled="actionLoadingId === row.id"
              @click="confirmSlip(row)"
            >
              ยืนยันการชำระ
            </button>
            <button
              v-if="row.status === 'pending'"
              type="button"
              class="btn ghost"
              :disabled="actionLoadingId === row.id"
              @click="cancelSlip(row)"
            >
              ยกเลิกสลิป
            </button>
            <button
              v-if="row.booking_status === 'awaiting_payment'"
              type="button"
              class="btn danger"
              :disabled="actionLoadingId === row.id"
              @click="cancelBooking(row)"
            >
              ยกเลิกคิว
            </button>
            <button
              v-if="row.status === 'cancelled'"
              type="button"
              class="btn danger"
              :disabled="actionLoadingId === row.id"
              @click="deleteSlip(row)"
            >
              ลบ
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.admin-booking-slips {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.admin-booking-slips-head h4 {
  margin: 0 0 4px;
}

.admin-booking-slips-retention {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2);
  margin: var(--space-3) 0;
}

.admin-booking-slips-retention label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-caption);
}

.admin-booking-slips-retention-input {
  width: 5rem;
}

.admin-booking-slips-msg {
  margin: var(--space-2) 0 0;
  font-size: var(--text-caption);
}

.admin-booking-slips-msg.success {
  color: #15803d;
}

.admin-booking-slips-msg.error {
  color: var(--color-error);
}

.admin-booking-slips-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.admin-booking-slips-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
}

.admin-booking-slips-item.status-pending {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.admin-booking-slips-media {
  flex-shrink: 0;
}

.admin-booking-slips-link {
  display: block;
}

.admin-booking-slips-thumb {
  width: 88px;
  height: 88px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.admin-booking-slips-missing {
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  font-size: 11px;
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
}

.admin-booking-slips-body {
  flex: 1;
  min-width: 0;
}

.admin-booking-slips-item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 4px;
}

.admin-booking-slips-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.admin-booking-slips-badge.pending {
  background: color-mix(in srgb, var(--color-primary) 15%, white);
  color: var(--color-primary);
}

.admin-booking-slips-badge.confirmed {
  background: #dcfce7;
  color: #15803d;
}

.admin-booking-slips-badge.cancelled {
  background: #f1f5f9;
  color: #64748b;
}

.admin-booking-slips-meta {
  margin: 0 0 2px;
  font-size: var(--text-caption);
}

.admin-booking-slips-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import { useCoupons } from '../composables/useCoupons'

const auth = useAuthStore()
const { showMyCoupons, loadMyCoupons, redeemCoupon, myCoupons } = useCoupons()

const profileName = ref('')
const profilePhone = ref('')
const saving = ref(false)
const loadingHistory = ref(false)
const message = ref('')
const errorMessage = ref('')
const history = ref([])

const thMonths = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const isPhoneAccount = computed(() => auth.user?.provider === 'phone')
const loginLabel = computed(() => {
  if (isPhoneAccount.value) return auth.user?.provider_id || '-'
  if (auth.user?.provider === 'google') return 'Google'
  if (auth.user?.provider === 'facebook') return 'Facebook'
  if (auth.user?.provider === 'line') return 'LINE'
  return auth.user?.provider || '-'
})

const initials = computed(() => {
  const n = auth.user?.name || ''
  return n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'NA'
})

const totalPoints = computed(() => auth.user?.total_points || 0)
const canRedeemCoupon = computed(() => totalPoints.value >= 100)

function formatDateLabel(iso) {
  if (!iso) return '-'
  const key = String(iso).slice(0, 10)
  const [y, m, d] = key.split('-').map(Number)
  return `${d} ${thMonths[m - 1]} ${y + 543}`
}

function formatCreatedAt(value) {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTotal(value) {
  if (value == null || value === '') return '-'
  return `${Number(value).toLocaleString('th-TH')} บาท`
}

function statusLabel(status) {
  const map = {
    awaiting_payment: 'รอชำระเงิน',
    pending: 'ชำระแล้ว / รอให้บริการ',
    done: 'ทำเสร็จแล้ว',
    cancelled: 'ยกเลิกแล้ว',
  }
  return map[status] || status
}

function statusClass(status) {
  return {
    awaiting_payment: 'status-unpaid',
    pending: 'status-pending',
    done: 'status-done',
    cancelled: 'status-cancelled',
  }[status] || ''
}

function syncFormFromUser() {
  profileName.value = auth.user?.name || ''
  profilePhone.value = isPhoneAccount.value ? (auth.user?.provider_id || '') : ''
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const { data } = await api.get('/api/bookings/my')
    history.value = data || []
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดประวัติไม่สำเร็จ'
  } finally {
    loadingHistory.value = false
  }
}

async function saveProfile() {
  message.value = ''
  errorMessage.value = ''

  const name = profileName.value.trim()
  if (!name) {
    errorMessage.value = 'กรุณาระบุชื่อ'
    return
  }

  const payload = { name }
  if (isPhoneAccount.value) {
    const phone = profilePhone.value.trim()
    if (!phone) {
      errorMessage.value = 'กรุณาระบุเบอร์โทร'
      return
    }
    payload.phone = phone
  }

  saving.value = true
  try {
    const { data } = await api.patch('/api/auth/profile', payload)
    if (data?.user) auth.user = data.user
    else await auth.fetchMe()
    syncFormFromUser()
    message.value = data?.message || 'บันทึกข้อมูลแล้ว'
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

watch(
  () => auth.user,
  () => syncFormFromUser(),
  { immediate: true }
)

onMounted(async () => {
  await Promise.all([
    auth.fetchMe().catch(() => null),
    loadHistory(),
    loadMyCoupons(),
  ])
  syncFormFromUser()
})
</script>

<template>
  <div class="page">
    <header class="hdr">
      <div class="hdr-top">
        <div class="brand">
          Nail<span class="brand-accent">Thuean</span>
        </div>
        <div class="avatar" :title="auth.user?.name">{{ initials }}</div>
      </div>
      <h1 class="page-title">บัญชีของฉัน</h1>
      <p class="page-sub">แก้ไขข้อมูลและดูประวัติการจอง</p>
    </header>

    <main class="content">
      <section class="card profile-card">
        <div class="profile-stats">
          <div class="stat-box">
            <strong>{{ totalPoints.toLocaleString('th-TH') }}</strong>
            <span>แต้มสะสม</span>
          </div>
          <div class="stat-box">
            <strong>{{ auth.user?.completed_bookings ?? 0 }}</strong>
            <span>ทำเสร็จ</span>
          </div>
          <div class="stat-box">
            <strong>{{ auth.user?.cancelled_bookings ?? 0 }}</strong>
            <span>ยกเลิก</span>
          </div>
        </div>

        <h2 class="section-title">ข้อมูลส่วนตัว</h2>

        <label class="field">
          <span>ชื่อ</span>
          <input
            v-model="profileName"
            type="text"
            class="input"
            placeholder="ชื่อผู้จอง"
            @input="errorMessage = ''"
          />
        </label>

        <label v-if="isPhoneAccount" class="field">
          <span>เบอร์โทร (รหัสล็อกอิน)</span>
          <input
            v-model="profilePhone"
            type="tel"
            class="input"
            placeholder="เบอร์โทร"
            @input="errorMessage = ''"
          />
        </label>

        <label v-else class="field">
          <span>วิธีล็อกอิน</span>
          <input :value="loginLabel" type="text" class="input readonly" readonly />
        </label>

        <label class="field">
          <span>อีเมล</span>
          <input :value="auth.user?.email || '-'" type="text" class="input readonly" readonly />
        </label>

        <p v-if="message" class="alert success">{{ message }}</p>
        <p v-if="errorMessage" class="alert error">{{ errorMessage }}</p>

        <button type="button" class="btn-save" :disabled="saving" @click="saveProfile">
          {{ saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
        </button>
      </section>

      <section class="card coupon-card">
        <h2 class="section-title">คูปอง</h2>
        <p class="coupon-hint">
          แลกคูปองลด 20% ใช้ 100 แต้ม · คุณมี {{ totalPoints.toLocaleString('th-TH') }} แต้ม
        </p>
        <div class="coupon-actions">
          <button type="button" class="btn-coupon" @click="showMyCoupons">
            <i class="ti ti-ticket" aria-hidden="true"></i>
            <span>คูปองของฉัน</span>
            <span v-if="myCoupons.length" class="coupon-badge">{{ myCoupons.length }}</span>
          </button>
          <button
            v-if="canRedeemCoupon"
            type="button"
            class="btn-redeem"
            @click="redeemCoupon"
          >
            <i class="ti ti-gift" aria-hidden="true"></i>
            <span>แลกคูปอง</span>
          </button>
        </div>
      </section>

      <section class="card history-card">
        <h2 class="section-title">ประวัติการจอง</h2>
        <p v-if="loadingHistory" class="muted">กำลังโหลด...</p>
        <p v-else-if="history.length === 0" class="muted">ยังไม่มีประวัติการจอง</p>

        <div v-for="item in history" :key="item.id" class="history-item">
          <div class="history-head">
            <strong>{{ formatDateLabel(item.booking_date) }}</strong>
            <span class="history-time">
              {{ item.start_hour }}:00 - {{ item.end_hour ?? Number(item.start_hour) + 2 }}:00
            </span>
          </div>
          <p class="history-status" :class="statusClass(item.status)">
            {{ statusLabel(item.status) }}
          </p>
          <p class="history-services">
            {{
              item.nail_options?.length
                ? item.nail_options.map((opt) => opt.option_name).join(', ')
                : 'ไม่ระบุบริการ'
            }}
          </p>
          <p v-if="item.total != null && item.total !== ''" class="history-total">
            ยอด {{ formatTotal(item.total) }}
          </p>
          <p class="history-meta">จองเมื่อ {{ formatCreatedAt(item.created_at) }}</p>
        </div>
      </section>
    </main>

    <BottomNav active="profile" />
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600&display=swap');

* {
  box-sizing: border-box;
}

.page {
  font-family: 'Noto Sans Thai', sans-serif;
  background: #f8fafc;
  min-height: 100svh;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  padding-bottom: 72px;
}

.hdr {
  background: #fff;
  border-bottom: 0.5px solid #f1e8f0;
  padding: 14px 18px 16px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.hdr-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.brand {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.brand-accent {
  color: #e11d48;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fce7f3;
  color: #e11d48;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.page-title {
  margin: 0 0 4px;
  font-size: 20px;
  color: #1e293b;
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.content {
  padding: 14px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.stat-box {
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
}

.stat-box strong {
  display: block;
  font-size: 18px;
  color: #e11d48;
  margin-bottom: 2px;
}

.stat-box span {
  font-size: 11px;
  color: #64748b;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
  color: #1e293b;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #475569;
}

.input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 11px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #1e293b;
  background: #fff;
}

.input.readonly {
  background: #f8fafc;
  color: #64748b;
}

.alert {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
}

.alert.success {
  background: #ecfdf5;
  color: #047857;
}

.alert.error {
  background: #fef2f2;
  color: #b91c1c;
}

.btn-save {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 13px;
  background: #e11d48;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.coupon-hint {
  margin: -4px 0 12px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.45;
}

.coupon-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn-coupon,
.btn-redeem {
  flex: 1;
  min-width: 140px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.btn-coupon {
  background: #fff1f2;
  color: #e11d48;
}

.btn-redeem {
  background: #e11d48;
  color: #fff;
}

.btn-coupon i,
.btn-redeem i {
  font-size: 18px;
}

.coupon-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e11d48;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.muted {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.history-item {
  padding: 12px 0;
  border-top: 1px solid #f1f5f9;
}

.history-item:first-of-type {
  border-top: none;
  padding-top: 0;
}

.history-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.history-head strong {
  font-size: 14px;
  color: #1e293b;
}

.history-time {
  font-size: 12px;
  color: #64748b;
}

.history-status {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-unpaid { color: #ea580c; }
.status-pending { color: #2563eb; }
.status-done { color: #16a34a; }
.status-cancelled { color: #64748b; }

.history-services,
.history-total,
.history-meta {
  margin: 0 0 2px;
  font-size: 12px;
  color: #64748b;
}
</style>

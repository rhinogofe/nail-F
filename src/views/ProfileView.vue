<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useBookingStore } from '../stores/booking'
import api from '../api/axios'
import { bookingEndHour } from '../utils/bookingSlots'
import BottomNav from '../components/BottomNav.vue'
import { useCoupons } from '../composables/useCoupons'
import { useUiSettingsStore } from '../stores/uiSettings'
import BrandMark from '../components/BrandMark.vue'
import AccountMenuDrawer from '../components/AccountMenuDrawer.vue'

const auth = useAuthStore()
const bookingStore = useBookingStore()
const ui = useUiSettingsStore()
const { showMyCoupons, loadMyCoupons, redeemCoupon, myCoupons, couponSettings, canRedeem, loadCouponSettings } = useCoupons()

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
const canRedeemCoupon = canRedeem

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
    awaiting_payment: 'status-awaiting',
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
    bookingStore.fetchShopHours().catch(() => null),
    loadHistory(),
    loadMyCoupons(),
    loadCouponSettings(),
  ])
  syncFormFromUser()
})
</script>

<template>
  <div class="app-page app-page--nav profile-page">
    <header class="hdr app-header">
      <div class="hdr-top">
        <BrandMark />
        <AccountMenuDrawer />
      </div>
      <h1 class="page-title app-page-title">{{ ui.get('ui_profile_title', 'บัญชีของฉัน') }}</h1>
      <p class="page-sub app-page-sub">{{ ui.get('ui_profile_subtitle', 'แก้ไขข้อมูลและดูประวัติการจอง') }}</p>
    </header>

    <main class="content app-content">
      <section class="card profile-hero">
        <div class="profile-hero-avatar app-avatar">{{ initials }}</div>
        <div class="profile-hero-text">
          <h2 class="profile-hero-name">{{ auth.user?.name || 'สมาชิก' }}</h2>
          <p class="profile-hero-meta muted">{{ isPhoneAccount ? profilePhone || loginLabel : loginLabel }}</p>
        </div>
      </section>

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
          <span class="field-label">ชื่อ</span>
          <div class="field-input-wrap">
            <i class="ti ti-user field-input-icon" aria-hidden="true"></i>
            <input
              v-model="profileName"
              type="text"
              class="input"
              placeholder="ชื่อผู้จอง"
              @input="errorMessage = ''"
            />
          </div>
        </label>

        <label v-if="isPhoneAccount" class="field">
          <span class="field-label">เบอร์โทร (รหัสล็อกอิน)</span>
          <div class="field-input-wrap">
            <i class="ti ti-phone field-input-icon" aria-hidden="true"></i>
            <input
              v-model="profilePhone"
              type="tel"
              class="input"
              placeholder="เบอร์โทร"
              @input="errorMessage = ''"
            />
          </div>
        </label>

        <label v-else class="field">
          <span class="field-label">วิธีล็อกอิน</span>
          <div class="field-input-wrap">
            <i class="ti ti-lock field-input-icon" aria-hidden="true"></i>
            <input :value="loginLabel" type="text" class="input readonly" readonly />
          </div>
        </label>

        <!-- <label class="field">
          <span class="field-label">อีเมล</span>
          <div class="field-input-wrap">
            <i class="ti ti-mail field-input-icon" aria-hidden="true"></i>
            <input :value="auth.user?.email || '-'" type="text" class="input readonly" readonly />
          </div>
        </label> -->

        <p v-if="message" class="alert-banner success">{{ message }}</p>
        <p v-if="errorMessage" class="alert-banner error">{{ errorMessage }}</p>

        <button type="button" class="btn primary btn-save" :disabled="saving" @click="saveProfile">
          {{ saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
        </button>
      </section>

      <section class="card coupon-card">
        <h2 class="section-title">คูปอง</h2>
        <p class="coupon-hint">
          แลกคูปองลด {{ couponSettings.discountPercent }}% ใช้ {{ couponSettings.requiredPoints.toLocaleString('th-TH') }} แต้ม · คุณมี {{ totalPoints.toLocaleString('th-TH') }} แต้ม
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
              {{ item.start_hour }}:00 - {{ item.end_hour ?? bookingEndHour(Number(item.start_hour), bookingStore.bookingSlotHours) }}:00
            </span>
          </div>
          <span class="status-pill" :class="statusClass(item.status)">
            {{ statusLabel(item.status) }}
          </span>
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
.profile-page {
  padding: 0;
}

.hdr {
  padding-bottom: var(--space-3);
}

.hdr-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.page-title {
  margin: 0 0 var(--space-1);
}

.page-sub {
  margin: 0;
}

.content {
  padding-top: 0;
}

.card {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.profile-hero-avatar {
  width: 56px;
  height: 56px;
  font-size: var(--text-body);
}

.profile-hero-name {
  margin: 0 0 var(--space-1);
  font-size: var(--text-h2);
  font-weight: 600;
  color: var(--color-text-primary);
}

.profile-hero-meta {
  margin: 0;
  font-size: var(--text-caption);
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.stat-box {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-2);
  text-align: center;
}

.stat-box strong {
  display: block;
  font-size: var(--text-h2);
  color: var(--color-primary);
  margin-bottom: 2px;
  font-variant-numeric: tabular-nums;
}

.stat-box span {
  font-size: var(--text-label);
  color: var(--color-text-muted);
}

.section-title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-h3);
  font-weight: 600;
  color: var(--color-text-primary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.field-label {
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.field-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--color-surface-elevated);
  min-height: var(--touch-min);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.field-input-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.field-input-icon {
  color: var(--color-text-muted);
  font-size: 18px;
  flex-shrink: 0;
}

.input {
  width: 100%;
  border: 0;
  outline: 0;
  padding: var(--space-2) 0;
  font-size: var(--text-body);
  font-family: inherit;
  color: var(--color-text-primary);
  background: transparent;
  min-width: 0;
}

.input.readonly {
  color: var(--color-text-secondary);
}

.btn-save {
  width: 100%;
  min-height: var(--btn-primary-height);
  font-weight: 600;
}

.coupon-hint {
  margin: calc(var(--space-1) * -1) 0 var(--space-3);
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  line-height: 1.45;
}

.coupon-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.btn-coupon,
.btn-redeem {
  flex: 1;
  min-width: 140px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-3);
  font-size: var(--text-body);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  min-height: var(--touch-min);
  transition: transform var(--transition), opacity var(--transition);
}

.btn-coupon {
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.btn-redeem {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-coupon:active,
.btn-redeem:active {
  transform: scale(0.98);
}

.btn-coupon i,
.btn-redeem i {
  font-size: 18px;
}

.coupon-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--text-caption);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.muted {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.history-item {
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
}

.history-item:first-of-type {
  border-top: none;
  padding-top: 0;
}

.history-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.history-head strong {
  font-size: var(--text-body);
  color: var(--color-text-primary);
}

.history-time {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.status-pill {
  display: inline-block;
  margin-bottom: var(--space-2);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-label);
  font-weight: 600;
}

.status-awaiting {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}

.status-pending {
  background: color-mix(in srgb, var(--color-info) 15%, transparent);
  color: var(--color-info);
}

.status-done {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.status-cancelled {
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
  color: var(--color-error);
}

.history-services,
.history-total,
.history-meta {
  margin: 0 0 2px;
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.history-total {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>

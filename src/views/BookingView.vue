<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { useAuthStore } from '../stores/auth'
import { useBookingStore } from '../stores/booking'
import api from '../api/axios'
import { colorForDate, dayTintStyle } from '../utils/nailOptionHelpers'

const router = useRouter()
const auth = useAuthStore()
const bookingStore = useBookingStore()

const selectedDate = ref(toLocalYmd(new Date()))
const busy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showModal = ref(false)
const sheetStep = ref('confirm')
const pendingHour = ref(null)
const selectedOptionIds = ref([])
const serviceError = ref('')

const isSlots2hMode = computed(() => bookingStore.bookingDisplayMode === 'slots_2h')

const slots = computed(() => {
  const result = []
  const step = isSlots2hMode.value ? 2 : 1
  for (let h = bookingStore.shopOpenHour; h <= bookingStore.shopLastBookingHour; h += step) result.push(h)
  return result
})
const bookings = computed(() => bookingStore.bookingsByDate[selectedDate.value] || [])
const blockedSlots = computed(() => bookingStore.blocksByDate[selectedDate.value] || [])
const nailOptions = computed(() => bookingStore.nailOptions || [])
const myCoupons = ref([])
const todayDate = startOfDay(new Date())
// bookUntilDate = วันสิ้นสุดที่ล็อกตอนแอดมินกดบันทึก (ไม่เลื่อนตามวันนี้)
const maxBookDate = computed(() => {
  if (bookingStore.bookUntilDate && /^\d{4}-\d{2}-\d{2}$/.test(bookingStore.bookUntilDate)) {
    return parseYmdLocal(bookingStore.bookUntilDate)
  }
  return addDays(todayDate, Math.max(0, bookingStore.advanceDays - 1))
})
const windowStartDate = ref(startOfDay(new Date()))
const dayStripRef = ref(null)
const visibleDayCount = ref(7)
const POLL_INTERVAL_MS = 45_000
const DAY_PILL_WIDTH = 46
const DAY_STRIP_GAP = 6
let pollTimer = null
let stripResizeTimer = null

const weekdayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const thMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function measureVisibleDayCount() {
  const width = dayStripRef.value?.clientWidth
  if (!width) return
  const perPill = DAY_PILL_WIDTH + DAY_STRIP_GAP
  const count = Math.floor((width + DAY_STRIP_GAP) / perPill)
  visibleDayCount.value = Math.max(3, Math.min(count, 14))
}

function scheduleStripMeasure() {
  clearTimeout(stripResizeTimer)
  stripResizeTimer = setTimeout(async () => {
    const prev = visibleDayCount.value
    measureVisibleDayCount()
    if (prev !== visibleDayCount.value) {
      await refreshBlocksAndEnsureSelection(false)
      await loadDate()
    }
  }, 150)
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
function addDays(date, days) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d
}
function toLocalYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function parseYmdLocal(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const weekDays = computed(() => {
  const items = Array.from({ length: visibleDayCount.value }, (_, i) => {
    const date = addDays(windowStartDate.value, i)
    if (date > maxBookDate.value) return null
    const iso = toLocalYmd(date)
    const tintColor = colorForDate(bookingStore.allNailOptions, iso)
    return { iso, day: date.getDate(), label: weekdayNames[date.getDay()], isToday: iso === toLocalYmd(todayDate), tintColor }
  })
  return items.filter(Boolean)
})
const visibleWeekDays = computed(() => weekDays.value.filter(d => !isClosedDay(d.iso)))
function isSlotRangeBlocked(hour) {
  if (isSlots2hMode.value) return isHourBlocked(hour) || isHourBlocked(hour + 1)
  return isHourBlocked(hour)
}

const visibleSlots = computed(() => slots.value.filter(h => !isSlotRangeBlocked(h)))

const selectedDateLabel = computed(() => {
  const d = parseYmdLocal(selectedDate.value)
  return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
})
const monthLabel = computed(() => {
  const d = parseYmdLocal(selectedDate.value)
  return `${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
})
const pendingTimeLabel = computed(() => {
  const h = pendingHour.value
  if (h == null) return ''
  return `${toHourLabel(h)} – ${toHourLabel(h + 2)} น.`
})
const requiredLocationLabel = computed(() =>
  nailOptions.value
    .filter(opt => opt.is_required)
    .map(opt => opt.option_name)
    .join(', ')
)
const hasSelectedServices = computed(() => selectedOptionIds.value.length > 0)
const canSubmitBooking = computed(() => {
  const required = nailOptions.value.filter(opt => opt.is_required)
  if (!required.length) return hasSelectedServices.value
  return required.every(opt => selectedOptionIds.value.includes(opt.id))
})

function applyRequiredOptionDefaults() {
  const requiredIds = nailOptions.value.filter(opt => opt.is_required).map(opt => opt.id)
  selectedOptionIds.value = [...new Set([...selectedOptionIds.value, ...requiredIds])]
}

function missingRequiredOptionNames() {
  return nailOptions.value
    .filter(opt => opt.is_required && !selectedOptionIds.value.includes(opt.id))
    .map(opt => opt.option_name)
}

function toHourLabel(hour) { return `${hour}:00` }

function slotTimeLabel(hour) {
  if (isSlots2hMode.value) return `${toHourLabel(hour)} – ${toHourLabel(hour + 2)}`
  return toHourLabel(hour)
}

function occupiedSlotLabel() {
  return 'ไม่ว่าง'
}

const canGoPrev = computed(() => windowStartDate.value > todayDate)
const canGoNext = computed(() => addDays(windowStartDate.value, visibleDayCount.value) <= maxBookDate.value)

function isClosedDay(date) {
  return (bookingStore.blocksByDate[date] || []).some(b => b.is_full_day)
}
function findFirstOpenDate(fromDate) {
  let cursor = startOfDay(fromDate)
  while (cursor <= maxBookDate.value) {
    const iso = toLocalYmd(cursor)
    if (!isClosedDay(iso)) return iso
    cursor = addDays(cursor, 1)
  }
  return null
}
function alignWindowToDate(iso) {
  const target = parseYmdLocal(iso)
  windowStartDate.value = startOfDay(target < todayDate ? todayDate : target)
}
function isHourBlocked(hour) {
  return blockedSlots.value.some(b => {
    if (b.is_full_day) return true
    return hour >= Number(b.start_hour) && hour < Number(b.end_hour)
  })
}
function activeBookings() {
  return bookings.value.filter(b => b.status !== 'cancelled')
}
function bookingForHour(hour) {
  return activeBookings().find(b => {
    const start = Number(b.start_hour)
    const end = Number(b.end_hour ?? start + 2)
    return hour >= start && hour < end
  })
}
function isStartSlot(hour) {
  const b = bookingForHour(hour)
  return b && Number(b.start_hour) === hour
}
function hasBookingOverlap(hour) {
  const slotEnd = hour + 2
  return activeBookings().some(b => {
    const start = Number(b.start_hour)
    const end = Number(b.end_hour ?? start + 2)
    return start < slotEnd && end > hour
  })
}
function isSlotRangeBlockedForBooking(hour) {
  for (let h = hour; h < hour + 2; h++) {
    if (isHourBlocked(h)) return true
  }
  return false
}
function canBook(hour) {
  if (hour > bookingStore.shopLastBookingHour) return false
  if (hour + 2 > bookingStore.shopLastBookingHour + 2) return false
  if (hasBookingOverlap(hour)) return false
  if (isSlotRangeBlockedForBooking(hour)) return false
  return true
}
function hasBookingOnDay(iso) {
  return (bookingStore.bookingsByDate[iso] || []).length > 0
}

async function loadDate() {
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const beforeDate = selectedDate.value
    await Promise.all([
      bookingStore.fetchByDate(selectedDate.value),
      bookingStore.fetchNailOptions(selectedDate.value).catch(() => []),
    ])
    if (isClosedDay(beforeDate)) {
      await refreshBlocksAndEnsureSelection(true)
      if (!isClosedDay(selectedDate.value)) { await loadDate(); return }
      bookingStore.bookingsByDate[selectedDate.value] = []
      errorMessage.value = 'ช่วงนี้ร้านปิดรับคิวทั้งวัน กรุณาเลือกวันอื่น'
    }
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'
  }
}

function bookingSettingsSnapshot() {
  return {
    shopOpenHour: bookingStore.shopOpenHour,
    shopLastBookingHour: bookingStore.shopLastBookingHour,
    advanceDays: bookingStore.advanceDays,
    bookUntilDate: bookingStore.bookUntilDate,
    bookingDisplayMode: bookingStore.bookingDisplayMode,
  }
}

function hasBookingSettingsChanged(before, after) {
  return (
    before.shopOpenHour !== after.shopOpenHour ||
    before.shopLastBookingHour !== after.shopLastBookingHour ||
    before.advanceDays !== after.advanceDays ||
    before.bookUntilDate !== after.bookUntilDate ||
    before.bookingDisplayMode !== after.bookingDisplayMode
  )
}

async function syncBookingSettings({ refreshLayout = true } = {}) {
  const before = bookingSettingsSnapshot()
  await Promise.all([
    bookingStore.fetchBookingSettings(),
    bookingStore.fetchAllNailOptions(),
  ])
  const after = bookingSettingsSnapshot()
  if (!refreshLayout || !hasBookingSettingsChanged(before, after)) return false

  const picked = parseYmdLocal(selectedDate.value)
  if (picked > maxBookDate.value) {
    selectedDate.value = toLocalYmd(maxBookDate.value)
    alignWindowToDate(selectedDate.value)
  }
  await refreshBlocksAndEnsureSelection(true)
  await loadDate()
  return true
}

async function refreshSlotData() {
  try {
    await bookingStore.fetchByDate(selectedDate.value)
  } catch {
    // polling / pre-book refresh — เงียบไว้ รอบถัดไปลองใหม่
  }
}

async function pollCurrentDate() {
  if (document.hidden || busy.value) return
  const layoutRefreshed = await syncBookingSettings()
  if (!layoutRefreshed) {
    await Promise.all([
      refreshSlotData(),
      bookingStore.fetchAllNailOptions().catch(() => null),
    ])
  }
}

async function ensureSlotStillAvailable(hour) {
  await refreshSlotData()
  if (!canBook(hour)) {
    serviceError.value = 'เวลานี้เพิ่งถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น'
    return false
  }
  return true
}

async function onVisibilityChange() {
  if (document.hidden || busy.value) return
  const layoutRefreshed = await syncBookingSettings()
  if (!layoutRefreshed) await refreshSlotData()
}

function openBookSheet(hour) {
  if (!canBook(hour)) return
  pendingHour.value = hour
  sheetStep.value = 'confirm'
  selectedOptionIds.value = []
  serviceError.value = ''
  showModal.value = true
}

function closeBookSheet() {
  showModal.value = false
  sheetStep.value = 'confirm'
  selectedOptionIds.value = []
  serviceError.value = ''
  pendingHour.value = null
}

async function goToServiceStep() {
  serviceError.value = ''
  const hour = pendingHour.value
  if (hour == null) return

  busy.value = true
  try {
    if (!(await ensureSlotStillAvailable(hour))) return
    if (!nailOptions.value.length) {
      serviceError.value = 'ไม่มีบริการให้เลือกในวันนี้'
      return
    }
    applyRequiredOptionDefaults()
    sheetStep.value = 'services'
  } finally {
    busy.value = false
  }
}

function backToConfirmStep() {
  serviceError.value = ''
  sheetStep.value = 'confirm'
}

async function submitBooking() {
  const hour = pendingHour.value
  if (hour == null) return

  const missingRequired = missingRequiredOptionNames()
  if (missingRequired.length) {
    serviceError.value = `กรุณาเลือกบริการที่จำเป็น: ${missingRequired.join(', ')}`
    return
  }

  if (!selectedOptionIds.value.length) {
    serviceError.value = 'กรุณาเลือกบริการอย่างน้อย 1 รายการ'
    return
  }

  busy.value = true
  serviceError.value = ''
  try {
    if (!(await ensureSlotStillAvailable(hour))) return

    const booking = await bookingStore.bookSlot(
      selectedDate.value,
      hour,
      selectedOptionIds.value.map(String),
    )
    closeBookSheet()
    await Swal.fire({
      title: 'จองแล้ว รอชำระเงิน',
      text: 'กรุณาโอนและส่งสลิปทาง LINE เพื่อรอแอดมินยืนยัน',
      icon: 'success',
      confirmButtonText: 'ไปหน้าชำระเงิน',
    })
    router.push({ path: `/payment/${booking.id}`, query: { date: selectedDate.value, start: String(hour), end: String(hour+2) } })
  } catch (error) {
    const msg = error?.response?.data?.error || 'จองคิวไม่สำเร็จ'
    await Swal.fire({ title: 'จองไม่สำเร็จ', text: msg, icon: 'error' })
    if (error?.response?.status === 409) await loadDate()
  } finally {
    busy.value = false
  }
}

async function cancel(bookingId) {
  const result = await Swal.fire({
    title: 'ยืนยันการยกเลิก', text: 'ต้องการยกเลิกคิวนี้ใช่ไหม',
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก', cancelButtonText: 'ปิด',
  })
  if (!result.isConfirmed) return
  busy.value = true
  try {
    await bookingStore.cancelBooking(bookingId, selectedDate.value)
    await Swal.fire({ title: 'ยกเลิกสำเร็จ', icon: 'success', timer: 1300, showConfirmButton: false })
  } catch (error) {
    await Swal.fire({ title: 'ยกเลิกไม่สำเร็จ', text: error?.response?.data?.error || 'เกิดข้อผิดพลาด', icon: 'error' })
  } finally {
    busy.value = false
  }
}

async function loadMyCoupons() {
  try {
    const { data } = await api.get('/api/coupons/my')
    myCoupons.value = (data || []).filter(c => !c.is_used)
  } catch { myCoupons.value = [] }
}

async function redeemCoupon() {
  const result = await Swal.fire({
    title: 'แลกคูปองลด 20%', text: 'ใช้ 100 แต้มเพื่อแลกคูปอง 1 ใบ ใช่หรือไม่?',
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'แลกคูปอง', cancelButtonText: 'ยกเลิก',
  })
  if (!result.isConfirmed) return
  try {
    const { data } = await api.post('/api/coupons/redeem')
    await auth.fetchMe()
    await loadMyCoupons()
    await Swal.fire({
      title: 'แลกคูปองสำเร็จ',
      html: `รหัสคูปองของคุณ:<br><strong style="font-size:22px">${data?.coupon?.coupon_code || '-'}</strong>`,
      icon: 'success',
    })
  } catch (error) {
    await Swal.fire({ title: 'แลกคูปองไม่สำเร็จ', text: error?.response?.data?.error || 'เกิดข้อผิดพลาด', icon: 'error' })
  }
}

async function showMyCoupons() {
  await loadMyCoupons()
  const html = myCoupons.value.length
    ? myCoupons.value.map(c =>
        `<div style="padding:8px 0;border-bottom:1px solid #eee;text-align:left">
          <strong>${c.coupon_code}</strong><br/>ส่วนลด ${c.discount_percent}%
        </div>`).join('')
    : '<p>ยังไม่มีคูปอง</p>'
  await Swal.fire({ title: 'คูปองของฉัน', html: `<div style="max-height:240px;overflow:auto">${html}</div>`, confirmButtonText: 'ปิด' })
}

function selectDate(iso) {
  const picked = parseYmdLocal(iso)
  if (picked < todayDate || picked > maxBookDate.value) return
  selectedDate.value = iso
  loadDate()
}

function dayPillStyle(day) {
  if (!day.tintColor) return {}
  return dayTintStyle(day.tintColor, { selected: selectedDate.value === day.iso })
}

async function refreshBlocksAndEnsureSelection(fullRange = false) {
  const from = fullRange ? toLocalYmd(todayDate) : toLocalYmd(windowStartDate.value)
  const to = fullRange
    ? toLocalYmd(maxBookDate.value)
    : toLocalYmd(addDays(windowStartDate.value, visibleDayCount.value - 1))
  await bookingStore.fetchBlocksRange(from, to)
  if (fullRange) {
    const first = findFirstOpenDate(todayDate)
    if (!first) { errorMessage.value = 'ไม่มีวันเปิดรับคิวในช่วงที่เปิดจอง'; return }
    if (isClosedDay(selectedDate.value) || !visibleWeekDays.value.find(d => d.iso === selectedDate.value)) {
      selectedDate.value = first
      alignWindowToDate(first)
    }
    return
  }
  if (!visibleWeekDays.value.find(d => d.iso === selectedDate.value)) {
    if (visibleWeekDays.value[0]) selectedDate.value = visibleWeekDays.value[0].iso
  }
}

async function prevWeek() {
  if (!canGoPrev.value) return
  windowStartDate.value = addDays(windowStartDate.value, -visibleDayCount.value)
  if (windowStartDate.value < todayDate) windowStartDate.value = new Date(todayDate)
  await refreshBlocksAndEnsureSelection(); await loadDate()
}
async function nextWeek() {
  if (!canGoNext.value) return
  windowStartDate.value = addDays(windowStartDate.value, visibleDayCount.value)
  if (windowStartDate.value > maxBookDate.value) windowStartDate.value = new Date(maxBookDate.value)
  await refreshBlocksAndEnsureSelection(); await loadDate()
}

function logout() { auth.logout(); router.push('/login') }
function goToPayment(booking) {
  router.push({ path: `/payment/${booking.id}`, query: { date: selectedDate.value, start: String(booking.start_hour), end: String(booking.end_hour ?? Number(booking.start_hour) + 2) } })
}

const initials = computed(() => {
  const n = auth.user?.name || ''
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'NA'
})

const totalPoints = computed(() => auth.user?.total_points || 0)
const pointsLabel = computed(() => {
  const n = totalPoints.value
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    const s = m >= 10 ? Math.round(m) : Number(m.toFixed(1))
    return `${s}M แต้ม`
  }
  if (n >= 10_000) return `${Math.round(n / 1_000)}k แต้ม`
  return `${n.toLocaleString('th-TH')} แต้ม`
})
const canRedeemCoupon = computed(() => totalPoints.value >= 100)

onMounted(async () => {
  window.addEventListener('resize', scheduleStripMeasure)
  document.addEventListener('visibilitychange', onVisibilityChange)
  pollTimer = setInterval(pollCurrentDate, POLL_INTERVAL_MS)
  await bookingStore.fetchBookingSettings()
  await bookingStore.fetchAllNailOptions()
  await refreshBlocksAndEnsureSelection(true)
  await Promise.all([loadDate(), bookingStore.fetchMyBookings().catch(() => null), loadMyCoupons()])
  await nextTick()
  measureVisibleDayCount()
})
onUnmounted(() => {
  window.removeEventListener('resize', scheduleStripMeasure)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearTimeout(stripResizeTimer)
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="page">

    <!-- ── HEADER ── -->
    <header class="hdr">
      <div class="hdr-top">
        <div class="brand">
          Nail<span class="brand-accent">Thuean</span>
          <span class="brand-emoji" aria-hidden="true">💅</span>
        </div>
        <div class="avatar" :title="auth.user?.name">{{ initials }}</div>
      </div>

      <div class="hdr-bar">
        <button v-if="canRedeemCoupon" class="chip chip-rose" @click="redeemCoupon">
          <i class="ti ti-gift" aria-hidden="true"></i>
          <span>แลกคูปอง</span>
        </button>
        <button class="chip chip-star" @click="showMyCoupons" :aria-label="pointsLabel">
          <i class="ti ti-star" aria-hidden="true"></i>
          <span>{{ pointsLabel }}</span>
        </button>
      </div>

      <div class="date-nav">
        <button class="nav-btn" :disabled="!canGoPrev" @click="prevWeek" aria-label="ก่อนหน้า">
          <i class="ti ti-chevron-left" aria-hidden="true"></i>
        </button>
        <span class="month-label">{{ monthLabel }}</span>
        <button class="nav-btn" :disabled="!canGoNext" @click="nextWeek" aria-label="ถัดไป">
          <i class="ti ti-chevron-right" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Day strip -->
      <div ref="dayStripRef" class="day-strip">
        <button
          v-for="day in visibleWeekDays"
          :key="day.iso"
          class="day-pill"
          :class="{
            active: selectedDate === day.iso && !day.tintColor,
            today: day.isToday && selectedDate !== day.iso && !day.tintColor,
            'has-book': hasBookingOnDay(day.iso),
            'has-tint': Boolean(day.tintColor),
          }"
          :style="dayPillStyle(day)"
          @click="selectDate(day.iso)"
        >
          <span class="day-name">{{ day.label }}</span>
          <strong class="day-num">{{ day.day }}</strong>
          <span class="day-dot" aria-hidden="true"></span>
        </button>
      </div>

      <p v-if="visibleWeekDays.length === 0" class="strip-hint">
        <template v-if="canGoNext">ร้านปิดช่วงนี้ กด <strong>ถัดไป</strong> เพื่อดูวันอื่น</template>
        <template v-else>ไม่มีวันเปิดรับคิวในช่วงที่เปิดจอง</template>
      </p>
    </header>

    <!-- ── BODY ── -->
    <main class="body">
      <div class="date-heading">
        <span class="section-label">
          {{ selectedDateLabel }}<template v-if="requiredLocationLabel"> สถานที่ให้บริการ {{ requiredLocationLabel }}</template>
        </span>
      </div>

      <p v-if="errorMessage" class="msg error">
        <i class="ti ti-alert-circle" style="font-size:15px;vertical-align:-2px" aria-hidden="true"></i>
        {{ errorMessage }}
      </p>

      <!-- Slots -->
      <div v-if="visibleSlots.length === 0" class="empty-state">
        <i class="ti ti-calendar-off" style="font-size:36px;color:#94a3b8" aria-hidden="true"></i>
        <p>วันนี้ไม่มีช่วงเวลาเปิดรับคิว</p>
      </div>

      <template v-else>
        <div v-for="hour in visibleSlots" :key="hour" class="slot-row">
          <span class="slot-time">{{ slotTimeLabel(hour) }}</span>

          <!-- ── Booked by me ── -->
          <div v-if="bookingForHour(hour) && isStartSlot(hour) && bookingForHour(hour).is_mine" class="slot-card mine">
            <div class="slot-left">
              <span class="slot-range">{{ toHourLabel(bookingForHour(hour).start_hour) }} – {{ toHourLabel(bookingForHour(hour).end_hour) }}</span>
              <span class="slot-status">นัดของคุณ</span>
            </div>
            <div class="slot-right">
              <span class="badge badge-mine">
                <i class="ti ti-check" style="font-size:11px" aria-hidden="true"></i> จองแล้ว
              </span>
              <button
                v-if="bookingForHour(hour).status === 'awaiting_payment'"
                class="btn-cancel-slot"
                :disabled="busy"
                @click="cancel(bookingForHour(hour).id)"
              >ยกเลิก</button>
              <button
                v-if="bookingForHour(hour).status === 'awaiting_payment'"
                class="book-btn"
                :disabled="busy"
                @click="goToPayment(bookingForHour(hour))"
              >ชำระเงิน</button>
            </div>
          </div>

          <!-- ── Booked by others ── -->
          <div v-else-if="bookingForHour(hour) && isStartSlot(hour)" class="slot-card busy">
            <div class="slot-left">
              <span class="slot-range strike">{{ toHourLabel(bookingForHour(hour).start_hour) }} – {{ toHourLabel(bookingForHour(hour).end_hour) }}</span>
              <span class="slot-status">{{ occupiedSlotLabel(bookingForHour(hour).status) }}</span>
            </div>
            <span class="badge badge-busy">🔒</span>
          </div>

          <!-- ── Continuation row ── -->
          <div v-else-if="bookingForHour(hour) && !isStartSlot(hour)" class="slot-card continuation">
            <span class="slot-status">{{ occupiedSlotLabel(bookingForHour(hour).status) }}</span>
          </div>

          <!-- ── จองไม่ได้ (ทับคิว / ปิดช่วงเวลา / เลยเวลา) ── -->
          <div v-else-if="!canBook(hour)" class="slot-card busy">
            <div class="slot-left">
              <span class="slot-range strike">{{ toHourLabel(hour) }} – {{ toHourLabel(hour + 2) }}</span>
              <span class="slot-status">ไม่ว่าง</span>
            </div>
          </div>

          <!-- ── ว่าง จองได้ ── -->
          <div v-else class="slot-card free" @click="openBookSheet(hour)">
            <div class="slot-left">
              <span class="slot-range">{{ toHourLabel(hour) }} – {{ toHourLabel(hour + 2) }}</span>
              <span class="slot-status">ว่าง</span>
            </div>
            <button class="book-btn" :disabled="busy" @click.stop="openBookSheet(hour)">
              จอง
            </button>
          </div>
        </div>
      </template>
    </main>

    <!-- ── BOTTOM SHEET MODAL ── -->
    <Transition name="fade">
      <div v-if="showModal" class="overlay" @click.self="closeBookSheet">
        <div class="sheet" role="dialog" aria-modal="true">
          <div class="sheet-handle"></div>

          <!-- Step 1: ยืนยันรายละเอียด -->
          <template v-if="sheetStep === 'confirm'">
            <h3 class="sheet-title">ยืนยันการจอง</h3>
            <p class="sheet-sub">ตรวจสอบรายละเอียดก่อนเลือกบริการ</p>

            <div class="sheet-info">
              <div class="info-row">
                <span class="info-label"><i class="ti ti-calendar info-ic" aria-hidden="true"></i>วันที่</span>
                <span class="info-val">{{ selectedDateLabel }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"><i class="ti ti-clock info-ic" aria-hidden="true"></i>เวลา</span>
                <span class="info-val">{{ pendingTimeLabel }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"><i class="ti ti-hourglass info-ic" aria-hidden="true"></i>ระยะเวลา</span>
                <span class="info-val">2 ชั่วโมง</span>
              </div>
              <div v-if="requiredLocationLabel" class="info-row">
                <span class="info-label"><i class="ti ti-map-pin info-ic" aria-hidden="true"></i>สถานที่</span>
                <span class="info-val">{{ requiredLocationLabel }}</span>
              </div>
            </div>

            <div class="points-banner">
              <i class="ti ti-star points-ic" aria-hidden="true"></i>
              <span>เมื่อช่างทำเสร็จ คุณจะได้รับ <strong>+10 แต้ม</strong></span>
            </div>

            <p v-if="serviceError" class="sheet-error">{{ serviceError }}</p>

            <div class="sheet-actions">
              <button type="button" class="btn-cancel" @click="closeBookSheet">ยกเลิก</button>
              <button type="button" class="btn-confirm" :disabled="busy" @click="goToServiceStep">
                เลือกบริการ
                <i class="ti ti-arrow-right" aria-hidden="true"></i>
              </button>
            </div>
          </template>

          <!-- Step 2: เลือกบริการ -->
          <template v-else>
            <h3 class="sheet-title">เลือกบริการ</h3>
            <p class="sheet-sub">
              <template v-if="requiredLocationLabel">สถานที่ให้บริการ {{ requiredLocationLabel }}</template>
              <template v-else>เลือกบริการสำหรับคิวนี้</template>
            </p>

            <div class="sheet-info sheet-info-compact">
              <div class="info-row">
                <span class="info-label"><i class="ti ti-calendar info-ic" aria-hidden="true"></i>วันที่</span>
                <span class="info-val">{{ selectedDateLabel }}</span>
              </div>
              <div class="info-row">
                <span class="info-label"><i class="ti ti-clock info-ic" aria-hidden="true"></i>เวลา</span>
                <span class="info-val">{{ pendingTimeLabel }}</span>
              </div>
            </div>

            <div class="option-list">
              <label
                v-for="opt in nailOptions"
                :key="opt.id"
                class="option-card"
                :class="{ selected: selectedOptionIds.includes(opt.id), required: opt.is_required }"
              >
                <input
                  v-model="selectedOptionIds"
                  type="checkbox"
                  class="option-input"
                  :value="opt.id"
                  :disabled="opt.is_required"
                  @change="serviceError = ''"
                />
                <span class="option-check" aria-hidden="true">
                  <i class="ti ti-check"></i>
                </span>
                <span class="option-body">
                  <span class="option-name">
                    {{ opt.option_name }}
                    <span v-if="opt.is_required" class="option-required-tag">บังคับ</span>
                  </span>
                  <span v-if="opt.description" class="option-desc">{{ opt.description }}</span>
                </span>
                <span v-if="Number(opt.price) > 0" class="option-price"></span>
                <!-- <span v-if="Number(opt.price) > 0" class="option-price">฿{{ Number(opt.price).toLocaleString('th-TH') }}</span> -->
              </label>
            </div>

            <p v-if="serviceError" class="sheet-error">{{ serviceError }}</p>

            <div class="sheet-actions">
              <button type="button" class="btn-cancel" :disabled="busy" @click="backToConfirmStep">ย้อนกลับ</button>
              <button
                type="button"
                class="btn-confirm"
                :disabled="busy || !canSubmitBooking"
                @click="submitBooking"
              >
                ยืนยันการจอง
                <i class="ti ti-check" aria-hidden="true"></i>
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- ── BOTTOM NAV ── -->
    <nav class="bottom-nav" aria-label="เมนูหลัก">
      <button class="nav-item active" aria-current="page">
        <i class="ti ti-calendar" aria-hidden="true"></i>
        <span>จองคิว</span>
      </button>
      <!-- <button class="nav-item" @click="router.push('/history')">
        <i class="ti ti-history" aria-hidden="true"></i>
        <span>ประวัติ</span>
      </button> -->
      <button class="nav-item" @click="showMyCoupons">
        <i class="ti ti-ticket" aria-hidden="true"></i>
        <span>คูปอง</span>
      </button>
      <button v-if="auth.isAdmin" class="nav-item" @click="router.push('/admin')">
        <i class="ti ti-shield" aria-hidden="true"></i>
        <span>แอดมิน</span>
      </button>
      <button class="nav-item" @click="logout">
        <i class="ti ti-logout" aria-hidden="true"></i>
        <span>ออกจากระบบ</span>
      </button>
    </nav>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600&display=swap');

/* ── Reset & root ── */
* { box-sizing: border-box; }
.page {
  font-family: 'Noto Sans Thai', sans-serif;
  background: #f8fafc;
  min-height: 100svh;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  padding-bottom: 72px;
}

/* ── HEADER ── */
.hdr {
  background: #fff;
  border-bottom: 0.5px solid #f1e8f0;
  padding: 14px 18px 0;
  position: sticky;
  top: 0;
  z-index: 20;
}
.hdr-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  letter-spacing: -0.3px;
  line-height: 1;
  white-space: nowrap;
}
.brand-accent { color: #e11d48; }
.brand-emoji { font-size: 16px; line-height: 1; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #f9a8d4, #fb7185);
  color: #fff; font-size: 12px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.hdr-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

/* Chips */
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  border: 0.5px solid transparent;
  cursor: pointer;
  font-family: inherit;
  transition: opacity .15s;
}
.chip i { font-size: 14px; flex-shrink: 0; }
.chip:hover { opacity: .8; }
.chip-star {
  margin-left: auto;
  background: #fff1f2;
  color: #e11d48;
  border-color: #fecdd3;
  max-width: 100%;
}
.chip-star span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip-rose { background: #e11d48; color: #fff; flex-shrink: 0; }
.chip-slate { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }

/* Date nav */
.date-nav {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.month-label { font-size: 13px; font-weight: 600; color: #1e293b; }
.nav-btn {
  width: 28px; height: 28px; border-radius: 8px;
  border: 0.5px solid #f1e8f0; background: #f8fafc;
  color: #475569; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background .15s;
}
.nav-btn i { font-size: 16px; line-height: 1; }
.nav-btn:hover:not(:disabled) { background: #f1f5f9; }
.nav-btn:disabled { opacity: .35; cursor: not-allowed; }

/* Day strip */
.day-strip {
  display: flex; gap: 6px; padding-bottom: 12px;
  overflow: hidden;
}
.day-pill {
  flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 3px;
  width: 46px; padding: 8px 0; border-radius: 12px;
  border: 0.5px solid #f1e8f0; background: #fff;
  cursor: pointer; transition: all .18s; font-family: inherit;
}
.day-pill.has-tint .day-name,
.day-pill.has-tint .day-num {
  color: inherit;
}
.day-pill.has-tint.active .day-name,
.day-pill.has-tint.active .day-num,
.day-pill.has-tint.active .day-dot {
  color: #fff;
}
.day-pill.has-tint.active .day-dot {
  background: rgba(255,255,255,.55);
}
.day-pill:hover { background: #fdf2f8; border-color: #fbcfe8; }
.day-pill.has-tint:hover {
  filter: brightness(0.97);
}
.day-pill.today:not(.active):not(.has-tint) { border-color: #f9a8d4; background: #fdf2f8; }
.day-pill.active:not(.has-tint) { background: #e11d48; border-color: #e11d48; }
.day-name { font-size: 10px; color: #94a3b8; font-weight: 500; }
.day-num { font-size: 15px; font-weight: 600; color: #1e293b; }
.day-pill.today:not(.active):not(.has-tint) .day-num { color: #e11d48; }
.day-pill.active:not(.has-tint) .day-name,
.day-pill.active:not(.has-tint) .day-num { color: #fff; }
.day-dot {
  width: 4px; height: 4px; border-radius: 50%; background: transparent;
}
.day-pill.has-book .day-dot { background: #f9a8d4; }
.day-pill.active:not(.has-tint) .day-dot { background: rgba(255,255,255,.5); }

.strip-hint { font-size: 12px; color: #94a3b8; padding: 0 2px 12px; }

/* ── BODY ── */
.body { padding: 0 16px; }
.date-heading {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0 10px;
}
.section-label { font-size: 13px; font-weight: 600; color: #1e293b; }

.msg {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 10px;
}
.msg.error { background: #fff1f2; color: #e11d48; border: 0.5px solid #fecdd3; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 48px 0; color: #94a3b8; font-size: 14px;
}

/* ── SLOTS ── */
.slot-row {
  display: flex; align-items: stretch; gap: 10px; margin-bottom: 8px;
}
.slot-time {
  font-size: 11px; font-weight: 500; color: #94a3b8;
  width: 38px; flex-shrink: 0; text-align: right; padding-top: 16px;
}
.slot-card {
  flex: 1; border-radius: 12px; border: 0.5px solid #f1e8f0;
  background: #fff; padding: 12px 14px;
  display: flex; align-items: center; justify-content: space-between;
  min-height: 56px; transition: all .18s;
}
.slot-card.free { cursor: pointer; }
.slot-card.free:hover { border-color: #fbcfe8; background: #fdf2f8; }
.slot-card.free.disabled { cursor: not-allowed; opacity: .5; }
.slot-card.mine { background: #fff1f2; border-color: #fca5a5; }
.slot-card.busy { background: #f8fafc; border-color: #f1e8f0; }
.slot-card.continuation { background: #f8fafc; border-color: #f1e8f0; justify-content: center; min-height: 40px; }

.slot-left { display: flex; flex-direction: column; gap: 2px; }
.slot-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.slot-range { font-size: 13px; font-weight: 500; color: #1e293b; }
.slot-status { font-size: 11px; color: #94a3b8; }
.slot-card.mine .slot-range { color: #e11d48; }
.slot-card.mine .slot-status { color: #f43f5e; }
.slot-card.busy .slot-range,
.strike { text-decoration: line-through; color: #94a3b8; }

.badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 99px;
}
.badge-mine { background: #fff1f2; color: #e11d48; border: 0.5px solid #fecdd3; }
.badge-busy { font-size: 14px; }

.book-btn {
  padding: 7px 14px; border-radius: 8px; border: none;
  background: #e11d48; color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer; flex-shrink: 0; font-family: inherit; transition: opacity .15s;
}
.book-btn:hover:not(:disabled) { opacity: .85; }
.book-btn:disabled { opacity: .4; cursor: not-allowed; }

.btn-cancel-slot {
  padding: 7px 12px; border-radius: 10px;
  border: 0.5px solid #e2e8f0; background: #fff;
  font-size: 10px; font-weight: 600; color: #64748b;
  cursor: pointer; flex-shrink: 0; font-family: inherit; transition: all .15s;
}
.btn-cancel-slot:hover:not(:disabled) {
  border-color: #fecdd3;
  color: #e11d48;
  background: #fff1f2;
}
.btn-cancel-slot:disabled { opacity: .4; cursor: not-allowed; }

/* ── BOTTOM SHEET ── */
.overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,.45);
  display: flex; align-items: flex-end; z-index: 50;
}
.sheet {
  background: #fff; width: 100%; max-width: 430px; margin: 0 auto;
  border-radius: 20px 20px 0 0; padding: 20px 20px 36px;
}
.sheet-handle {
  width: 36px; height: 4px; background: #e2e8f0;
  border-radius: 99px; margin: 0 auto 18px;
}
.sheet-title { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
.sheet-sub { font-size: 13px; color: #94a3b8; margin-bottom: 18px; }
.sheet-info {
  background: #f8fafc; border-radius: 12px; padding: 14px; margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.sheet-info-compact { margin-bottom: 12px; }
.info-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.info-label {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: #94a3b8; flex-shrink: 0;
}
.info-ic { font-size: 14px; }
.info-val { font-size: 13px; font-weight: 500; color: #1e293b; text-align: right; }
.points-banner {
  display: flex; align-items: center; gap: 10px;
  background: #fff1f2; border: 0.5px solid #fecdd3;
  border-radius: 12px; padding: 12px 14px; margin-bottom: 20px;
  font-size: 13px; color: #1e293b;
}
.points-ic { font-size: 18px; color: #e11d48; flex-shrink: 0; }
.sheet-error {
  margin: -6px 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff1f2;
  border: 0.5px solid #fecdd3;
  color: #e11d48;
  font-size: 12px;
  font-weight: 500;
}
.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(42vh, 280px);
  overflow-y: auto;
  margin-bottom: 16px;
  padding-right: 2px;
}
.option-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 0.5px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.option-card:hover { border-color: #fbcfe8; background: #fdf2f8; }
.option-card.selected {
  border-color: #e11d48;
  background: #fff1f2;
  box-shadow: 0 0 0 1px rgba(225, 29, 72, .08);
}
.option-card.required {
  cursor: default;
}
.option-card.required:hover {
  border-color: #e11d48;
  background: #fff1f2;
}
.option-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.option-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid #cbd5e1;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: transparent;
  transition: all .15s;
}
.option-card.selected .option-check {
  border-color: #e11d48;
  background: #e11d48;
  color: #fff;
}
.option-check i { font-size: 13px; }
.option-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.option-name { font-size: 14px; font-weight: 600; color: #1e293b; }
.option-required-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #e11d48;
  background: #ffe4e6;
  vertical-align: middle;
}
.option-desc {
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.option-price {
  font-size: 13px;
  font-weight: 600;
  color: #e11d48;
  flex-shrink: 0;
}
.sheet-actions { display: flex; gap: 10px; }
.btn-cancel {
  flex: 1; padding: 14px; border-radius: 12px;
  border: 0.5px solid #e2e8f0; background: #f8fafc;
  font-size: 14px; font-weight: 500; color: #475569;
  cursor: pointer; font-family: inherit;
}
.btn-confirm {
  flex: 2; padding: 14px; border-radius: 12px;
  border: none; background: #e11d48; color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: opacity .15s;
}
.btn-confirm i { font-size: 14px; }
.btn-confirm:hover:not(:disabled) { opacity: .88; }
.btn-confirm:disabled { opacity: .4; cursor: not-allowed; }

/* ── BOTTOM NAV ── */
.bottom-nav {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px;
  background: #fff; border-top: 0.5px solid #f1e8f0;
  display: flex; padding: 8px 0 max(14px, env(safe-area-inset-bottom));
  z-index: 30;
}
.nav-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 500; color: #94a3b8;
  background: none; border: none; cursor: pointer; font-family: inherit;
  transition: color .15s;
}
.nav-item i { font-size: 20px; }
.nav-item.active { color: #e11d48; }
.nav-item:hover:not(.active) { color: #475569; }

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active .sheet, .fade-leave-active .sheet { transition: transform .28s cubic-bezier(.32,.72,0,1); }
.fade-enter-from .sheet { transform: translateY(100%); }
.fade-leave-to .sheet { transform: translateY(100%); }
</style>

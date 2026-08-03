<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { useAuthStore } from '../stores/auth'
import { useBookingStore } from '../stores/booking'
import { useCoupons } from '../composables/useCoupons'
import BottomNav from '../components/BottomNav.vue'
import AccountMenuDrawer from '../components/AccountMenuDrawer.vue'
import api from '../api/axios'
import { colorForDate, dayTintStyle } from '../utils/nailOptionHelpers'
import {
  buildVisibleSlots,
  buildDayWindowSlots,
  canBookSlot,
  canBookDayWindowSlot,
  slotTimeLabel as formatSlotTimeLabel,
  hourToSlot,
  slotKey,
  slotLabel,
  bookingRowToSlot,
  formatSlotDuration,
} from '../utils/bookingSlots'
import { useUnpaidCountdown } from '../composables/useUnpaidCountdown'
import { useShopRoute } from '../composables/useShopRoute'
import { useUiSettingsStore } from '../stores/uiSettings'
import { formatUiText } from '../utils/formatUiText'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const { shopPath } = useShopRoute()
const ui = useUiSettingsStore()
const auth = useAuthStore()
const bookingStore = useBookingStore()
const unpaidCountdown = useUnpaidCountdown(() => ({
  enabled: bookingStore.unpaidAutoCancelEnabled,
  expireHours: bookingStore.unpaidExpireHours,
}))
let expiryRefreshPending = false
const { loadMyCoupons, redeemCoupon, showMyCoupons, couponSettings, canRedeem, loadCouponSettings } = useCoupons()

const selectedDate = ref(toLocalYmd(new Date()))
const busy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showModal = ref(false)
const sheetStep = ref('confirm')
const pendingSlot = ref(null)
const selectedOptionIds = ref([])
const serviceError = ref('')

const isSlots2hMode = computed(() => bookingStore.bookingDisplayMode === 'slots_2h')

const bookings = computed(() => bookingStore.bookingsByDate[selectedDate.value] || [])
const blockedSlots = computed(() => bookingStore.blocksByDate[selectedDate.value] || [])
const extraHoursForDate = computed(() => bookingStore.extraHoursByDate[selectedDate.value] || [])
const dayHoursForDate = computed(() => bookingStore.dayHoursByDate[selectedDate.value] || [])
const usesCustomDayHours = computed(() => dayHoursForDate.value.length > 0)
const nailOptions = computed(() => bookingStore.nailOptions || [])
const todayDate = startOfDay(new Date())
// bookUntilDate = วันสิ้นสุดที่ล็อกตอนแอดมินกดบันทึก (ไม่เลื่อนตามวันนี้)
const maxBookDate = computed(() => {
  if (bookingStore.bookUntilDate && /^\d{4}-\d{2}-\d{2}$/.test(bookingStore.bookUntilDate)) {
    return parseYmdLocal(bookingStore.bookUntilDate)
  }
  return addDays(todayDate, Math.max(0, bookingStore.advanceDays - 1))
})
const dayStripRef = ref(null)
const stripScroll = ref({ left: 0, width: 0, scrollWidth: 0 })
const stripDragState = ref({ active: false, moved: false, startX: 0, startScrollLeft: 0, targetIso: null, pointerId: null })
const POLL_INTERVAL_MS = 45_000
let pollTimer = null
let stripResizeTimer = null

const weekdayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const thMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function updateStripScroll() {
  const el = dayStripRef.value
  if (!el) return
  stripScroll.value = {
    left: el.scrollLeft,
    width: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }
}

function scheduleStripMeasure() {
  clearTimeout(stripResizeTimer)
  stripResizeTimer = setTimeout(() => {
    updateStripScroll()
  }, 150)
}

function scrollActiveDayIntoView(behavior = 'smooth') {
  nextTick(() => {
    const strip = dayStripRef.value
    if (!strip) return
    const active = strip.querySelector('.day-pill.active') || strip.querySelector('.day-pill.today')
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior })
    updateStripScroll()
  })
}

function scrollDayStrip(direction) {
  const el = dayStripRef.value
  if (!el) return
  const step = Math.max(180, el.clientWidth * 0.85)
  el.scrollBy({ left: direction * step, behavior: 'smooth' })
}

function onStripPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const el = dayStripRef.value
  if (!el) return
  const pill = e.target.closest?.('.day-pill')
  stripDragState.value = {
    active: true,
    moved: false,
    startX: e.clientX,
    startScrollLeft: el.scrollLeft,
    targetIso: pill?.dataset?.iso || null,
    pointerId: e.pointerId,
  }
}

function onStripPointerMove(e) {
  if (!stripDragState.value.active || e.pointerId !== stripDragState.value.pointerId) return
  const el = dayStripRef.value
  if (!el) return
  const dx = e.clientX - stripDragState.value.startX
  if (!stripDragState.value.moved && Math.abs(dx) > 10) {
    stripDragState.value.moved = true
    stripDragState.value.targetIso = null
    el.setPointerCapture(e.pointerId)
  }
  if (!stripDragState.value.moved) return
  e.preventDefault()
  el.scrollLeft = stripDragState.value.startScrollLeft - dx
}

function onStripPointerUp(e) {
  if (!stripDragState.value.active || e.pointerId !== stripDragState.value.pointerId) return
  const el = dayStripRef.value
  const { moved, targetIso } = stripDragState.value
  stripDragState.value.active = false
  if (moved) el?.releasePointerCapture(e.pointerId)
  updateStripScroll()
  if (!moved && targetIso) selectDate(targetIso)
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

const stripDays = computed(() => {
  const items = []
  let cursor = new Date(todayDate)
  while (cursor <= maxBookDate.value) {
    const iso = toLocalYmd(cursor)
    if (!isClosedDay(iso)) {
      const tintColor = colorForDate(bookingStore.allNailOptions, iso)
      items.push({
        iso,
        day: cursor.getDate(),
        label: weekdayNames[cursor.getDay()],
        isToday: iso === toLocalYmd(todayDate),
        tintColor,
      })
    }
    cursor = addDays(cursor, 1)
  }
  return items
})

const slotBuildParams = computed(() => ({
  openHour: bookingStore.shopOpenHour,
  lastBookingHour: bookingStore.shopLastBookingHour,
  extras: extraHoursForDate.value,
  dayWindows: dayHoursForDate.value,
  blocks: blockedSlots.value,
  bookings: bookings.value,
  displayMode: bookingStore.bookingDisplayMode,
  slotHours: bookingStore.bookingSlotHours,
}))

const selectedDateLabel = computed(() => {
  const d = parseYmdLocal(selectedDate.value)
  return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
})
const monthLabel = computed(() => {
  const d = parseYmdLocal(selectedDate.value)
  return `${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
})
const pendingTimeLabel = computed(() => {
  const slot = pendingSlot.value
  if (!slot) return ''
  return `${slotLabel(slot)} น.`
})
const slotDurationLabel = computed(() => {
  if (pendingSlot.value) {
    return formatSlotDuration(pendingSlot.value, bookingStore.bookingSlotHours)
  }
  return `${bookingStore.bookingSlotHours} ชั่วโมง`
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

function occupiedSlotLabel(status) {
  if (status === 'awaiting_payment') return 'ไม่ว่าง/ยังไม่ชำระ'
  if (status === 'pending' || status === 'done') return 'ไม่ว่าง/ชำระแล้ว'
  return 'ไม่ว่าง'
}

function occupiedSlotStatusClass(status) {
  if (status === 'awaiting_payment') return 'status-awaiting'
  if (status === 'pending' || status === 'done') return 'status-paid'
  return ''
}

const canGoPrev = computed(() => stripScroll.value.left > 4)
const canGoNext = computed(() => (
  stripScroll.value.left + stripScroll.value.width < stripScroll.value.scrollWidth - 4
))

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
  scrollActiveDayIntoView()
}
function activeBookings() {
  return bookings.value.filter(b => b.status !== 'cancelled')
}
function bookingForSlot(slot) {
  const key = slotKey(slot)
  return activeBookings().find(
    (b) => slotKey(bookingRowToSlot(b, bookingStore.bookingSlotHours)) === key
  )
}

function canBook(slot) {
  if (usesCustomDayHours.value) {
    return canBookDayWindowSlot(slot, {
      blocks: blockedSlots.value,
      bookings: bookings.value,
    })
  }
  return canBookSlot(slot.startHour, slotBuildParams.value)
}

const visibleSlots = computed(() => {
  const params = slotBuildParams.value
  if (usesCustomDayHours.value) {
    return buildDayWindowSlots({
      dayWindows: dayHoursForDate.value,
      blocks: blockedSlots.value,
    })
  }
  return buildVisibleSlots(params)
    .map((h) => hourToSlot(h, params.slotHours))
})
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
      bookingStore.fetchDayHoursForDate(selectedDate.value),
    ])
    if (isClosedDay(beforeDate)) {
      await refreshBlocksAndEnsureSelection(true)
      if (!isClosedDay(selectedDate.value)) { await loadDate(); return }
      bookingStore.bookingsByDate[selectedDate.value] = []
      errorMessage.value = ui.get('ui_closed_day_error', 'ช่วงนี้ร้านปิดรับคิวทั้งวัน กรุณาเลือกวันอื่น')
    }
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'
  }
}

function bookingSettingsSnapshot() {
  return {
    shopOpenHour: bookingStore.shopOpenHour,
    shopLastBookingHour: bookingStore.shopLastBookingHour,
    bookingSlotHours: bookingStore.bookingSlotHours,
    advanceDays: bookingStore.advanceDays,
    bookUntilDate: bookingStore.bookUntilDate,
    bookingDisplayMode: bookingStore.bookingDisplayMode,
    unpaidAutoCancelEnabled: bookingStore.unpaidAutoCancelEnabled,
    unpaidExpireHours: bookingStore.unpaidExpireHours,
  }
}

function hasBookingSettingsChanged(before, after) {
  return (
    before.shopOpenHour !== after.shopOpenHour ||
    before.shopLastBookingHour !== after.shopLastBookingHour ||
    before.bookingSlotHours !== after.bookingSlotHours ||
    before.advanceDays !== after.advanceDays ||
    before.bookUntilDate !== after.bookUntilDate ||
    before.bookingDisplayMode !== after.bookingDisplayMode ||
    before.unpaidAutoCancelEnabled !== after.unpaidAutoCancelEnabled ||
    before.unpaidExpireHours !== after.unpaidExpireHours
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

async function ensureSlotStillAvailable(slot) {
  await Promise.all([
    refreshSlotData(),
    bookingStore.fetchDayHoursForDate(selectedDate.value),
  ])
  const key = slotKey(slot)
  const stillListed = visibleSlots.value.some((s) => slotKey(s) === key)
  const stillFree = canBook(slot) && !bookingForSlot(slot)
  if (!stillListed || !stillFree) {
    serviceError.value = ui.get('ui_slot_taken_error', 'เวลานี้เพิ่งถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น')
    return false
  }
  return true
}

async function onVisibilityChange() {
  if (document.hidden || busy.value) return
  const layoutRefreshed = await syncBookingSettings()
  if (!layoutRefreshed) await refreshSlotData()
}

function openBookSheet(slot) {
  if (!canBook(slot) || bookingForSlot(slot)) return
  pendingSlot.value = slot
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
  pendingSlot.value = null
}

async function goToServiceStep() {
  serviceError.value = ''
  const slot = pendingSlot.value
  if (!slot) return

  busy.value = true
  try {
    if (!(await ensureSlotStillAvailable(slot))) return
    if (!nailOptions.value.length) {
      serviceError.value = ui.get('ui_no_services_today', 'ไม่มีบริการให้เลือกในวันนี้')
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
  const slot = pendingSlot.value
  if (!slot) return

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
    if (!(await ensureSlotStillAvailable(slot))) return

    const booking = await bookingStore.bookSlot(
      selectedDate.value,
      slot,
      selectedOptionIds.value.map(String),
    )
    closeBookSheet()
    await Swal.fire({
      title: ui.get('ui_booking_success_title', 'จองแล้ว รอชำระเงิน'),
      text: ui.get('ui_booking_success_text', 'กรุณาโอนและส่งสลิปทาง LINE เพื่อรอแอดมินยืนยัน'),
      icon: 'success',
      confirmButtonText: ui.get('ui_booking_success_btn', 'ไปหน้าชำระเงิน'),
    })
    router.push({
      path: shopPath(`/payment/${booking.id}`),
      query: {
        date: selectedDate.value,
        start: String(slot.startHour),
        startMin: String(slot.startMinute ?? 0),
        end: String(slot.endHour),
        endMin: String(slot.endMinute ?? 0),
      },
    })
  } catch (error) {
    const msg = error?.response?.data?.error || 'จองคิวไม่สำเร็จ'
    await Swal.fire({ title: ui.get('ui_booking_fail_title', 'จองไม่สำเร็จ'), text: msg, icon: 'error' })
    if (error?.response?.status === 409) await loadDate()
  } finally {
    busy.value = false
  }
}

async function cancel(bookingId) {
  const result = await Swal.fire({
    title: ui.get('ui_cancel_confirm_title', 'ยืนยันการยกเลิก'),
    text: ui.get('ui_cancel_confirm_text', 'ต้องการยกเลิกคิวนี้ใช่ไหม'),
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก', cancelButtonText: 'ปิด',
  })
  if (!result.isConfirmed) return
  busy.value = true
  try {
    await bookingStore.cancelBooking(bookingId, selectedDate.value)
    await Swal.fire({ title: ui.get('ui_cancel_success_title', 'ยกเลิกสำเร็จ'), icon: 'success', timer: 1300, showConfirmButton: false })
  } catch (error) {
    await Swal.fire({ title: ui.get('ui_cancel_fail_title', 'ยกเลิกไม่สำเร็จ'), text: error?.response?.data?.error || 'เกิดข้อผิดพลาด', icon: 'error' })
  } finally {
    busy.value = false
  }
}

function selectDate(iso) {
  const picked = parseYmdLocal(iso)
  if (picked < todayDate || picked > maxBookDate.value || isClosedDay(iso)) return
  selectedDate.value = iso
  loadDate()
  scrollActiveDayIntoView()
}

function dayPillStyle(day) {
  if (!day.tintColor) return {}
  return dayTintStyle(day.tintColor, { selected: selectedDate.value === day.iso })
}

async function refreshBlocksAndEnsureSelection(ensureSelection = false) {
  const from = toLocalYmd(todayDate)
  const to = toLocalYmd(maxBookDate.value)
  await Promise.all([
    bookingStore.fetchBlocksRange(from, to),
    bookingStore.fetchExtraHoursRange(from, to),
  ])
  if (!ensureSelection) return

  const first = findFirstOpenDate(todayDate)
  if (!first) {
    errorMessage.value = ui.get('ui_no_open_days', 'ไม่มีวันเปิดรับคิวในช่วงที่เปิดจอง')
    return
  }
  const picked = parseYmdLocal(selectedDate.value)
  if (picked > maxBookDate.value || isClosedDay(selectedDate.value)) {
    selectedDate.value = first
    scrollActiveDayIntoView('auto')
  }
}

async function prevWeek() {
  if (!canGoPrev.value) return
  scrollDayStrip(-1)
}

async function nextWeek() {
  if (!canGoNext.value) return
  scrollDayStrip(1)
}

function displaySlotLabel(slot) {
  if (usesCustomDayHours.value) return slotLabel(slot)
  return formatSlotTimeLabel(slot.startHour, isSlots2hMode.value, bookingStore.bookingSlotHours)
}

function displayBookingLabel(booking) {
  return slotLabel(bookingRowToSlot(booking, bookingStore.bookingSlotHours))
}

function goToPayment(booking) {
  const slot = bookingRowToSlot(booking, bookingStore.bookingSlotHours)
  router.push({
    path: shopPath(`/payment/${booking.id}`),
    query: {
      date: selectedDate.value,
      start: String(slot.startHour),
      startMin: String(slot.startMinute ?? 0),
      end: String(slot.endHour),
      endMin: String(slot.endMinute ?? 0),
    },
  })
}

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
const canRedeemCoupon = canRedeem

const pointsBannerHtml = computed(() =>
  formatUiText(
    ui.get('ui_points_banner', 'เมื่อช่างทำเสร็จ คุณจะได้รับ <strong>+{points} แต้ม</strong>'),
    { points: (couponSettings.value.completionPoints ?? 10).toLocaleString('th-TH') }
  )
)

watch(unpaidCountdown.nowMs, () => {
  if (!bookingStore.unpaidAutoCancelEnabled || busy.value || expiryRefreshPending) return
  const hasExpired = activeBookings().some(
    (b) => b.status === 'awaiting_payment' && unpaidCountdown.isExpired(b.created_at)
  )
  if (!hasExpired) return
  expiryRefreshPending = true
  refreshSlotData().finally(() => {
    expiryRefreshPending = false
  })
})

onMounted(async () => {
  window.addEventListener('resize', scheduleStripMeasure)
  document.addEventListener('visibilitychange', onVisibilityChange)
  pollTimer = setInterval(pollCurrentDate, POLL_INTERVAL_MS)
  await bookingStore.fetchBookingSettings()
  await bookingStore.fetchAllNailOptions()
  await refreshBlocksAndEnsureSelection(true)
  await Promise.all([loadDate(), bookingStore.fetchMyBookings().catch(() => null), loadMyCoupons(), loadCouponSettings()])
  await nextTick()
  updateStripScroll()
  scrollActiveDayIntoView('auto')
})
onUnmounted(() => {
  window.removeEventListener('resize', scheduleStripMeasure)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearTimeout(stripResizeTimer)
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="app-page app-page--nav booking-page">

    <!-- ── HEADER ── -->
    <header class="hdr app-header">
      <div class="hdr-top">
        <BrandMark show-sparkle />
        <AccountMenuDrawer />
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
      <p v-if="canGoNext" class="date-nav-hint">
        {{ ui.get('ui_date_nav_hint', 'ลากเลื่อนหรือกด … เพื่อดูวันถัดไป') }}
      </p>

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
      <div
        ref="dayStripRef"
        class="day-strip"
        :class="{ 'is-dragging': stripDragState.active && stripDragState.moved }"
        @scroll="updateStripScroll"
        @pointerdown="onStripPointerDown"
        @pointermove="onStripPointerMove"
        @pointerup="onStripPointerUp"
        @pointercancel="onStripPointerUp"
      >
        <button
          v-for="day in stripDays"
          :key="day.iso"
          type="button"
          class="day-pill"
          :data-iso="day.iso"
          :class="{
            active: selectedDate === day.iso && !day.tintColor,
            today: day.isToday && selectedDate !== day.iso && !day.tintColor,
            'has-book': hasBookingOnDay(day.iso),
            'has-tint': Boolean(day.tintColor),
          }"
          :style="dayPillStyle(day)"
        >
          <span class="day-name">{{ day.label }}</span>
          <strong class="day-num">{{ day.day }}</strong>
          <span class="day-dot" aria-hidden="true"></span>
        </button>
      </div>

      <p v-if="stripDays.length === 0" class="strip-hint">
        {{ ui.get('ui_no_open_days', 'ไม่มีวันเปิดรับคิวในช่วงที่เปิดจอง') }}
      </p>
    </header>

    <!-- ── BODY ── -->
    <main class="body">
      <div class="date-heading">
        <span class="section-label">
          {{ selectedDateLabel }}<template v-if="requiredLocationLabel"> สถานที่ให้บริการ {{ requiredLocationLabel }}</template>
        </span>
      </div>

      <p v-if="usesCustomDayHours" class="custom-hours-note">
        <i class="ti ti-clock" aria-hidden="true"></i>
        วันนี้เปิดรับตามเวลาที่ตั้งเฉพาะวัน
      </p>

      <p v-if="errorMessage" class="msg error">
        <i class="ti ti-alert-circle" style="font-size:15px;vertical-align:-2px" aria-hidden="true"></i>
        {{ errorMessage }}
      </p>

      <!-- Slots -->
      <div v-if="visibleSlots.length === 0" class="empty-state">
        <i class="ti ti-calendar-off empty-icon" aria-hidden="true"></i>
        <p>วันนี้ไม่มีช่วงเวลาเปิดรับคิว</p>
      </div>

      <template v-else>
        <div v-for="slot in visibleSlots" :key="slotKey(slot)" class="slot-row">
          <span class="slot-time">{{ displaySlotLabel(slot) }}</span>

          <!-- ── Booked by me ── -->
          <div v-if="bookingForSlot(slot) && bookingForSlot(slot).is_mine" class="slot-card mine">
            <div class="slot-left">
              <span class="slot-range">{{ displayBookingLabel(bookingForSlot(slot)) }}</span>
              <span class="slot-status">นัดของคุณ</span>
              <span
                v-if="unpaidCountdown.countdownLabel(bookingForSlot(slot))"
                class="slot-countdown"
              >{{ unpaidCountdown.countdownLabel(bookingForSlot(slot)) }}</span>
            </div>
            <div class="slot-right">
              <span class="badge badge-mine">
                <i class="ti ti-check" style="font-size:11px" aria-hidden="true"></i> จองแล้ว
              </span>
              <button
                v-if="bookingForSlot(slot).status === 'awaiting_payment'"
                class="btn-cancel-slot"
                :disabled="busy"
                @click="cancel(bookingForSlot(slot).id)"
              >ยกเลิก</button>
              <button
                v-if="bookingForSlot(slot).status === 'awaiting_payment'"
                class="book-btn"
                :disabled="busy"
                @click="goToPayment(bookingForSlot(slot))"
              >ชำระเงิน</button>
            </div>
          </div>

          <!-- ── Booked by others ── -->
          <div v-else-if="bookingForSlot(slot)" class="slot-card busy">
            <div class="slot-left">
              <span class="slot-range strike">{{ displayBookingLabel(bookingForSlot(slot)) }}</span>
              <span class="slot-status" :class="occupiedSlotStatusClass(bookingForSlot(slot).status)">{{ occupiedSlotLabel(bookingForSlot(slot).status) }}</span>
              <span
                v-if="unpaidCountdown.countdownLabel(bookingForSlot(slot))"
                class="slot-countdown"
              >{{ unpaidCountdown.countdownLabel(bookingForSlot(slot)) }}</span>
            </div>
            <span class="badge badge-busy"><i class="ti ti-lock" aria-hidden="true"></i></span>
          </div>

          <!-- ── จองไม่ได้ (ทับคิว / ปิดช่วงเวลา / เลยเวลา) ── -->
          <div v-else-if="!canBook(slot)" class="slot-card busy">
            <div class="slot-left">
              <span class="slot-range strike">{{ displaySlotLabel(slot) }}</span>
              <span class="slot-status">ไม่ว่าง</span>
            </div>
          </div>

          <!-- ── ว่าง จองได้ ── -->
          <div v-else class="slot-card free" @click="openBookSheet(slot)">
            <div class="slot-left">
              <span class="slot-range">{{ displaySlotLabel(slot) }}</span>
              <span class="slot-status">ว่าง</span>
            </div>
            <button class="book-btn" :disabled="busy" @click.stop="openBookSheet(slot)">
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
                <span class="info-val">{{ slotDurationLabel }}</span>
              </div>
              <div v-if="requiredLocationLabel" class="info-row">
                <span class="info-label"><i class="ti ti-map-pin info-ic" aria-hidden="true"></i>สถานที่</span>
                <span class="info-val">{{ requiredLocationLabel }}</span>
              </div>
            </div>

            <div class="points-banner">
              <i class="ti ti-star points-ic" aria-hidden="true"></i>
              <span v-html="pointsBannerHtml"></span>
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
    <BottomNav active="bookings" />

  </div>
</template>

<style scoped>
.booking-page {
  padding-top: 0;
  padding-left: 0;
  padding-right: 0;
}

/* ── HEADER ── */
.hdr {
  padding-bottom: 0;
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
  font-size: var(--text-h3);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.3px;
  line-height: 1;
  white-space: nowrap;
}
.brand-accent { color: var(--color-primary); }
.brand-icon-sm { font-size: 16px; color: var(--color-primary); line-height: 1; }

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
  background: var(--color-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border);
  max-width: 100%;
}
.chip-star span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip-rose { background: var(--color-primary); color: var(--color-on-primary); flex-shrink: 0; }
.chip-slate { background: var(--color-surface); color: var(--color-text-secondary); border-color: var(--color-border); }

/* Date nav */
.date-nav {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.month-label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.nav-btn {
  width: var(--touch-min); height: var(--touch-min); border-radius: 10px;
  border: 1px solid var(--color-border); background: var(--color-surface-elevated);
  color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background var(--transition);
}
.nav-btn i { font-size: 16px; line-height: 1; }
.nav-btn:hover:not(:disabled) { background: var(--color-primary-light); }
.nav-btn:disabled { opacity: .35; cursor: not-allowed; }

.date-nav-hint {
  margin: -4px 0 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.4;
}

.date-nav-hint i {
  font-size: 12px;
  vertical-align: -1px;
}

/* Day strip */
.day-strip {
  display: flex;
  gap: 6px;
  padding-bottom: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  touch-action: pan-x;
  cursor: grab;
}
.day-strip.is-dragging {
  cursor: grabbing;
  user-select: none;
  scroll-snap-type: none;
}
.day-strip.is-dragging .day-pill {
  pointer-events: none;
}
.day-strip::-webkit-scrollbar {
  display: none;
}
.day-pill {
  flex: 0 0 clamp(42px, 12vw, 52px);
  scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  min-height: 58px; padding: 8px 0; border-radius: 12px;
  border: 1px solid var(--color-border); background: var(--color-surface-elevated);
  cursor: pointer; transition: all var(--transition); font-family: inherit;
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
.day-pill:hover { background: var(--color-primary-light); border-color: var(--color-primary-light); }
.day-pill.has-tint:hover {
  filter: brightness(0.97);
}
.day-pill.today:not(.active):not(.has-tint) { border-color: var(--color-primary); background: var(--color-primary-light); }
.day-pill.active:not(.has-tint) {
  background: var(--color-primary);
  border-color: var(--color-primary);
  transform: scale(1.02);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 28%, transparent);
}
.day-name { font-size: 10px; color: var(--color-text-muted); font-weight: 500; }
.day-num { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.day-pill.today:not(.active):not(.has-tint) .day-num { color: var(--color-primary); }
.day-pill.active:not(.has-tint) .day-name,
.day-pill.active:not(.has-tint) .day-num { color: var(--color-on-primary); }
.day-dot {
  width: 4px; height: 4px; border-radius: 50%; background: transparent;
}
.day-pill.has-book .day-dot { background: var(--color-primary); }
.day-pill.active:not(.has-tint) .day-dot { background: rgba(255,255,255,.5); }

.strip-hint { font-size: 12px; color: var(--color-text-muted); padding: 0 2px 12px; }

/* ── BODY ── */
.body { padding: 0 var(--page-padding-x); }
.date-heading {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0 10px;
}
.section-label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.custom-hours-note {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.08);
  color: #4338ca;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.msg {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 10px;
}
.msg.error { background: rgba(196, 92, 92, 0.08); color: var(--color-error); border: 1px solid rgba(196, 92, 92, 0.2); }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 48px 0; color: var(--color-text-muted); font-size: 14px;
}
.empty-icon { font-size: 36px; color: var(--color-text-muted); }

/* ── SLOTS ── */
.slot-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
}
.slot-time {
  font-size: 11px; font-weight: 500; color: var(--color-text-muted);
  width: 38px; flex-shrink: 0; text-align: right;
}
.slot-card {
  flex: 1; border-radius: var(--radius-card); border: 1px solid var(--color-border);
  background: var(--color-surface-elevated); padding: 12px 14px;
  display: flex; align-items: center; justify-content: space-between;
  min-height: 56px; transition: all var(--transition);
  box-shadow: var(--shadow-card);
}
.slot-card.free {
  cursor: pointer;
  background: var(--slot-free-bg);
  border-color: var(--slot-free-border);
}
.slot-card.free:hover { border-color: var(--color-primary); background: var(--color-primary-light); }
.slot-card.free.disabled { cursor: not-allowed; opacity: .5; }
.slot-card.mine { background: var(--slot-mine-bg); border-color: var(--slot-mine-border); }
.slot-card.busy { background: var(--slot-busy-bg); border-color: var(--color-border); }
.slot-card.continuation { background: var(--slot-busy-bg); border-color: var(--color-border); justify-content: center; min-height: 40px; }

.slot-left { display: flex; flex-direction: column; gap: 2px; }
.slot-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.slot-range { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
.slot-status { font-size: 11px; color: var(--color-text-muted); }
.slot-status.status-awaiting { color: var(--color-primary); font-weight: 500; }
.slot-status.status-paid { color: var(--color-text-secondary); }
.slot-countdown {
  font-size: var(--text-label);
  font-weight: 600;
  color: var(--color-warning);
  font-variant-numeric: tabular-nums;
}
.slot-card.mine .slot-countdown {
  color: var(--color-primary-dark);
}
.slot-card.mine .slot-range { color: var(--color-primary-dark); }
.slot-card.mine .slot-status { color: var(--color-primary); }
.slot-card.busy .slot-range,
.strike { text-decoration: line-through; color: var(--color-text-muted); }

.badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 99px;
}
.badge-mine { background: var(--color-primary-light); color: var(--color-primary-dark); border: 1px solid var(--color-primary); }
.badge-busy { font-size: 14px; color: var(--color-text-muted); }

.book-btn {
  padding: 7px 14px; border-radius: var(--radius-md); border: none;
  background: var(--color-primary); color: var(--color-on-primary); font-size: var(--text-caption); font-weight: 600;
  cursor: pointer; flex-shrink: 0; font-family: inherit; transition: background var(--transition), transform var(--transition);
  min-height: 36px;
}
.book-btn:hover:not(:disabled) { background: var(--color-primary-hover); }
.book-btn:active:not(:disabled) { transform: scale(0.97); }
.book-btn:disabled { opacity: .4; cursor: not-allowed; }

.btn-cancel-slot {
  padding: 7px 12px; border-radius: 10px;
  border: 1px solid var(--color-border); background: var(--color-surface-elevated);
  font-size: 10px; font-weight: 600; color: var(--color-text-secondary);
  cursor: pointer; flex-shrink: 0; font-family: inherit; transition: all var(--transition);
}
.btn-cancel-slot:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}
.btn-cancel-slot:disabled { opacity: .4; cursor: not-allowed; }

/* ── BOTTOM SHEET ── */
.overlay {
  position: fixed; inset: 0; background: rgba(45, 36, 36, 0.4);
  display: flex; align-items: flex-end; z-index: 50;
}
.sheet {
  background: var(--color-surface-elevated); width: 100%; max-width: 430px; margin: 0 auto;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0));
  box-shadow: var(--shadow-sheet);
}
.sheet-handle {
  width: 36px; height: 4px; background: var(--color-border);
  border-radius: 99px; margin: 0 auto 18px;
}
.sheet-title { font-size: var(--text-h3); font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; }
.sheet-sub { font-size: 13px; color: var(--color-text-muted); margin-bottom: 18px; }
.sheet-info {
  background: var(--color-surface); border-radius: 12px; padding: 14px; margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 8px;
  border: 1px solid var(--color-border);
}
.sheet-info-compact { margin-bottom: 12px; }
.info-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.info-label {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: var(--color-text-muted); flex-shrink: 0;
}
.info-ic { font-size: 14px; }
.info-val { font-size: 13px; font-weight: 500; color: var(--color-text-primary); text-align: right; }
.points-banner {
  display: flex; align-items: center; gap: 10px;
  background: var(--color-primary-light); border: 1px solid var(--color-primary);
  border-radius: 12px; padding: 12px 14px; margin-bottom: 20px;
  font-size: 13px; color: var(--color-text-primary);
}
.points-ic { font-size: 18px; color: var(--color-primary); flex-shrink: 0; }
.sheet-error {
  margin: -6px 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(196, 92, 92, 0.08);
  border: 1px solid rgba(196, 92, 92, 0.2);
  color: var(--color-error);
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
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
}
.option-card:hover { border-color: var(--color-primary-light); background: var(--color-primary-light); }
.option-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 14%, transparent);
}
.option-card.required {
  cursor: default;
}
.option-card.required:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
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
  border-color: var(--color-primary);
  background: var(--color-primary);
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
.option-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.option-required-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary-dark);
  background: var(--color-primary-light);
  vertical-align: middle;
}
.option-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.option-price {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  flex-shrink: 0;
}
.sheet-actions { display: flex; gap: 10px; }
.btn-cancel {
  flex: 1; padding: 14px; border-radius: 12px;
  border: 1px solid var(--color-border); background: var(--color-surface);
  font-size: 14px; font-weight: 500; color: var(--color-text-secondary);
  cursor: pointer; font-family: inherit;
  min-height: var(--btn-secondary-height);
}
.btn-confirm {
  flex: 1; padding: 14px; border-radius: 12px;
  border: none; background: var(--color-primary); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: opacity var(--transition);
  min-height: var(--btn-primary-height);
}
.btn-confirm i { font-size: 14px; }
.btn-confirm:hover:not(:disabled) { opacity: .88; }
.btn-confirm:disabled { opacity: .4; cursor: not-allowed; }

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity var(--transition); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active .sheet, .fade-leave-active .sheet { transition: transform var(--transition-sheet); }
.fade-enter-from .sheet { transform: translateY(100%); }
.fade-leave-to .sheet { transform: translateY(100%); }
</style>

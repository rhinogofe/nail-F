<script setup>
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { dismissBlockingOverlays, scheduleOverlayCleanup } from '../utils/dismissBlockingOverlays'
import { lockBodyScroll, releaseAllBodyScrollLocks, unlockBodyScroll } from '../utils/bodyScrollLock'
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
  buildDynamicTimelineSlots,
  isDynamicSlotAvailable,
  canBookSlot,
  canBookDayWindowSlot,
  getExtendedSlotBlockReason,
  computeEffectiveBookingSlot,
  slotTimeLabel as formatSlotTimeLabel,
  slotLabel,
  hourToSlot,
  slotKey,
  bookingRowToSlot,
  formatSlotDuration,
  sumOptionDurationMinutes,
  formatDurationMinutes,
} from '../utils/bookingSlots'
import { useUnpaidCountdown } from '../composables/useUnpaidCountdown'
import { useShopRoute } from '../composables/useShopRoute'
import { useUiSettingsStore } from '../stores/uiSettings'
import { formatUiText } from '../utils/formatUiText'
import BrandMark from '../components/BrandMark.vue'
import {
  buildBookableCategories,
  optionsForCategory,
  resolveLocationMapUrl,
  UNCategorized_CATEGORY_ID,
} from '../utils/bookingOptionsResponse'

const router = useRouter()
const route = useRoute()
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
const cancelInFlight = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const showModal = ref(false)
const pendingCancelId = ref(null)
const sheetStep = ref('confirm')
const pendingSlot = ref(null)
const selectedOptionIds = ref([])
const selectedCategoryId = ref('')
const serviceError = ref('')
const selectedServicesExpanded = ref(false)

const isSlots2hMode = computed(() => bookingStore.bookingDisplayMode === 'slots_2h')

const bookings = computed(() => bookingStore.bookingsByDate[selectedDate.value] || [])
const blockedSlots = computed(() => bookingStore.blocksByDate[selectedDate.value] || [])
const extraHoursForDate = computed(() => bookingStore.extraHoursByDate[selectedDate.value] || [])
const dayHoursForDate = computed(() => bookingStore.dayHoursByDate[selectedDate.value] || [])
const usesCustomDayHours = computed(() => dayHoursForDate.value.length > 0)
const nailOptions = computed(() => bookingStore.nailOptions || [])
const serviceCategories = computed(() => bookingStore.serviceCategories || [])
const bookableCategories = computed(() =>
  buildBookableCategories(serviceCategories.value, nailOptions.value)
)
const hasCategoryStep = computed(() => bookableCategories.value.length > 1)
const requiredOptions = computed(() => nailOptions.value.filter((opt) => opt.is_required))
const categoryOptions = computed(() => {
  if (!hasCategoryStep.value && !selectedCategoryId.value) {
    return nailOptions.value.filter((opt) => !opt.is_required)
  }
  if (!selectedCategoryId.value) return []
  return optionsForCategory(nailOptions.value, selectedCategoryId.value)
})
const selectedOptionalServices = computed(() => {
  const requiredIds = new Set(requiredOptions.value.map((opt) => opt.id))
  return nailOptions.value.filter(
    (opt) => selectedOptionIds.value.includes(opt.id) && !requiredIds.has(opt.id)
  )
})
const selectedServicesTotalPrice = computed(() => {
  const sum = selectedOptionalServices.value.reduce((acc, opt) => acc + (Number(opt.price) || 0), 0)
  return sum > 0 ? sum : null
})
const selectedServicesForDisplay = computed(() => {
  const ids = new Set(selectedOptionIds.value.map(String))
  return nailOptions.value.filter((opt) => ids.has(String(opt.id)))
})
const selectedServicesTotalMinutes = computed(() =>
  sumOptionDurationMinutes(nailOptions.value, selectedOptionIds.value)
)
const selectedServicesTotalDurationLabel = computed(() =>
  formatDurationMinutes(selectedServicesTotalMinutes.value)
)
const selectedServicesSummaryLine = computed(() => {
  const count = selectedServicesForDisplay.value.length
  const parts = [`${count} บริการ`, selectedServicesTotalDurationLabel.value]
  if (selectedServicesTotalPrice.value != null) {
    parts.push(`${selectedServicesTotalPrice.value.toLocaleString('th-TH')} บาท`)
  }
  return parts.join(' · ')
})
function categorySelectionCount(categoryId) {
  return selectedOptionalServices.value.filter((opt) => {
    const catId = opt.category_id || UNCategorized_CATEGORY_ID
    return catId === categoryId
  }).length
}
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
const stripDragState = ref({
  active: false,
  moved: false,
  startX: 0,
  startScrollLeft: 0,
  targetIso: null,
  pointerId: null,
})
const POLL_INTERVAL_MS = 45_000
let pollTimer = null
let stripResizeTimer = null
let submitInFlight = false

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
  resetStripDragState()
  try {
    if (el?.hasPointerCapture?.(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
  } catch {
    /* ignore */
  }
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
  extendByServices: bookingStore.extendBookingByServices,
}))

function dynamicSlotParams() {
  return {
    ...slotBuildParams.value,
    dayWindows: dayHoursForDate.value,
    allowPastClose: bookingStore.extendBookingPastClose,
  }
}

const selectedDateLabel = computed(() => {
  const d = parseYmdLocal(selectedDate.value)
  return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
})
const monthLabel = computed(() => {
  const d = parseYmdLocal(selectedDate.value)
  return `${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
})
const pendingTimeLabel = computed(() => {
  const slot = effectiveBookingSlot.value || pendingSlot.value
  if (!slot) return ''
  return `${slotLabel(slot)} น.`
})
const effectiveBookingSlot = computed(() => {
  const base = pendingSlot.value
  if (!base) return null
  return computeEffectiveBookingSlot(
    base,
    nailOptions.value,
    selectedOptionIds.value,
    bookingStore.bookingSlotHours,
    bookingStore.extendBookingByServices,
  )
})
const slotDurationLabel = computed(() => {
  const slot = effectiveBookingSlot.value || pendingSlot.value
  if (slot) {
    return formatSlotDuration(slot, bookingStore.bookingSlotHours)
  }
  return `${bookingStore.bookingSlotHours} ชั่วโมง`
})
const serviceDurationExtendHint = computed(() => {
  if (!bookingStore.extendBookingByServices || !pendingSlot.value) return ''
  const base = pendingSlot.value
  const effective = effectiveBookingSlot.value
  if (!effective || slotKey(base) === slotKey(effective)) return ''
  if (serviceExtendBlockReason.value) return ''
  const mins = sumOptionDurationMinutes(nailOptions.value, selectedOptionIds.value)
  const baseMins = bookingStore.bookingSlotHours * 60
  if (mins <= baseMins) return ''
  return `บริการรวม ${formatSlotDuration(effective, bookingStore.bookingSlotHours)} — ปรับเวลาจองเป็น ${slotLabel(effective)} น.`
})

function resolveExtendBlockMessage(reason) {
  if (reason === 'next_booking') {
    return ui.get(
      'ui_extend_blocked_next_booking',
      'เวลารวมบริการของท่านยาวกว่าเวลาคิวเนื่องจากมีคิวต่อถัดไปไม่สามารถขยายเวลาได้'
    )
  }
  if (reason === 'closing_time') {
    return ui.get(
      'ui_extend_blocked_closing',
      'เวลารวมบริการของท่านยาวกว่าเวลาคิวเนื่องจากชนเวลาปิดร้านไม่สามารถขยายเวลาได้'
    )
  }
  return ''
}

const serviceExtendBlockReason = computed(() => {
  if (!bookingStore.extendBookingByServices || !pendingSlot.value) return null
  if (!selectedOptionIds.value.length) return null
  const base = pendingSlot.value
  const extended = effectiveBookingSlot.value
  if (!extended) return null
  return getExtendedSlotBlockReason(base, extended, dynamicSlotParams())
})

const serviceExtendBlockMessage = computed(() =>
  resolveExtendBlockMessage(serviceExtendBlockReason.value)
)
const requiredLocationLabel = computed(() =>
  nailOptions.value
    .filter(opt => opt.is_required)
    .map(opt => opt.option_name)
    .join(', ')
)
const requiredLocationMapUrl = computed(() =>
  resolveLocationMapUrl(
    nailOptions.value.filter((opt) => opt.is_required).map((opt) => opt.option_name),
    bookingStore.serviceLocations
  )
)
const hasSelectedServices = computed(() => selectedOptionIds.value.length > 0)
const canSubmitBooking = computed(() => {
  const required = requiredOptions.value
  const requiredOk = !required.length || required.every((opt) => selectedOptionIds.value.includes(opt.id))
  if (!requiredOk) return false

  if (serviceExtendBlockReason.value) return false

  if (hasCategoryStep.value) {
    return selectedOptionalServices.value.length > 0
  }

  return hasSelectedServices.value
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

function formatOptionDuration(opt) {
  return formatDurationMinutes(opt?.duration_min)
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
  if (bookingStore.extendBookingByServices) {
    return isDynamicSlotAvailable(slot, dynamicSlotParams())
  }
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
  if (bookingStore.extendBookingByServices) {
    return buildDynamicTimelineSlots(dynamicSlotParams()).all
  }
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
    extendBookingByServices: bookingStore.extendBookingByServices,
    extendBookingPastClose: bookingStore.extendBookingPastClose,
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
    before.extendBookingByServices !== after.extendBookingByServices ||
    before.extendBookingPastClose !== after.extendBookingPastClose ||
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
    ui.fetch().catch(() => null),
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

async function ensureSlotStillAvailable(slot, optionIds = []) {
  await Promise.all([
    refreshSlotData(),
    bookingStore.fetchDayHoursForDate(selectedDate.value),
  ])

  if (bookingStore.extendBookingByServices) {
    const params = dynamicSlotParams()
    if (!isDynamicSlotAvailable(slot, params)) {
      serviceError.value = ui.get('ui_slot_taken_error', 'เวลานี้เพิ่งถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น')
      return false
    }
    if (optionIds.length) {
      const extended = computeEffectiveBookingSlot(
        slot,
        nailOptions.value,
        optionIds,
        bookingStore.bookingSlotHours,
        true,
      )
      const params = dynamicSlotParams()
      const reason = extended && getExtendedSlotBlockReason(slot, extended, params)
      if (reason) {
        serviceError.value = resolveExtendBlockMessage(reason)
        return false
      }
    }
    return true
  }

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
  if (document.hidden) return
  resetInteractionBlockers()
  if (busy.value) return
  window.setTimeout(() => {
    if (document.hidden || busy.value) return
    refreshSlotData().catch(() => null)
    void syncBookingSettings({ refreshLayout: false })
  }, 300)
}

function openBookSheet(slot) {
  if (!canBook(slot) || bookingForSlot(slot) || showModal.value) return
  pendingSlot.value = slot
  sheetStep.value = 'confirm'
  selectedOptionIds.value = []
  selectedCategoryId.value = ''
  serviceError.value = ''
  afterScrollSettled(() => {
    if (!pendingSlot.value) return
    showModal.value = true
  })
}

function closeBookSheet() {
  showModal.value = false
  sheetStep.value = 'confirm'
  selectedOptionIds.value = []
  selectedCategoryId.value = ''
  serviceError.value = ''
  selectedServicesExpanded.value = false
  pendingSlot.value = null
}

function resetStripDragState() {
  const el = dayStripRef.value
  const pointerId = stripDragState.value.pointerId
  stripDragState.value = {
    active: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
    targetIso: null,
    pointerId: null,
  }
  if (el && pointerId != null) {
    try {
      if (el.hasPointerCapture?.(pointerId)) {
        el.releasePointerCapture(pointerId)
      }
    } catch {
      /* ignore */
    }
  }
}

function resetInteractionBlockers() {
  closeBookSheet()
  pendingCancelId.value = null
  releaseAllBodyScrollLocks()
  busy.value = false
  cancelInFlight.value = null
  submitInFlight = false
  resetStripDragState()
  dismissBlockingOverlays()
  scheduleOverlayCleanup()
}

// iOS PWA misplaces fixed-position sheets while the page is mid-scroll, so the
// scroll has to finish before the sheet mounts.
function scrollPageToTop() {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function afterScrollSettled(callback) {
  scrollPageToTop()
  let attempts = 0
  const tick = () => {
    attempts += 1
    const offset = window.scrollY || document.documentElement.scrollTop || 0
    if (offset > 1 && attempts < 10) {
      scrollPageToTop()
      requestAnimationFrame(tick)
      return
    }
    callback()
  }
  requestAnimationFrame(tick)
}

function openCancelConfirm(bookingId) {
  if (cancelInFlight.value || pendingCancelId.value) return
  dismissBlockingOverlays()
  afterScrollSettled(() => {
    if (cancelInFlight.value || pendingCancelId.value) return
    pendingCancelId.value = bookingId
  })
}

function closeCancelConfirm() {
  pendingCancelId.value = null
}

async function confirmCancelBooking() {
  const bookingId = pendingCancelId.value
  if (!bookingId || cancelInFlight.value) return
  pendingCancelId.value = null
  cancelInFlight.value = bookingId
  try {
    await bookingStore.cancelBooking(bookingId, selectedDate.value)
    successMessage.value = ui.get('ui_cancel_success_title', 'ยกเลิกสำเร็จ')
    resetInteractionBlockers()
    window.setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || ui.get('ui_cancel_fail_title', 'ยกเลิกไม่สำเร็จ')
    dismissBlockingOverlays()
    scheduleOverlayCleanup()
  } finally {
    cancelInFlight.value = null
  }
}

function removeSelectedOption(optionId) {
  selectedOptionIds.value = selectedOptionIds.value.filter((id) => id !== optionId)
  serviceError.value = ''
  applyRequiredOptionDefaults()
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
    if (bookableCategories.value.length >= 1) {
      selectedCategoryId.value = bookableCategories.value[0].id
    } else {
      selectedCategoryId.value = ''
    }
    sheetStep.value = 'services'
  } finally {
    busy.value = false
  }
}

function selectBookingCategory(categoryId) {
  selectedCategoryId.value = categoryId
  serviceError.value = ''
}

function backFromServicesStep() {
  serviceError.value = ''
  selectedServicesExpanded.value = false
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

  if (hasCategoryStep.value) {
    if (!selectedOptionalServices.value.length) {
      serviceError.value = 'กรุณาเลือกบริการอย่างน้อย 1 รายการ'
      return
    }
  } else if (!selectedOptionIds.value.length) {
    serviceError.value = 'กรุณาเลือกบริการอย่างน้อย 1 รายการ'
    return
  }

  busy.value = true
  serviceError.value = ''
  submitInFlight = true
  try {
    if (!(await ensureSlotStillAvailable(slot, selectedOptionIds.value))) return

    const submitSlot = effectiveBookingSlot.value || slot
    const booking = await bookingStore.bookSlot(
      selectedDate.value,
      submitSlot,
      selectedOptionIds.value.map(String),
    )
    closeBookSheet()
    dismissBlockingOverlays()
    busy.value = false
    router.push({
      path: shopPath(`/payment/${booking.id}`),
      query: {
        date: selectedDate.value,
        start: String(submitSlot.startHour),
        startMin: String(submitSlot.startMinute ?? 0),
        end: String(submitSlot.endHour),
        endMin: String(submitSlot.endMinute ?? 0),
        booked: '1',
      },
    })
    refreshSlotData().catch(() => null)
  } catch (error) {
    const msg = error?.response?.data?.error || 'จองคิวไม่สำเร็จ'
    await Swal.fire({ title: ui.get('ui_booking_fail_title', 'จองไม่สำเร็จ'), text: msg, icon: 'error' })
    if (error?.response?.status === 409) await loadDate()
  } finally {
    submitInFlight = false
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
  if (bookingStore.extendBookingByServices || usesCustomDayHours.value) return slotLabel(slot)
  return formatSlotTimeLabel(slot.startHour, isSlots2hMode.value, bookingStore.bookingSlotHours)
}

function displayBookingLabel(booking) {
  return slotLabel(bookingRowToSlot(booking, bookingStore.bookingSlotHours))
}

function goToPayment(booking) {
  resetInteractionBlockers()
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

const anySheetOpen = computed(() => showModal.value || Boolean(pendingCancelId.value))

watch(anySheetOpen, (open, wasOpen) => {
  if (open === wasOpen) return
  if (open) lockBodyScroll()
  else unlockBodyScroll()
})

onActivated(() => {
  resetInteractionBlockers()
  scrollPageToTop()
})

watch(
  () => route.fullPath,
  () => {
    resetInteractionBlockers()
    scrollPageToTop()
  }
)

onMounted(() => {
  resetInteractionBlockers()
  scrollPageToTop()
  window.addEventListener('resize', scheduleStripMeasure)
  document.addEventListener('visibilitychange', onVisibilityChange)
  pollTimer = setInterval(pollCurrentDate, POLL_INTERVAL_MS)
  void bootstrapBookingPage()
})

async function bootstrapBookingPage() {
  try {
    await loadDate()
    await nextTick()
    updateStripScroll()
    scrollActiveDayIntoView('auto')
  } catch {
    /* show slots on next poll */
  }

  void Promise.all([
    bookingStore.fetchBookingSettings().catch(() => null),
    bookingStore.fetchAllNailOptions().catch(() => null),
    bookingStore.fetchMyBookings().catch(() => null),
    loadMyCoupons().catch(() => null),
    loadCouponSettings().catch(() => null),
  ]).then(() => refreshBlocksAndEnsureSelection(true).catch(() => null))
}

onUnmounted(() => {
  submitInFlight = false
  busy.value = false
  releaseAllBodyScrollLocks()
  resetInteractionBlockers()
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
        <div class="hdr-brand-wrap">
          <BrandMark show-sparkle />
        </div>
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
        <a
          v-if="requiredLocationMapUrl"
          :href="requiredLocationMapUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="map-link-btn"
        >
          <i class="ti ti-map-pin" aria-hidden="true"></i>
          ดูแผนที่
        </a>
      </div>

      <p v-if="usesCustomDayHours" class="custom-hours-note">
        <i class="ti ti-clock" aria-hidden="true"></i>
        วันนี้เปิดรับตามเวลาที่ตั้งเฉพาะวัน
      </p>

      <p v-if="errorMessage" class="msg error">
        <i class="ti ti-alert-circle" style="font-size:15px;vertical-align:-2px" aria-hidden="true"></i>
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="msg success">
        <i class="ti ti-check" style="font-size:15px;vertical-align:-2px" aria-hidden="true"></i>
        {{ successMessage }}
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
                type="button"
                class="btn-cancel-slot"
                :disabled="cancelInFlight === bookingForSlot(slot).id"
                @click.stop="openCancelConfirm(bookingForSlot(slot).id)"
                @pointerup.stop="openCancelConfirm(bookingForSlot(slot).id)"
              >ยกเลิก</button>
              <button
                v-if="bookingForSlot(slot).status === 'awaiting_payment'"
                type="button"
                class="book-btn"
                @click.stop="goToPayment(bookingForSlot(slot))"
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
    <Teleport to="body">
    <Transition name="fade">
      <div v-if="showModal" class="overlay" @click.self="closeBookSheet">
        <div class="sheet" :class="{ 'sheet-services': sheetStep === 'services' }" role="dialog" aria-modal="true">
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
                <span class="info-val info-val-with-action">
                  {{ requiredLocationLabel }}
                  <a
                    v-if="requiredLocationMapUrl"
                    :href="requiredLocationMapUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="map-link-btn map-link-btn--inline"
                  >
                    <i class="ti ti-map-pin" aria-hidden="true"></i>
                    ดูแผนที่
                  </a>
                </span>
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
            <div class="sheet-services-layout">
              <div class="sheet-header">
                <h3 class="sheet-title">เลือกบริการ</h3>
                <p v-if="hasCategoryStep" class="sheet-sub">เลื่อนหมวดซ้าย–ขวา แล้วเลือกบริการได้หลายหมวด</p>
                <p v-else-if="requiredLocationLabel" class="sheet-sub sheet-sub-with-map">
                  <span>สถานที่ให้บริการ {{ requiredLocationLabel }}</span>
                  <a
                    v-if="requiredLocationMapUrl"
                    :href="requiredLocationMapUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="map-link-btn map-link-btn--inline"
                  >
                    <i class="ti ti-map-pin" aria-hidden="true"></i>
                    ดูแผนที่
                  </a>
                </p>
                <p v-else class="sheet-sub">เลือกบริการสำหรับคิวนี้</p>

                <div class="sheet-info sheet-info-compact">
                  <div class="info-row">
                    <span class="info-label"><i class="ti ti-calendar info-ic" aria-hidden="true"></i>วันที่</span>
                    <span class="info-val">{{ selectedDateLabel }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label"><i class="ti ti-clock info-ic" aria-hidden="true"></i>เวลา</span>
                    <span class="info-val">{{ pendingTimeLabel }}</span>
                  </div>
                  <div v-if="serviceDurationExtendHint" class="info-row">
                    <span class="info-label"><i class="ti ti-hourglass info-ic" aria-hidden="true"></i>ระยะเวลา</span>
                    <span class="info-val">{{ serviceDurationExtendHint }}</span>
                  </div>
                </div>
              </div>

              <div class="sheet-body">
                <div v-if="hasCategoryStep" class="category-strip-wrap">
                  <div class="category-strip">
                    <button
                      v-for="cat in bookableCategories"
                      :key="cat.id"
                      type="button"
                      class="category-pill"
                      :class="{
                        active: selectedCategoryId === cat.id,
                        picked: categorySelectionCount(cat.id) > 0,
                      }"
                      @click="selectBookingCategory(cat.id)"
                    >
                      {{ cat.name }}
                      <span v-if="categorySelectionCount(cat.id)" class="category-pill-count">
                        {{ categorySelectionCount(cat.id) }}
                      </span>
                    </button>
                  </div>
                </div>

                <div class="option-list">
                  <label
                    v-for="opt in requiredOptions"
                    :key="`req-${opt.id}`"
                    class="option-card selected required"
                  >
                    <input
                      v-model="selectedOptionIds"
                      type="checkbox"
                      class="option-input"
                      :value="opt.id"
                      disabled
                    />
                    <span class="option-check" aria-hidden="true">
                      <i class="ti ti-check"></i>
                    </span>
                    <span class="option-body">
                      <span class="option-name">
                        {{ opt.option_name }}
                        <span class="option-required-tag">บังคับ</span>
                      </span>
                      <span v-if="opt.description" class="option-desc">{{ opt.description }}</span>
                    </span>
                    <span class="option-meta">
                      <span v-if="Number(opt.duration_min) > 0" class="option-duration">{{ formatOptionDuration(opt) }}</span>
                    </span>
                  </label>

                  <label
                    v-for="opt in categoryOptions"
                    :key="opt.id"
                    class="option-card"
                    :class="{ selected: selectedOptionIds.includes(opt.id) }"
                  >
                    <input
                      v-model="selectedOptionIds"
                      type="checkbox"
                      class="option-input"
                      :value="opt.id"
                      @change="serviceError = ''"
                    />
                    <span class="option-check" aria-hidden="true">
                      <i class="ti ti-check"></i>
                    </span>
                    <span class="option-body">
                      <span class="option-name">{{ opt.option_name }}</span>
                      <span v-if="opt.description" class="option-desc">{{ opt.description }}</span>
                    </span>
                    <span class="option-meta">
                      <span v-if="Number(opt.duration_min) > 0" class="option-duration">{{ formatOptionDuration(opt) }}</span>
                      <span v-if="Number(opt.price) > 0" class="option-price">
                        {{ Number(opt.price).toLocaleString('th-TH') }} บ.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div class="sheet-footer">
                <p v-if="serviceExtendBlockMessage" class="sheet-warn sheet-warn-footer" role="alert">
                  <i class="ti ti-alert-triangle" aria-hidden="true"></i>
                  {{ serviceExtendBlockMessage }}
                </p>

                <p v-if="serviceError" class="sheet-error sheet-error-footer">{{ serviceError }}</p>

                <div v-if="selectedServicesForDisplay.length" class="sheet-selected-summary">
                  <button
                    type="button"
                    class="selected-summary-toggle"
                    :aria-expanded="selectedServicesExpanded"
                    @click="selectedServicesExpanded = !selectedServicesExpanded"
                  >
                    <span class="info-label">
                      <i class="ti ti-list-check info-ic" aria-hidden="true"></i>
                      บริการที่เลือก
                    </span>
                    <span class="selected-summary-line">{{ selectedServicesSummaryLine }}</span>
                    <i
                      class="ti selected-summary-chevron"
                      :class="selectedServicesExpanded ? 'ti-chevron-down' : 'ti-chevron-up'"
                      aria-hidden="true"
                    ></i>
                  </button>
                  <ul v-if="selectedServicesExpanded" class="selected-services-items selected-services-items-footer">
                    <li
                      v-for="opt in selectedServicesForDisplay"
                      :key="`picked-${opt.id}`"
                      class="selected-service-item"
                    >
                      <span class="selected-service-name">{{ opt.option_name }}</span>
                      <span v-if="Number(opt.duration_min) > 0" class="selected-service-duration">{{ formatOptionDuration(opt) }}</span>
                      <span v-if="Number(opt.price) > 0" class="selected-service-price">
                        {{ Number(opt.price).toLocaleString('th-TH') }} บ.
                      </span>
                      <button
                        v-if="!opt.is_required"
                        type="button"
                        class="selected-service-remove"
                        aria-label="ลบรายการ"
                        @click="removeSelectedOption(opt.id)"
                      >
                        <i class="ti ti-x" aria-hidden="true"></i>
                      </button>
                    </li>
                  </ul>
                </div>

                <div class="sheet-actions">
                  <button type="button" class="btn-cancel" :disabled="busy" @click="backFromServicesStep">ย้อนกลับ</button>
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
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
    </Teleport>

    <!-- ── CANCEL CONFIRM (iOS-safe, no SweetAlert) ── -->
    <Teleport to="body">
    <Transition name="fade">
      <div v-if="pendingCancelId" class="overlay cancel-overlay" @click.self="closeCancelConfirm">
        <div class="sheet cancel-sheet" role="dialog" aria-modal="true" aria-labelledby="cancel-sheet-title">
          <div class="sheet-handle"></div>
          <h3 id="cancel-sheet-title" class="sheet-title">{{ ui.get('ui_cancel_confirm_title', 'ยืนยันการยกเลิก') }}</h3>
          <p class="sheet-sub">{{ ui.get('ui_cancel_confirm_text', 'ต้องการยกเลิกคิวนี้ใช่ไหม') }}</p>
          <div class="sheet-actions">
            <button type="button" class="btn-cancel" @click="closeCancelConfirm">ปิด</button>
            <button
              type="button"
              class="btn-confirm btn-confirm-danger"
              :disabled="cancelInFlight === pendingCancelId"
              @click="confirmCancelBooking"
            >
              ยืนยันยกเลิก
            </button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>

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
  min-width: 0;
}
.hdr-brand-wrap {
  flex: 1 1 0;
  min-width: 0;
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
.map-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-light) 40%, white);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.map-link-btn--inline { margin-left: 8px; padding: 4px 8px; font-size: 11px; }
.info-val-with-action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 4px;
}
.sheet-sub-with-map {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
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
.msg.success { background: rgba(34, 120, 80, 0.08); color: #227850; border: 1px solid rgba(34, 120, 80, 0.2); }

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
.slot-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; position: relative; z-index: 2; }
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
  position: relative; z-index: 2; touch-action: manipulation;
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
  height: 100dvh;
  overscroll-behavior: contain;
}
.cancel-overlay { z-index: 60; }
.cancel-sheet { padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
.btn-confirm-danger {
  background: #b45309;
}
.btn-confirm-danger:hover:not(:disabled) { opacity: .9; }
.sheet {
  background: var(--color-surface-elevated); width: 100%; max-width: 430px; margin: 0 auto;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0px));
  box-shadow: var(--shadow-sheet);
  max-height: 88dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.sheet.sheet-services {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
}
.sheet-services-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.sheet-header {
  flex-shrink: 0;
}
.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding-bottom: 4px;
}
.sheet-footer {
  flex-shrink: 0;
  margin: 0 -20px;
  padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sheet-warn-footer,
.sheet-error-footer {
  margin: 0;
}
.sheet-selected-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.selected-summary-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 12%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-light) 45%, white);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.selected-summary-toggle .info-label {
  flex-shrink: 0;
}
.selected-summary-line {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary-dark);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-summary-chevron {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--color-text-muted);
}
.selected-services-items-footer {
  max-height: min(28vh, 160px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.sheet-services .option-list {
  max-height: none;
  overflow-y: visible;
  margin-bottom: 0;
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
.info-row-stack {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed var(--color-border);
}
.selected-services-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.selected-service-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-primary-light) 50%, white);
  border: 1px solid color-mix(in srgb, var(--color-primary) 15%, var(--color-border));
}
.selected-service-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.selected-service-duration {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary-dark);
  white-space: nowrap;
}
.selected-service-price {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.selected-service-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.selected-service-remove:hover {
  background: rgba(196, 92, 92, 0.12);
  color: var(--color-error);
}
.selected-services-total {
  align-self: flex-end;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary-dark);
}
.services-duration-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-primary-light) 45%, white);
  border: 1px solid color-mix(in srgb, var(--color-primary) 12%, var(--color-border));
}
.services-duration-summary strong {
  color: var(--color-primary-dark);
}
.option-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.option-duration {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.category-strip-wrap {
  margin-bottom: 12px;
}
.category-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 6px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.category-strip::-webkit-scrollbar { display: none; }
.category-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), color var(--transition);
}
.category-pill:hover {
  border-color: var(--color-primary-light);
  background: var(--color-primary-light);
}
.category-pill.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}
.category-pill.picked:not(.active) {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-light) 65%, white);
}
.category-pill-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
.category-pill:not(.active) .category-pill-count {
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}
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
.sheet-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(217, 119, 6, 0.08);
  border: 1px solid rgba(217, 119, 6, 0.22);
  color: #92400e;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
}
.sheet-warn i {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
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
.fade-leave-active.overlay { pointer-events: none; }
.fade-enter-active .sheet, .fade-leave-active .sheet { transition: transform var(--transition-sheet); }
.fade-enter-from .sheet { transform: translateY(100%); }
.fade-leave-to .sheet { transform: translateY(100%); }
</style>

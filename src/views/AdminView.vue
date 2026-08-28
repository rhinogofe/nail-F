<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useShopRoute } from '../composables/useShopRoute'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import { useShopStore } from '../stores/shop'
import Swal from 'sweetalert2'
import { colorForDate, dayTintStyle, isValidHexColor, optionVisibleOnDate, optionBookableOnDate } from '../utils/nailOptionHelpers'
import AccountMenuDrawer from '../components/AccountMenuDrawer.vue'
import BrandMark from '../components/BrandMark.vue'
import AdminManualPanel from '../components/AdminManualPanel.vue'
import AdminRenewalPanel from '../components/AdminRenewalPanel.vue'
import AdminShopFeaturesPanel from '../components/AdminShopFeaturesPanel.vue'
import AdminBookingPaymentSlips from '../components/AdminBookingPaymentSlips.vue'
import AdminSwitch from '../components/AdminSwitch.vue'
import { usePushNotifications } from '../composables/usePushNotifications'
import { PUSH_DEVICE_STATUS_EVENT } from '../utils/pushNotifications'
import { isFirebaseConfigured } from '../utils/firebaseConfig'

/** Above teleported admin modals (.booking-edit-backdrop z-index 2000) */
const adminSwal = Swal.mixin({
  customClass: {
    container: 'swal-over-app-modal',
  },
})
import { buildBookingSlotSelectOptions, slotTimeLabel, normalizeShopOpenHour, normalizeShopLastBookingHour, normalizeBookingSlotHours, normalizeBookingMinGapMinutes, resolveEffectiveMinGapMinutes, bookingEndHour, formatHmLabel, formatLastBookingOptionLabel, availableStartHoursForDay, availableStartMinutesForHour, maxEndMinutesForDayHourStart, maxEndMinutesForDayHourEdit, toMinutesFromHm, bookingRowToSlot, slotLabel, slotKey, parseSlotKey, formatDurationMinutes, sumOptionDurationMinutes, applyServiceDurationToSlot } from '../utils/bookingSlots'
import { clipThumbnailSrc } from '../utils/clipThumbnail'
import { UI_FIELD_GROUPS } from '../constants/uiSettingsFields'
import { imageUrlHint } from '../utils/imageUrl'
import { resolveUiImageUrl } from '../utils/resolveUiImageUrl'
import { compressImage } from '../utils/compressChatImage'
import { useUiSettingsStore } from '../stores/uiSettings'
import { useShopFeaturesStore } from '../stores/shopFeatures'
import {
  normalizeBookingOptionsResponse,
  buildBookableCategories,
  optionsForCategory,
  UNCategorized_CATEGORY_ID,
} from '../utils/bookingOptionsResponse'
import { useShopRealtime } from '../composables/useShopRealtime'

const router = useRouter()
const { shopPath, shopSlug } = useShopRoute()
const auth = useAuthStore()
const shopStore = useShopStore()
const uiSettingsStore = useUiSettingsStore()
const shopFeaturesStore = useShopFeaturesStore()
const accountMenuRef = ref(null)
const {
  enabled: pushEnabled,
  configured: pushConfigured,
  needsIosInstall,
  refreshStatus: refreshPushStatus,
} = usePushNotifications()

const showPushOffBanner = computed(() => {
  if (pushEnabled.value) return false
  if (pushConfigured.value) return true
  // iOS Safari (ยังไม่ Add to Home) รายงาน supported=false แต่ยังควรเตือนให้ตั้งค่า
  return needsIosInstall.value && isFirebaseConfigured()
})

function openAccountMenuForPushHelp() {
  accountMenuRef.value?.open?.()
}

function onPushDeviceStatusChanged() {
  void refreshPushStatus()
}

async function confirmAdminSave(title, message) {
  const opts = {
    title,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก',
  }
  if (typeof message === 'string' && message.includes('<')) {
    opts.html = message
  } else {
    opts.text = message || 'บันทึกการเปลี่ยนแปลงนี้ใช่ไหม'
  }
  const result = await adminSwal.fire(opts)
  return result.isConfirmed
}

function scrollToAdminSection(sectionId, focusSelector) {
  const settingsKey = settingsSectionById[sectionId]
  if (settingsKey) {
    activeTab.value = 'settings'
    activeSettingsSection.value = settingsKey
    if (!isMobile.value) settingsNavOpen.value = true
    focusAdminSectionEl(sectionId, focusSelector)
    return
  }
  const blocksKey = blocksSectionById[sectionId]
  if (blocksKey) {
    activeTab.value = 'blocks'
    activeBlocksSection.value = blocksKey
    if (blocksKey !== 'day-hours') closeDayHoursDate()
    closeBlockDay()
    if (!isMobile.value) blocksNavOpen.value = true
    focusAdminSectionEl(sectionId, focusSelector)
    return
  }
  nextTick(() => {
    const section = document.getElementById(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (focusSelector) {
      const input = section.querySelector(focusSelector)
      input?.focus({ preventScroll: true })
    }
  })
}

function focusAdminSectionEl(sectionId, focusSelector) {
  nextTick(() => {
    const section = document.getElementById(sectionId)
    if (!section) return
    if (focusSelector) {
      section.querySelector(focusSelector)?.focus({ preventScroll: true })
    }
  })
}

function focusAdminModal(modalId, focusSelector) {
  nextTick(() => {
    requestAnimationFrame(() => {
      const modal = document.getElementById(modalId)
      modal?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (focusSelector) {
        const el = modal?.querySelector(focusSelector)
        el?.focus({ preventScroll: true })
      }
    })
  })
}

function todayYmd() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
function todayYm() {
  return todayYmd().slice(0, 7)
}

function buildCalendarWeeks(monthYm) {
  const [y, m] = monthYm.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const startPad = new Date(y, m - 1, 1).getDay()
  const weeks = []
  let week = Array.from({ length: startPad }, () => null)

  for (let day = 1; day <= lastDay; day++) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    week.push({ day, iso, isToday: iso === todayYmd() })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

const date = ref(todayYmd())
const status = ref('')
const bookings = ref([])
const bookingMonth = ref(todayYm())
const selectedBookingDate = ref('')
const bookingDaySummary = ref({})
const bookingMonthPaidTotal = ref(0)
const bookingMonthUnpaidTotal = ref(0)
const bookingMonthCancelledTotal = ref(0)
const revenueMonth = ref(todayYm())
const revenueDaySummary = ref({})
const revenueMonthTotal = ref(0)
const revenueMonthDepositTotal = ref(0)
const revenueMonthDoneCount = ref(0)
const revenuePrevMonthDepositTotal = ref(0)
const revenuePrevMonthTotal = ref(0)
const revenueDepositChangePct = ref(null)
const revenueTotalChangePct = ref(null)
const revenuePrevMonthLabel = ref('')
const revenueDepositRate = ref(300)
const revenueLoading = ref(false)
const blockMonth = ref(todayYm())
const selectedBlockDate = ref('')
const blocks = ref([])
const extraHours = ref([])
const extraStart = ref(19)
const extraEnd = ref(21)
const extraNote = ref('')
const blockDate = ref(todayYmd())
const blockType = ref('partial')
const blockStart = ref(10)
const blockEnd = ref(15)
const blockNote = ref('')
const bulkBlockType = ref('partial')
const bulkBlockStart = ref(10)
const bulkBlockEnd = ref(15)
const bulkBlockNote = ref('')
const bulkStartDate = ref(todayYmd())
const bulkDays = ref(7)
const depositAmount = ref(300)
const registerShopPin = ref('')
const registerShopPinConfigured = ref(false)
const couponDiscountPercent = ref(20)
const couponRequiredPoints = ref(100)
const couponCompletionPoints = ref(10)
const linePushEnabled = ref(false)
const lineCanEditEnabled = ref(false)
const linePushToId = ref('')
const lineChannelToken = ref('')
const lineChannelSecret = ref('')

const lineBranchShops = computed(() =>
  allShops.value.filter((shop) => shop.slug !== 'default')
)
const lineTokenConfigured = ref(false)
const lineTokenMasked = ref('')
const lineSecretConfigured = ref(false)
const lineSecretMasked = ref('')
const lineCentralBotEnabled = ref(false)
const lineUsesOwnBot = ref(false)
const lineUseOwnBot = ref(false)
const lineCanEditUseOwnBot = ref(false)
const lineWebhookPath = ref('/api/line/webhook')
const lineBranchToggling = ref('')
const chatNotifyNewBookingEnabled = ref(true)
const chatNotifyUpcomingAdminEnabled = ref(true)
const chatNotifyUpcomingCustomerEnabled = ref(true)
const chatNotifyUpcomingMinutes = ref(30)
const chatNotifyCancelAdminEnabled = ref(true)
const chatNotifyCancelCustomerEnabled = ref(true)
const chatNotifyPaidAdminEnabled = ref(false)
const chatNotifyPaidCustomerEnabled = ref(true)
const chatNotifySlipAdminEnabled = ref(true)
const lineEffectiveUsesOwnBot = computed(() =>
  lineUsesOwnBot.value || (lineCanEditUseOwnBot.value && lineUseOwnBot.value)
)
const lineWebhookUrlHint = computed(() => {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  if (lineEffectiveUsesOwnBot.value && shopSlug.value && shopSlug.value !== 'default') {
    return `${base}/api/line/webhook/${shopSlug.value}`
  }
  return `${base}${lineWebhookPath.value}`
})
const isSuperAdmin = computed(() => auth.isSuperAdmin)
const canManageShopAdmins = computed(() => isSuperAdmin.value || shopSlug.value !== 'default')
const staffAddBtnLabel = computed(() => uiSettingsStore.get('ui_admin_add_staff_btn', 'เพิ่มช่าง'))
const unpaidAutoCancelEnabled = ref(true)
const unpaidExpireHours = ref(24)
// Auto-saving the enable switch must not persist an unsaved edit in the hours
// field, so keep the last value the server actually confirmed.
const unpaidExpireHoursSaved = ref(24)
const settingToggleSaving = ref('')
const useCouponCode = ref('')
const nailOptions = ref([])
const nailOptionsLoaded = ref(false)
const serviceMonth = ref(todayYm())
const selectedServiceDate = ref('')
const showEveryDayForm = ref(false)
const serviceWeekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const serviceThMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const optionColorPresets = [
  { label: 'Rose Gold', value: '#C4847A' },
  { label: 'เขียว', value: '#5B8C6A' },
  { label: 'ฟ้าตุ่น', value: '#6B8FA3' },
  { label: 'ทองอ่อน', value: '#D4AF7A' },
]
const serviceLocations = ref([])
const serviceCategories = ref([])
const showCategoryPanel = ref(false)
const categoryForm = ref({
  id: null,
  name: '',
  description: '',
  is_active: true,
  sort_order: 0,
})
const showcaseClips = ref([])
const showcaseThumbFailed = ref(new Set())
const clipForm = ref({
  id: null,
  tiktok_url: '',
  title: '',
  is_active: true,
})
const locationForm = ref({
  id: null,
  name: '',
  color: '#C4847A',
  description: '',
  map_url: '',
  is_active: true,
  sort_order: 0,
})
const optionForm = ref({
  id: null,
  option_name: '',
  description: '',
  price: 0,
  duration_min: 60,
  is_active: true,
  is_required: false,
  color: '#C4847A',
  show_from_date: '',
  show_to_date: '',
  category_id: '',
})
const optionFormUseColor = ref(false)
const loading = ref(false)
const message = ref('')
const errorMessage = ref('')
const activeTab = ref('bookings')

const bookingEditOpen = ref(false)
const bookingEditItem = ref(null)
const bookingEditTotal = ref('')
const bookingEditOptions = ref([])
const bookingEditSelectedIds = ref([])
const bookingEditLoading = ref(false)
const bookingEditSaving = ref(false)
const bookingEditError = ref('')
const bookingEditUserId = ref('')
const bookingEditUserQuery = ref('')
const bookingEditOriginalSlotKey = ref('')
const bookingEditOriginalDate = ref('')
const bookingEditMoveToSlotKey = ref('')
const bookingEditDate = ref('')
const bookingRestoreStatus = ref('')
const bookingRestoreConflictHint = ref('')
const bookingEditExtraHours = ref([])
const bookingEditDayHours = ref([])
const bookingEditSlotBookings = ref([])
const bookingEditSlotBlocks = ref([])

const bookingAddOpen = ref(false)
const bookingAddUserId = ref('')
const bookingAddUserQuery = ref('')
const bookingAddSlotKey = ref('')
const bookingAddStatus = ref('pending')
const bookingAddTotal = ref('')
const bookingAddOptions = ref([])
const bookingAddSelectedIds = ref([])
const bookingAddLoading = ref(false)
const bookingAddSaving = ref(false)
const bookingAddError = ref('')
const bookingAddExtraHours = ref([])
const bookingAddDayHours = ref([])
const bookingAddSlotBookings = ref([])
const bookingAddSlotBlocks = ref([])
const bookingAddCategories = ref([])
const bookingAddSelectedCategoryId = ref('')
const bookingEditCategories = ref([])
const bookingEditSelectedCategoryId = ref('')

function bookableOptionsOnDate(options, dateIso) {
  return options.filter((opt) => optionBookableOnDate(opt, dateIso))
}

function syncCategorySelection(categories, options, dateIso, selectedRef, selectedIds = []) {
  const bookable = bookableOptionsOnDate(options, dateIso)
  const cats = buildBookableCategories(categories, bookable)
  if (!cats.length) {
    selectedRef.value = ''
    return
  }
  const optionalSelected = bookable.filter(
    (opt) => !opt.is_required && selectedIds.includes(String(opt.id))
  )
  if (optionalSelected.length) {
    const catId = optionalSelected[0].category_id || UNCategorized_CATEGORY_ID
    if (cats.some((cat) => cat.id === catId)) {
      selectedRef.value = catId
      return
    }
  }
  if (!cats.some((cat) => cat.id === selectedRef.value)) {
    selectedRef.value = cats[0].id
  }
}

const bookingEditOrphaned = computed(() => {
  if (!bookingEditItem.value) return []
  const availableIds = new Set(bookingEditOptions.value.map((o) => String(o.id)))
  return (bookingEditItem.value.nail_options || []).filter((o) => !availableIds.has(String(o.id)))
})

const bookingAddDate = computed(() => selectedBookingDate.value || '')

const bookingAddHourOptions = computed(() =>
  buildBookingSlotSelectOptions({
    openHour: shopOpenHour.value,
    lastBookingHour: shopLastBookingHour.value,
    extras: bookingAddExtraHours.value,
    dayWindows: bookingAddDayHours.value,
    blocks: bookingAddSlotBlocks.value,
    bookings: bookingAddSlotBookings.value,
    displayMode: bookingDisplayMode.value,
    slotHours: bookingSlotHours.value,
    extendByServices: extendBookingByServices.value,
    minGapMinutes: effectiveMinGapMinutes.value,
  })
)

const bookingAddBookableCategories = computed(() =>
  buildBookableCategories(
    bookingAddCategories.value,
    bookableOptionsOnDate(bookingAddOptions.value, bookingAddDate.value)
  )
)

const bookingAddRequiredOptions = computed(() =>
  bookableOptionsOnDate(bookingAddOptions.value, bookingAddDate.value).filter((opt) => opt.is_required)
)

const bookingAddCategoryOptions = computed(() => {
  const bookable = bookableOptionsOnDate(bookingAddOptions.value, bookingAddDate.value)
  if (!bookingAddBookableCategories.value.length) {
    return bookable.filter((opt) => !opt.is_required)
  }
  if (!bookingAddSelectedCategoryId.value) return []
  return optionsForCategory(bookable, bookingAddSelectedCategoryId.value)
})

const bookingEditBookableCategories = computed(() =>
  buildBookableCategories(
    bookingEditCategories.value,
    bookableOptionsOnDate(bookingEditOptions.value, bookingEditDate.value)
  )
)

const bookingEditRequiredOptions = computed(() =>
  bookableOptionsOnDate(bookingEditOptions.value, bookingEditDate.value).filter((opt) => opt.is_required)
)

const bookingEditCategoryOptions = computed(() => {
  const bookable = bookableOptionsOnDate(bookingEditOptions.value, bookingEditDate.value)
  if (!bookingEditBookableCategories.value.length) {
    return bookable.filter((opt) => !opt.is_required)
  }
  if (!bookingEditSelectedCategoryId.value) return []
  return optionsForCategory(bookable, bookingEditSelectedCategoryId.value)
})

const bookingEditHourOptions = computed(() => {
  const sameDay = bookingEditDate.value === bookingEditOriginalDate.value
  return buildBookingSlotSelectOptions({
    openHour: shopOpenHour.value,
    lastBookingHour: shopLastBookingHour.value,
    extras: bookingEditExtraHours.value,
    dayWindows: bookingEditDayHours.value,
    blocks: bookingEditSlotBlocks.value,
    bookings: bookingEditSlotBookings.value,
    displayMode: bookingDisplayMode.value,
    slotHours: bookingSlotHours.value,
    extendByServices: extendBookingByServices.value,
    minGapMinutes: effectiveMinGapMinutes.value,
  }, {
    excludeSlotKey: sameDay ? bookingEditOriginalSlotKey.value : null,
  })
})

const isBookingRestoreMode = computed(() => Boolean(bookingRestoreStatus.value))

const bookingEditCurrentHourLabel = computed(() => {
  if (!bookingEditItem.value) return '-'
  return slotLabel(bookingRowToSlot(bookingEditItem.value, bookingSlotHours.value))
})

const bookingEditSelectedSlot = computed(() => {
  const key = bookingEditMoveToSlotKey.value || bookingEditOriginalSlotKey.value
  return key ? parseSlotKey(key) : null
})

const bookingEditSelectedTotalMinutes = computed(() =>
  sumOptionDurationMinutes(bookingEditOptions.value, bookingEditSelectedIds.value)
)

const bookingEditPredictedSlot = computed(() => {
  const base = bookingEditSelectedSlot.value
  if (!base) return null
  if (!extendBookingByServices.value) return base
  return applyServiceDurationToSlot(
    base,
    bookingEditSelectedTotalMinutes.value,
    bookingSlotHours.value
  ) || base
})

const bookingEditPredictedEndLabel = computed(() => {
  const slot = bookingEditPredictedSlot.value
  return slot ? slotLabel(slot) : ''
})

const bookingEditServiceDurationLabel = computed(() =>
  formatDurationMinutes(bookingEditSelectedTotalMinutes.value)
)

const bookingAddSelectedSlot = computed(() => {
  const key = bookingAddSlotKey.value
  return key ? parseSlotKey(key) : null
})

const bookingAddSelectedTotalMinutes = computed(() =>
  sumOptionDurationMinutes(bookingAddOptions.value, bookingAddSelectedIds.value)
)

const bookingAddPredictedSlot = computed(() => {
  const base = bookingAddSelectedSlot.value
  if (!base) return null
  if (!extendBookingByServices.value) return base
  return applyServiceDurationToSlot(
    base,
    bookingAddSelectedTotalMinutes.value,
    bookingSlotHours.value
  ) || base
})

const bookingAddPredictedEndLabel = computed(() => {
  const slot = bookingAddPredictedSlot.value
  return slot ? slotLabel(slot) : ''
})

const bookingAddServiceDurationLabel = computed(() =>
  formatDurationMinutes(bookingAddSelectedTotalMinutes.value)
)

function formatBookingOptionDuration(opt) {
  const mins = Number(opt?.duration_min)
  if (!Number.isFinite(mins) || mins <= 0) return ''
  return formatDurationMinutes(mins)
}

const bookingAddUsers = computed(() => {
  const q = bookingAddUserQuery.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(
    (u) =>
      String(u.name || '').toLowerCase().includes(q)
      || String(u.email || '').toLowerCase().includes(q)
      || String(u.provider_id || '').includes(q)
  )
})

const bookingEditUsers = computed(() => {
  const q = bookingEditUserQuery.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(
    (u) =>
      String(u.name || '').toLowerCase().includes(q)
      || String(u.email || '').toLowerCase().includes(q)
      || String(u.provider_id || '').includes(q)
  )
})

const adminTabs = [
  { key: 'bookings', label: 'จัดการคิว', icon: 'ti-calendar' },
  { key: 'revenue', label: 'สรุปยอด', icon: 'ti-report-money' },
  { key: 'services', label: 'บริการ', icon: 'ti-list-check' },
  { key: 'settings', label: 'ตั้งค่า', icon: 'ti-settings' },
  { key: 'ui', label: 'UI', icon: 'ti-palette' },
  { key: 'blocks', label: 'เวลา', icon: 'ti-calendar-off' },
  { key: 'reviews', label: 'รีวิว', icon: 'ti-star' },
  { key: 'renewal', label: 'ต่ออายุ', icon: 'ti-refresh' },
  { key: 'manual', label: 'คู่มือ', icon: 'ti-book-2' },
  { key: 'users', label: 'ผู้ใช้', icon: 'ti-users' },
  { key: 'features', label: 'ฟังก์ชัน', icon: 'ti-toggle-left', superAdminOnly: true },
]

const showRenewalTab = computed(
  () => shopSlug.value !== 'default' || (isSuperAdmin.value && shopSlug.value === 'default')
)

const visibleAdminTabs = computed(() =>
  adminTabs.filter((tab) => {
    if (tab.superAdminOnly && !(isSuperAdmin.value && shopSlug.value === 'default')) {
      return false
    }
    if (tab.key === 'renewal' && !showRenewalTab.value) return false
    if (tab.key === 'features') return isSuperAdmin.value && shopSlug.value === 'default'
    return shopFeaturesStore.tabEnabled(tab.key)
  })
)

const settingsSections = [
  { key: 'deposit', id: 'settings-deposit', label: 'มัดจำ', icon: 'ti-cash' },
  { key: 'coupon', id: 'settings-coupon', label: 'คูปองแลกแต้ม', icon: 'ti-ticket' },
  { key: 'line', id: 'settings-line', label: 'LINE แจ้งเตือน', icon: 'ti-brand-line' },
  { key: 'chat-notify', id: 'settings-chat-notify', label: 'แจ้งเตือนในแอป', icon: 'ti-bell' },
  { key: 'unpaid', id: 'settings-unpaid', label: 'ยกเลิกอัตโนมัติ', icon: 'ti-clock-pause' },
  { key: 'shops', id: 'settings-shops', label: 'ร้าน / สาขา', icon: 'ti-building-store' },
  { key: 'register-pin', id: 'settings-register-pin', label: 'รหัสสร้างร้านค้า', icon: 'ti-lock', superAdminOnly: true },
  { key: 'locations', id: 'settings-locations', label: 'สถานที่', icon: 'ti-map-pin' },
  { key: 'use-coupon', id: 'settings-use-coupon', label: 'ใช้คูปอง', icon: 'ti-scan' },
]

const settingsSectionById = Object.fromEntries(
  settingsSections.map((s) => [s.id, s.key])
)

const visibleSettingsSections = computed(() =>
  settingsSections.filter((section) => {
    if (section.superAdminOnly && !(isSuperAdmin.value && shopSlug.value === 'default')) {
      return false
    }
    if (!shopFeaturesStore.settingsSectionEnabled(section.key)) return false
    if (section.key === 'line') {
      if (isSuperAdmin.value && shopSlug.value === 'default') return true
      return linePushEnabled.value
    }
    return true
  })
)

const activeSettingsSection = ref('deposit')
const activeUiSection = ref(0)
const settingsNavOpen = ref(false)
const uiNavOpen = ref(false)
const blocksSections = [
  { key: 'shop-hours', label: 'เวลาเปิด-ปิดปกติ', icon: 'ti-clock' },
  { key: 'day-hours', label: 'เวลาเปิด-ปิดเฉพาะวัน', icon: 'ti-calendar-time' },
  { key: 'slot-display', label: 'ความยาวคิว', icon: 'ti-layout-list' },
  { key: 'advance', label: 'จองล่วงหน้า', icon: 'ti-calendar-event' },
  { key: 'bulk', label: 'ปิดหลายวัน', icon: 'ti-calendar-stats' },
  { key: 'calendar', label: 'ปิดทีละวัน', icon: 'ti-calendar' },
]
const visibleBlocksSections = computed(() =>
  blocksSections.filter((section) => shopFeaturesStore.blocksSectionEnabled(section.key))
)
const blocksSectionById = {
  'blocks-day-hours': 'day-hours',
  'blocks-slot-display': 'slot-display',
  'blocks-shop-hours': 'shop-hours',
  'blocks-advance-days': 'advance',
}
const activeBlocksSection = ref('shop-hours')
const blocksNavOpen = ref(false)
const setupWizardDismissed = ref(false)
const isMobile = ref(false)
let adminMobileMq = null

const uiFieldGroups = UI_FIELD_GROUPS
const visibleUiFieldGroups = computed(() =>
  uiFieldGroups.filter((group) => !group.requiresLinePush || linePushEnabled.value)
)

const activeSettingsSectionMeta = computed(
  () => visibleSettingsSections.value.find((s) => s.key === activeSettingsSection.value)
    || visibleSettingsSections.value[0]
    || settingsSections[0]
)

const activeUiSectionMeta = computed(
  () => visibleUiFieldGroups.value[activeUiSection.value] || visibleUiFieldGroups.value[0] || uiFieldGroups[0]
)

const activeBlocksSectionMeta = computed(
  () => visibleBlocksSections.value.find((s) => s.key === activeBlocksSection.value)
    || visibleBlocksSections.value[0]
    || blocksSections[0]
)

const blocksToolbarSubtitle = computed(() => {
  if (selectedBlockDate.value && activeBlocksSection.value === 'calendar') {
    return formatServiceDateLabel(selectedBlockDate.value)
  }
  if (selectedDayHoursDate.value && activeBlocksSection.value === 'day-hours') {
    return formatServiceDateLabel(selectedDayHoursDate.value)
  }
  const meta = {
    'shop-hours': 'เวลาเปิด-ปิดร้านปกติทุกวัน',
    'day-hours': 'ตั้งเวลาเปิด-ปิดเฉพาะวันที่',
    'slot-display': 'ความยาวคิวและรูปแบบแสดงหน้าจอง',
    advance: 'กำหนดวันสุดท้ายที่ลูกค้าจองได้',
    bulk: 'ปิดล่วงหน้าหลายวัน',
    calendar: 'ปิดวัน / ปิดช่วงเวลา',
  }
  return meta[activeBlocksSection.value] || ''
})

function updateAdminMobileLayout() {
  isMobile.value = adminMobileMq?.matches ?? window.innerWidth <= 640
  if (!isMobile.value) {
    settingsNavOpen.value = true
    uiNavOpen.value = true
    blocksNavOpen.value = true
  }
}

function toggleSettingsNav() {
  settingsNavOpen.value = !settingsNavOpen.value
}

function toggleUiNav() {
  uiNavOpen.value = !uiNavOpen.value
}

function toggleBlocksNav() {
  blocksNavOpen.value = !blocksNavOpen.value
}

function loadSetupWizardDismissed() {
  try {
    setupWizardDismissed.value = localStorage.getItem(`admin-setup-dismissed-${shopSlug.value}`) === '1'
  } catch {
    setupWizardDismissed.value = false
  }
}

function dismissSetupWizard() {
  setupWizardDismissed.value = true
  try {
    localStorage.setItem(`admin-setup-dismissed-${shopSlug.value}`, '1')
  } catch {
    /* ignore */
  }
}

const setupWizardSteps = computed(() => [
  {
    key: 'hours',
    label: 'ตั้งเวลาเปิด-ปิดปกติ',
    done: false,
    go: () => goToBlocksSection('shop-hours'),
  },
  {
    key: 'services',
    label: 'เพิ่มบริการ',
    done: nailOptions.value.length > 0,
    go: () => switchTab('services'),
  },
  {
    key: 'locations',
    label: 'เพิ่มสถานที่รายวัน (ถ้ามีหลายจุด)',
    done: serviceLocations.value.length > 0,
    optional: true,
    go: () => goToSettingsSection('locations'),
  },
  {
    key: 'deposit',
    label: 'ตรวจยอดมัดจำ',
    done: Number(depositAmount.value) > 0,
    go: () => goToSettingsSection('deposit'),
  },
])

const setupWizardProgress = computed(() => {
  const required = setupWizardSteps.value.filter((step) => !step.optional)
  const done = required.filter((step) => step.done).length
  return { done, total: required.length }
})

const showSetupWizard = computed(
  () => nailOptionsLoaded.value && !setupWizardDismissed.value && nailOptions.value.length === 0
)

function selectSettingsSection(key) {
  activeSettingsSection.value = key
  if (isMobile.value) settingsNavOpen.value = false
}

function selectUiSection(index) {
  activeUiSection.value = index
  if (isMobile.value) uiNavOpen.value = false
}

watch(visibleUiFieldGroups, (groups) => {
  if (activeUiSection.value >= groups.length) {
    activeUiSection.value = 0
  }
})

watch(visibleSettingsSections, (sections) => {
  if (!sections.some((s) => s.key === activeSettingsSection.value)) {
    activeSettingsSection.value = sections[0]?.key || 'deposit'
  }
})

function selectBlocksSection(key) {
  activeBlocksSection.value = key
  if (key !== 'day-hours') closeDayHoursDate()
  if (key === 'bulk' || key === 'shop-hours' || key === 'slot-display' || key === 'advance') closeBlockDay()
  if (isMobile.value) blocksNavOpen.value = false
}

function goToBlocksSection(key) {
  if (activeTab.value !== 'blocks') {
    if (activeTab.value === 'services') closeServiceDay()
    if (activeTab.value === 'bookings') closeBookingDay()
    activeTab.value = 'blocks'
    message.value = ''
    errorMessage.value = ''
  }
  selectBlocksSection(key)
  if (!isMobile.value) blocksNavOpen.value = true
}

function goToSettingsSection(key) {
  if (activeTab.value !== 'settings') {
    if (activeTab.value === 'services') closeServiceDay()
    if (activeTab.value === 'bookings') closeBookingDay()
    if (activeTab.value === 'blocks') {
      closeBlockDay()
      closeDayHoursDate()
    }
    activeTab.value = 'settings'
    message.value = ''
    errorMessage.value = ''
  }
  activeSettingsSection.value = key
  if (!isMobile.value) settingsNavOpen.value = true
  if (isMobile.value) settingsNavOpen.value = false
}

// ── Shop hours ─────────────────────────────
const allShops = ref([])
const newShopName = ref('')
const newShopSlug = ref('')
const newShopUsageLimitDays = ref('')
const USAGE_PRESET_DAYS = [10, 15, 30]

function parseUsageInputDays(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const days = Math.floor(Number(raw))
  if (!Number.isFinite(days) || days <= 0) return null
  return Math.min(days, 3650)
}

function hasUsageLimitInput(value) {
  return parseUsageInputDays(value) != null
}
const shopEditOpen = ref(false)
const shopEditItem = ref(null)
const shopEditName = ref('')
const shopEditActive = ref(true)
const shopEditUsageLimitDays = ref('')
const shopEditResetUsage = ref(false)
const shopEditSaving = ref(false)
const shopEditError = ref('')

const currentBranchUsage = computed(() => {
  if (shopSlug.value === 'default') return null
  return allShops.value.find((shop) => shop.slug === shopSlug.value) || shopStore.shop
})

const renewalBannerDaysBefore = ref(7)

const branchShopsForRenewal = computed(() =>
  allShops.value.filter((shop) => shop.slug !== 'default')
)

async function loadRenewalBannerSetting() {
  if (shopSlug.value === 'default') return
  try {
    const { data } = await api.get('/api/admin/usage-renewal/settings')
    renewalBannerDaysBefore.value = Math.floor(Number(data?.banner_days_before))
    if (!Number.isFinite(renewalBannerDaysBefore.value) || renewalBannerDaysBefore.value < 0) {
      renewalBannerDaysBefore.value = 7
    }
  } catch {
    renewalBannerDaysBefore.value = 7
  }
}

const showBranchUsageExpiredBanner = computed(
  () => shopSlug.value !== 'default' && !!currentBranchUsage.value?.usage_expired
)

const showBranchUsageWarningBanner = computed(() => {
  const usage = currentBranchUsage.value
  if (shopSlug.value === 'default' || !usage || usage.usage_expired) return false
  if (!usage.usage_limit_days || usage.usage_days_remaining == null) return false
  return usage.usage_days_remaining <= renewalBannerDaysBefore.value
})

function openRenewalTab() {
  if (!showRenewalTab.value) return
  switchTab('renewal')
}

function formatShopUsageBadge(shop) {
  if (!shop?.usage_limit_days) return null
  if (shop.usage_expired) return { text: 'หมดอายุ', tone: 'expired' }
  if (shop.usage_days_remaining != null && shop.usage_days_remaining <= 3) {
    return { text: `เหลือ ${shop.usage_days_remaining} วัน`, tone: 'warn' }
  }
  if (shop.usage_days_remaining != null) {
    return { text: `เหลือ ${shop.usage_days_remaining} วัน`, tone: 'ok' }
  }
  return { text: `${shop.usage_limit_days} วัน`, tone: 'ok' }
}

function formatUsageExpiryDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const branchShopOptions = computed(() =>
  allShops.value.filter((shop) => shop.slug !== 'default' && shop.is_active)
)
const uiForm = ref({})
const uiImageUploading = ref('')
const pendingUiUploadKind = ref('')
const uiImageFileInput = ref(null)
const shopOpenHour = ref(9)
const shopLastBookingHour = ref(18)
const hourOptions = Array.from({ length: 24 }, (_, i) => i)
const minuteOptions = Array.from({ length: 60 }, (_, i) => i)

const dayHoursMonth = ref(todayYm())
const selectedDayHoursDate = ref('')
const dayHoursMonthList = ref([])
const dayHoursForSelectedDate = ref([])
const dayHourFormOpen = ref(false)
const dayHourEditingId = ref(null)
const dayHourEditOriginalEndM = ref(null)
const dayHourGenerating = ref(false)
const dayHourStartH = ref(9)
const dayHourStartM = ref(0)
const dayHourEndH = ref(18)
const dayHourEndM = ref(0)
const dayHourSaving = ref(false)

// ── Advance days ────────────────────────────
const advanceDays = ref(30)
const bookUntilDate = ref('')

function formatBookUntilLabel(iso) {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${serviceThMonths[m - 1]} ${y + 543}`
}
//nettyfiy
async function loadAdvanceDays() {
  try {
    const { data } = await api.get('/api/admin/settings/advance-days')
    advanceDays.value = data.advance_days ?? 30
    bookUntilDate.value = data.book_until_date || ''
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดจำนวนวันล่วงหน้าไม่สำเร็จ'
  }
}

async function saveAdvanceDays() {
  if (!Number.isInteger(advanceDays.value) || advanceDays.value < 1 || advanceDays.value > 365) {
    errorMessage.value = 'จำนวนวันต้องอยู่ระหว่าง 1-365'
    return
  }
  const ok = await confirmAdminSave(
    'ยืนยันบันทึก',
    `ตั้งจองล่วงหน้า ${advanceDays.value} วัน และล็อกวันสิ้นสุดใหม่ใช่ไหม`
  )
  if (!ok) return
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch('/api/admin/settings/advance-days', { advance_days: advanceDays.value })
    advanceDays.value = data.advance_days ?? advanceDays.value
    bookUntilDate.value = data.book_until_date || ''
    message.value = `บันทึกแล้ว: เปิดจองถึง ${formatBookUntilLabel(bookUntilDate.value)} (ล็อกวันสิ้นสุดแล้ว)`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกไม่สำเร็จ'
  }
}

async function loadAllShops() {
  try {
    const { data } = await api.get('/api/admin/shops')
    allShops.value = data || []
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดรายการร้านไม่สำเร็จ'
  }
}

const BRANCH_USAGE_POLL_MS = 30000
let branchUsagePollTimer = null
let branchUsageRefreshing = false

async function refreshBranchUsage({ silent = false } = {}) {
  if (shopSlug.value === 'default') return
  if (branchUsageRefreshing) return
  branchUsageRefreshing = true
  try {
    const { data } = await api.get('/api/admin/shops')
    allShops.value = data || []
    await shopStore.loadShop(shopSlug.value)
    await loadRenewalBannerSetting()
  } catch (err) {
    if (!silent) {
      errorMessage.value = err?.response?.data?.error || 'โหลดข้อมูลการใช้งานไม่สำเร็จ'
    }
  } finally {
    branchUsageRefreshing = false
  }
}

function startBranchUsagePolling() {
  stopBranchUsagePolling()
  if (shopSlug.value === 'default') return
  branchUsagePollTimer = setInterval(() => {
    void refreshBranchUsage({ silent: true })
  }, BRANCH_USAGE_POLL_MS)
}

function stopBranchUsagePolling() {
  if (branchUsagePollTimer) {
    clearInterval(branchUsagePollTimer)
    branchUsagePollTimer = null
  }
}

function onAdminWindowFocus() {
  if (shopSlug.value !== 'default') void refreshBranchUsage({ silent: true })
}

async function createShop() {
  message.value = ''
  errorMessage.value = ''
  const name = newShopName.value.trim()
  const slug = newShopSlug.value.trim().toLowerCase()
  if (!name || !slug) {
    errorMessage.value = 'กรุณากรอกชื่อและ slug ร้าน'
    return
  }
  const ok = await confirmAdminSave('ยืนยันเพิ่มสาขา', `เพิ่มสาขา "${name}" (/${slug}) ใช่ไหม`)
  if (!ok) return
  const limitDays = parseUsageInputDays(newShopUsageLimitDays.value)
  if (String(newShopUsageLimitDays.value).trim() && limitDays == null) {
    errorMessage.value = 'จำนวนวันใช้งานไม่ถูกต้อง (ต้องเป็นตัวเลขมากกว่า 0)'
    return
  }
  try {
    const payload = { name, slug }
    if (limitDays != null) {
      payload.usage_limit_days = limitDays
    }
    await api.post('/api/shops', payload)
    newShopName.value = ''
    newShopSlug.value = ''
    newShopUsageLimitDays.value = ''
    message.value = `สร้างร้าน ${name} แล้ว — URL: /${slug}/bookings`
    await loadAllShops()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'สร้างร้านไม่สำเร็จ'
  }
}

function switchShopAdmin(slug) {
  if (slug === shopSlug.value) return
  router.push(`/${slug}/admin`)
}

function resetAdminShopLocalState() {
  closeBookingDay()
  closeServiceDay()
  closeBlockDay()
  closeDayHoursDate()
  bookingEditOpen.value = false
  bookingEditItem.value = null
  bookingAddOpen.value = false

  nailOptionsLoaded.value = false
  nailOptions.value = []
  serviceCategories.value = []
  serviceLocations.value = []
  showcaseClips.value = []
  blocks.value = []
  extraHours.value = []
  bookingDaySummary.value = {}
  bookingMonthPaidTotal.value = 0
  bookingMonthUnpaidTotal.value = 0
  bookingMonthCancelledTotal.value = 0
  revenueDaySummary.value = {}
  revenueMonthTotal.value = 0
  revenueMonthDepositTotal.value = 0
  revenueMonthDoneCount.value = 0
  users.value = []
  usersTotal.value = 0
  usersHasMore.value = false
  usersLoaded.value = false
}

async function reloadAdminShopContext() {
  resetAdminShopLocalState()
  message.value = ''
  errorMessage.value = ''

  const slug = shopSlug.value
  await shopStore.loadShop(slug).catch(() => null)
  await uiSettingsStore.fetch(shopStore.shopName).catch(() => null)

  const tasks = [
    loadUiSettingsAdmin(),
    shopFeaturesStore.fetchForAdmin(),
    loadDepositSetting(),
    loadCouponSetting(),
    loadLinePushSetting(),
    loadChatNotifySetting(),
    loadUnpaidAutoCancelSetting(),
    loadAdvanceDays(),
    loadBookingDisplay(),
    loadShopHours(),
    loadDayHoursMonth(),
    loadBlocks(),
    loadNailOptions(),
    loadServiceCategories(),
    loadServiceLocations(),
    loadShowcaseClips(),
    loadBookingCalendarSummary(),
    loadRegisterShopPinSetting(),
  ]

  if (slug !== 'default') {
    tasks.push(loadRenewalBannerSetting(), refreshBranchUsage({ silent: true }))
    startBranchUsagePolling()
  } else {
    stopBranchUsagePolling()
  }

  if (activeTab.value === 'revenue') tasks.push(loadRevenueSummary())
  if (activeTab.value === 'users') tasks.push(loadUsers({ reset: true }))

  await Promise.all(tasks)
  loadSetupWizardDismissed()
}

function openShopEdit(shop) {
  shopEditItem.value = shop
  shopEditName.value = shop.name || ''
  shopEditActive.value = shop.is_active !== false
  shopEditUsageLimitDays.value = shop.usage_limit_days ?? ''
  shopEditResetUsage.value = false
  shopEditError.value = ''
  shopEditOpen.value = true
  scrollToAdminSection('settings-shops')
  nextTick(() => {
    document.getElementById('shop-edit-name-input')?.focus()
  })
}

function closeShopEdit() {
  shopEditOpen.value = false
  shopEditItem.value = null
}

async function saveShopEdit() {
  if (!shopEditItem.value) return
  const name = shopEditName.value.trim()
  if (!name) {
    shopEditError.value = 'กรุณาระบุชื่อร้าน'
    return
  }
  const ok = await confirmAdminSave(
    'ยืนยันบันทึกสาขา',
    `บันทึกสาขา "${name}" (${shopEditActive.value ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}) ใช่ไหม`
  )
  if (!ok) return
  const limitDays = parseUsageInputDays(shopEditUsageLimitDays.value)
  if (String(shopEditUsageLimitDays.value).trim() && limitDays == null) {
    shopEditError.value = 'จำนวนวันใช้งานไม่ถูกต้อง (ต้องเป็นตัวเลขมากกว่า 0)'
    return
  }
  shopEditSaving.value = true
  shopEditError.value = ''
  message.value = ''
  errorMessage.value = ''
  try {
    const originalLimit = shopEditItem.value.usage_limit_days ?? ''
    const limitChanged = String(limitDays ?? '') !== String(originalLimit || '')
    const payload = {
      name,
      is_active: shopEditActive.value,
    }
    if (limitChanged) {
      payload.usage_limit_days = limitDays
    } else if (shopEditResetUsage.value) {
      payload.reset_usage_period = true
    }
    const { data } = await api.patch(`/api/shops/${shopEditItem.value.slug}`, payload)
    message.value = `บันทึกสาขา "${name}" แล้ว`
    await loadAllShops()
    if (data?.shop?.slug === shopSlug.value && data.shop.is_active === false) {
      router.push('/default/admin')
    }
    closeShopEdit()
  } catch (err) {
    shopEditError.value = err?.response?.data?.error || 'บันทึกสาขาไม่สำเร็จ'
  } finally {
    shopEditSaving.value = false
  }
}

async function deleteShopBranch(shop) {
  if (shop.slug === 'default') return
  const intro = await adminSwal.fire({
    title: 'ลบสาขาถาวร',
    html: `ลบสาขา <strong>${shop.name}</strong> (/${shop.slug}) ออกจากระบบ<br><span style="color:#9A8E89">คิวจอง แชท บริการ ตั้งค่า และสลิปของสาขานี้จะหายไปทั้งหมด — กู้คืนไม่ได้</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการต่อ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#C45C5C',
  })
  if (!intro.isConfirmed) return

  const confirm = await adminSwal.fire({
    title: 'ยืนยันการลบถาวร',
    html: `พิมพ์ <strong>${shop.slug}</strong> เพื่อยืนยัน`,
    input: 'text',
    inputPlaceholder: shop.slug,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบถาวร',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#C45C5C',
    inputValidator: (value) => {
      if (String(value || '').trim().toLowerCase() !== shop.slug) {
        return 'slug ไม่ตรงกับสาขาที่จะลบ'
      }
      return undefined
    },
  })
  if (!confirm.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.delete(`/api/shops/${shop.slug}`, { params: { force: true } })
    message.value = data?.message || `ลบสาขา ${shop.name} ถาวรแล้ว`
    if (shop.slug === shopSlug.value) {
      router.push('/default/admin')
    }
    await loadAllShops()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ลบสาขาไม่สำเร็จ'
  }
}

function adminShopLabel(user) {
  if (!user?.is_admin) return ''
  if (user.is_super_admin || user.admin_shop_slug === 'default') return 'ทุกสาขา'
  return user.admin_shop_slug || '-'
}

function canEditUserAdminRights(user) {
  if (!canManageShopAdmins.value) return false
  if (isSuperAdmin.value) return true
  if (user?.is_super_admin) return false
  if (user?.is_admin && user.admin_shop_slug && user.admin_shop_slug !== shopSlug.value) return false
  return true
}

function canToggleUserAdmin(user) {
  if (!canEditUserAdminRights(user)) return false
  if (user.id === auth.user?.id && user.is_admin) return false
  return true
}

async function loadUiSettingsAdmin() {
  try {
    const { data } = await api.get('/api/admin/settings/ui')
    uiForm.value = { ...(data || {}) }
    uiSettingsStore.applyLocal(data || {})
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดตั้งค่า UI ไม่สำเร็จ'
  }
}

async function saveUiSettingsAdmin() {
  const ok = await confirmAdminSave('ยืนยันบันทึก UI', 'บันทึกการตั้งค่า UI และข้อความทั้งหมดใช่ไหม')
  if (!ok) return
  message.value = ''
  errorMessage.value = ''
  try {
    const payload = { ...uiForm.value }
    if (uiFieldHasValue('ui_promptpay_id')) {
      payload.ui_kshop_qr_url = ''
    } else if (uiFieldHasValue('ui_kshop_qr_url')) {
      payload.ui_promptpay_id = ''
    }
    const { data } = await api.patch('/api/admin/settings/ui', payload)
    uiForm.value = { ...(data.settings || {}) }
    uiSettingsStore.applyLocal(data.settings || uiForm.value)
    message.value = 'บันทึกการตั้งค่า UI แล้ว'
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึก UI ไม่สำเร็จ'
  }
}

function uiPreviewUrl(key) {
  const url = String(uiForm.value[key] || '').trim()
  return url ? resolveUiImageUrl(url, shopSlug.value) : ''
}

function uiImageFieldHint(key) {
  return imageUrlHint(uiForm.value[key])
}

function uiFieldHasValue(key) {
  return String(uiForm.value[key] || '').trim() !== ''
}

function shouldShowUiField(field) {
  if (field?.hideInAdmin) return false
  if (!field?.hideWhen) return true
  return !uiFieldHasValue(field.hideWhen)
}

function isUiFormToggleOn(key) {
  const value = String(uiForm.value[key] ?? '0').trim().toLowerCase()
  return value !== '0' && value !== 'false' && value !== 'off'
}

async function onUiToggleChange(field, checked) {
  const key = field.key
  const previous = uiForm.value[key]
  uiForm.value[key] = checked ? '1' : '0'
  await autoSaveSettingToggle({
    key: `ui:${key}`,
    url: '/api/admin/settings/ui',
    payload: { [key]: checked ? '1' : '0' },
    label: field.label,
    nextValue: checked,
    revert: () => { uiForm.value[key] = previous },
    apply: (data) => {
      if (data?.settings) {
        uiForm.value = { ...uiForm.value, ...data.settings }
        uiSettingsStore.applyLocal(data.settings)
      }
    },
  })
}

function triggerUiImageUpload(kind) {
  if (uiImageUploading.value) return
  pendingUiUploadKind.value = kind
  uiImageFileInput.value?.click()
}

async function onUiImageSelected(event) {
  const kind = pendingUiUploadKind.value
  const input = event.target
  const file = input.files?.[0]
  input.value = ''
  pendingUiUploadKind.value = ''
  if (!file || !kind || uiImageUploading.value) return

  uiImageUploading.value = kind
  message.value = ''
  errorMessage.value = ''
  try {
    const maxWidth = kind === 'logo' ? 800 : kind === 'kshop_qr' ? 1200 : 1920
    const { base64, mime } = await compressImage(file, { maxWidth, quality: 0.85 })
    const { data } = await api.post('/api/admin/settings/ui/upload', {
      kind,
      image_data: base64,
      image_mime: mime,
    })
    uiForm.value = { ...(data.settings || uiForm.value) }
    uiSettingsStore.applyLocal(data.settings || uiForm.value)
    message.value = kind === 'logo'
      ? 'อัปโหลดโลโก้แล้ว'
      : kind === 'kshop_qr'
        ? 'อัปโหลด QR KShop แล้ว'
        : 'อัปโหลดภาพปกแล้ว'
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || err?.message || 'อัปโหลดรูปไม่สำเร็จ'
  } finally {
    uiImageUploading.value = ''
  }
}

async function loadShopHours() {
  try {
    const { data } = await api.get('/api/admin/settings/shop-hours')
    shopOpenHour.value = normalizeShopOpenHour(data.open_hour)
    if (data.slot_hours != null) {
      bookingSlotHours.value = normalizeBookingSlotHours(data.slot_hours)
    }
    shopLastBookingHour.value = normalizeShopLastBookingHour(data.last_booking_hour, shopOpenHour.value, bookingSlotHours.value)
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดเวลาร้านไม่สำเร็จ'
  }
}

async function saveShopHours() {
  const slot = normalizeBookingSlotHours(bookingSlotHours.value)
  if (shopOpenHour.value >= shopLastBookingHour.value - (slot - 1)) {
    errorMessage.value = `เวลาเปิดต้องน้อยกว่าเวลาจองสุดท้ายอย่างน้อย ${slot} ชั่วโมง`
    return
  }
  const ok = await confirmAdminSave(
    'ยืนยันบันทึกเวลาร้าน',
    `เปิด ${formatHmLabel(shopOpenHour.value, 0)} – จองสุดท้าย ${formatHmLabel(shopLastBookingHour.value, 0)} ใช่ไหม`
  )
  if (!ok) return
  message.value = ''
  errorMessage.value = ''
  try {
    await api.patch('/api/admin/settings/shop-hours', {
      open_hour: shopOpenHour.value,
      last_booking_hour: shopLastBookingHour.value,
    })
    message.value = `บันทึกเวลาร้านแล้ว: เปิด ${formatHmLabel(shopOpenHour.value, 0)} – จองสุดท้าย ${formatHmLabel(shopLastBookingHour.value, 0)} (ปิด ${formatHmLabel(shopLastBookingHour.value + bookingSlotHours.value, 0)})`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกเวลาร้านไม่สำเร็จ'
  }
}

function shiftDayHoursMonth(delta) {
  const [y, m] = dayHoursMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  dayHoursMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadDayHoursMonth()
}

const dayHoursMonthLabel = computed(() => {
  const [y, m] = dayHoursMonth.value.split('-').map(Number)
  return `${serviceThMonths[m - 1]} ${y + 543}`
})

const dayHoursCalendarWeeks = computed(() => buildCalendarWeeks(dayHoursMonth.value))

const dayHoursExceptEditing = computed(() => {
  if (!dayHourEditingId.value) return dayHoursForSelectedDate.value
  return dayHoursForSelectedDate.value.filter((item) => item.id !== dayHourEditingId.value)
})

const dayHourAvailableStartHours = computed(() => availableStartHoursForDay(dayHoursExceptEditing.value))

const dayHourAvailableStartMinutes = computed(() =>
  availableStartMinutesForHour(dayHourStartH.value, dayHoursExceptEditing.value)
)

const dayHourCanAddMore = computed(() => dayHourAvailableStartHours.value.length > 0)

const dayHourMaxEndM = computed(() => {
  const startM = toMinutesFromHm(dayHourStartH.value, dayHourStartM.value)
  if (dayHourEditingId.value != null && dayHourEditOriginalEndM.value != null) {
    return maxEndMinutesForDayHourEdit(startM, dayHoursExceptEditing.value, {
      editingId: dayHourEditingId.value,
      originalEndM: dayHourEditOriginalEndM.value,
      allWindows: dayHoursForSelectedDate.value,
    })
  }
  return maxEndMinutesForDayHourStart(startM, dayHoursExceptEditing.value)
})

const dayHourEndHourOptions = computed(() => {
  const startM = toMinutesFromHm(dayHourStartH.value, dayHourStartM.value)
  const maxEndM = dayHourMaxEndM.value
  return hourOptions.filter((h) => {
    const hourStartM = h * 60
    const hourEndM = h * 60 + 59
    return hourEndM > startM && hourStartM <= maxEndM && h <= 23
  })
})

const dayHourEndMinuteOptions = computed(() => {
  const startM = toMinutesFromHm(dayHourStartH.value, dayHourStartM.value)
  const maxEndM = dayHourMaxEndM.value
  const endH = dayHourEndH.value
  return minuteOptions.filter((m) => {
    const endM = toMinutesFromHm(endH, m)
    return endM > startM && endM <= maxEndM
  })
})

function defaultDayHourEndFromStart(startM, maxEndM) {
  const preferred = startM + 60
  if (preferred <= maxEndM) return preferred
  if (maxEndM > startM) return maxEndM
  return Math.min(startM + 1, maxEndM)
}

function applyDayHourEndMinutes(endM) {
  dayHourEndH.value = Math.floor(endM / 60)
  dayHourEndM.value = endM % 60
}

function syncDayHourEndAfterStartChange() {
  const startM = toMinutesFromHm(dayHourStartH.value, dayHourStartM.value)
  const maxEndM = dayHourMaxEndM.value
  let endM = toMinutesFromHm(dayHourEndH.value, dayHourEndM.value)
  if (endM <= startM || endM > maxEndM) {
    applyDayHourEndMinutes(defaultDayHourEndFromStart(startM, maxEndM))
    return
  }
  clampDayHourEndAfterStart()
}

function clampDayHourEndAfterStart() {
  const startM = toMinutesFromHm(dayHourStartH.value, dayHourStartM.value)
  const maxEndM = dayHourMaxEndM.value
  let endM = toMinutesFromHm(dayHourEndH.value, dayHourEndM.value)
  if (endM <= startM || endM > maxEndM) {
    applyDayHourEndMinutes(defaultDayHourEndFromStart(startM, maxEndM))
    return
  }
  const allowedMinutes = dayHourEndMinuteOptions.value
  if (!allowedMinutes.includes(dayHourEndM.value)) {
    dayHourEndM.value = allowedMinutes[0] ?? 0
  }
  const allowedHours = dayHourEndHourOptions.value
  if (!allowedHours.includes(dayHourEndH.value)) {
    dayHourEndH.value = allowedHours[0] ?? 23
    clampDayHourEndAfterStart()
  }
}

function dayHoursDayHasEntries(iso) {
  return dayHoursMonthList.value.some((item) => formatDateKey(item.schedule_date) === iso)
}

function dayHoursDayCount(iso) {
  return dayHoursMonthList.value.filter((item) => formatDateKey(item.schedule_date) === iso).length
}

async function loadDayHoursMonth() {
  try {
    const { data } = await api.get('/api/admin/day-hours', { params: { month: dayHoursMonth.value } })
    dayHoursMonthList.value = data || []
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดปฏิทินเวลาจองไม่สำเร็จ'
  }
}

async function loadDayHoursForDate(date) {
  if (!date) return
  try {
    const { data } = await api.get(`/api/admin/day-hours/${date}`)
    dayHoursForSelectedDate.value = (data || []).map((row) => ({
      ...row,
      start_hour: Number(row.start_hour),
      start_minute: Number(row.start_minute ?? 0),
      end_hour: Number(row.end_hour),
      end_minute: Number(row.end_minute ?? 0),
    }))
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดเวลาจองของวันนี้ไม่สำเร็จ'
  }
}

async function openDayHoursDate(iso) {
  selectedDayHoursDate.value = iso
  closeDayHourForm()
  await loadDayHoursForDate(iso)
}

function closeDayHoursDate() {
  selectedDayHoursDate.value = ''
  dayHoursForSelectedDate.value = []
  closeDayHourForm()
}

function formatDayHourRange(item) {
  return `${formatHmLabel(item.start_hour, item.start_minute ?? 0)} – ${formatHmLabel(item.end_hour, item.end_minute ?? 0)}`
}

function closeDayHourForm() {
  dayHourFormOpen.value = false
  dayHourEditingId.value = null
  dayHourEditOriginalEndM.value = null
}

function openDayHourForm() {
  dayHourEditingId.value = null
  const available = dayHourAvailableStartHours.value
  if (!available.length) {
    errorMessage.value = 'ไม่มีช่วงเวลาว่างเหลือในวันนี้'
    return
  }
  dayHourStartH.value = available[0]
  dayHourStartM.value = availableStartMinutesForHour(available[0], dayHoursExceptEditing.value)[0] ?? 0
  const startM = toMinutesFromHm(dayHourStartH.value, dayHourStartM.value)
  const maxEndM = maxEndMinutesForDayHourStart(startM, dayHoursExceptEditing.value)
  applyDayHourEndMinutes(defaultDayHourEndFromStart(startM, maxEndM))
  dayHourFormOpen.value = true
  errorMessage.value = ''
}

function openDayHourEdit(item) {
  dayHourEditingId.value = item.id
  dayHourEditOriginalEndM.value = toMinutesFromHm(item.end_hour, item.end_minute ?? 0)
  dayHourStartH.value = item.start_hour
  dayHourStartM.value = item.start_minute ?? 0
  dayHourEndH.value = item.end_hour
  dayHourEndM.value = item.end_minute ?? 0
  dayHourFormOpen.value = true
  errorMessage.value = ''
  focusAdminModal('admin-day-hour-edit-modal', 'select')
}

async function generateFullDayHours() {
  if (!selectedDayHoursDate.value) return

  let replace = false
  if (dayHoursForSelectedDate.value.length) {
    const ok = await adminSwal.fire({
      title: 'แทนที่ช่วงเวลาทั้งวัน?',
      text: 'จะลบช่วงเวลาเดิมแล้วสร้างใหม่ตามเวลาเปิด-ปิดปกติและความยาวคิว',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'สร้างใหม่',
      cancelButtonText: 'ยกเลิก',
    })
    if (!ok.isConfirmed) return
    replace = true
  }

  dayHourGenerating.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.post('/api/admin/day-hours/generate-full-day', {
      schedule_date: selectedDayHoursDate.value,
      replace,
    })
    message.value = `สร้างช่วงเวลาทั้งวัน ${data.count} รายการแล้ว`
    closeDayHourForm()
    await Promise.all([loadDayHoursForDate(selectedDayHoursDate.value), loadDayHoursMonth()])
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'สร้างช่วงเวลาทั้งวันไม่สำเร็จ'
  } finally {
    dayHourGenerating.value = false
  }
}

async function saveDayHourEntry() {
  if (!selectedDayHoursDate.value) return
  const startM = toMinutesFromHm(dayHourStartH.value, dayHourStartM.value)
  const endM = toMinutesFromHm(dayHourEndH.value, dayHourEndM.value)
  if (endM <= startM) {
    errorMessage.value = 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม'
    return
  }
  if (endM > toMinutesFromHm(23, 59)) {
    errorMessage.value = 'เวลาสิ้นสุดต้องไม่เกิน 23:59'
    return
  }

  dayHourSaving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    if (dayHourEditingId.value) {
      const { data } = await api.patch(`/api/admin/day-hours/${dayHourEditingId.value}`, {
        start_hour: dayHourStartH.value,
        start_minute: dayHourStartM.value,
        end_hour: dayHourEndH.value,
        end_minute: dayHourEndM.value,
      })
      message.value = data.cascaded
        ? 'บันทึกแล้ว · เลื่อนช่วงถัดไปให้อัตโนมัติ'
        : 'บันทึกช่วงเวลาแล้ว'
    } else {
      await api.post('/api/admin/day-hours', {
        schedule_date: selectedDayHoursDate.value,
        start_hour: dayHourStartH.value,
        start_minute: dayHourStartM.value,
        end_hour: dayHourEndH.value,
        end_minute: dayHourEndM.value,
      })
      message.value = 'บันทึกช่วงเวลาจองแล้ว'
    }
    closeDayHourForm()
    await Promise.all([loadDayHoursForDate(selectedDayHoursDate.value), loadDayHoursMonth()])
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกช่วงเวลาไม่สำเร็จ'
  } finally {
    dayHourSaving.value = false
  }
}

async function removeDayHourEntry(id) {
  const ok = await adminSwal.fire({
    title: 'ยืนยันลบช่วงเวลา',
    text: 'ลบช่วงเวลาจองนี้ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/day-hours/${id}`)
    message.value = 'ลบช่วงเวลาแล้ว'
    closeDayHourForm()
    await Promise.all([loadDayHoursForDate(selectedDayHoursDate.value), loadDayHoursMonth()])
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ลบช่วงเวลาไม่สำเร็จ'
  }
}

watch(dayHourStartH, () => {
  const allowed = dayHourAvailableStartMinutes.value
  if (!allowed.includes(dayHourStartM.value)) {
    dayHourStartM.value = allowed[0] ?? 0
  }
  syncDayHourEndAfterStartChange()
})

watch(dayHourStartM, () => {
  const allowed = dayHourAvailableStartMinutes.value
  if (!allowed.includes(dayHourStartM.value)) {
    dayHourStartM.value = allowed[0] ?? 0
  }
  syncDayHourEndAfterStartChange()
})

watch(dayHourEndH, () => {
  clampDayHourEndAfterStart()
})

// ── Users ────────────────────────────────────
const USER_PAGE_SIZE = 100
const users = ref([])
const usersTotal = ref(0)
const usersHasMore = ref(false)
const usersLoading = ref(false)
const usersLoadingMore = ref(false)
const usersLoaded = ref(false)
const usersListRef = ref(null)
const usersSentinelRef = ref(null)
const userSearch = ref('')
const userEditOpen = ref(false)
const userEditItem = ref(null)
const userEditName = ref('')
const userEditEmail = ref('')
const userEditLoginId = ref('')
const userEditPoints = ref(0)
const userEditNote = ref('')
const userEditIsAdmin = ref(false)
const userEditAdminShopSlug = ref('default')
const userEditSaving = ref(false)
const userEditError = ref('')
const userHistoryOpen = ref(false)
const userHistoryUser = ref(null)
const userHistoryBookings = ref([])
const userHistoryLoading = ref(false)
const userHistoryError = ref('')

const staffAddOpen = ref(false)
const staffAddName = ref('')
const staffAddPhone = ref('')
const staffAddShopSlug = ref('default')
const staffAddSaving = ref(false)
const staffAddError = ref('')

const chatSendOpen = ref(false)
const chatSendUser = ref(null)
const chatSendBody = ref('')
const chatSendSaving = ref(false)
const chatSendError = ref('')

function openSendMessageModal(user) {
  chatSendUser.value = user
  chatSendBody.value = ''
  chatSendError.value = ''
  chatSendOpen.value = true
  focusAdminModal('admin-chat-send-modal', '#admin-chat-send-input')
}

function closeSendMessageModal() {
  chatSendOpen.value = false
  chatSendUser.value = null
  chatSendBody.value = ''
  chatSendError.value = ''
}

async function submitSendMessageModal() {
  const user = chatSendUser.value
  const body = chatSendBody.value.trim()
  if (!user?.id || !body || chatSendSaving.value) return

  chatSendSaving.value = true
  chatSendError.value = ''
  try {
    await api.post(`/api/admin/chat/conversations/${user.id}/messages`, { body })
    message.value = `ส่งข้อความถึง ${user.name} แล้ว`
    closeSendMessageModal()
  } catch (err) {
    chatSendError.value = err?.response?.data?.error || 'ส่งข้อความไม่สำเร็จ'
  } finally {
    chatSendSaving.value = false
  }
}

function openAdminChat(userId) {
  if (!userId) return
  router.push(shopPath(`/chat?userId=${userId}`))
}

const filteredUsers = computed(() => users.value)

let usersObserver = null
let userSearchDebounce = null

async function loadUsers({ reset = false } = {}) {
  if (usersLoading.value || usersLoadingMore.value) return
  if (!reset && !usersHasMore.value) return

  if (reset) {
    usersLoading.value = true
  } else {
    usersLoadingMore.value = true
  }

  try {
    const offset = reset ? 0 : users.value.length
    const q = userSearch.value.trim()
    const params = { limit: USER_PAGE_SIZE, offset }
    if (q) params.q = q

    const { data } = await api.get('/api/admin/users', { params })
    const rows = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : [])

    if (reset) {
      users.value = rows
    } else {
      const existing = new Set(users.value.map((u) => u.id))
      for (const user of rows) {
        if (!existing.has(user.id)) users.value.push(user)
      }
    }

    usersTotal.value = Number(data?.total ?? rows.length)
    usersHasMore.value = Boolean(
      data?.has_more ?? (offset + rows.length < usersTotal.value),
    )
    usersLoaded.value = true
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดผู้ใช้ไม่สำเร็จ'
  } finally {
    usersLoading.value = false
    usersLoadingMore.value = false
    nextTick(setupUsersInfiniteScroll)
  }
}

async function ensureUsersLoaded() {
  if (!usersLoaded.value && !usersLoading.value) {
    await loadUsers({ reset: true })
  }
}

function setupUsersInfiniteScroll() {
  usersObserver?.disconnect()
  usersObserver = null
  if (activeTab.value !== 'users' || !usersSentinelRef.value || !usersHasMore.value) return

  usersObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return
      if (!usersHasMore.value || usersLoading.value || usersLoadingMore.value) return
      void loadUsers()
    },
    { root: null, rootMargin: '160px' },
  )
  usersObserver.observe(usersSentinelRef.value)
}

function openStaffAdd() {
  staffAddName.value = ''
  staffAddPhone.value = ''
  staffAddShopSlug.value = isSuperAdmin.value
    ? (shopSlug.value === 'default' ? 'default' : shopSlug.value)
    : shopSlug.value
  staffAddError.value = ''
  staffAddOpen.value = true
  focusAdminModal('admin-staff-add-modal', 'input[type="text"]')
}

function closeStaffAdd() {
  staffAddOpen.value = false
  staffAddError.value = ''
}

async function saveStaffAdd() {
  const name = staffAddName.value.trim()
  const phone = staffAddPhone.value.trim()
  if (!name) {
    staffAddError.value = 'กรุณาระบุชื่อ'
    return
  }
  if (!phone) {
    staffAddError.value = 'กรุณาระบุเบอร์โทร'
    return
  }

  staffAddSaving.value = true
  staffAddError.value = ''
  message.value = ''
  errorMessage.value = ''
  try {
    const payload = { name, phone }
    if (isSuperAdmin.value) {
      payload.admin_shop_slug = staffAddShopSlug.value
    }
    const { data } = await api.post('/api/admin/users/staff', payload)
    const user = data?.user
    if (user) {
      const idx = users.value.findIndex((u) => u.id === user.id)
      if (idx >= 0) users.value[idx] = user
      else users.value.unshift(user)
    }
    closeStaffAdd()
    await adminSwal.fire({
      title: `${staffAddBtnLabel.value}แล้ว`,
      html: `ชื่อ <strong>${name}</strong><br>ล็อกอินด้วยชื่อ + เบอร์ <strong>${phone}</strong>`,
      icon: 'success',
    })
    message.value = `${staffAddBtnLabel.value} "${name}" (${phone}) แล้ว`
  } catch (err) {
    staffAddError.value = err?.response?.data?.error || 'เพิ่มช่างไม่สำเร็จ'
  } finally {
    staffAddSaving.value = false
  }
}

async function toggleAdmin(user) {
  const next = !user.is_admin
  if (next && !canManageShopAdmins.value) return
  if (!canToggleUserAdmin(user)) return
  const adminSlug = isSuperAdmin.value ? 'default' : shopSlug.value
  const ok = await adminSwal.fire({
    title: next ? 'ให้สิทธิ์แอดมิน' : 'ถอดสิทธิ์แอดมิน',
    text: next
      ? `ให้ "${user.name}" เป็นแอดมินสาขา /${adminSlug} ใช่ไหม`
      : `ถอดสิทธิ์แอดมินของ "${user.name}" ใช่ไหม`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return
  try {
    await api.patch(`/api/admin/users/${user.id}/set-admin`, {
      is_admin: next,
      admin_shop_slug: next ? adminSlug : null,
    })
    user.is_admin = next
    user.is_super_admin = next && isSuperAdmin.value && adminSlug === 'default'
    user.admin_shop_slug = next ? adminSlug : null
    message.value = `${next ? 'ให้' : 'ถอด'}สิทธิ์แอดมิน "${user.name}" แล้ว`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'อัปเดตสิทธิ์ไม่สำเร็จ'
  }
}

async function deleteUser(user) {
  const ok = await adminSwal.fire({
    title: 'ลบผู้ใช้',
    html: `ลบ <strong>${user.name}</strong> และข้อมูลการจองทั้งหมดของผู้ใช้นี้<br><span style="color:#C45C5C">การลบไม่สามารถยกเลิกได้</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#C45C5C',
  })
  if (!ok.isConfirmed) return
  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/users/${user.id}`)
    users.value = users.value.filter((u) => u.id !== user.id)
    message.value = `ลบผู้ใช้ "${user.name}" แล้ว`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ลบผู้ใช้ไม่สำเร็จ'
  }
}

function editUser(user) {
  userEditItem.value = user
  userEditName.value = user.name || ''
  userEditEmail.value = user.email || ''
  userEditLoginId.value = user.provider_id || ''
  userEditPoints.value = Number(user.total_points) || 0
  userEditNote.value = user.admin_note || ''
  userEditIsAdmin.value = Boolean(user.is_admin)
  userEditAdminShopSlug.value = user.is_super_admin || user.admin_shop_slug === 'default'
    ? 'default'
    : (user.admin_shop_slug || shopSlug.value || branchShopOptions.value[0]?.slug || 'default')
  userEditError.value = ''
  userEditOpen.value = true
  focusAdminModal('admin-user-edit-modal', 'input[type="text"]:not([disabled])')
}

function closeUserEdit() {
  userEditOpen.value = false
  userEditItem.value = null
}

async function openUserHistory(user) {
  userHistoryUser.value = user
  userHistoryOpen.value = true
  userHistoryBookings.value = []
  userHistoryError.value = ''
  userHistoryLoading.value = true
  try {
    const { data } = await api.get(`/api/admin/users/${user.id}/bookings`)
    userHistoryUser.value = data.user || user
    userHistoryBookings.value = data.bookings || []
  } catch (err) {
    userHistoryError.value = err?.response?.data?.error || 'โหลดประวัติจองไม่สำเร็จ'
  } finally {
    userHistoryLoading.value = false
  }
}

function closeUserHistory() {
  userHistoryOpen.value = false
  userHistoryUser.value = null
  userHistoryBookings.value = []
  userHistoryError.value = ''
}

function bookingTimeRange(booking) {
  return slotLabel(bookingRowToSlot(booking, bookingSlotHours.value))
}

function statusBadgeClass(status) {
  return {
    'user-history-status--awaiting': status === 'awaiting_payment',
    'user-history-status--pending': status === 'pending',
    'user-history-status--done': status === 'done',
    'user-history-status--cancelled': status === 'cancelled',
  }
}

async function saveUserEdit() {
  if (!userEditItem.value) return
  const name = userEditName.value.trim()
  const email = userEditEmail.value.trim()
  const totalPoints = Number(userEditPoints.value)
  if (!name) {
    userEditError.value = 'กรุณาระบุชื่อ'
    return
  }
  if (!email) {
    userEditError.value = 'กรุณาระบุอีเมล'
    return
  }
  if (userEditItem.value.provider === 'phone') {
    const loginId = userEditLoginId.value.trim()
    if (!loginId) {
      userEditError.value = 'กรุณาระบุรหัสล็อกอิน (เบอร์โทร)'
      return
    }
  }
  if (!Number.isInteger(totalPoints) || totalPoints < 0) {
    userEditError.value = 'แต้มต้องเป็นจำนวนเต็มที่ไม่ติดลบ'
    return
  }
  if (userEditItem.value.id === auth.user?.id && userEditIsAdmin.value === false && userEditItem.value.is_admin) {
    userEditError.value = 'ไม่สามารถถอดสิทธิ์แอดมินของตัวเองได้'
    return
  }

  userEditSaving.value = true
  userEditError.value = ''
  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      name,
      email,
      total_points: totalPoints,
      admin_note: userEditNote.value.trim(),
    }
    if (canEditUserAdminRights(userEditItem.value)) {
      payload.is_admin = userEditIsAdmin.value
      if (userEditIsAdmin.value) {
        payload.admin_shop_slug = isSuperAdmin.value
          ? userEditAdminShopSlug.value
          : shopSlug.value
      }
    }
    if (userEditItem.value.provider === 'phone') {
      payload.login_id = userEditLoginId.value.trim()
    }
    const { data } = await api.patch(`/api/admin/users/${userEditItem.value.id}`, payload)
    const idx = users.value.findIndex((u) => u.id === userEditItem.value.id)
    if (idx >= 0 && data?.user) users.value[idx] = data.user
    if (userEditItem.value.id === auth.user?.id) {
      await auth.fetchMe().catch(() => null)
    }
    message.value = 'บันทึกข้อมูลผู้ใช้แล้ว'
    closeUserEdit()
  } catch (err) {
    userEditError.value = err?.response?.data?.error || 'บันทึกไม่สำเร็จ'
  } finally {
    userEditSaving.value = false
  }
}

function providerLabel(p) {
  return { google: 'Google', facebook: 'Facebook', line: 'LINE', phone: 'เบอร์โทร' }[p] || p
}

async function onRenewalShopsChanged() {
  if (shopSlug.value !== 'default') {
    await refreshBranchUsage({ silent: true })
  } else {
    await loadAllShops()
  }
}

function switchTab(tab) {
  if (activeTab.value === tab) return
  if (activeTab.value === 'services') closeServiceDay()
  if (activeTab.value === 'bookings') closeBookingDay()
  if (activeTab.value === 'blocks') {
    closeBlockDay()
    closeDayHoursDate()
  }
  activeTab.value = tab
  message.value = ''
  errorMessage.value = ''
  if (tab === 'revenue') loadRevenueSummary()
  if (tab === 'reviews') loadShowcaseClips()
  if (tab === 'users' && !usersLoaded.value) loadUsers({ reset: true })
  if (tab === 'ui') activeUiSection.value = 0
  if (tab === 'blocks') activeBlocksSection.value = 'shop-hours'
  if (isMobile.value) {
    settingsNavOpen.value = false
    uiNavOpen.value = false
    blocksNavOpen.value = false
  } else {
    settingsNavOpen.value = true
    uiNavOpen.value = true
    blocksNavOpen.value = true
  }
}

const filtered = computed(() => bookings.value)

const bookingMonthLabel = computed(() => {
  const [y, m] = bookingMonth.value.split('-').map(Number)
  return `${serviceThMonths[m - 1]} ${y + 543}`
})

const bookingCalendarWeeks = computed(() => buildCalendarWeeks(bookingMonth.value))

function bookingDayStats(iso) {
  return bookingDaySummary.value[iso] || { unpaid_count: 0, paid_count: 0, cancelled_count: 0 }
}

function bookingDayHasBookings(iso) {
  const stats = bookingDayStats(iso)
  return stats.unpaid_count > 0 || stats.paid_count > 0 || stats.cancelled_count > 0
}

function bookingDayHasUnpaid(iso) {
  return bookingDayStats(iso).unpaid_count > 0
}

function bookingDayColor(iso) {
  return colorForDate(nailOptions.value, iso)
}

function bookingDayStyle(iso) {
  return dayTintStyle(bookingDayColor(iso))
}

function shiftBookingMonth(delta) {
  const [y, m] = bookingMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  bookingMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadBookingCalendarSummary()
}

async function loadBookingCalendarSummary() {
  try {
    const { data } = await api.get('/api/admin/bookings/calendar-summary', {
      params: { month: bookingMonth.value },
    })
    const map = {}
    for (const row of data?.days || data || []) map[row.date] = row
    bookingDaySummary.value = map
    bookingMonthPaidTotal.value = Number(data?.month_paid_count) || 0
    bookingMonthUnpaidTotal.value = Number(data?.month_unpaid_count) || 0
    bookingMonthCancelledTotal.value = Number(data?.month_cancelled_count) || 0
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดปฏิทินคิวไม่สำเร็จ'
  }
}

function openBookingDay(iso) {
  selectedBookingDate.value = iso
  date.value = iso
  status.value = ''
  loadBookings()
}

function closeBookingDay() {
  selectedBookingDate.value = ''
  bookings.value = []
}

async function reloadBookingViews({ silent = false } = {}) {
  await Promise.all([loadBookings({ silent }), loadBookingCalendarSummary()])
  if (activeTab.value === 'revenue') await loadRevenueSummary()
}

async function refreshAdminBookingModalSlots() {
  if (bookingEditOpen.value && bookingEditDate.value) {
    await loadBookingEditDayData(bookingEditDate.value, { preserveForm: true }).catch(() => null)
  }
  if (bookingAddOpen.value && selectedBookingDate.value) {
    await loadBookingAddDayData({ preserveForm: true }).catch(() => null)
  }
}

async function onAdminShopRealtimeUpdate(event) {
  const type = event?.type || 'updated'
  const isBookingEvent = [
    'updated',
    'created',
    'cancelled',
    'payment_confirmed',
    'payment_reverted',
    'completed',
    'restored',
    'unpaid_expired',
    'schedule',
  ].includes(type)

  const tasks = []
  if (isBookingEvent || type === 'options') {
    tasks.push(reloadBookingViews({ silent: true }), refreshAdminBookingModalSlots())
  }
  if (type === 'schedule') {
    tasks.push(
      loadShopHours(),
      loadDayHoursMonth(),
      loadBlocks(),
      loadAdvanceDays(),
      loadBookingDisplay(),
    )
    if (selectedDayHoursDate.value) {
      tasks.push(loadDayHoursForDate(selectedDayHoursDate.value))
    }
  }
  if (type === 'options') {
    tasks.push(loadNailOptions(), loadServiceCategories(), loadServiceLocations())
  }
  if (type === 'settings') {
    tasks.push(
      loadUiSettingsAdmin(),
      loadDepositSetting(),
      loadCouponSetting(),
      loadUnpaidAutoCancelSetting(),
      loadAdvanceDays(),
      loadBookingDisplay(),
      loadShopHours(),
      shopFeaturesStore.fetchForAdmin(),
      refreshAdminBookingModalSlots(),
    )
  }
  if (type === 'reviews') {
    tasks.push(loadShowcaseClips())
  }
  await Promise.all(tasks)
}

useShopRealtime({
  enabled: true,
  shopSlug,
  auth: true,
  onChange: onAdminShopRealtimeUpdate,
})

const revenueMonthLabel = computed(() => {
  const [y, m] = revenueMonth.value.split('-').map(Number)
  return `${serviceThMonths[m - 1]} ${y + 543}`
})

const revenueCalendarWeeks = computed(() => buildCalendarWeeks(revenueMonth.value))

function revenueDayStats(iso) {
  return revenueDaySummary.value[iso] || {
    total_amount: 0,
    deposit_amount: 0,
    done_count: 0,
  }
}

function revenueDayHasData(iso) {
  return revenueDayStats(iso).done_count > 0
}

function revenueDayColor(iso) {
  return colorForDate(nailOptions.value, iso)
}

function revenueDayStyle(iso) {
  return dayTintStyle(revenueDayColor(iso))
}

function formatDayRevenue(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n.toLocaleString('th-TH')
}

function formatDayRevenueCell(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 10000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) {
    const k = n / 1000
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`
  }
  return n.toLocaleString('th-TH')
}

function shiftRevenueMonth(delta) {
  const [y, m] = revenueMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  revenueMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadRevenueSummary()
}

function formatRevenueChangePct(pct, currentTotal) {
  if (pct == null) {
    return {
      text: currentTotal > 0 ? 'ใหม่' : '—',
      className: currentTotal > 0 ? 'revenue-change--up' : '',
      icon: currentTotal > 0 ? 'ti-trending-up' : 'ti-minus',
    }
  }
  const rounded = Math.round(pct * 10) / 10
  if (rounded === 0) {
    return { text: '0%', className: 'revenue-change--flat', icon: '' }
  }
  const sign = rounded > 0 ? '+' : ''
  return {
    text: `${sign}${rounded.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`,
    className: rounded > 0 ? 'revenue-change--up' : 'revenue-change--down',
    icon: rounded > 0 ? 'ti-trending-up' : 'ti-trending-down',
  }
}

const revenueDepositChange = computed(() =>
  formatRevenueChangePct(revenueDepositChangePct.value, revenueMonthDepositTotal.value)
)
const revenueTotalChange = computed(() =>
  formatRevenueChangePct(revenueTotalChangePct.value, revenueMonthTotal.value)
)

async function loadRevenueSummary() {
  revenueLoading.value = true
  try {
    const { data } = await api.get('/api/admin/revenue/summary', {
      params: { month: revenueMonth.value },
    })
    const map = {}
    for (const row of data?.days || []) map[row.date] = row
    revenueDaySummary.value = map
    revenueDepositRate.value = Number(data?.deposit_rate) || 300
    revenueMonthDepositTotal.value = Number(data?.month_deposit_total) || 0
    revenueMonthTotal.value = Number(data?.month_total) || 0
    revenueMonthDoneCount.value = Number(data?.month_done_count) || 0
    revenuePrevMonthDepositTotal.value = Number(data?.prev_month_deposit_total) || 0
    revenuePrevMonthTotal.value = Number(data?.prev_month_total) || 0
    revenueDepositChangePct.value = data?.deposit_change_pct ?? null
    revenueTotalChangePct.value = data?.total_change_pct ?? null
    if (data?.prev_month) {
      const [py, pm] = String(data.prev_month).split('-').map(Number)
      revenuePrevMonthLabel.value = `${serviceThMonths[pm - 1]} ${py + 543}`
    } else {
      revenuePrevMonthLabel.value = ''
    }
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดสรุปยอดไม่สำเร็จ'
  } finally {
    revenueLoading.value = false
  }
}

// ── รูปแบบแสดงเวลาหน้าจองลูกค้า ─────────────
const bookingDisplayMode = ref('slots_2h')
const bookingSlotHours = ref(2)
const extendBookingByServices = ref(false)
const extendBookingPastClose = ref(false)
const bookingMinGapEnabled = ref(false)
const bookingMinGapMinutes = ref(60)

const effectiveMinGapMinutes = computed(() =>
  resolveEffectiveMinGapMinutes(bookingMinGapEnabled.value, bookingMinGapMinutes.value)
)

const displaySlotPreview = computed(() => {
  const slot = normalizeBookingSlotHours(bookingSlotHours.value)
  const result = []
  const step = bookingDisplayMode.value === 'slots_2h' ? slot : 1
  for (let h = shopOpenHour.value; h <= shopLastBookingHour.value; h += step) {
    result.push(slotTimeLabel(h, true, slot))
  }
  return result.join(' · ')
})

async function loadBookingDisplay() {
  try {
    const [{ data: displayData }, { data: slotData }, { data: extendData }, { data: minGapData }] = await Promise.all([
      api.get('/api/admin/settings/booking-display'),
      api.get('/api/admin/settings/booking-slot-hours'),
      api.get('/api/admin/settings/extend-booking-by-services'),
      api.get('/api/admin/settings/booking-min-gap'),
    ])
    bookingDisplayMode.value = displayData.display_mode === 'slots_2h' ? 'slots_2h' : 'normal'
    bookingSlotHours.value = normalizeBookingSlotHours(slotData.slot_hours)
    extendBookingByServices.value = extendData.enabled === true
    extendBookingPastClose.value = extendData.past_close_enabled === true
    bookingMinGapEnabled.value = minGapData.enabled === true
    bookingMinGapMinutes.value = normalizeBookingMinGapMinutes(minGapData.minutes)
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดรูปแบบแสดงเวลาไม่สำเร็จ'
  }
}

async function saveBookingSlotHours() {
  message.value = ''
  errorMessage.value = ''
  const slot = normalizeBookingSlotHours(bookingSlotHours.value)
  const ok = await confirmAdminSave('ยืนยันบันทึก', `ตั้งความยาวคิว ${slot} ชั่วโมง ใช่ไหม`)
  if (!ok) return
  try {
    await api.patch('/api/admin/settings/booking-slot-hours', { slot_hours: slot })
    bookingSlotHours.value = slot
    message.value = `บันทึกความยาวคิว ${slot} ชม. แล้ว`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกความยาวคิวไม่สำเร็จ'
  }
}

async function selectBookingDisplayMode(mode) {
  const next = mode === 'slots_2h' ? 'slots_2h' : 'normal'
  if (bookingDisplayMode.value === next) return
  if (settingToggleSaving.value) return

  const previous = bookingDisplayMode.value
  bookingDisplayMode.value = next
  settingToggleSaving.value = 'booking-display'
  message.value = ''
  errorMessage.value = ''
  const label = next === 'slots_2h'
    ? `ช่วงบล็อก (กระโดด ${bookingSlotHours.value} ชม.)`
    : 'ปกติ (ทีละชม.)'
  try {
    const { data } = await api.patch('/api/admin/settings/booking-display', {
      display_mode: next,
    })
    bookingDisplayMode.value = data.display_mode === 'slots_2h' ? 'slots_2h' : 'normal'
    message.value = `บันทึกแล้ว — ${label}`
  } catch (err) {
    bookingDisplayMode.value = previous
    errorMessage.value = err?.response?.data?.error || 'บันทึกรูปแบบแสดงเวลาไม่สำเร็จ'
  } finally {
    settingToggleSaving.value = ''
  }
}

async function loadBookings({ silent = false } = {}) {
  if (!silent) loading.value = true
  errorMessage.value = ''
  try {
    const params = {}
    if (date.value) params.date = date.value
    if (status.value) params.status = status.value
    const { data } = await api.get('/api/admin/bookings', { params })
    bookings.value = data
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'
  } finally {
    if (!silent) loading.value = false
  }
}

async function loadBlocks() {
  try {
    const [blocksRes, extraRes] = await Promise.all([
      api.get('/api/admin/blocks', { params: { month: blockMonth.value } }),
      api.get('/api/admin/extra-hours', { params: { month: blockMonth.value } }),
    ])
    blocks.value = blocksRes.data
    extraHours.value = extraRes.data
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดรายการปิดวันเวลาไม่สำเร็จ'
  }
}

const blocksByDate = computed(() => {
  const map = {}
  for (const item of blocks.value) {
    const key = formatDateKey(item.block_date)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
})

const blockMonthLabel = computed(() => {
  const [y, m] = blockMonth.value.split('-').map(Number)
  return `${serviceThMonths[m - 1]} ${y + 543}`
})

const blockCalendarWeeks = computed(() => buildCalendarWeeks(blockMonth.value))

const selectedDayBlocks = computed(() => {
  if (!selectedBlockDate.value) return []
  return blocks.value.filter((item) => formatDateKey(item.block_date) === selectedBlockDate.value)
})

const selectedDayExtraHours = computed(() => {
  if (!selectedBlockDate.value) return []
  return extraHours.value.filter((item) => formatDateKey(item.extra_date) === selectedBlockDate.value)
})

function blockDayMarker(iso) {
  const items = blocksByDate.value[iso] || []
  if (!items.length) return null
  if (items.some((b) => b.is_full_day)) return 'full'
  return 'partial'
}

function blockDayColor(iso) {
  return colorForDate(nailOptions.value, iso)
}

function blockDayStyle(iso) {
  return dayTintStyle(blockDayColor(iso))
}

function shiftBlockMonth(delta) {
  const [y, m] = blockMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  blockMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadBlocks()
}

function openBlockDay(iso) {
  activeBlocksSection.value = 'calendar'
  selectedBlockDate.value = iso
  blockDate.value = iso
  message.value = ''
  errorMessage.value = ''
}

function closeBlockDay() {
  selectedBlockDate.value = ''
}

async function loadDepositSetting() {
  try {
    const { data } = await api.get('/api/admin/settings/deposit')
    depositAmount.value = Number(data?.deposit_amount || 300)
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดค่ายอดมัดจำไม่สำเร็จ'
  }
}

async function loadRegisterShopPinSetting() {
  if (!isSuperAdmin.value || shopSlug.value !== 'default') return
  try {
    const { data } = await api.get('/api/admin/settings/register-pin')
    registerShopPin.value = String(data?.pin || '')
    registerShopPinConfigured.value = Boolean(data?.configured)
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดรหัสสร้างร้านไม่สำเร็จ'
  }
}

async function saveRegisterShopPinSetting() {
  const pin = String(registerShopPin.value || '').replace(/\D/g, '').slice(0, 4)
  if (pin && !/^\d{4}$/.test(pin)) {
    errorMessage.value = 'รหัสต้องเป็นตัวเลข 4 หลัก'
    return
  }
  const ok = await confirmAdminSave(
    pin ? 'ยืนยันบันทึกรหัสสร้างร้าน' : 'ยืนยันปิดการสมัครร้าน',
    pin
      ? 'บันทึกรหัสนี้สำหรับสมัครร้านค้าใหม่ใช่ไหม'
      : 'ล้างรหัสจะปิดให้สมัครร้านใหม่ และซ่อนปุ่มสมัครร้านในหน้าล็อกอิน ใช่ไหม'
  )
  if (!ok) return
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch('/api/admin/settings/register-pin', { pin })
    registerShopPin.value = String(data?.pin || '')
    registerShopPinConfigured.value = Boolean(data?.configured)
    message.value = data?.configured
      ? 'บันทึกรหัสสร้างร้านค้าแล้ว — เปิดรับสมัครร้าน'
      : 'ปิดการสมัครร้านแล้ว'
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกรหัสไม่สำเร็จ'
  }
}

function onRegisterPinInput(event) {
  registerShopPin.value = String(event.target.value || '').replace(/\D/g, '').slice(0, 4)
}

async function loadCouponSetting() {
  try {
    const { data } = await api.get('/api/admin/settings/coupon')
    couponDiscountPercent.value = Number(data?.discount_percent) || 20
    couponRequiredPoints.value = Number(data?.required_points) || 100
    couponCompletionPoints.value = Number(data?.completion_points ?? 10)
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดตั้งค่าคูปองไม่สำเร็จ'
  }
}

async function saveCouponSetting() {
  const discount = Number(couponDiscountPercent.value)
  const points = Number(couponRequiredPoints.value)
  const completion = Number(couponCompletionPoints.value)
  if (!Number.isInteger(discount) || discount < 1 || discount > 100) {
    errorMessage.value = 'ส่วนลดต้องอยู่ระหว่าง 1–100%'
    return
  }
  if (!Number.isInteger(points) || points < 1) {
    errorMessage.value = 'แต้มที่ใช้แลกต้องมากกว่า 0'
    return
  }
  if (!Number.isInteger(completion) || completion < 0) {
    errorMessage.value = 'แต้มเมื่อทำเสร็จต้องเป็นจำนวนเต็มที่ไม่ติดลบ'
    return
  }
  const ok = await confirmAdminSave(
    'ยืนยันบันทึกคูปอง',
    `ลด ${discount}% ใช้ ${points.toLocaleString('th-TH')} แต้ม · ทำเสร็จ +${completion.toLocaleString('th-TH')} แต้ม ใช่ไหม`
  )
  if (!ok) return
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch('/api/admin/settings/coupon', {
      discount_percent: discount,
      required_points: points,
      completion_points: completion,
    })
    couponDiscountPercent.value = Number(data.discount_percent) || discount
    couponRequiredPoints.value = Number(data.required_points) || points
    couponCompletionPoints.value = Number(data.completion_points ?? completion)
    message.value = `บันทึกแล้ว: ลด ${couponDiscountPercent.value}% · แลก ${couponRequiredPoints.value} แต้ม · ทำเสร็จ +${couponCompletionPoints.value} แต้ม`
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกตั้งค่าคูปองไม่สำเร็จ'
  }
}

async function loadLinePushSetting() {
  try {
    const { data } = await api.get('/api/admin/settings/line-push')
    linePushEnabled.value = data.enabled !== false
    lineCanEditEnabled.value = data.can_edit_enabled === true
    linePushToId.value = data.push_to_id || ''
    lineTokenConfigured.value = Boolean(data.token_configured)
    lineTokenMasked.value = data.token_masked || ''
    lineSecretConfigured.value = Boolean(data.secret_configured)
    lineSecretMasked.value = data.secret_masked || ''
    lineCentralBotEnabled.value = Boolean(data.central_bot_enabled)
    lineUsesOwnBot.value = Boolean(data.uses_own_bot)
    lineUseOwnBot.value = Boolean(data.use_own_bot)
    lineCanEditUseOwnBot.value = Boolean(data.can_edit_use_own_bot)
    lineWebhookPath.value = data.webhook_url || '/api/line/webhook'
    lineChannelToken.value = ''
    lineChannelSecret.value = ''
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดตั้งค่า LINE แจ้งเตือนไม่สำเร็จ'
  }
}

function syncShopLinePushInList(slug, patch) {
  const shop = allShops.value.find((item) => item.slug === slug)
  if (!shop) return
  Object.assign(shop, patch)
}

async function saveLinePushSetting() {
  const ok = await confirmAdminSave('ยืนยันบันทึก LINE', 'บันทึกการตั้งค่าแจ้งเตือน LINE ใช่ไหม')
  if (!ok) return
  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      push_to_id: linePushToId.value.trim(),
    }
    if (isSuperAdmin.value) {
      payload.enabled = linePushEnabled.value
    }
    if (lineCanEditUseOwnBot.value) {
      payload.use_own_bot = lineUseOwnBot.value
    }
    if (lineUsesOwnBot.value || lineUseOwnBot.value) {
      if (lineChannelToken.value.trim()) {
        payload.channel_access_token = lineChannelToken.value.trim()
      }
      if (lineChannelSecret.value.trim()) {
        payload.channel_secret = lineChannelSecret.value.trim()
      }
    }
    const { data } = await api.patch('/api/admin/settings/line-push', payload)
    linePushEnabled.value = data.enabled !== false
    linePushToId.value = data.push_to_id || ''
    lineTokenConfigured.value = Boolean(data.token_configured)
    lineTokenMasked.value = data.token_masked || ''
    lineSecretConfigured.value = Boolean(data.secret_configured)
    lineSecretMasked.value = data.secret_masked || ''
    lineCentralBotEnabled.value = Boolean(data.central_bot_enabled)
    lineUsesOwnBot.value = Boolean(data.uses_own_bot)
    lineUseOwnBot.value = Boolean(data.use_own_bot)
    lineCanEditUseOwnBot.value = Boolean(data.can_edit_use_own_bot)
    lineWebhookPath.value = data.webhook_url || lineWebhookPath.value
    lineChannelToken.value = ''
    lineChannelSecret.value = ''
    message.value = 'บันทึกการแจ้งเตือน LINE แล้ว'
    const configured = lineUsesOwnBot.value
      ? Boolean(data.token_configured && data.secret_configured && data.push_to_id)
      : Boolean(data.token_configured && data.push_to_id)
    syncShopLinePushInList(shopSlug.value, {
      line_push_enabled: data.enabled !== false,
      line_push_configured: configured,
      line_push_ready: data.enabled !== false && configured,
      line_use_own_bot: Boolean(data.use_own_bot),
    })
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึก LINE แจ้งเตือนไม่สำเร็จ'
  }
}

async function toggleShopLinePush(shop, enabled) {
  if (!shop?.slug || shop.slug === 'default') return
  lineBranchToggling.value = shop.slug
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/shops/${shop.slug}/line-push-enabled`, { enabled })
    syncShopLinePushInList(shop.slug, {
      line_push_enabled: data.line_push_enabled,
      line_push_configured: data.line_push_configured,
      line_push_ready: data.line_push_ready,
    })
    if (shop.slug === shopSlug.value) {
      linePushEnabled.value = data.line_push_enabled !== false
    }
    message.value = `${enabled ? 'เปิด' : 'ปิด'} LINE แจ้งเตือน — ${shop.name}`
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เปลี่ยนสถานะ LINE ไม่สำเร็จ'
  } finally {
    lineBranchToggling.value = ''
  }
}

async function testLinePushSetting() {
  errorMessage.value = ''
  try {
    const { data } = await api.post('/api/admin/settings/line-push/test')
    message.value = data.message || 'ส่งข้อความทดสอบแล้ว'
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ส่งทดสอบ LINE ไม่สำเร็จ'
  }
}

// Boolean settings save the moment they are switched. Only the toggled field is
// sent, so pending edits in the text/number fields next to it stay unsaved until
// their own Save button is pressed.
async function autoSaveSettingToggle({ key, url, payload, label, nextValue, revert, apply }) {
  if (settingToggleSaving.value) {
    revert()
    return
  }
  settingToggleSaving.value = key
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(url, payload)
    apply?.(data)
    message.value = `${nextValue ? 'เปิด' : 'ปิด'} — ${label}`
  } catch (error) {
    revert()
    errorMessage.value = error?.response?.data?.error || `บันทึก "${label}" ไม่สำเร็จ`
  } finally {
    settingToggleSaving.value = ''
  }
}

const chatNotifyToggles = {
  new_booking_enabled: { model: chatNotifyNewBookingEnabled, label: 'แจ้งแอดมินเมื่อมีคิวจองใหม่' },
  upcoming_admin_enabled: { model: chatNotifyUpcomingAdminEnabled, label: 'แจ้งแอดมินก่อนถึงคิว' },
  upcoming_customer_enabled: { model: chatNotifyUpcomingCustomerEnabled, label: 'แจ้งลูกค้าก่อนถึงคิว' },
  cancel_admin_enabled: { model: chatNotifyCancelAdminEnabled, label: 'แจ้งแอดมินเมื่อคิวถูกยกเลิก' },
  cancel_customer_enabled: { model: chatNotifyCancelCustomerEnabled, label: 'แจ้งลูกค้าเมื่อคิวถูกยกเลิก' },
  paid_admin_enabled: { model: chatNotifyPaidAdminEnabled, label: 'แจ้งแอดมินเมื่อชำระเงินแล้ว' },
  paid_customer_enabled: { model: chatNotifyPaidCustomerEnabled, label: 'แจ้งลูกค้าเมื่อชำระเงินแล้ว' },
  slip_admin_enabled: { model: chatNotifySlipAdminEnabled, label: 'แจ้งแอดมินเมื่อลูกค้าอัปโหลดสลิป' },
}

async function saveChatNotifyToggle(field, nextValue) {
  const entry = chatNotifyToggles[field]
  if (!entry) return
  if (typeof nextValue === 'boolean') entry.model.value = nextValue
  await autoSaveSettingToggle({
    key: `chat-notify:${field}`,
    url: '/api/admin/settings/chat-notify',
    payload: { [field]: nextValue },
    label: entry.label,
    nextValue,
    revert: () => { entry.model.value = !nextValue },
    apply: (data) => {
      if (typeof data?.[field] === 'boolean') entry.model.value = data[field]
    },
  })
}

async function saveLinePushToggle(field, nextValue) {
  const model = field === 'enabled' ? linePushEnabled : lineUseOwnBot
  const label = field === 'enabled'
    ? 'แจ้งเตือน LINE เมื่อลูกค้าจองคิว'
    : 'ใช้ LINE Bot ของร้านเอง (Premium)'
  if (typeof nextValue === 'boolean') model.value = nextValue
  await autoSaveSettingToggle({
    key: `line-push:${field}`,
    url: '/api/admin/settings/line-push',
    payload: { [field]: nextValue },
    label,
    nextValue,
    revert: () => { model.value = !nextValue },
    apply: (data) => {
      linePushEnabled.value = data.enabled !== false
      lineUsesOwnBot.value = Boolean(data.uses_own_bot)
      lineUseOwnBot.value = Boolean(data.use_own_bot)
      lineCanEditUseOwnBot.value = Boolean(data.can_edit_use_own_bot)
      lineWebhookPath.value = data.webhook_url || lineWebhookPath.value
      syncShopLinePushInList(shopSlug.value, {
        line_push_enabled: data.enabled !== false,
        line_use_own_bot: Boolean(data.use_own_bot),
      })
    },
  })
}

async function saveUnpaidAutoCancelToggle(nextValue) {
  if (typeof nextValue === 'boolean') unpaidAutoCancelEnabled.value = nextValue
  await autoSaveSettingToggle({
    key: 'unpaid:enabled',
    url: '/api/admin/settings/unpaid-auto-cancel',
    payload: { enabled: nextValue, expire_hours: unpaidExpireHoursSaved.value },
    label: 'ยกเลิกคิวรอชำระอัตโนมัติ',
    nextValue,
    revert: () => { unpaidAutoCancelEnabled.value = !nextValue },
    apply: (data) => { unpaidAutoCancelEnabled.value = data.enabled !== false },
  })
}

async function saveExtendBookingToggle(field, nextValue) {
  const model = field === 'enabled' ? extendBookingByServices : extendBookingPastClose
  const label = field === 'enabled'
    ? 'ขยายเวลาจองตามบริการ'
    : 'ขยายเวลาเกินเวลาปิดร้าน'
  if (typeof nextValue === 'boolean') model.value = nextValue
  await autoSaveSettingToggle({
    key: `extend-booking:${field}`,
    url: '/api/admin/settings/extend-booking-by-services',
    payload: { [field === 'enabled' ? 'enabled' : 'past_close_enabled']: nextValue },
    label,
    nextValue,
    revert: () => { model.value = !nextValue },
    apply: (data) => {
      extendBookingByServices.value = data.enabled === true
      extendBookingPastClose.value = data.past_close_enabled === true
    },
  })
}

async function saveBookingMinGapToggle(nextValue) {
  if (typeof nextValue === 'boolean') bookingMinGapEnabled.value = nextValue
  await autoSaveSettingToggle({
    key: 'booking-min-gap:enabled',
    url: '/api/admin/settings/booking-min-gap',
    payload: { enabled: nextValue },
    label: 'เปิดจองช่องว่างระหว่างคิว',
    nextValue,
    revert: () => { bookingMinGapEnabled.value = !nextValue },
    apply: (data) => {
      bookingMinGapEnabled.value = data.enabled === true
      bookingMinGapMinutes.value = normalizeBookingMinGapMinutes(data.minutes)
    },
  })
}

async function saveBookingMinGapMinutes() {
  const minutes = normalizeBookingMinGapMinutes(bookingMinGapMinutes.value)
  bookingMinGapMinutes.value = minutes
  settingToggleSaving.value = 'booking-min-gap:minutes'
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch('/api/admin/settings/booking-min-gap', { minutes })
    bookingMinGapMinutes.value = normalizeBookingMinGapMinutes(data.minutes)
    message.value = `บันทึกช่องว่างขั้นต่ำ ${bookingMinGapMinutes.value} นาทีแล้ว`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกช่องว่างขั้นต่ำไม่สำเร็จ'
  } finally {
    settingToggleSaving.value = ''
  }
}

async function loadChatNotifySetting() {
  try {
    const { data } = await api.get('/api/admin/settings/chat-notify')
    chatNotifyNewBookingEnabled.value = data.new_booking_enabled !== false
    chatNotifyUpcomingAdminEnabled.value = data.upcoming_admin_enabled !== false
    chatNotifyUpcomingCustomerEnabled.value = data.upcoming_customer_enabled !== false
    chatNotifyUpcomingMinutes.value = Number(data.upcoming_minutes) || 30
    chatNotifyCancelAdminEnabled.value = data.cancel_admin_enabled !== false
    chatNotifyCancelCustomerEnabled.value = data.cancel_customer_enabled !== false
    chatNotifyPaidAdminEnabled.value = data.paid_admin_enabled === true
    chatNotifyPaidCustomerEnabled.value = data.paid_customer_enabled !== false
    chatNotifySlipAdminEnabled.value = data.slip_admin_enabled !== false
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดตั้งค่าแจ้งเตือนในแอปไม่สำเร็จ'
  }
}

async function saveChatNotifySetting() {
  const minutes = Number(chatNotifyUpcomingMinutes.value)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    errorMessage.value = 'เวลาแจ้งเตือนก่อนคิวต้องเป็น 1–1440 นาที'
    return
  }

  const ok = await confirmAdminSave('ยืนยันบันทึก', `แจ้งก่อนถึงคิว ${minutes} นาที ใช่ไหม`)
  if (!ok) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch('/api/admin/settings/chat-notify', {
      upcoming_minutes: minutes,
    })
    chatNotifyUpcomingMinutes.value = Number(data.upcoming_minutes) || minutes
    message.value = 'บันทึกเวลาแจ้งก่อนถึงคิวแล้ว'
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกแจ้งเตือนในแอปไม่สำเร็จ'
  }
}

async function loadUnpaidAutoCancelSetting() {
  try {
    const { data } = await api.get('/api/admin/settings/unpaid-auto-cancel')
    unpaidAutoCancelEnabled.value = data.enabled !== false
    unpaidExpireHours.value = Number(data.expire_hours) || 24
    unpaidExpireHoursSaved.value = unpaidExpireHours.value
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดตั้งค่ายกเลิกอัตโนมัติไม่สำเร็จ'
  }
}

async function saveUnpaidAutoCancelSetting() {
  const hours = Number(unpaidExpireHours.value)
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    errorMessage.value = 'เวลายกเลิกต้องเป็นจำนวนเต็ม 1–168 ชั่วโมง'
    return
  }

  const ok = await confirmAdminSave(
    'ยืนยันบันทึก',
    unpaidAutoCancelEnabled.value
      ? `เปิดยกเลิกอัตโนมัติ — คิวรอชำระจะถูกยกเลิกหลัง <strong>${hours} ชม.</strong>`
      : 'ปิดยกเลิกอัตโนมัติ — คิวรอชำระจะไม่ถูกยกเลิกเอง'
  )
  if (!ok) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch('/api/admin/settings/unpaid-auto-cancel', {
      enabled: unpaidAutoCancelEnabled.value,
      expire_hours: hours,
    })
    unpaidAutoCancelEnabled.value = data.enabled !== false
    unpaidExpireHours.value = Number(data.expire_hours) || hours
    unpaidExpireHoursSaved.value = unpaidExpireHours.value
    message.value = unpaidAutoCancelEnabled.value
      ? `บันทึกแล้ว: ยกเลิกอัตโนมัติหลัง ${unpaidExpireHours.value} ชม.`
      : 'บันทึกแล้ว: ปิดยกเลิกอัตโนมัติ'
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกตั้งค่าไม่สำเร็จ'
  }
}

async function saveDepositSetting() {
  const ok = await confirmAdminSave(
    'ยืนยันบันทึกยอดมัดจำ',
    `ตั้งยอดมัดจำเป็น ${depositAmount.value} บาท ใช่ไหม`
  )
  if (!ok) return

  message.value = ''
  errorMessage.value = ''
  try {
    const payload = { deposit_amount: Number(depositAmount.value) }
    const { data } = await api.patch('/api/admin/settings/deposit', payload)
    depositAmount.value = Number(data?.deposit_amount || depositAmount.value)
    message.value = 'บันทึกยอดมัดจำแล้ว'
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกยอดมัดจำไม่สำเร็จ'
  }
}

function formatYmdLocal(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function formatDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    return formatYmdLocal(new Date(value))
  }
  return formatYmdLocal(new Date(value))
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return formatYmdLocal(dt)
}

const bulkEndDate = computed(() => addDaysIso(bulkStartDate.value, bulkDays.value - 1))

const bulkPreviewText = computed(() => {
  if (bulkBlockType.value === 'full_day') {
    return `ปิดทั้งวัน ${bulkDays.value} วัน (${bulkStartDate.value} → ${bulkEndDate.value})`
  }
  return `ปิดเวลา ${bulkBlockStart.value}:00–${bulkBlockEnd.value}:00 ต่อเนื่อง ${bulkDays.value} วัน (${bulkStartDate.value} → ${bulkEndDate.value})`
})

async function createBulkBlocks() {
  const isFullDay = bulkBlockType.value === 'full_day'
  if (!isFullDay) {
    const start = Number(bulkBlockStart.value)
    const end = Number(bulkBlockEnd.value)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errorMessage.value = 'ช่วงเวลาปิดไม่ถูกต้อง (ชั่วโมงสิ้นสุดต้องมากกว่าเวลาเริ่ม)'
      return
    }
  }
  const rangeText = isFullDay
    ? `ปิดทั้งวัน ${bulkDays.value} วัน (${bulkStartDate.value} ถึง ${bulkEndDate.value})`
    : `ปิดเวลา ${bulkBlockStart.value}:00-${bulkBlockEnd.value}:00 จำนวน ${bulkDays.value} วัน (${bulkStartDate.value} ถึง ${bulkEndDate.value})`

  const ok = await adminSwal.fire({
    title: 'ยืนยันปิดล่วงหน้า',
    text: rangeText,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      start_date: bulkStartDate.value,
      days: Number(bulkDays.value),
      is_full_day: isFullDay,
      note: bulkBlockNote.value || null,
    }
    if (!isFullDay) {
      payload.start_hour = Number(bulkBlockStart.value)
      payload.end_hour = Number(bulkBlockEnd.value)
    }
    const { data } = await api.post('/api/admin/blocks/bulk', payload)
    message.value = data?.message || `ปิดรับคิวแล้ว ${data?.created || 0} วัน`
    blockMonth.value = bulkStartDate.value.slice(0, 7)
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ปิดล่วงหน้าไม่สำเร็จ'
  }
}

async function createBlock() {
  if (blockType.value !== 'full_day') {
    const start = Number(blockStart.value)
    const end = Number(blockEnd.value)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errorMessage.value = 'ช่วงเวลาปิดไม่ถูกต้อง (ชั่วโมงสิ้นสุดต้องมากกว่าเวลาเริ่ม)'
      return
    }
  }

  const ok = await adminSwal.fire({
    title: 'ยืนยันเพิ่มรายการปิด',
    text: 'ต้องการเพิ่มรายการปิดวัน/เวลาใช่ไหม',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      block_date: blockDate.value,
      is_full_day: blockType.value === 'full_day',
      note: blockNote.value || null,
    }
    if (blockType.value !== 'full_day') {
      payload.start_hour = Number(blockStart.value)
      payload.end_hour = Number(blockEnd.value)
    }
    await api.post('/api/admin/blocks', payload)
    message.value = 'เพิ่มช่วงเวลาปิดรับคิวแล้ว'
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เพิ่มช่วงเวลาปิดรับคิวไม่สำเร็จ'
  }
}

async function removeBlock(id) {
  const ok = await adminSwal.fire({
    title: 'ยืนยันลบรายการ',
    text: 'ลบรายการปิดวัน/เวลานี้ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/blocks/${id}`)
    message.value = 'ลบรายการปิดวันเวลาแล้ว'
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ลบรายการไม่สำเร็จ'
  }
}

async function createExtraHour() {
  const start = Number(extraStart.value)
  const end = Number(extraEnd.value)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    errorMessage.value = 'ช่วงเวลาเปิดเพิ่มไม่ถูกต้อง (ชั่วโมงสิ้นสุดต้องมากกว่าเวลาเริ่ม)'
    return
  }
  if (end - start < bookingSlotHours.value) {
    errorMessage.value = `ช่วงเปิดเพิ่มต้องยาวอย่างน้อย ${bookingSlotHours.value} ชั่วโมง (ตามความยาวคิว)`
    return
  }

  message.value = ''
  errorMessage.value = ''
  try {
    await api.post('/api/admin/extra-hours', {
      extra_date: selectedBlockDate.value,
      start_hour: start,
      end_hour: end,
      note: extraNote.value || null,
    })
    message.value = 'เพิ่มช่วงเปิดรับพิเศษแล้ว'
    extraNote.value = ''
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เพิ่มช่วงเปิดรับพิเศษไม่สำเร็จ'
  }
}

async function removeExtraHour(id) {
  const ok = await adminSwal.fire({
    title: 'ยืนยันลบรายการ',
    text: 'ลบช่วงเปิดรับพิเศษนี้ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/extra-hours/${id}`)
    message.value = 'ลบช่วงเปิดรับพิเศษแล้ว'
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ลบรายการไม่สำเร็จ'
  }
}

function formatBookingTotal(value) {
  if (value == null || value === '') return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toLocaleString('th-TH')} บาท`
}

function sumBookingOptionPrices(booking) {
  const opts = booking?.nail_options || []
  if (!opts.length) return null
  let sum = 0
  let hasPrice = false
  for (const opt of opts) {
    const price = Number(opt.price)
    if (Number.isFinite(price)) {
      sum += price
      hasPrice = true
    }
  }
  return hasPrice ? sum : null
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bookingNetAfterDeposit(booking) {
  const totalPrice = sumBookingOptionPrices(booking)
  const deposit = Number(depositAmount.value) || 0
  if (totalPrice == null) return null
  return Math.max(0, totalPrice - deposit)
}

function buildMarkDoneSummaryHtml(booking) {
  const opts = booking?.nail_options || []
  const services = opts.length
    ? opts.map((opt) => {
        const price = Number(opt.price)
        const priceLabel = Number.isFinite(price) ? ` (${price.toLocaleString('th-TH')} บาท)` : ''
        return `${escapeHtml(opt.option_name)}${priceLabel}`
      }).join('<br>')
    : '-'
  const totalPrice = sumBookingOptionPrices(booking)
  const deposit = Number(depositAmount.value) || 0
  const netTotal = bookingNetAfterDeposit(booking)
  return `
    <div style="text-align:left;font-size:14px;line-height:1.55;margin-bottom:12px">
      <p style="margin:0 0 10px"><strong>บริการที่ทำ</strong><br>${services}</p>
      <p style="margin:0 0 6px"><strong>ราคา</strong> ${totalPrice != null ? `${totalPrice.toLocaleString('th-TH')} บาท` : '-'}</p>
      <p style="margin:0 0 6px"><strong>มัดจำ</strong> ${deposit.toLocaleString('th-TH')} บาท</p>
      <p style="margin:0"><strong>ราคารวมหักมัดจำแล้ว</strong> ${netTotal != null ? `${netTotal.toLocaleString('th-TH')} บาท` : '-'}</p>
    </div>
  `
}

async function markDone(booking) {
  const item = booking && typeof booking === 'object' ? booking : bookings.value.find((row) => row.id === booking)
  if (!item?.id) return
  const pts = Number(couponCompletionPoints.value) || 0
  const pointsHint = pts > 0 ? `ลูกค้าจะได้รับ +${pts.toLocaleString('th-TH')} แต้ม` : 'ไม่มีการให้แต้ม'
  const suggestedTotal = bookingNetAfterDeposit(item)
  const result = await adminSwal.fire({
    title: 'ทำคิวเสร็จ',
    html: `${buildMarkDoneSummaryHtml(item)}<p style="margin:12px 0 0;font-size:13px;color:#9A8E89">กรอกยอดเงินแล้วยืนยัน — ${pointsHint}</p>`,
    input: 'number',
    inputLabel: 'ยอดเงิน (บาท)',
    inputValue: suggestedTotal != null ? String(suggestedTotal) : '',
    inputAttributes: { min: 0, step: 1 },
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => {
      const n = Number(value)
      if (value === '' || !Number.isFinite(n) || n < 0) return 'กรุณากรอกยอดเงินที่ถูกต้อง'
      return undefined
    },
  })
  if (!result.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${item.id}/complete`, {
      total: Number(result.value),
    })
    message.value = data?.message || 'อัปเดตสำเร็จ'
    await Promise.all([reloadBookingViews(), auth.fetchMe().catch(() => null)])
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'อัปเดตไม่สำเร็จ'
  }
}

async function loadBookingEditDayData(date, { preserveForm = false } = {}) {
  if (!date) return
  if (!preserveForm) {
    bookingEditLoading.value = true
    bookingEditError.value = ''
  }
  try {
    const [optionsRes, extraRes, dayHoursRes, dayRes] = await Promise.all([
      api.get('/api/bookings/options', { params: { date } }),
      api.get('/api/bookings/extra-hours', { params: { from: date, to: date } }),
      api.get('/api/bookings/day-hours', { params: { date } }),
      api.get('/api/bookings', { params: { date } }),
    ])
    bookingEditExtraHours.value = extraRes.data || []
    bookingEditDayHours.value = dayHoursRes.data || []
    bookingEditSlotBookings.value = dayRes.data?.bookings || []
    bookingEditSlotBlocks.value = dayRes.data?.blocks || []
    const normalized = normalizeBookingOptionsResponse(optionsRes.data)
    bookingEditOptions.value = normalized.options
    bookingEditCategories.value = normalized.categories

    const availableIds = new Set(bookingEditOptions.value.map((o) => String(o.id)))
    let selected = bookingEditSelectedIds.value.filter((id) => availableIds.has(String(id)))
    for (const opt of bookingEditOptions.value) {
      if (
        opt.is_required
        && optionBookableOnDate(opt, date)
        && !selected.includes(String(opt.id))
      ) {
        selected.push(String(opt.id))
      }
    }
    bookingEditSelectedIds.value = selected
    if (!preserveForm) bookingEditMoveToSlotKey.value = ''
    syncCategorySelection(
      bookingEditCategories.value,
      bookingEditOptions.value,
      bookingEditDate.value,
      bookingEditSelectedCategoryId,
      bookingEditSelectedIds.value
    )
  } catch (error) {
    bookingEditError.value = error?.response?.data?.error || 'โหลดข้อมูลวันจองไม่สำเร็จ'
  } finally {
    if (!preserveForm) bookingEditLoading.value = false
  }
}

async function onBookingEditDateChange() {
  bookingEditError.value = ''
  await loadBookingEditDayData(bookingEditDate.value)
}

async function editBooking(item) {
  bookingEditItem.value = item
  bookingEditTotal.value = item.total != null ? String(Number(item.total)) : '0'
  bookingEditUserId.value = item.user_id ? String(item.user_id) : ''
  bookingEditUserQuery.value = ''
  bookingEditDate.value = item.booking_date || selectedBookingDate.value || ''
  bookingEditOriginalDate.value = bookingEditDate.value
  bookingEditOriginalSlotKey.value = slotKey(bookingRowToSlot(item, bookingSlotHours.value))
  bookingEditMoveToSlotKey.value = ''
  bookingEditExtraHours.value = []
  bookingEditDayHours.value = []
  bookingEditSlotBookings.value = []
  bookingEditSlotBlocks.value = []
  bookingEditSelectedIds.value = (item.nail_options || []).map((o) => String(o.id))
  bookingEditOptions.value = []
  bookingEditCategories.value = []
  bookingEditSelectedCategoryId.value = ''
  bookingEditError.value = ''
  bookingEditLoading.value = true
  bookingEditOpen.value = true

  try {
    await ensureUsersLoaded()
    const { data: hoursData } = await api.get('/api/bookings/shop-hours')
    shopOpenHour.value = normalizeShopOpenHour(hoursData?.open_hour)
    shopLastBookingHour.value = normalizeShopLastBookingHour(hoursData?.last_booking_hour, shopOpenHour.value)
    await loadBookingEditDayData(bookingEditDate.value)
  } catch (error) {
    bookingEditError.value = error?.response?.data?.error || 'โหลดรายการบริการไม่สำเร็จ'
  } finally {
    bookingEditLoading.value = false
    focusAdminModal(
      'admin-booking-edit-modal',
      isBookingRestoreMode.value ? 'select.booking-restore-slot' : 'input[type="date"]'
    )
  }
}

function closeBookingEdit() {
  bookingEditOpen.value = false
  bookingEditItem.value = null
  bookingRestoreStatus.value = ''
  bookingRestoreConflictHint.value = ''
}

function isRestoreSlotConflict(error) {
  const data = error?.response?.data
  if (data?.code === 'SLOT_TAKEN' || data?.code === 'SLOT_BLOCKED') return true
  const msg = String(data?.error || '')
  return error?.response?.status === 409 && /ทับกับคิว|ถูกจอง|ปิดรับคิว/.test(msg)
}

async function openRestoreTimePicker(item, restoreStatus, conflictHint) {
  bookingRestoreStatus.value = restoreStatus
  bookingRestoreConflictHint.value = conflictHint || 'เวลาเดิมมีคนจองแล้ว กรุณาเลือกวันหรือเวลาใหม่'
  await editBooking(item)
}

async function submitRestoreBooking(item, restoreStatus, slotOverride = null) {
  const payload = { status: restoreStatus }
  if (slotOverride) {
    payload.booking_date = slotOverride.bookingDate
    payload.start_hour = slotOverride.startHour
    payload.start_minute = slotOverride.startMinute ?? 0
  }
  const { data } = await api.patch(`/api/admin/bookings/${item.id}/restore`, payload)
  message.value = data?.message || 'คืนสถานะจองแล้ว'
  if (slotOverride?.bookingDate) {
    selectedBookingDate.value = slotOverride.bookingDate
    date.value = slotOverride.bookingDate
  }
  await reloadBookingViews()
}

async function saveBookingEdit() {
  if (!bookingEditItem.value) return
  if (isBookingRestoreMode.value) {
    if (!bookingEditDate.value) {
      bookingEditError.value = 'กรุณาเลือกวันจอง'
      return
    }
    const slot = parseSlotKey(bookingEditMoveToSlotKey.value)
    if (!slot) {
      bookingEditError.value = 'กรุณาเลือกเวลาว่างเพื่อคืนสถานะจอง'
      return
    }
    bookingEditSaving.value = true
    bookingEditError.value = ''
    message.value = ''
    errorMessage.value = ''
    try {
      await submitRestoreBooking(bookingEditItem.value, bookingRestoreStatus.value, {
        bookingDate: bookingEditDate.value,
        startHour: slot.startHour,
        startMinute: slot.startMinute,
      })
      closeBookingEdit()
    } catch (error) {
      bookingEditError.value = error?.response?.data?.error || 'คืนสถานะจองไม่สำเร็จ'
    } finally {
      bookingEditSaving.value = false
    }
    return
  }
  if (!bookingEditUserId.value) {
    bookingEditError.value = 'กรุณาเลือกลูกค้า'
    return
  }
  const total = bookingEditTotal.value === '' ? 0 : Number(bookingEditTotal.value)
  if (!Number.isFinite(total) || total < 0) {
    bookingEditError.value = 'กรุณากรอกยอดเงินที่ถูกต้อง'
    return
  }
  if (!bookingEditSelectedIds.value.length) {
    bookingEditError.value = 'กรุณาเลือกบริการอย่างน้อย 1 รายการ'
    return
  }
  if (!bookingEditDate.value) {
    bookingEditError.value = 'กรุณาเลือกวันจอง'
    return
  }
  const selectedSlotKey = bookingEditMoveToSlotKey.value || bookingEditOriginalSlotKey.value
  const slot = parseSlotKey(selectedSlotKey)
  if (!slot) {
    bookingEditError.value = 'กรุณาเลือกเวลา'
    return
  }

  bookingEditSaving.value = true
  bookingEditError.value = ''
  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      total,
      user_id: bookingEditUserId.value,
      booking_date: bookingEditDate.value,
      start_hour: slot.startHour,
      start_minute: slot.startMinute,
      nailoption_ids: bookingEditSelectedIds.value,
    }
    const { data } = await api.patch(`/api/admin/bookings/${bookingEditItem.value.id}`, payload)
    message.value = data?.message || 'บันทึกแล้ว'
    const movedDate = bookingEditDate.value
    closeBookingEdit()
    if (movedDate) {
      selectedBookingDate.value = movedDate
      date.value = movedDate
    }
    await reloadBookingViews()
  } catch (error) {
    bookingEditError.value = error?.response?.data?.error || 'บันทึกไม่สำเร็จ'
  } finally {
    bookingEditSaving.value = false
  }
}

async function confirmPayment(id) {
  const ok = await adminSwal.fire({
    title: 'ยืนยันชำระเงิน',
    text: 'ลูกค้าโอนเงินแล้วใช่ไหม',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/confirm-payment`)
    message.value = data?.message || 'ยืนยันชำระเงินสำเร็จ'
    await reloadBookingViews()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ยืนยันชำระเงินไม่สำเร็จ'
  }
}

async function revertPayment(id) {
  const ok = await adminSwal.fire({
    title: 'เปลี่ยนเป็นรอชำระเงิน',
    text: 'คิวจะกลับไปสถานะยังไม่ชำระ และเริ่มนับเวลาชำระใหม่',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/revert-payment`)
    message.value = data?.message || 'เปลี่ยนเป็นรอชำระเงินแล้ว'
    await reloadBookingViews()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เปลี่ยนสถานะไม่สำเร็จ'
  }
}

async function useCoupon() {
  message.value = ''
  errorMessage.value = ''
  const code = String(useCouponCode.value || '').trim().toUpperCase()
  if (!code) {
    errorMessage.value = 'กรุณากรอกรหัสคูปอง'
    return
  }

  const ok = await adminSwal.fire({
    title: 'ยืนยันใช้คูปอง',
    text: `ใช้คูปองรหัส ${code} ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันใช้',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  try {
    const { data } = await api.patch('/api/admin/coupons/use', { coupon_code: code })
    message.value = data?.message || 'ใช้คูปองเรียบร้อยแล้ว'
    useCouponCode.value = ''
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ใช้คูปองไม่สำเร็จ'
  }
}

async function cancelUnpaid(id) {
  const ok = await adminSwal.fire({
    title: 'ยืนยันยกเลิกคิว',
    text: 'ลูกค้าไม่ชำระเงิน ต้องการยกเลิกคิวนี้ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/cancel-unpaid`)
    message.value = data?.message || 'ยกเลิกคิวที่ยังไม่ชำระเงินแล้ว'
    await reloadBookingViews()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ยกเลิกคิวไม่สำเร็จ'
  }
}

async function cancelPaid(id) {
  const ok = await adminSwal.fire({
    title: 'ยืนยันยกเลิกคิวชำระแล้ว',
    html: 'ใช้กรณีลูกค้าขอเลื่อนวัน/ยกเลิกคิว<br>ช่วงเวลานี้จะว่างให้จองใหม่ได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/cancel-paid`)
    message.value = data?.message || 'ยกเลิกคิวชำระแล้วแล้ว'
    await reloadBookingViews()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ยกเลิกคิวไม่สำเร็จ'
  }
}

async function deleteBooking(id) {
  const ok = await adminSwal.fire({
    title: 'ลบรายการจอง',
    text: 'ลบคิวที่ยกเลิกแล้วออกจากระบบ ใช่ไหม? ไม่สามารถกู้คืนได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#C45C5C',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.delete(`/api/admin/bookings/${id}`)
    message.value = data?.message || 'ลบรายการจองแล้ว'
    await reloadBookingViews()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ลบรายการจองไม่สำเร็จ'
  }
}

async function restoreBooking(item) {
  const result = await adminSwal.fire({
    title: 'คืนสถานะจอง',
    html: 'คืนคิวที่ยกเลิกแล้วกลับมาใช้งานได้อีกครั้ง<br>เลือกสถานะหลังคืน<br><small class="muted">ถ้าเลือกรอชำระเงิน ระบบจะเริ่มนับเวลาชำระใหม่</small>',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'รอชำระเงิน',
    cancelButtonText: 'ปิด',
    showDenyButton: true,
    denyButtonText: 'ชำระแล้ว / รอให้บริการ',
  })
  if (!result.isConfirmed && !result.isDenied) return

  const restoreStatus = result.isDenied ? 'pending' : 'awaiting_payment'
  message.value = ''
  errorMessage.value = ''
  try {
    await submitRestoreBooking(item, restoreStatus)
  } catch (error) {
    if (isRestoreSlotConflict(error)) {
      await openRestoreTimePicker(
        item,
        restoreStatus,
        error?.response?.data?.error || 'เวลาเดิมมีคนจองแล้ว กรุณาเลือกวันหรือเวลาใหม่'
      )
      return
    }
    errorMessage.value = error?.response?.data?.error || 'คืนสถานะจองไม่สำเร็จ'
  }
}

async function loadBookingAddDayData({ preserveForm = false } = {}) {
  if (!selectedBookingDate.value) return
  if (!preserveForm) bookingAddLoading.value = true
  try {
    const date = selectedBookingDate.value
    const [hoursRes, optionsRes, extraRes, dayHoursRes, dayRes] = await Promise.all([
      api.get('/api/bookings/shop-hours'),
      api.get('/api/bookings/options', { params: { date } }),
      api.get('/api/bookings/extra-hours', { params: { from: date, to: date } }),
      api.get('/api/bookings/day-hours', { params: { date } }),
      api.get('/api/bookings', { params: { date } }),
    ])
    shopOpenHour.value = normalizeShopOpenHour(hoursRes.data?.open_hour)
    shopLastBookingHour.value = normalizeShopLastBookingHour(
      hoursRes.data?.last_booking_hour,
      shopOpenHour.value,
      bookingSlotHours.value
    )
    bookingAddExtraHours.value = extraRes.data || []
    bookingAddDayHours.value = dayHoursRes.data || []
    bookingAddSlotBookings.value = dayRes.data?.bookings || []
    bookingAddSlotBlocks.value = dayRes.data?.blocks || []
    const hourOpts = buildBookingSlotSelectOptions({
      openHour: shopOpenHour.value,
      lastBookingHour: shopLastBookingHour.value,
      extras: bookingAddExtraHours.value,
      dayWindows: bookingAddDayHours.value,
      blocks: bookingAddSlotBlocks.value,
      bookings: bookingAddSlotBookings.value,
      displayMode: bookingDisplayMode.value,
      slotHours: bookingSlotHours.value,
      extendByServices: extendBookingByServices.value,
      minGapMinutes: effectiveMinGapMinutes.value,
    })
    if (!preserveForm || !hourOpts.some((opt) => opt.key === bookingAddSlotKey.value)) {
      bookingAddSlotKey.value = hourOpts[0]?.key || ''
    }
    const normalized = normalizeBookingOptionsResponse(optionsRes.data)
    bookingAddOptions.value = normalized.options
    bookingAddCategories.value = normalized.categories
    const availableIds = new Set(bookingAddOptions.value.map((o) => String(o.id)))
    let selected = preserveForm
      ? bookingAddSelectedIds.value.filter((id) => availableIds.has(String(id)))
      : []
    for (const opt of bookingAddOptions.value) {
      if (opt.is_required && optionBookableOnDate(opt, date) && !selected.includes(String(opt.id))) {
        selected.push(String(opt.id))
      }
    }
    bookingAddSelectedIds.value = selected
    syncCategorySelection(
      bookingAddCategories.value,
      bookingAddOptions.value,
      date,
      bookingAddSelectedCategoryId
    )
  } catch (error) {
    bookingAddError.value = error?.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'
  } finally {
    if (!preserveForm) bookingAddLoading.value = false
  }
}

async function openBookingAdd() {
  if (!selectedBookingDate.value) return
  bookingAddUserId.value = ''
  bookingAddUserQuery.value = ''
  bookingAddSlotKey.value = ''
  bookingAddStatus.value = selectedBookingDate.value < todayYmd() ? 'done' : 'pending'
  bookingAddTotal.value = ''
  bookingAddSelectedIds.value = []
  bookingAddOptions.value = []
  bookingAddCategories.value = []
  bookingAddSelectedCategoryId.value = ''
  bookingAddExtraHours.value = []
  bookingAddDayHours.value = []
  bookingAddSlotBookings.value = []
  bookingAddSlotBlocks.value = []
  bookingAddError.value = ''
  bookingAddOpen.value = true
  await ensureUsersLoaded()
  await loadBookingAddDayData()
}

function closeBookingAdd() {
  bookingAddOpen.value = false
}

async function saveBookingAdd() {
  if (!selectedBookingDate.value) return
  if (!bookingAddUserId.value) {
    bookingAddError.value = 'กรุณาเลือกลูกค้า'
    return
  }
  if (!bookingAddSelectedIds.value.length) {
    bookingAddError.value = 'กรุณาเลือกบริการอย่างน้อย 1 รายการ'
    return
  }
  if (bookingAddStatus.value === 'done') {
    const total = Number(bookingAddTotal.value)
    if (bookingAddTotal.value === '' || !Number.isFinite(total) || total < 0) {
      bookingAddError.value = 'สถานะทำเสร็จแล้วต้องระบุยอดเงิน'
      return
    }
  }

  bookingAddSaving.value = true
  bookingAddError.value = ''
  try {
    const slot = parseSlotKey(bookingAddSlotKey.value)
    if (!slot) {
      bookingAddError.value = 'กรุณาเลือกเวลา'
      bookingAddSaving.value = false
      return
    }
    const payload = {
      user_id: bookingAddUserId.value,
      booking_date: selectedBookingDate.value,
      start_hour: slot.startHour,
      start_minute: slot.startMinute,
      end_hour: slot.endHour,
      end_minute: slot.endMinute,
      nailoption_ids: bookingAddSelectedIds.value,
      status: bookingAddStatus.value,
    }
    if (bookingAddTotal.value !== '') {
      payload.total = Number(bookingAddTotal.value)
    }
    const { data } = await api.post('/api/admin/bookings', payload)
    message.value = data?.message || 'เพิ่มคิวแล้ว'
    closeBookingAdd()
    await reloadBookingViews()
    if (bookingAddStatus.value === 'done') {
      await auth.fetchMe().catch(() => null)
    }
  } catch (error) {
    bookingAddError.value = error?.response?.data?.error || 'เพิ่มคิวไม่สำเร็จ'
  } finally {
    bookingAddSaving.value = false
  }
}

function optionCountForDate(iso) {
  return nailOptions.value.filter((item) => optionBookableOnDate(item, iso)).length
}

function serviceDayColor(iso) {
  return colorForDate(nailOptions.value, iso)
}

function serviceDayStyle(iso) {
  return dayTintStyle(serviceDayColor(iso))
}

function setOptionColor(color) {
  optionForm.value.color = color
  optionFormUseColor.value = true
}

const serviceMonthLabel = computed(() => {
  const [y, m] = serviceMonth.value.split('-').map(Number)
  return `${serviceThMonths[m - 1]} ${y + 543}`
})

const serviceCalendarWeeks = computed(() => buildCalendarWeeks(serviceMonth.value))

function sortByDisplayOrder(items) {
  return [...items].sort((a, b) => {
    const orderDiff = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    if (orderDiff !== 0) return orderDiff
    return String(a.option_name || '').localeCompare(String(b.option_name || ''), 'th')
  })
}

const selectedDayOptions = computed(() => {
  if (!selectedServiceDate.value) return []
  return sortByDisplayOrder(
    nailOptions.value.filter((item) => optionVisibleOnDate(item, selectedServiceDate.value))
  )
})

const everyDayOptions = computed(() =>
  sortByDisplayOrder(
    nailOptions.value.filter((item) => !formatDateKey(item.show_from_date) && !formatDateKey(item.show_to_date))
  )
)

const activeLocationPresets = computed(() =>
  serviceLocations.value.filter((loc) => loc.is_active)
)
const activeServiceCategories = computed(() =>
  serviceCategories.value.filter((cat) => cat.is_active)
)

const optionEditScopeLabel = computed(() => {
  if (!optionForm.value.id) return ''
  const from = String(optionForm.value.show_from_date || '').trim()
  const to = String(optionForm.value.show_to_date || '').trim()
  if (!from && !to) return 'แสดงทุกวัน'
  if (from && to && from === to) return `วันที่ ${formatServiceDateLabel(from)}`
  if (from && to) return `${formatServiceDateLabel(from)} – ${formatServiceDateLabel(to)}`
  if (from) return `ตั้งแต่ ${formatServiceDateLabel(from)}`
  return ''
})

function formatServiceDateLabel(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${serviceThMonths[m - 1]} ${y + 543}`
}

function formatCreatedAt(value) {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function shiftServiceMonth(delta) {
  const [y, m] = serviceMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  serviceMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function openServiceDay(iso) {
  selectedServiceDate.value = iso
  resetOptionFormForDay()
  message.value = ''
  errorMessage.value = ''
}

function closeServiceDay() {
  selectedServiceDate.value = ''
  showEveryDayForm.value = false
  resetOptionForm()
}

function resetOptionForm() {
  optionFormUseColor.value = false
  optionForm.value = {
    id: null,
    option_name: '',
    description: '',
    price: 0,
    duration_min: 60,
    is_active: true,
    is_required: false,
    color: '#C4847A',
    show_from_date: '',
    show_to_date: '',
    category_id: '',
  }
}

function resetOptionFormForDay() {
  optionFormUseColor.value = false
  optionForm.value = {
    id: null,
    option_name: '',
    description: '',
    price: 0,
    duration_min: 60,
    is_active: true,
    is_required: false,
    color: '#C4847A',
    show_from_date: selectedServiceDate.value,
    show_to_date: selectedServiceDate.value,
    category_id: '',
  }
}

function openEveryDayOptionForm() {
  selectedServiceDate.value = ''
  showEveryDayForm.value = true
  resetOptionForm()
  message.value = ''
  errorMessage.value = ''
  scrollToAdminSection('services-option-form-everyday', 'input[type="text"]')
}

function closeEveryDayForm() {
  showEveryDayForm.value = false
  resetOptionForm()
}

function optionShowRangeText(item) {
  const from = formatDateKey(item.show_from_date)
  const to = formatDateKey(item.show_to_date)
  if (!from && !to) return 'แสดงทุกวัน'
  if (from && to && from === to) {
    const [, mm, dd] = from.split('-').map(Number)
    return `วันที่ ${dd} ${serviceThMonths[mm - 1]}`
  }
  if (from && to) return `แสดง ${from} ถึง ${to}`
  if (from) return `แสดงตั้งแต่ ${from}`
  return `แสดงถึง ${to}`
}

function optionDeleteLabel(item) {
  const from = formatDateKey(item.show_from_date)
  const to = formatDateKey(item.show_to_date)
  if (from && (!to || from === to)) {
    const [, mm, dd] = from.split('-').map(Number)
    return `${item.option_name} (วันที่ ${dd} ${serviceThMonths[mm - 1]})`
  }
  if (from && to) return `${item.option_name} (${from} ถึง ${to})`
  return item.option_name
}

function isLocationPresetName(name) {
  return serviceLocations.value.some((loc) => loc.name === name)
}

function locationExistsOnDay(name) {
  if (!selectedServiceDate.value) return false
  return selectedDayOptions.value.some((item) => item.option_name === name)
}

async function addLocationPreset(preset) {
  if (!selectedServiceDate.value) return
  if (locationExistsOnDay(preset.name)) {
    await adminSwal.fire({
      title: 'มีสถานที่นี้แล้ว',
      text: `วันนี้มี "${preset.name}" อยู่แล้ว`,
      icon: 'info',
      confirmButtonText: 'ตกลง',
    })
    return
  }

  const ok = await adminSwal.fire({
    title: 'เพิ่มสถานที่',
    text: `เพิ่ม "${preset.name}" สำหรับ ${formatServiceDateLabel(selectedServiceDate.value)} ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'เพิ่ม',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const iso = selectedServiceDate.value
    await api.post('/api/admin/nailoptions', {
      option_name: preset.name,
      description: preset.description || `สถานที่ให้บริการ ${preset.name}`,
      price: 0,
      duration_min: 0,
      is_active: true,
      is_required: true,
      color: preset.color,
      show_from_date: iso,
      show_to_date: iso,
    })
    message.value = `เพิ่มสถานที่ "${preset.name}" แล้ว`
    resetOptionFormForDay()
    await loadNailOptions()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เพิ่มสถานที่ไม่สำเร็จ'
  }
}

function resetLocationForm() {
  locationForm.value = {
    id: null,
    name: '',
    color: '#C4847A',
    description: '',
    map_url: '',
    is_active: true,
    sort_order: serviceLocations.value.length,
  }
}

function setLocationColor(color) {
  locationForm.value.color = color
}

async function loadServiceCategories() {
  try {
    const { data } = await api.get('/api/admin/service-categories')
    serviceCategories.value = data || []
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดหมวดหมู่ไม่สำเร็จ'
  }
}

function resetCategoryForm() {
  categoryForm.value = {
    id: null,
    name: '',
    description: '',
    is_active: true,
    sort_order: serviceCategories.value.length,
  }
}

function startEditCategory(item) {
  categoryForm.value = {
    id: item.id,
    name: item.name,
    description: item.description || '',
    is_active: Boolean(item.is_active),
    sort_order: Number(item.sort_order) || 0,
  }
  focusAdminModal('admin-category-edit-modal', 'input[type="text"]')
}

async function saveServiceCategory() {
  const name = String(categoryForm.value.name || '').trim()
  if (!name) {
    errorMessage.value = 'กรุณาระบุชื่อหมวดหมู่'
    return
  }

  const isEdit = Boolean(categoryForm.value.id)
  const ok = await confirmAdminSave(
    isEdit ? 'ยืนยันแก้ไขหมวดหมู่' : 'ยืนยันเพิ่มหมวดหมู่',
    `${isEdit ? 'แก้ไข' : 'เพิ่ม'} "${name}" ใช่ไหม`
  )
  if (!ok) return

  message.value = ''
  errorMessage.value = ''
  const payload = {
    name,
    description: String(categoryForm.value.description || '').trim() || null,
    is_active: Boolean(categoryForm.value.is_active),
    sort_order: Number(categoryForm.value.sort_order) || 0,
  }

  try {
    if (isEdit) {
      await api.patch(`/api/admin/service-categories/${categoryForm.value.id}`, payload)
      message.value = 'แก้ไขหมวดหมู่แล้ว'
    } else {
      await api.post('/api/admin/service-categories', payload)
      message.value = 'เพิ่มหมวดหมู่แล้ว'
    }
    resetCategoryForm()
    await loadServiceCategories()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกหมวดหมู่ไม่สำเร็จ'
  }
}

async function removeServiceCategory(item) {
  const ok = await adminSwal.fire({
    title: 'ยืนยันลบหมวดหมู่',
    text: `ลบ "${item.name}" ใช่ไหม (บริการในหมวดนี้จะไม่มีหมวด)`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/service-categories/${item.id}`)
    message.value = 'ลบหมวดหมู่แล้ว'
    if (categoryForm.value.id === item.id) resetCategoryForm()
    await Promise.all([loadServiceCategories(), loadNailOptions()])
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ลบหมวดหมู่ไม่สำเร็จ'
  }
}

async function loadServiceLocations() {
  try {
    const { data } = await api.get('/api/admin/service-locations')
    serviceLocations.value = data
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดรายการสถานที่ไม่สำเร็จ'
  }
}

function startEditLocation(item) {
  locationForm.value = {
    id: item.id,
    name: item.name,
    color: item.color && isValidHexColor(item.color) ? item.color : '#C4847A',
    description: item.description || '',
    map_url: item.map_url || '',
    is_active: Boolean(item.is_active),
    sort_order: Number(item.sort_order) || 0,
  }
  focusAdminModal('admin-location-edit-modal', 'input[type="text"]')
}

async function saveServiceLocation() {
  const name = String(locationForm.value.name || '').trim()
  if (!name) {
    errorMessage.value = 'กรุณาระบุชื่อสถานที่'
    return
  }
  const colorValue = String(locationForm.value.color || '').trim()
  if (!isValidHexColor(colorValue)) {
    errorMessage.value = 'รูปแบบสีไม่ถูกต้อง ใช้ #RRGGBB'
    return
  }

  const isEdit = Boolean(locationForm.value.id)
  const ok = await confirmAdminSave(
    isEdit ? 'ยืนยันแก้ไขสถานที่' : 'ยืนยันเพิ่มสถานที่',
    `${isEdit ? 'แก้ไข' : 'เพิ่ม'} "${name}" ใช่ไหม`
  )
  if (!ok) return

  message.value = ''
  errorMessage.value = ''
  const payload = {
    name,
    color: colorValue,
    description: String(locationForm.value.description || '').trim() || null,
    map_url: String(locationForm.value.map_url || '').trim() || null,
    is_active: Boolean(locationForm.value.is_active),
    sort_order: Number(locationForm.value.sort_order) || 0,
  }

  try {
    if (isEdit) {
      await api.patch(`/api/admin/service-locations/${locationForm.value.id}`, payload)
      message.value = 'แก้ไขสถานที่แล้ว'
    } else {
      await api.post('/api/admin/service-locations', payload)
      message.value = 'เพิ่มสถานที่แล้ว'
    }
    resetLocationForm()
    await loadServiceLocations()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกสถานที่ไม่สำเร็จ'
  }
}

async function removeServiceLocation(item) {
  const ok = await adminSwal.fire({
    title: 'ลบสถานที่',
    text: `ลบ "${item.name}" จากรายการปุ่มลัด ใช่ไหม (บริการที่สร้างไปแล้วไม่หาย)`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#C45C5C',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/service-locations/${item.id}`)
    message.value = `ลบสถานที่ "${item.name}" แล้ว`
    if (locationForm.value.id === item.id) resetLocationForm()
    await loadServiceLocations()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ลบสถานที่ไม่สำเร็จ'
  }
}

function resetClipForm() {
  clipForm.value = {
    id: null,
    tiktok_url: '',
    title: '',
    is_active: true,
  }
}

function onShowcaseThumbError(id) {
  showcaseThumbFailed.value = new Set([...showcaseThumbFailed.value, id])
}

async function loadShowcaseClips() {
  try {
    const { data } = await api.get('/api/admin/showcase-clips')
    showcaseClips.value = data || []
    showcaseThumbFailed.value = new Set()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดรายการคลิปไม่สำเร็จ'
  }
}

function startEditClip(item) {
  clipForm.value = {
    id: item.id,
    tiktok_url: item.tiktok_url,
    title: item.title || '',
    is_active: Boolean(item.is_active),
  }
  focusAdminModal('admin-clip-edit-modal', 'input[type="url"]')
}

async function saveShowcaseClip() {
  const tiktok_url = String(clipForm.value.tiktok_url || '').trim()
  if (!tiktok_url) {
    errorMessage.value = 'กรุณาวางลิงก์ TikTok หรือ Instagram'
    return
  }

  const isEdit = Boolean(clipForm.value.id)
  const label = String(clipForm.value.title || '').trim() || tiktok_url
  const ok = await confirmAdminSave(
    isEdit ? 'ยืนยันแก้ไขคลิป' : 'ยืนยันเพิ่มคลิป',
    `${isEdit ? 'แก้ไข' : 'เพิ่ม'} "${label}" ใช่ไหม`
  )
  if (!ok) return

  message.value = ''
  errorMessage.value = ''

  const payload = {
    tiktok_url,
    title: String(clipForm.value.title || '').trim(),
    is_active: Boolean(clipForm.value.is_active),
  }

  try {
    if (isEdit) {
      await api.patch(`/api/admin/showcase-clips/${clipForm.value.id}`, payload)
      message.value = 'แก้ไขคลิปแล้ว'
    } else {
      await api.post('/api/admin/showcase-clips', payload)
      message.value = 'เพิ่มคลิปแล้ว'
    }
    resetClipForm()
    await loadShowcaseClips()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกคลิปไม่สำเร็จ'
  }
}

async function removeShowcaseClip(item) {
  const ok = await adminSwal.fire({
    title: 'ลบคลิป',
    text: 'ลบคลิปนี้ออกจากหน้ารีวิว ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#C45C5C',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/showcase-clips/${item.id}`)
    message.value = 'ลบคลิปแล้ว'
    if (clipForm.value.id === item.id) resetClipForm()
    await loadShowcaseClips()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ลบคลิปไม่สำเร็จ'
  }
}

async function moveShowcaseClip(item, direction) {
  message.value = ''
  errorMessage.value = ''
  try {
    await api.patch(`/api/admin/showcase-clips/${item.id}/move`, { direction })
    await loadShowcaseClips()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'จัดลำดับไม่สำเร็จ'
  }
}

async function toggleShowcaseClip(item) {
  message.value = ''
  errorMessage.value = ''
  try {
    await api.patch(`/api/admin/showcase-clips/${item.id}`, {
      is_active: !item.is_active,
    })
    await loadShowcaseClips()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'อัปเดตสถานะไม่สำเร็จ'
  }
}

async function refreshShowcaseThumbnail(item) {
  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.post(`/api/admin/showcase-clips/${item.id}/refresh-thumbnail`)
    message.value = data?.message || 'ดึงรูปปกแล้ว'
    await loadShowcaseClips()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ดึงรูปปกไม่สำเร็จ'
  }
}

async function loadNailOptions() {
  try {
    const { data } = await api.get('/api/admin/nailoptions')
    nailOptions.value = data
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดรายการบริการไม่สำเร็จ'
  } finally {
    nailOptionsLoaded.value = true
  }
}

async function moveNailOption(item, direction, { date = '', everyday = false } = {}) {
  message.value = ''
  errorMessage.value = ''
  try {
    const payload = { direction }
    if (everyday) payload.scope = 'everyday'
    else if (date) payload.date = date
    await api.patch(`/api/admin/nailoptions/${item.id}/move`, payload)
    await loadNailOptions()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'จัดลำดับไม่สำเร็จ'
  }
}

function startEditOption(item) {
  const from = formatDateKey(item.show_from_date)
  const to = formatDateKey(item.show_to_date)
  optionFormUseColor.value = isValidHexColor(item.color)
  optionForm.value = {
    id: item.id,
    option_name: item.option_name,
    description: item.description || '',
    price: Number(item.price),
    duration_min: Number(item.duration_min),
    is_active: Boolean(item.is_active),
    is_required: Boolean(item.is_required),
    color: item.color && isValidHexColor(item.color) ? item.color : '#C4847A',
    show_from_date: from || '',
    show_to_date: to || '',
    category_id: item.category_id || '',
  }
  focusAdminModal('admin-option-edit-modal', 'input[type="text"]')
}

async function saveNailOption() {
  const name = String(optionForm.value.option_name || '').trim()
  if (!name) {
    errorMessage.value = 'กรุณากรอกชื่อบริการ'
    return
  }

  const isEdit = Boolean(optionForm.value.id)
  let showFrom = String(optionForm.value.show_from_date || '').trim()
  let showTo = String(optionForm.value.show_to_date || '').trim()
  if (!isEdit && selectedServiceDate.value) {
    showFrom = selectedServiceDate.value
    showTo = selectedServiceDate.value
  }
  if (showFrom && showTo && showFrom > showTo) {
    errorMessage.value = 'วันเริ่มแสดงต้องไม่เกินวันสิ้นสุดแสดง'
    return
  }
  const colorValue = optionFormUseColor.value
    ? String(optionForm.value.color || '').trim()
    : ''
  if (optionFormUseColor.value && !isValidHexColor(colorValue)) {
    errorMessage.value = 'รูปแบบสีไม่ถูกต้อง ใช้ #RRGGBB'
    return
  }

  const ok = await confirmAdminSave(
    isEdit ? 'ยืนยันแก้ไขบริการ' : 'ยืนยันเพิ่มบริการ',
    `${isEdit ? 'แก้ไข' : 'เพิ่ม'} "${name}" ใช่ไหม`
  )
  if (!ok) return

  message.value = ''
  errorMessage.value = ''

  const payload = {
    option_name: name,
    description: String(optionForm.value.description || '').trim() || null,
    price: Number(optionForm.value.price),
    duration_min: Number(optionForm.value.duration_min),
    is_active: Boolean(optionForm.value.is_active),
    is_required: Boolean(optionForm.value.is_required),
    color: optionFormUseColor.value ? colorValue : null,
    show_from_date: showFrom || null,
    show_to_date: showTo || null,
    category_id: optionForm.value.category_id || null,
  }

  try {
    if (isEdit) {
      await api.patch(`/api/admin/nailoptions/${optionForm.value.id}`, payload)
      message.value = 'แก้ไขบริการแล้ว'
    } else {
      await api.post('/api/admin/nailoptions', payload)
      message.value = 'เพิ่มบริการแล้ว'
    }
    if (isEdit) {
    resetOptionForm()
    } else if (selectedServiceDate.value) {
      resetOptionFormForDay()
    } else {
      resetOptionForm()
    }
    await loadNailOptions()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกบริการไม่สำเร็จ'
  }
}

async function removeNailOption(item) {
  const label = optionDeleteLabel(item)
  const ok = await adminSwal.fire({
    title: 'ยืนยันลบบริการ',
    text: `ลบ "${label}" ใช่ไหม`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/nailoptions/${item.id}`)
    message.value = 'ลบบริการแล้ว'
    if (optionForm.value.id === item.id) resetOptionForm()
    await loadNailOptions()
  } catch (error) {
    const msg = error?.response?.data?.error || 'ลบบริการไม่สำเร็จ'
    errorMessage.value = msg
    await adminSwal.fire({ title: 'ลบไม่สำเร็จ', text: msg, icon: 'error' })
  }
}

function statusLabel(s) {
  const map = {
    awaiting_payment: 'รอชำระ',
    pending: 'รอบริการ',
    done: 'ทำเสร็จแล้ว',
    cancelled: 'ยกเลิก',
  }
  return map[s] || s
}

function backToBooking() {
  router.push(shopPath('/bookings'))
}

const shopShareUrl = computed(() => {
  const path = `/${shopSlug.value}/bookings`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
})

async function shareShopLink() {
  message.value = ''
  errorMessage.value = ''
  const url = shopShareUrl.value
  const title = shopStore.shopName || shopSlug.value
  const text = `จองคิว ${title}`

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      message.value = 'แชร์ลิงก์แล้ว'
      return
    }
    await navigator.clipboard.writeText(url)
    message.value = 'คัดลอกลิงก์ร้านแล้ว'
  } catch (err) {
    if (err?.name === 'AbortError') return
    try {
      await navigator.clipboard.writeText(url)
      message.value = 'คัดลอกลิงก์ร้านแล้ว'
    } catch {
      errorMessage.value = 'แชร์/คัดลอกลิงก์ไม่สำเร็จ'
    }
  }
}

watch(visibleAdminTabs, (tabs) => {
  if (!tabs.some((t) => t.key === activeTab.value)) {
    activeTab.value = tabs[0]?.key || 'bookings'
  }
})

watch(visibleSettingsSections, (sections) => {
  if (!sections.some((s) => s.key === activeSettingsSection.value)) {
    activeSettingsSection.value = sections[0]?.key || 'deposit'
  }
})

watch(visibleBlocksSections, (sections) => {
  if (!sections.some((s) => s.key === activeBlocksSection.value)) {
    activeBlocksSection.value = sections[0]?.key || 'shop-hours'
  }
})

onMounted(() => void shopFeaturesStore.fetchForAdmin())
onMounted(loadUiSettingsAdmin)
onMounted(loadAllShops)
onMounted(loadRenewalBannerSetting)
onMounted(loadBookingCalendarSummary)
onMounted(loadBlocks)
onMounted(loadDepositSetting)
onMounted(loadRegisterShopPinSetting)
onMounted(loadCouponSetting)
onMounted(loadLinePushSetting)
onMounted(loadChatNotifySetting)
onMounted(loadUnpaidAutoCancelSetting)
onMounted(loadNailOptions)
onMounted(loadServiceLocations)
onMounted(loadServiceCategories)
onMounted(loadShopHours)
onMounted(loadDayHoursMonth)
onMounted(loadAdvanceDays)
onMounted(loadBookingDisplay)
onMounted(loadShowcaseClips)
onMounted(() => {
  adminMobileMq = window.matchMedia('(max-width: 640px)')
  updateAdminMobileLayout()
  adminMobileMq.addEventListener('change', updateAdminMobileLayout)
  loadSetupWizardDismissed()
  window.addEventListener(PUSH_DEVICE_STATUS_EVENT, onPushDeviceStatusChanged)
  startBranchUsagePolling()
  window.addEventListener('focus', onAdminWindowFocus)
})
onUnmounted(() => {
  adminMobileMq?.removeEventListener('change', updateAdminMobileLayout)
  window.removeEventListener(PUSH_DEVICE_STATUS_EVENT, onPushDeviceStatusChanged)
  stopBranchUsagePolling()
  window.removeEventListener('focus', onAdminWindowFocus)
  usersObserver?.disconnect()
  if (userSearchDebounce) clearTimeout(userSearchDebounce)
})

watch(shopSlug, (next, prev) => {
  if (!prev || next === prev) return
  void reloadAdminShopContext()
})

watch(userSearch, () => {
  if (activeTab.value !== 'users') return
  if (userSearchDebounce) clearTimeout(userSearchDebounce)
  userSearchDebounce = setTimeout(() => {
    loadUsers({ reset: true })
  }, 300)
})

watch([activeTab, usersHasMore, usersSentinelRef], () => {
  if (activeTab.value === 'users') {
    nextTick(setupUsersInfiniteScroll)
  }
})
</script>

<template>
  <main class="admin-page">
    <header class="admin-top-bar">
      <div class="admin-brand-wrap">
        <BrandMark show-logo />
        <p class="muted admin-sub">แอดมิน · {{ auth.user?.name || '-' }}</p>
      </div>
      <div class="admin-top-actions">
        <AccountMenuDrawer ref="accountMenuRef" />
        <button type="button" class="btn admin-share-btn" @click="shareShopLink">
          <i class="ti ti-share-2" aria-hidden="true"></i>
          แชร์ลิงก์ร้าน
        </button>
        <button type="button" class="btn admin-back-btn" @click="backToBooking">
          <i class="ti ti-arrow-left" aria-hidden="true"></i>
          กลับจอง
        </button>
      </div>
    </header>

    <button
      v-if="showPushOffBanner"
      type="button"
      class="admin-push-reminder alert-banner warning"
      @click="openAccountMenuForPushHelp"
    >
      <i class="ti ti-bell-off" aria-hidden="true"></i>
      แจ้งเตือนนอกแอปยังปิดอยู่ — กด
      <span class="admin-push-reminder-link">บรรทัดนี้</span>
      เพื่อดูวิธีเปิด
    </button>

    <div class="admin-tab-wrap">
    <nav class="admin-nav" aria-label="เมนูแอดมิน">
      <button
        v-for="tab in visibleAdminTabs"
        :key="tab.key"
        type="button"
        class="tab-btn admin-nav-item"
        :class="{ active: activeTab === tab.key }"
        :aria-current="activeTab === tab.key ? 'page' : undefined"
        @click="switchTab(tab.key)"
      >
        <i class="ti" :class="tab.icon" aria-hidden="true"></i>
        <span>{{ tab.label }}</span>
      </button>
    </nav>
    </div>

    <p v-if="message" class="alert-banner success" role="status">{{ message }}</p>
    <p v-if="errorMessage" class="alert-banner error" role="alert">{{ errorMessage }}</p>
    <button
      v-if="showBranchUsageExpiredBanner && activeTab !== 'renewal'"
      type="button"
      class="admin-renewal-reminder alert-banner error"
      @click="openRenewalTab"
    >
      <i class="ti ti-alert-circle" aria-hidden="true"></i>
      สาขานี้หมดระยะเวลาใช้งานแล้ว ({{ formatUsageExpiryDate(currentBranchUsage.usage_expires_at) }}) — ลูกค้าไม่สามารถจองได้ ·
      <span class="admin-renewal-reminder-link">กดที่นี่เพื่อต่ออายุ</span>
    </button>
    <button
      v-else-if="showBranchUsageWarningBanner && activeTab !== 'renewal'"
      type="button"
      class="admin-renewal-reminder alert-banner"
      :class="currentBranchUsage.usage_days_remaining <= 3 ? 'error' : 'warning'"
      @click="openRenewalTab"
    >
      <i class="ti ti-alert-triangle" aria-hidden="true"></i>
      ระยะเวลาใช้งานเหลือ {{ currentBranchUsage.usage_days_remaining }} วัน (หมดอายุ {{ formatUsageExpiryDate(currentBranchUsage.usage_expires_at) }}) ·
      <span class="admin-renewal-reminder-link">กดที่นี่เพื่อต่ออายุ</span>
    </button>

    <div v-if="showSetupWizard" class="admin-setup-wizard card-inner">
      <div class="admin-setup-wizard-head admin-section-head">
        <div>
          <h3>เริ่มตั้งร้าน</h3>
          <p class="muted">ทำตามขั้นตอนด้านล่างเพื่อเปิดรับจองลูกค้า</p>
        </div>
        <button type="button" class="btn admin-setup-dismiss" @click="dismissSetupWizard">ซ่อน</button>
      </div>
      <ol class="admin-setup-steps">
        <li
          v-for="step in setupWizardSteps"
          :key="step.key"
          class="admin-setup-step"
          :class="{ done: step.done, optional: step.optional }"
        >
          <span class="admin-setup-step-label">
            <i class="ti" :class="step.done ? 'ti-circle-check' : 'ti-circle'" aria-hidden="true"></i>
            {{ step.label }}
            <span v-if="step.optional" class="muted">(ไม่บังคับ)</span>
          </span>
          <button v-if="!step.done" type="button" class="btn primary admin-setup-go" @click="step.go()">
            ไปตั้งค่า
          </button>
        </li>
      </ol>
    </div>

    <section v-show="activeTab === 'bookings'" class="admin-section">
      <template v-if="!selectedBookingDate">
        <div class="admin-section-head">
          <h3>จัดการคิวตามวัน</h3>
          <p class="muted">กดวันที่เพื่อดูคิว · สีตามสถานที่ให้บริการ</p>
        </div>

        <div class="service-cal-nav">
          <button type="button" class="btn service-cal-nav-btn" @click="shiftBookingMonth(-1)" aria-label="เดือนก่อน">
            <i class="ti ti-chevron-left" aria-hidden="true"></i>
          </button>
          <span class="service-cal-month">{{ bookingMonthLabel }}</span>
          <button type="button" class="btn service-cal-nav-btn" @click="shiftBookingMonth(1)" aria-label="เดือนถัดไป">
            <i class="ti ti-chevron-right" aria-hidden="true"></i>
          </button>
        </div>

        <div class="service-cal-weekdays">
          <span v-for="wd in serviceWeekdays" :key="`bk-${wd}`" class="service-cal-wd">{{ wd }}</span>
        </div>

        <div class="service-cal-grid">
          <div v-for="(week, wi) in bookingCalendarWeeks" :key="`bk-week-${wi}`" class="service-cal-week">
            <button
              v-for="(cell, ci) in week"
              :key="`bk-${wi}-${ci}`"
              type="button"
              class="service-cal-day booking-cal-day"
              :class="{
                empty: !cell,
                today: cell?.isToday && !bookingDayColor(cell.iso),
                'has-bookings': cell && bookingDayHasBookings(cell.iso) && !bookingDayColor(cell.iso),
              }"
              :style="cell ? bookingDayStyle(cell.iso) : undefined"
              :disabled="!cell"
              @click="cell && openBookingDay(cell.iso)"
            >
              <span v-if="cell" class="service-cal-num">{{ cell.day }}</span>
              <span v-if="cell && bookingDayHasBookings(cell.iso)" class="booking-cal-stats">
                <span class="booking-stat-paid" title="ชำระแล้ว">{{ bookingDayStats(cell.iso).paid_count }}</span>
                <span class="booking-stat-sep">/</span>
                <span class="booking-stat-unpaid" title="รอชำระ">{{ bookingDayStats(cell.iso).unpaid_count }}</span>
                <span
                  v-if="bookingDayStats(cell.iso).cancelled_count > 0"
                  class="booking-stat-cancelled"
                  title="ยกเลิก"
                >
                  ยก.{{ bookingDayStats(cell.iso).cancelled_count }}
                </span>
              </span>
              <span v-if="cell && bookingDayHasUnpaid(cell.iso)" class="booking-cal-alert" title="มีคิวยังไม่ชำระ">!</span>
            </button>
          </div>
        </div>

        <div class="booking-cal-legend">
          <span><span class="legend-paid">{{ bookingMonthPaidTotal }}</span> ชำระแล้ว</span>
          <span><span class="legend-unpaid">{{ bookingMonthUnpaidTotal }}</span> รอชำระ</span>
          <span><span class="legend-cancelled">{{ bookingMonthCancelledTotal }}</span> ยกเลิก</span>
          <span>รวมทั้งหมด {{ bookingMonthPaidTotal + bookingMonthUnpaidTotal + bookingMonthCancelledTotal }}</span>
          <span v-if="bookingMonthUnpaidTotal > 0">
            <span class="booking-cal-alert inline">!</span> มีคิวยังไม่ชำระ
          </span>
        </div>

        <AdminBookingPaymentSlips
          :active="activeTab === 'bookings' && !selectedBookingDate"
          :is-super-admin="isSuperAdmin"
          :shop-slug="shopSlug"
          @changed="loadBookingCalendarSummary"
        />
      </template>

      <template v-else>
        <div class="service-day-header">
          <button type="button" class="btn service-back-btn" @click="closeBookingDay">
            <i class="ti ti-arrow-left" aria-hidden="true"></i>
            กลับปฏิทิน
          </button>
          <div>
            <h3>คิววันที่ {{ formatServiceDateLabel(selectedBookingDate) }}</h3>
            <p class="muted">
              ชำระแล้ว {{ bookingDayStats(selectedBookingDate).paid_count }} ·
              รอชำระ {{ bookingDayStats(selectedBookingDate).unpaid_count }} ·
              ยกเลิก {{ bookingDayStats(selectedBookingDate).cancelled_count }} 
             
            </p>
          </div>
          <button type="button" class="btn primary booking-add-btn" @click="openBookingAdd">
            เพิ่มคิว
          </button>
        </div>

      <div class="admin-filter-row">
        <label class="admin-filter-item">
          สถานะ
          <select v-model="status" @change="loadBookings" class="admin-input">
            <option value="">ทั้งหมด</option>
            <option value="awaiting_payment">รอชำระเงิน</option>
            <option value="pending">ชำระแล้ว / รอให้บริการ</option>
            <option value="done">ทำเสร็จแล้ว</option>
            <option value="cancelled">ยกเลิกแล้ว</option>
          </select>
        </label>
      </div>

      <div v-if="loading" class="state-card">
        <i class="ti ti-loader-2 state-card-icon" aria-hidden="true"></i>
        <span class="state-card-title">กำลังโหลดคิว</span>
      </div>

        <div v-else-if="filtered.length === 0" class="state-card">
          <i class="ti ti-calendar-off state-card-icon" aria-hidden="true"></i>
          <p class="state-card-title">ไม่มีคิวในวันที่เลือก</p>
        </div>
      <div v-for="item in filtered" :key="item.id" class="admin-item">
          <div class="admin-item-body">
            <div class="admin-item-title-row">
              <strong>{{ bookingTimeRange(item) }}</strong>
              <span class="status-pill" :class="`status-pill--${item.status}`">{{ statusLabel(item.status) }}</span>
            </div>
          <p class="muted">{{ item.user_name }}</p>
          <p class="muted">
            {{
              item.nail_options?.length
                ? item.nail_options.map((opt) => opt.option_name).join(', ')
                : 'ไม่มีบริการ'
            }}
          </p>
            <p class="muted">จองเมื่อ {{ formatCreatedAt(item.created_at) }}</p>
            <p v-if="item.total != null && item.total !== ''" class="muted tabular-nums">
              ยอด {{ formatBookingTotal(item.total) }}
            </p>
        </div>
          <div class="row admin-booking-actions">
            <button
              type="button"
              class="btn"
              @click="openSendMessageModal({ id: item.user_id, name: item.user_name, email: item.user_email })"
            >
              ส่งข้อความ
            </button>
            <button type="button" class="btn primary" @click="openAdminChat(item.user_id)">
              ไปแชท
            </button>
            <button
              v-if="item.status !== 'cancelled'"
              type="button"
              class="btn"
              @click="editBooking(item)"
            >
              แก้ไขข้อมูล
            </button>
          <button
            v-if="item.status === 'awaiting_payment'"
            class="btn"
            @click="confirmPayment(item.id)"
          >
            ยืนยันชำระเงิน
          </button>
          <button
            v-if="item.status === 'awaiting_payment'"
            class="btn danger"
            @click="cancelUnpaid(item.id)"
          >
            ยกเลิกคิวไม่ชำระ
          </button>
            <button
              v-if="item.status === 'pending'"
              class="btn"
              @click="revertPayment(item.id)"
            >
              เปลี่ยนเป็นรอชำระ
            </button>
          <button
            v-if="item.status === 'pending'"
            class="btn primary"
              @click="markDone(item)"
          >
              ทำเสร็จ{{ couponCompletionPoints > 0 ? ` +${couponCompletionPoints} แต้ม` : '' }}
          </button>
          <button
            v-if="item.status === 'pending'"
            class="btn danger"
            @click="cancelPaid(item.id)"
          >
            ยกเลิกคิว (เลื่อนวัน)
          </button>
            <button
              v-if="item.status === 'cancelled'"
              type="button"
              class="btn primary"
              @click="restoreBooking(item)"
            >
              คืนสถานะจอง
            </button>
            <button
              v-if="item.status === 'cancelled'"
              class="btn danger"
              @click="deleteBooking(item.id)"
            >
              ลบ
            </button>
        </div>
      </div>

        <AdminBookingPaymentSlips
          :active="activeTab === 'bookings' && !!selectedBookingDate"
          :booking-date="selectedBookingDate || ''"
          :is-super-admin="isSuperAdmin"
          :shop-slug="shopSlug"
          @changed="loadBookings"
        />
      </template>
    </section>

    <section v-show="activeTab === 'revenue'" class="admin-section revenue-section">
      <div class="admin-section-head">
        <h3>สรุปยอดรายเดือน</h3>
        <p class="muted">ยอดมัดจำและยอดบริการตามวันในเดือนที่เลือก</p>
      </div>

      <div class="service-cal-nav">
        <button type="button" class="btn service-cal-nav-btn" @click="shiftRevenueMonth(-1)" aria-label="เดือนก่อน">
          <i class="ti ti-chevron-left" aria-hidden="true"></i>
        </button>
        <span class="service-cal-month">{{ revenueMonthLabel }}</span>
        <button type="button" class="btn service-cal-nav-btn" @click="shiftRevenueMonth(1)" aria-label="เดือนถัดไป">
          <i class="ti ti-chevron-right" aria-hidden="true"></i>
        </button>
      </div>

      <div v-if="revenueLoading" class="state-card">
        <i class="ti ti-loader-2 state-card-icon" aria-hidden="true"></i>
        <span class="state-card-title">กำลังโหลดยอด</span>
      </div>

      <template v-else>
        <div class="service-cal-weekdays">
          <span v-for="wd in serviceWeekdays" :key="`rev-${wd}`" class="service-cal-wd">{{ wd }}</span>
        </div>

        <div class="service-cal-grid">
          <div v-for="(week, wi) in revenueCalendarWeeks" :key="`rev-week-${wi}`" class="service-cal-week">
            <div
              v-for="(cell, ci) in week"
              :key="`rev-${wi}-${ci}`"
              class="service-cal-day revenue-cal-day"
              :class="{
                empty: !cell,
                today: cell?.isToday && !revenueDayColor(cell.iso),
                'has-revenue': cell && revenueDayHasData(cell.iso) && !revenueDayColor(cell.iso),
              }"
              :style="cell ? revenueDayStyle(cell.iso) : undefined"
            >
              <span v-if="cell" class="service-cal-num">{{ cell.day }}</span>
              <div v-if="cell && revenueDayHasData(cell.iso)" class="revenue-cal-body">
                <span
                  v-if="revenueDayStats(cell.iso).deposit_amount > 0"
                  class="revenue-cal-deposit"
                  :title="`มัดจำ ${formatDayRevenue(revenueDayStats(cell.iso).deposit_amount)}`"
                >
                  ม.{{ formatDayRevenueCell(revenueDayStats(cell.iso).deposit_amount) }}
                </span>
                <span
                  v-if="revenueDayStats(cell.iso).total_amount > 0"
                  class="revenue-cal-total"
                  :title="`ยอดบริการ ${formatDayRevenue(revenueDayStats(cell.iso).total_amount)}`"
                >
                  {{ formatDayRevenueCell(revenueDayStats(cell.iso).total_amount) }}
                </span>
                <span
                  v-if="revenueDayStats(cell.iso).done_count > 0"
                  class="revenue-cal-count"
                >
                  {{ revenueDayStats(cell.iso).done_count }} คิว
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="revenue-month-summary">
          <div class="revenue-summary-grid">
            <div class="revenue-summary-slot revenue-summary-slot--deposit">
              <div class="revenue-summary-slot-head">
                <i class="ti ti-coin" aria-hidden="true"></i>
                <span class="revenue-summary-label">มัดจำรวม</span>
              </div>
              <strong class="revenue-summary-deposit">{{ formatBookingTotal(revenueMonthDepositTotal) }}</strong>
              <span class="muted revenue-summary-sub">
                {{ revenueMonthDoneCount.toLocaleString('th-TH') }} คิว × คนละ
                {{ revenueDepositRate.toLocaleString('th-TH') }} บาท
              </span>
            </div>
            <div class="revenue-summary-slot revenue-summary-slot--total">
              <div class="revenue-summary-slot-head">
                <i class="ti ti-receipt" aria-hidden="true"></i>
                <span class="revenue-summary-label">ยอดบริการรวม</span>
              </div>
              <strong class="revenue-summary-total">{{ formatBookingTotal(revenueMonthTotal) }}</strong>
              <span class="muted revenue-summary-sub">
                {{ revenueMonthDoneCount.toLocaleString('th-TH') }} คิวทำเสร็จ
              </span>
            </div>
            <aside v-if="revenuePrevMonthLabel" class="revenue-summary-slot revenue-summary-slot--compare">
              <div class="revenue-summary-slot-head">
                <i class="ti ti-chart-line" aria-hidden="true"></i>
                <span class="revenue-summary-label">เทียบเดือนก่อน</span>
              </div>
              <span class="revenue-compare-ref">{{ revenuePrevMonthLabel }}</span>
              <div class="revenue-compare-rows">
                <div class="revenue-compare-row">
                  <span class="revenue-compare-metric">มัดจำ</span>
                  <span class="revenue-change" :class="revenueDepositChange.className">
                    <i v-if="revenueDepositChange.icon" class="ti" :class="revenueDepositChange.icon" aria-hidden="true"></i>
                    {{ revenueDepositChange.text }}
                  </span>
                </div>
                <div class="revenue-compare-row">
                  <span class="revenue-compare-metric">บริการ</span>
                  <span class="revenue-change" :class="revenueTotalChange.className">
                    <i v-if="revenueTotalChange.icon" class="ti" :class="revenueTotalChange.icon" aria-hidden="true"></i>
                    {{ revenueTotalChange.text }}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </template>
    </section>

    <section v-show="activeTab === 'services'" class="admin-section">
      <div class="service-categories-section">
        <div class="service-everyday-head admin-section-head">
          <div>
            <h3>หมวดหมู่บริการ</h3>
            <p class="muted">ลูกค้าจะเลือกหมวดหมู่ก่อน แล้วค่อยเลือกบริการในหมวดนั้น</p>
          </div>
          <button type="button" class="btn" @click="showCategoryPanel = !showCategoryPanel">
            {{ showCategoryPanel ? 'ซ่อน' : 'จัดการหมวดหมู่' }}
          </button>
        </div>

        <div v-if="serviceCategories.length" class="service-category-chips">
          <span v-for="cat in serviceCategories" :key="cat.id" class="service-category-chip" :class="{ inactive: !cat.is_active }">
            {{ cat.name }}
          </span>
        </div>
        <div v-else class="state-card">
          <i class="ti ti-category state-card-icon" aria-hidden="true"></i>
          <p class="state-card-title">ยังไม่มีหมวดหมู่</p>
          <p class="muted">ถ้าไม่สร้าง ลูกค้าจะเลือกบริการแบบเดิม</p>
        </div>

        <div v-if="showCategoryPanel" class="service-option-form card-inner" style="margin-top:12px">
          <template v-if="!categoryForm.id">
            <h4>เพิ่มหมวดหมู่</h4>
            <div class="admin-form-grid admin-option-grid">
              <label>
                ชื่อหมวดหมู่ *
                <input v-model="categoryForm.name" type="text" class="admin-input" placeholder="เช่น มือ, เท้า, ต่อเล็บ" />
              </label>
              <label>
                รายละเอียด
                <input v-model="categoryForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
              </label>
              <label>
                ลำดับแสดง
                <input v-model.number="categoryForm.sort_order" type="number" min="0" step="1" class="admin-input" />
              </label>
            </div>
            <div class="admin-form-row">
              <AdminSwitch v-model="categoryForm.is_active" label="เปิดใช้งาน" />
              <button type="button" class="btn primary admin-action-btn" @click="saveServiceCategory">
                เพิ่มหมวดหมู่
              </button>
            </div>
          </template>

          <div v-if="serviceCategories.length" :style="categoryForm.id ? '' : 'margin-top:16px'">
            <div v-for="item in serviceCategories" :key="item.id" class="admin-item">
              <div>
                <strong>{{ item.name }}</strong>
                <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
                  {{ item.is_active ? 'เปิด' : 'ปิด' }}
                </span>
                <p class="muted">{{ item.description || '-' }}</p>
                <p class="muted">ลำดับ {{ item.sort_order }}</p>
              </div>
              <div class="row">
                <button type="button" class="btn" @click="startEditCategory(item)">แก้ไข</button>
                <button type="button" class="btn danger" @click="removeServiceCategory(item)">ลบ</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr class="admin-divider" />

      <!-- ปฏิทินเลือกวัน -->
      <template v-if="!selectedServiceDate">
        <div class="service-cal-header admin-section-head">
          <h3>จัดการบริการตามวัน</h3>
          <p class="muted">กดวันที่ในปฏิทินเพื่อเพิ่ม/แก้ไขบริการของวันนั้น</p>
        </div>

        <div class="service-cal-nav">
          <button type="button" class="btn service-cal-nav-btn" @click="shiftServiceMonth(-1)" aria-label="เดือนก่อน">
            <i class="ti ti-chevron-left" aria-hidden="true"></i>
          </button>
          <span class="service-cal-month">{{ serviceMonthLabel }}</span>
          <button type="button" class="btn service-cal-nav-btn" @click="shiftServiceMonth(1)" aria-label="เดือนถัดไป">
            <i class="ti ti-chevron-right" aria-hidden="true"></i>
          </button>
        </div>

        <div class="service-cal-weekdays">
          <span v-for="wd in serviceWeekdays" :key="wd" class="service-cal-wd">{{ wd }}</span>
        </div>

        <div class="service-cal-grid">
          <div v-for="(week, wi) in serviceCalendarWeeks" :key="wi" class="service-cal-week">
            <button
              v-for="(cell, ci) in week"
              :key="`${wi}-${ci}`"
              type="button"
              class="service-cal-day"
              :class="{
                empty: !cell,
                today: cell?.isToday && !serviceDayColor(cell.iso),
                'has-options': cell && optionCountForDate(cell.iso) > 0 && !serviceDayColor(cell.iso),
              }"
              :style="cell ? serviceDayStyle(cell.iso) : undefined"
              :disabled="!cell"
              @click="cell && openServiceDay(cell.iso)"
            >
              <span v-if="cell" class="service-cal-num">{{ cell.day }}</span>
              <span v-if="cell && optionCountForDate(cell.iso)" class="service-cal-count">
                {{ optionCountForDate(cell.iso) }}
              </span>
            </button>
          </div>
        </div>

        <div class="service-everyday-section">
          <div class="service-everyday-head">
            <h4>บริการแสดงทุกวัน</h4>
            <button type="button" class="btn primary" @click="openEveryDayOptionForm">+ เพิ่มบริการทุกวัน</button>
          </div>
          <p class="muted">บริการที่ไม่ผูกวันที่ จะแสดงให้ลูกค้าเลือกได้ทุกวันในปฏิทินจอง</p>

          <div v-if="showEveryDayForm && !optionForm.id" id="services-option-form-everyday" class="service-option-form card-inner admin-settings-section">
            <h4>เพิ่มบริการทุกวัน</h4>
      <div class="admin-form-grid admin-option-grid">
        <label>
          ชื่อบริการ *
          <input v-model="optionForm.option_name" type="text" class="admin-input" placeholder="เช่น ทาสีเจลมือ" />
        </label>
        <label>
          รายละเอียด
          <input v-model="optionForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
        </label>
              <label>
                หมวดหมู่
                <select v-model="optionForm.category_id" class="admin-input">
                  <option value="">— ไม่ระบุ —</option>
                  <option v-for="cat in activeServiceCategories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </option>
                </select>
              </label>
        <label>
          ราคา (บาท)
          <input v-model.number="optionForm.price" type="number" min="0" step="1" class="admin-input" />
        </label>
        <label>
          ระยะเวลา (นาที)
                <input v-model.number="optionForm.duration_min" type="number" min="0" step="1" class="admin-input" />
        </label>
              <label class="admin-color-field admin-color-field-full">
                <span class="admin-color-label-row">
                  สีแสดงในปฏิทิน
                    <AdminSwitch compact v-model="optionFormUseColor" label="ใช้สี" />
                </span>
                <template v-if="optionFormUseColor">
                  <div class="color-picker-row">
                    <input v-model="optionForm.color" type="color" class="admin-color-input" />
                    <input v-model="optionForm.color" type="text" class="admin-input" maxlength="7" placeholder="#C4847A" />
                  </div>
                  <div class="color-preset-row">
                    <button
                      v-for="preset in optionColorPresets"
                      :key="preset.value"
                      type="button"
                      class="color-preset-btn"
                      :class="{ active: optionForm.color === preset.value }"
                      :style="{ background: preset.value }"
                      :title="preset.label"
                      :aria-label="preset.label"
                      @click="setOptionColor(preset.value)"
                    ></button>
                  </div>
                </template>
                <p v-else class="muted admin-color-hint">ไม่ใช้สี — วันในปฏิทินจะไม่เปลี่ยนจากบริการนี้</p>
              </label>
            </div>
            <div class="admin-form-row">
              <AdminSwitch v-model="optionForm.is_active" label="แสดงให้ลูกค้าเลือกจอง" />
              <AdminSwitch v-model="optionForm.is_required" label="บังคับเลือกเมื่อจอง" />
              <button class="btn primary admin-action-btn" @click="saveNailOption">
                เพิ่มบริการ
              </button>
              <button class="btn admin-action-btn" @click="closeEveryDayForm">ยกเลิก</button>
            </div>
          </div>

          <div v-if="!nailOptionsLoaded" class="state-card">
            <i class="ti ti-loader-2 state-card-icon" aria-hidden="true"></i>
            <span class="state-card-title">กำลังโหลดบริการ</span>
          </div>
          <div v-else-if="everyDayOptions.length === 0 && !showEveryDayForm" class="state-card">
            <i class="ti ti-list state-card-icon" aria-hidden="true"></i>
            <p class="state-card-title">ยังไม่มีบริการทุกวัน</p>
          </div>
          <div v-for="(item, index) in everyDayOptions" :key="item.id" class="admin-item">
            <div>
              <strong>{{ item.option_name }}</strong>
              <span v-if="item.category_name" class="badge-category">{{ item.category_name }}</span>
              <span v-if="item.color" class="option-color-dot" :style="{ background: item.color }" :title="item.color"></span>
              <span v-else class="badge-no-color">ไม่ใช้สี</span>
              <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
                {{ item.is_active ? 'เปิดใช้งาน' : 'ปิด' }}
              </span>
              <span v-if="item.is_required" class="badge-required">บังคับเลือก</span>
              <span class="badge-everyday">ทุกวัน</span>
              <p class="muted">{{ item.description || '-' }}</p>
              <p class="muted">
                ราคา {{ Number(item.price) }} บาท
                <template v-if="Number(item.duration_min) > 0"> · {{ item.duration_min }} นาที</template>
                <template v-else> · ไม่กินเวลาคิว</template>
              </p>
              <p class="muted">ลำดับแสดง {{ index + 1 }}</p>
            </div>
            <div class="row">
              <button
                type="button"
                class="btn service-order-btn"
                :disabled="index === 0"
                aria-label="เลื่อนขึ้น"
                @click="moveNailOption(item, 'up', { everyday: true })"
              >
                <i class="ti ti-chevron-up" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="btn service-order-btn"
                :disabled="index === everyDayOptions.length - 1"
                aria-label="เลื่อนลง"
                @click="moveNailOption(item, 'down', { everyday: true })"
              >
                <i class="ti ti-chevron-down" aria-hidden="true"></i>
              </button>
              <button class="btn" @click="startEditOption(item)">แก้ไข</button>
              <button class="btn danger" @click="removeNailOption(item)">ลบ</button>
            </div>
          </div>
        </div>
      </template>

      <!-- หน้าจัดการบริการของวันที่เลือก -->
      <template v-else>
        <div class="service-day-header">
          <button type="button" class="btn service-back-btn" @click="closeServiceDay">
            <i class="ti ti-arrow-left" aria-hidden="true"></i>
            กลับปฏิทิน
          </button>
          <div>
            <h3>บริการวันที่ {{ formatServiceDateLabel(selectedServiceDate) }}</h3>
            <p class="muted">แสดงเฉพาะวัน {{ selectedServiceDate }}</p>
          </div>
        </div>

        <div class="service-location-add card-inner">
          <h4>เพิ่มสถานที่ให้บริการ</h4>
          <p class="muted">เลือกสถานที่สำหรับวันนี้ · ลูกค้าต้องเลือกตอนจอง · สีในปฏิทินตามปุ่ม</p>
          <div v-if="activeLocationPresets.length === 0" class="state-card">
            <i class="ti ti-map-pin state-card-icon" aria-hidden="true"></i>
            <p class="state-card-title">ยังไม่มีสถานที่</p>
            <button type="button" class="btn primary" @click="goToSettingsSection('locations')">ไปเพิ่มสถานที่</button>
          </div>
          <div v-else class="location-preset-row">
            <button
              v-for="preset in activeLocationPresets"
              :key="preset.id"
              type="button"
              class="btn location-preset-btn"
              :disabled="locationExistsOnDay(preset.name)"
              @click="addLocationPreset(preset)"
            >
              <span class="location-preset-dot" :style="{ background: preset.color }" aria-hidden="true"></span>
              {{ preset.name }}
              <span v-if="locationExistsOnDay(preset.name)" class="location-preset-added">มีแล้ว</span>
            </button>
          </div>
        </div>

        <div v-if="!optionForm.id" id="services-option-form-day" class="service-option-form card-inner admin-settings-section">
          <h4>เพิ่มบริการอื่น</h4>
          <div class="admin-form-grid admin-option-grid">
        <label>
              ชื่อบริการ *
              <input v-model="optionForm.option_name" type="text" class="admin-input" placeholder="เช่น ทาสีเจลมือ" />
        </label>
        <label>
              รายละเอียด
              <input v-model="optionForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
        </label>
            <label>
              หมวดหมู่
              <select v-model="optionForm.category_id" class="admin-input">
                <option value="">— ไม่ระบุ —</option>
                <option v-for="cat in activeServiceCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </label>
            <label>
              ราคา (บาท)
              <input v-model.number="optionForm.price" type="number" min="0" step="1" class="admin-input" />
            </label>
            <label>
              ระยะเวลา (นาที)
              <input v-model.number="optionForm.duration_min" type="number" min="0" step="1" class="admin-input" />
            </label>
            <label class="admin-color-field admin-color-field-full">
              <span class="admin-color-label-row">
                สีแสดงในปฏิทิน
                <AdminSwitch compact v-model="optionFormUseColor" label="ใช้สี" />
              </span>
              <template v-if="optionFormUseColor">
                <div class="color-picker-row">
                  <input v-model="optionForm.color" type="color" class="admin-color-input" />
                  <input v-model="optionForm.color" type="text" class="admin-input" maxlength="7" placeholder="#C4847A" />
      </div>
                <div class="color-preset-row">
                  <button
                    v-for="preset in optionColorPresets"
                    :key="`day-${preset.value}`"
                    type="button"
                    class="color-preset-btn"
                    :class="{ active: optionForm.color === preset.value }"
                    :style="{ background: preset.value }"
                    :title="preset.label"
                    :aria-label="preset.label"
                    @click="setOptionColor(preset.value)"
                  ></button>
                </div>
              </template>
              <p v-else class="muted admin-color-hint">ไม่ใช้สี — วันในปฏิทินจะไม่เปลี่ยนจากบริการนี้</p>
            </label>
          </div>
      <div class="admin-form-row">
        <AdminSwitch v-model="optionForm.is_active" label="แสดงให้ลูกค้าเลือกจอง" />
            <AdminSwitch v-model="optionForm.is_required" label="บังคับเลือกเมื่อจอง" />
        <button class="btn primary admin-action-btn" @click="saveNailOption">
              เพิ่มบริการ
        </button>
          </div>
      </div>

        <h4 class="admin-subtitle">รายการในวันนี้ ({{ selectedDayOptions.length }})</h4>
        <div v-if="selectedDayOptions.length === 0" class="state-card">
          <i class="ti ti-list state-card-icon" aria-hidden="true"></i>
          <p class="state-card-title">ยังไม่มีบริการในวันนี้</p>
        </div>
        <div v-for="(item, index) in selectedDayOptions" :key="item.id" class="admin-item">
        <div>
          <strong>{{ item.option_name }}</strong>
            <span v-if="item.category_name" class="badge-category">{{ item.category_name }}</span>
            <span v-if="item.color" class="option-color-dot" :style="{ background: item.color }" :title="item.color"></span>
            <span v-else class="badge-no-color">ไม่ใช้สี</span>
          <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
            {{ item.is_active ? 'เปิดใช้งาน' : 'ปิด' }}
          </span>
            <span v-if="item.is_required" class="badge-required">บังคับเลือก</span>
            <span v-if="isLocationPresetName(item.option_name)" class="badge-location">สถานที่</span>
            <span v-if="!formatDateKey(item.show_from_date) && !formatDateKey(item.show_to_date)" class="badge-everyday">ทุกวัน</span>
          <p class="muted">{{ item.description || '-' }}</p>
            <p class="muted">
              ราคา {{ Number(item.price) }} บาท
              <template v-if="Number(item.duration_min) > 0"> · {{ item.duration_min }} นาที</template>
              <template v-else> · ไม่กินเวลาคิว</template>
            </p>
            <p v-if="formatDateKey(item.show_from_date) || formatDateKey(item.show_to_date)" class="muted">
              {{ optionShowRangeText(item) }}
            </p>
            <p class="muted">ลำดับแสดงในวันนี้ {{ index + 1 }}</p>
        </div>
        <div class="row">
            <button
              type="button"
              class="btn service-order-btn"
              :disabled="index === 0"
              aria-label="เลื่อนขึ้น"
              @click="moveNailOption(item, 'up', { date: selectedServiceDate })"
            >
              <i class="ti ti-chevron-up" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="btn service-order-btn"
              :disabled="index === selectedDayOptions.length - 1"
              aria-label="เลื่อนลง"
              @click="moveNailOption(item, 'down', { date: selectedServiceDate })"
            >
              <i class="ti ti-chevron-down" aria-hidden="true"></i>
            </button>
          <button class="btn" @click="startEditOption(item)">แก้ไข</button>
          <button class="btn danger" @click="removeNailOption(item)">ลบ</button>
        </div>
      </div>
      </template>
    </section>

    <section v-show="activeTab === 'settings'" class="admin-section admin-drawer-section">
      <div class="admin-drawer-shell">
        <Transition name="admin-drawer-backdrop">
          <button
            v-if="settingsNavOpen && isMobile"
            type="button"
            class="admin-drawer-backdrop"
            aria-label="ปิดหัวข้อตั้งค่า"
            @click="settingsNavOpen = false"
          />
        </Transition>

        <aside class="admin-drawer-nav" :class="{ 'admin-drawer-nav--open': settingsNavOpen || !isMobile }">
          <div class="admin-drawer-nav-head">
            <h3 class="admin-drawer-nav-title">หัวข้อตั้งค่า</h3>
            <button
              type="button"
              class="admin-drawer-icon-btn admin-drawer-close"
              aria-label="ปิดหัวข้อ"
              @click="settingsNavOpen = false"
            >
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
          <nav class="admin-drawer-nav-list" aria-label="หัวข้อตั้งค่า">
            <button
              v-for="section in visibleSettingsSections"
              :key="section.key"
              type="button"
              class="tab-btn admin-drawer-nav-item"
              :class="{ active: activeSettingsSection === section.key }"
              :aria-current="activeSettingsSection === section.key ? 'true' : undefined"
              @click="selectSettingsSection(section.key)"
            >
              <i class="ti" :class="section.icon" aria-hidden="true"></i>
              <span>{{ section.label }}</span>
            </button>
          </nav>
        </aside>

        <div class="admin-drawer-main">
          <header class="admin-drawer-toolbar">
            <button
              type="button"
              class="admin-drawer-icon-btn admin-drawer-menu-btn"
              :aria-expanded="settingsNavOpen"
              aria-label="เปิดหัวข้อตั้งค่า"
              @click="toggleSettingsNav"
            >
              <i class="ti ti-menu-2" aria-hidden="true"></i>
            </button>
            <div class="admin-drawer-toolbar-text">
              <strong>{{ activeSettingsSectionMeta.label }}</strong>
              <span class="muted">ตั้งค่าร้าน</span>
            </div>
          </header>

          <div class="admin-drawer-panel">
      <div v-show="activeSettingsSection === 'deposit'" id="settings-deposit" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>มัดจำ</h3>
        <p class="muted">ค่านี้จะถูกนำไปแสดงในหน้าชำระของลูกค้าทันที</p>
      </div>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          ยอดมัดจำ (บาท)
          <input v-model.number="depositAmount" type="number" min="1" step="1" class="admin-input" />
        </label>
        <button class="btn primary admin-action-btn" @click="saveDepositSetting">บันทึกยอดมัดจำ</button>
      </div>
      </div>

      <div v-show="activeSettingsSection === 'coupon'" id="settings-coupon" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>คูปองแลกแต้ม</h3>
        <p class="muted">ลูกค้าใช้แต้มแลกคูปองส่วนลด — ค่านี้แยกตามร้าน</p>
      </div>
      <div class="admin-form-row" style="flex-wrap:wrap">
        <label class="admin-label-grow">
          ส่วนลด (%)
          <input v-model.number="couponDiscountPercent" type="number" min="1" max="100" step="1" class="admin-input" />
        </label>
        <label class="admin-label-grow">
          แต้มที่ใช้แลก
          <input v-model.number="couponRequiredPoints" type="number" min="1" step="1" class="admin-input" />
        </label>
        <label class="admin-label-grow">
          แต้มเมื่อทำเสร็จ
          <input v-model.number="couponCompletionPoints" type="number" min="0" step="1" class="admin-input" />
        </label>
        <button type="button" class="btn primary admin-action-btn" style="align-self:flex-end" @click="saveCouponSetting">
          บันทึกคูปอง
        </button>
      </div>
      <div class="shop-hours-preview">
        <i class="ti ti-ticket" style="font-size:16px;color:var(--color-primary)"></i>
        ลูกค้าจะเห็น: แลกคูปองลด <strong>{{ couponDiscountPercent }}%</strong> ใช้ <strong>{{ couponRequiredPoints.toLocaleString('th-TH') }}</strong> แต้ม
        · ทำเสร็จได้ <strong>+{{ couponCompletionPoints.toLocaleString('th-TH') }}</strong> แต้ม
      </div>
      </div>

      <div v-show="activeSettingsSection === 'line'" id="settings-line" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>แจ้งเตือน LINE</h3>
        <p class="muted">
        ใช้ LINE Messaging API — ตั้ง Webhook ที่ LINE เป็น
        <code>{{ lineWebhookUrlHint }}</code>
        <template v-if="lineCentralBotEnabled && !lineEffectiveUsesOwnBot">
          แล้วให้ร้านทักบอทกลางพร้อม slug ร้านเพื่อผูกรับแจ้งเตือนอัตโนมัติ
        </template>
        <template v-else>
          แล้วทักบอทของสาขานี้เพื่อผูก User/Group ID อัตโนมัติ (ไม่ต้องพิมพ์ slug)
        </template>
        </p>
      </div>
      <div v-if="lineCentralBotEnabled && !lineEffectiveUsesOwnBot" class="shop-hours-preview" style="margin-bottom:12px">
        <i class="ti ti-robot" style="font-size:16px;color:var(--color-primary)"></i>
        บอทกลาง — Token + Secret ตั้งบน server แล้ว (<code>{{ lineTokenMasked }}</code>) · สาขานี้ตั้งแค่ User/Group ID
      </div>
      <div v-else-if="lineCentralBotEnabled && lineEffectiveUsesOwnBot" class="shop-hours-preview" style="margin-bottom:12px">
        <i class="ti ti-crown" style="font-size:16px;color:var(--color-primary)"></i>
        Premium — สาขานี้ใช้ LINE Bot ของตัวเอง · กรอก Token + Secret ด้านล่าง · Webhook แยกตาม slug
      </div>
      <div v-else class="shop-hours-preview" style="margin-bottom:12px">
        <i class="ti ti-building-store" style="font-size:16px;color:var(--color-primary)"></i>
        โหมดบอทแยกร้าน — กรอก Channel Access Token + Channel Secret ของสาขานี้เอง
      </div>
      <div v-if="lineCentralBotEnabled && !lineEffectiveUsesOwnBot" class="shop-hours-preview" style="margin-bottom:12px">
        <i class="ti ti-link" style="font-size:16px;color:var(--color-primary)"></i>
        slug ร้านนี้: <strong>/{{ shopSlug }}</strong> — ทักบอทกลางด้วย <code>{{ shopSlug }}</code> หรือ <code>/{{ shopSlug }}/bookings</code>
      </div>
      <div v-if="lineCanEditUseOwnBot" class="admin-switch-group">
        <div class="admin-switch-stack">
          <AdminSwitch
            v-model="lineUseOwnBot"
            label="ใช้ LINE Bot ของร้านเอง"
            hint="Premium — override บอทกลางสำหรับสาขานี้"
            :disabled="settingToggleSaving === 'line-push:use_own_bot'"
            @update:model-value="(v) => saveLinePushToggle('use_own_bot', v)"
          />
        </div>
      </div>
      <div v-else-if="lineCentralBotEnabled && lineUsesOwnBot && shopSlug !== 'default'" class="shop-hours-preview" style="margin-bottom:12px">
        <i class="ti ti-crown" style="font-size:16px;color:var(--color-primary)"></i>
        สาขานี้อยู่ในโหมด Premium (บอทของร้านเอง) — ตั้งค่า Token/Secret ด้านล่าง
      </div>
      <div v-if="lineCanEditEnabled && shopSlug !== 'default'" class="admin-switch-group">
        <div class="admin-switch-stack">
          <AdminSwitch
            v-model="linePushEnabled"
            label="เปิดแจ้งเตือน LINE เมื่อลูกค้าจองคิว"
            :hint="`สาขา ${shopStore.shopName || shopSlug}`"
            :disabled="settingToggleSaving === 'line-push:enabled'"
            @update:model-value="(v) => saveLinePushToggle('enabled', v)"
          />
        </div>
      </div>
      <div v-else-if="!isSuperAdmin && shopSlug !== 'default'" class="shop-hours-preview line-push-status-banner" style="margin-bottom:12px">
        <i class="ti ti-brand-line" style="font-size:16px;color:var(--color-primary)"></i>
        <template v-if="linePushEnabled">
          แจ้งเตือน LINE: <strong>เปิด</strong> (กำหนดโดยแอดมินหลัก)
        </template>
        <template v-else>
          แจ้งเตือน LINE: <strong class="line-push-status-off">ปิด</strong> — ติดต่อแอดมินหลักเพื่อเปิด · คุณตั้ง ID และข้อความได้ด้านล่าง
        </template>
      </div>

      <div v-if="isSuperAdmin && shopSlug === 'default'" class="line-branch-panel">
        <h4 class="line-branch-title">เปิด/ปิดแจ้งเตือนตามสาขา</h4>
        <p class="muted line-branch-hint">
          เปิด/ปิดแจ้งเตือนได้เฉพาะแอดมินหลัก — สาขาเปิดเองไม่ได้ · สลับไปสาขาเพื่อตั้ง ID และข้อความ
        </p>
        <ul v-if="lineBranchShops.length" class="line-branch-list">
          <li v-for="shop in lineBranchShops" :key="`line-branch-${shop.id}`" class="line-branch-row">
            <div class="line-branch-info">
              <strong>{{ shop.name }}</strong>
              <span class="muted">/{{ shop.slug }}</span>
              <span v-if="!shop.is_active" class="shop-inactive-badge">ปิด</span>
            </div>
            <AdminSwitch
              compact
              label="แจ้งเตือน"
              :model-value="shop.line_push_enabled !== false"
              :disabled="lineBranchToggling === shop.slug || !shop.is_active"
              @update:model-value="(v) => toggleShopLinePush(shop, v)"
            />
            <span v-if="shop.line_use_own_bot" class="shop-line-badge shop-line-badge--premium">Premium</span>
            <span v-if="shop.line_push_ready" class="shop-line-badge shop-line-badge--on">พร้อมส่ง</span>
            <span v-else-if="shop.line_push_enabled && shop.line_push_configured" class="shop-line-badge shop-line-badge--warn">เปิด · ยังไม่ครบ</span>
            <span v-else-if="shop.line_push_enabled" class="shop-line-badge shop-line-badge--warn">เปิด · ยังไม่ตั้ง ID</span>
            <span v-else class="shop-line-badge">ปิด</span>
            <button
              v-if="shop.is_active"
              type="button"
              class="btn line-branch-setup-btn"
              @click="switchShopAdmin(shop.slug); activeSettingsSection = 'line'"
            >
              ตั้งค่า
            </button>
          </li>
        </ul>
        <div v-else class="state-card">
          <i class="ti ti-building-store state-card-icon" aria-hidden="true"></i>
          <span class="state-card-title">ยังไม่มีสาขา</span>
        </div>
      </div>
      <div class="admin-form-grid admin-option-grid">
        <template v-if="lineEffectiveUsesOwnBot">
          <label>
            Channel Access Token
            <input
              v-model="lineChannelToken"
              type="password"
              class="admin-input"
              :placeholder="lineTokenConfigured ? `ตั้งแล้ว (${lineTokenMasked}) — ใส่ใหม่เพื่อเปลี่ยน` : 'ใส่ Channel Access Token'"
              autocomplete="off"
            />
          </label>
          <label>
            Channel Secret
            <input
              v-model="lineChannelSecret"
              type="password"
              class="admin-input"
              :placeholder="lineSecretConfigured ? `ตั้งแล้ว (${lineSecretMasked}) — ใส่ใหม่เพื่อเปลี่ยน` : 'ใส่ Channel Secret (32 ตัวอักษร)'"
              autocomplete="off"
            />
          </label>
        </template>
        <label :style="lineEffectiveUsesOwnBot ? '' : 'grid-column:1/-1'">
          User ID / Group ID รับแจ้งเตือน
          <input
            v-model="linePushToId"
            type="text"
            class="admin-input"
            :placeholder="lineCentralBotEnabled && !lineEffectiveUsesOwnBot
              ? 'Uxxxxxxxx หรือ Cxxxxxxxx — หรือทักบอทกลาง slug ร้านเพื่อผูกอัตโนมัติ'
              : 'Uxxxxxxxx หรือ Cxxxxxxxx — หรือทักบอทสาขานี้เพื่อผูกอัตโนมัติ'"
          />
        </label>
      </div>
      <p v-if="lineEffectiveUsesOwnBot" class="muted" style="margin-top:8px">
        Token จาก Messaging API → Issue · Secret จาก Basic settings → Channel secret · Webhook ใน LINE Developers ต้องตรงกับ <code>{{ lineWebhookUrlHint }}</code>
      </p>
      <p v-else-if="lineCentralBotEnabled && !lineEffectiveUsesOwnBot" class="muted" style="margin-top:8px">
        หลังทักบอทกลาง slug แล้ว รีเฟรชหน้านี้เพื่อดู User/Group ID · ร้าน Premium ให้แอดมินหลักเปิด “ใช้ LINE Bot ของร้านเอง” ด้านบน
      </p>
      <p class="muted" style="margin-top:8px">สวิตช์ด้านบนบันทึกทันที — ปุ่มนี้ใช้บันทึก ID และ Token</p>
      <div class="admin-form-row" style="flex-wrap:wrap;margin-top:12px">
        <button type="button" class="btn primary admin-action-btn" @click="saveLinePushSetting">บันทึก LINE แจ้งเตือน</button>
        <button
          type="button"
          class="btn ghost admin-action-btn"
          :disabled="!isSuperAdmin && !linePushEnabled"
          :title="!isSuperAdmin && !linePushEnabled ? 'แอดมินหลักปิดแจ้งเตือนไว้' : ''"
          @click="testLinePushSetting"
        >
          ส่งทดสอบ
        </button>
      </div>
      </div>

      <div v-show="activeSettingsSection === 'chat-notify'" id="settings-chat-notify" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>แจ้งเตือนในแอป</h3>
        <p class="muted">เปิดสวิตช์เพื่อส่งแจ้งเตือนในแอป — บันทึกทันทีที่สลับ</p>
      </div>

      <div class="admin-switch-group">
        <h4 class="admin-switch-group-title">แจ้งแอดมิน</h4>
        <div class="admin-switch-stack">
          <AdminSwitch
            v-model="chatNotifyNewBookingEnabled"
            label="มีคิวจองใหม่"
            :disabled="settingToggleSaving === 'chat-notify:new_booking_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('new_booking_enabled', v)"
          />
          <AdminSwitch
            v-model="chatNotifyUpcomingAdminEnabled"
            label="ก่อนถึงคิว"
            :disabled="settingToggleSaving === 'chat-notify:upcoming_admin_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('upcoming_admin_enabled', v)"
          />
          <AdminSwitch
            v-model="chatNotifyCancelAdminEnabled"
            label="คิวถูกยกเลิก"
            :disabled="settingToggleSaving === 'chat-notify:cancel_admin_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('cancel_admin_enabled', v)"
          />
          <AdminSwitch
            v-model="chatNotifyPaidAdminEnabled"
            label="ชำระเงินแล้ว"
            :disabled="settingToggleSaving === 'chat-notify:paid_admin_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('paid_admin_enabled', v)"
          />
          <AdminSwitch
            v-model="chatNotifySlipAdminEnabled"
            label="ลูกค้าอัปโหลดสลิป"
            :disabled="settingToggleSaving === 'chat-notify:slip_admin_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('slip_admin_enabled', v)"
          />
        </div>
      </div>

      <div class="admin-switch-group">
        <h4 class="admin-switch-group-title">แจ้งลูกค้า</h4>
        <div class="admin-switch-stack">
          <AdminSwitch
            v-model="chatNotifyUpcomingCustomerEnabled"
            label="ก่อนถึงคิว"
            :disabled="settingToggleSaving === 'chat-notify:upcoming_customer_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('upcoming_customer_enabled', v)"
          />
          <AdminSwitch
            v-model="chatNotifyCancelCustomerEnabled"
            label="คิวถูกยกเลิก"
            :disabled="settingToggleSaving === 'chat-notify:cancel_customer_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('cancel_customer_enabled', v)"
          />
          <AdminSwitch
            v-model="chatNotifyPaidCustomerEnabled"
            label="ชำระเงินแล้ว"
            :disabled="settingToggleSaving === 'chat-notify:paid_customer_enabled'"
            @update:model-value="(v) => saveChatNotifyToggle('paid_customer_enabled', v)"
          />
        </div>
      </div>

      <label class="admin-label-grow" style="display:block;max-width:240px">
        แจ้งก่อนถึงคิว (นาที)
        <input
          v-model.number="chatNotifyUpcomingMinutes"
          type="number"
          min="1"
          max="1440"
          step="1"
          class="admin-input"
        />
      </label>
      <div class="admin-form-row" style="margin-top:12px">
        <button type="button" class="btn primary admin-action-btn" @click="saveChatNotifySetting">บันทึกเวลา</button>
      </div>
      </div>

      <div v-show="activeSettingsSection === 'unpaid'" id="settings-unpaid" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>ยกเลิกอัตโนมัติ</h3>
        <p class="muted">
          คิวสถานะรอชำระเงินที่ไม่ชำระภายในเวลาที่กำหนดจะถูกยกเลิกเอง และช่วงเวลานั้นจะว่างให้จองใหม่
        </p>
      </div>
      <div class="admin-form-row" style="flex-wrap:wrap;align-items:flex-end;gap:12px">
        <div class="admin-switch-stack" style="flex:1;min-width:min(100%,260px)">
          <AdminSwitch
            v-model="unpaidAutoCancelEnabled"
            label="เปิดยกเลิกอัตโนมัติ"
            :disabled="settingToggleSaving === 'unpaid:enabled'"
            @update:model-value="saveUnpaidAutoCancelToggle"
          />
        </div>
        <label class="admin-label-grow" :class="{ muted: !unpaidAutoCancelEnabled }">
          ยกเลิกหลัง (ชั่วโมง)
          <input
            v-model.number="unpaidExpireHours"
            type="number"
            min="1"
            max="168"
            step="1"
            class="admin-input"
            :disabled="!unpaidAutoCancelEnabled"
          />
        </label>
        <button class="btn primary admin-action-btn" @click="saveUnpaidAutoCancelSetting">บันทึก</button>
      </div>
      <p class="muted" style="margin:8px 0 0">สวิตช์บันทึกทันที — ปุ่มนี้ใช้บันทึกจำนวนชั่วโมง</p>
      <div class="shop-hours-preview">
        <i class="ti ti-clock-pause" style="font-size:16px;color:var(--color-primary)"></i>
        <template v-if="unpaidAutoCancelEnabled">
          ลูกค้าจะเห็นนับถอยหลัง · ยกเลิกอัตโนมัติหลัง
          <strong>{{ unpaidExpireHours }} ชม.</strong>
          นับจากเวลาจอง
        </template>
        <template v-else>ปิดอยู่ — คิวรอชำระจะไม่ถูกยกเลิกเอง</template>
      </div>
      </div>

      <div v-show="activeSettingsSection === 'shops'" id="settings-shops" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>ร้าน / สาขา</h3>
        <p v-if="isSuperAdmin" class="muted">แต่ละร้านมีคิว บริการ และตั้งค่าแยกกัน · URL รูปแบบ <code>/slug/bookings</code></p>
        <p v-else class="muted">สาขาของคุณ · URL <code>/{{ shopSlug }}/bookings</code></p>
      </div>
      <ul v-if="allShops.length" class="admin-shop-list">
        <li v-for="shop in allShops" :key="shop.id" class="admin-shop-row">
          <button
            v-if="isSuperAdmin"
            type="button"
            class="admin-shop-item"
            :class="{ active: shop.slug === shopSlug, inactive: !shop.is_active }"
            @click="switchShopAdmin(shop.slug)"
          >
            <span>{{ shop.name }}</span>
            <span class="muted">/{{ shop.slug }}</span>
            <span v-if="!shop.is_active" class="shop-inactive-badge">ปิด</span>
            <span
              v-else-if="formatShopUsageBadge(shop)"
              class="shop-usage-badge"
              :class="`shop-usage-badge--${formatShopUsageBadge(shop).tone}`"
            >
              {{ formatShopUsageBadge(shop).text }}
            </span>
          </button>
          <div v-else class="admin-shop-item active">
            <span>{{ shop.name }}</span>
            <span class="muted">/{{ shop.slug }}</span>
          </div>
          <div v-if="isSuperAdmin" class="admin-shop-actions">
            <AdminSwitch
              v-if="shop.slug !== 'default'"
              compact
              label="LINE"
              :model-value="shop.line_push_enabled !== false"
              :disabled="lineBranchToggling === shop.slug || !shop.is_active"
              @update:model-value="(v) => toggleShopLinePush(shop, v)"
            />
            <button type="button" class="btn" @click="openShopEdit(shop)">แก้ไข</button>
            <button
              v-if="shop.slug !== 'default'"
              type="button"
              class="btn danger"
              @click="deleteShopBranch(shop)"
            >
              ลบถาวร
            </button>
          </div>
        </li>
      </ul>
      <div v-if="isSuperAdmin" class="admin-form-row" style="flex-wrap:wrap;margin-top:12px">
        <label class="admin-label-grow">
          ชื่อร้านใหม่
          <input v-model="newShopName" class="admin-input" placeholder="เช่น Nail จุฬา" />
        </label>
        <label class="admin-label-grow">
          slug (URL)
          <input v-model="newShopSlug" class="admin-input" placeholder="เช่น chula" />
        </label>
        <label class="admin-label-grow">
          จำกัดเวลาใช้งาน (วัน)
          <input
            v-model="newShopUsageLimitDays"
            type="number"
            min="1"
            max="3650"
            class="admin-input"
            placeholder="ว่าง = ไม่จำกัด"
          />
          <span class="usage-preset-row">
            <button type="button" class="btn usage-preset-btn" @click="newShopUsageLimitDays = ''">ไม่จำกัด</button>
            <button
              v-for="days in USAGE_PRESET_DAYS"
              :key="`new-usage-${days}`"
              type="button"
              class="btn usage-preset-btn"
              @click="newShopUsageLimitDays = String(days)"
            >
              {{ days }} ว.
            </button>
          </span>
        </label>
        <button type="button" class="btn primary admin-action-btn" style="align-self:flex-end" @click="createShop">
          เพิ่มร้าน
        </button>
      </div>
      </div>

      <div v-show="activeSettingsSection === 'register-pin'" id="settings-register-pin" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>รหัสสร้างร้านค้า</h3>
        <p class="muted">
          รหัส 4 หลักที่ต้องกรอกก่อนสมัครร้านใหม่ — เว้นว่างแล้วบันทึก = ปิดสมัครร้าน (ซ่อนปุ่มในหน้าล็อกอิน)
        </p>
      </div>
      <div class="admin-form-row" style="flex-wrap:wrap">
        <label class="admin-label-grow">
          รหัส 4 หลัก
          <input
            :value="registerShopPin"
            type="text"
            inputmode="numeric"
            maxlength="4"
            pattern="\d{4}"
            class="admin-input register-pin-admin-input"
            placeholder="เช่น 1234 (ว่าง = ปิด)"
            autocomplete="off"
            @input="onRegisterPinInput"
          />
        </label>
        <button type="button" class="btn primary admin-action-btn" style="align-self:flex-end" @click="saveRegisterShopPinSetting">
          {{ registerShopPin ? 'บันทึกรหัส' : 'ปิดสมัครร้าน' }}
        </button>
      </div>
      <div class="shop-hours-preview">
        <i class="ti ti-lock" style="font-size:16px;color:var(--color-primary)"></i>
        สถานะ:
        <strong>{{ registerShopPinConfigured ? 'เปิดรับสมัครร้านแล้ว' : 'ยังไม่ตั้งรหัส — ปิดการสมัครร้าน' }}</strong>
      </div>
      </div>

      <div v-show="activeSettingsSection === 'locations'" id="settings-locations" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>สถานที่บริการ</h3>
        <p class="muted">จัดการปุ่ม “เพิ่มสถานที่” ตอนเปิดบริการแต่ละวัน · ชื่อสถานที่ต้องไม่ซ้ำ · ลิงก์แผนที่ใช้ปุ่ม "ดูแผนที่" ตอนจอง/ชำระเงิน</p>
      </div>

      <div v-if="!locationForm.id" class="service-option-form card-inner">
        <h4>เพิ่มสถานที่ใหม่</h4>
        <div class="admin-form-grid admin-option-grid">
          <label>
            ชื่อสถานที่ *
            <input v-model="locationForm.name" type="text" class="admin-input" placeholder="เช่น จุฬา, เกษตร" />
          </label>
          <label>
            รายละเอียด
            <input v-model="locationForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
          </label>
          <label>
            ลำดับแสดง
            <input v-model.number="locationForm.sort_order" type="number" min="0" step="1" class="admin-input" />
          </label>
          <label>
            ลิงก์แผนที่
            <input v-model="locationForm.map_url" type="url" class="admin-input" placeholder="https://maps.google.com/..." />
          </label>
          <label class="admin-color-field">
            สีในปฏิทิน
            <div class="color-picker-row">
              <input v-model="locationForm.color" type="color" class="admin-color-input" />
              <input v-model="locationForm.color" type="text" class="admin-input" maxlength="7" placeholder="#C4847A" />
            </div>
            <div class="color-preset-row">
              <button
                v-for="preset in optionColorPresets"
                :key="`loc-${preset.value}`"
                type="button"
                class="color-preset-btn"
                :class="{ active: locationForm.color === preset.value }"
                :style="{ background: preset.value }"
                :title="preset.label"
                :aria-label="preset.label"
                @click="setLocationColor(preset.value)"
              ></button>
            </div>
          </label>
        </div>
        <div class="admin-form-row">
          <AdminSwitch v-model="locationForm.is_active" label="แสดงเป็นปุ่มลัด" />
          <button class="btn primary admin-action-btn" @click="saveServiceLocation">
            เพิ่มสถานที่
          </button>
        </div>
      </div>

      <div v-if="serviceLocations.length === 0" class="state-card" style="margin-top:10px">
        <i class="ti ti-map-pin state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">ยังไม่มีสถานที่</p>
      </div>
      <div v-for="item in serviceLocations" :key="item.id" class="admin-item">
        <div>
          <strong>{{ item.name }}</strong>
          <span class="option-color-dot" :style="{ background: item.color }" :title="item.color"></span>
          <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
            {{ item.is_active ? 'แสดงปุ่ม' : 'ซ่อนปุ่ม' }}
          </span>
          <p class="muted">{{ item.description || '-' }}</p>
          <p v-if="item.map_url" class="muted">แผนที่: {{ item.map_url }}</p>
          <p class="muted">ลำดับ {{ item.sort_order }}</p>
        </div>
        <div class="row">
          <button type="button" class="btn" @click="startEditLocation(item)">แก้ไข</button>
          <button type="button" class="btn danger" @click="removeServiceLocation(item)">ลบ</button>
        </div>
      </div>
      </div>

      <div v-show="activeSettingsSection === 'use-coupon'" id="settings-use-coupon" class="admin-settings-section">
      <div class="admin-section-head">
        <h3>ใช้คูปอง</h3>
        <p class="muted">กรอกรหัสคูปองของลูกค้าเพื่อใช้ส่วนลด</p>
      </div>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          รหัสคูปอง (10 หลัก)
          <input v-model="useCouponCode" type="text" maxlength="10" placeholder="กรอกรหัสคูปอง" class="admin-input" />
        </label>
        <button class="btn primary admin-action-btn" @click="useCoupon">ยืนยันใช้คูปอง</button>
      </div>
      </div>
          </div>
        </div>
      </div>
    </section>

    <section v-show="activeTab === 'ui'" id="settings-ui" class="admin-section admin-drawer-section">
      <div class="admin-drawer-shell">
        <Transition name="admin-drawer-backdrop">
          <button
            v-if="uiNavOpen && isMobile"
            type="button"
            class="admin-drawer-backdrop"
            aria-label="ปิดหัวข้อ UI"
            @click="uiNavOpen = false"
          />
        </Transition>

        <aside class="admin-drawer-nav" :class="{ 'admin-drawer-nav--open': uiNavOpen || !isMobile }">
          <div class="admin-drawer-nav-head">
            <h3 class="admin-drawer-nav-title">หัวข้อ UI</h3>
            <button
              type="button"
              class="admin-drawer-icon-btn admin-drawer-close"
              aria-label="ปิดหัวข้อ"
              @click="uiNavOpen = false"
            >
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
          <nav class="admin-drawer-nav-list" aria-label="หัวข้อ UI">
            <button
              v-for="(group, idx) in visibleUiFieldGroups"
              :key="group.title"
              type="button"
              class="tab-btn admin-drawer-nav-item"
              :class="{ active: activeUiSection === idx }"
              :aria-current="activeUiSection === idx ? 'true' : undefined"
              @click="selectUiSection(idx)"
            >
              <i class="ti" :class="group.requiresLinePush ? 'ti-brand-line' : 'ti-adjustments'" aria-hidden="true"></i>
              <span>{{ group.title }}</span>
            </button>
          </nav>
        </aside>

        <div class="admin-drawer-main">
          <header class="admin-drawer-toolbar">
            <button
              type="button"
              class="admin-drawer-icon-btn admin-drawer-menu-btn"
              :aria-expanded="uiNavOpen"
              aria-label="เปิดหัวข้อ UI"
              @click="toggleUiNav"
            >
              <i class="ti ti-menu-2" aria-hidden="true"></i>
            </button>
            <div class="admin-drawer-toolbar-text">
              <strong>{{ activeUiSectionMeta.title }}</strong>
              <span class="muted">/{{ shopSlug }} · template ใช้ {hours} {bookingId} …</span>
            </div>
          </header>

          <div class="admin-drawer-panel">
          <div
            v-for="(group, idx) in visibleUiFieldGroups"
            v-show="activeUiSection === idx"
            :key="group.title"
            class="ui-settings-group admin-settings-section"
          >
            <div class="admin-section-head">
              <h4 class="ui-settings-group-title">{{ group.title }}</h4>
              <p v-if="group.hint" class="muted ui-settings-hint">{{ group.hint }}</p>
            </div>
            <div class="admin-form-grid admin-option-grid">
              <template
                v-for="field in group.fields"
                :key="field.key"
              >
                <div
                  v-if="field.type === 'toggle' && shouldShowUiField(field)"
                  class="ui-field-label ui-field-toggle"
                >
                  <AdminSwitch
                    :model-value="isUiFormToggleOn(field.key)"
                    :label="field.label"
                    :hint="field.hint"
                    :disabled="settingToggleSaving === `ui:${field.key}`"
                    @update:model-value="(v) => onUiToggleChange(field, v)"
                  />
                </div>
                <label
                  v-else-if="shouldShowUiField(field)"
                  class="ui-field-label"
                >
                {{ field.label }}
                <textarea
                  v-if="field.multiline"
                  v-model="uiForm[field.key]"
                  class="admin-input"
                  :rows="field.rows || 3"
                  :placeholder="field.placeholder || ''"
                />
                <input
                  v-else-if="field.type === 'color'"
                  v-model="uiForm[field.key]"
                  type="color"
                  class="admin-color-input ui-color-input"
                />
                <input
                  v-else
                  v-model="uiForm[field.key]"
                  type="text"
                  class="admin-input"
                  :placeholder="field.placeholder || ''"
                />
                <p v-if="field.hint && field.type !== 'toggle'" class="muted ui-field-toggle-hint">{{ field.hint }}</p>
                <div v-if="field.uploadKind" class="ui-image-upload-row">
                  <button
                    type="button"
                    class="btn ghost admin-action-btn ui-image-upload-btn"
                    :disabled="!!uiImageUploading"
                    @click="triggerUiImageUpload(field.uploadKind)"
                  >
                    <i class="ti ti-photo-up" aria-hidden="true"></i>
                    {{
                      uiImageUploading === field.uploadKind
                        ? 'กำลังอัปโหลด...'
                        : 'อัปโหลดจากมือถือ'
                    }}
                  </button>
                  <span class="muted ui-image-upload-hint">เลือกจากแกลเลอรีหรือถ่ายรูป</span>
                </div>
                <img
                  v-if="field.key === 'ui_logo_url' && uiPreviewUrl('ui_logo_url')"
                  :src="uiPreviewUrl('ui_logo_url')"
                  alt="preview logo"
                  class="ui-image-preview"
                  @error="($event.target.style.display = 'none')"
                />
                <img
                  v-if="field.key === 'ui_hero_image_url' && uiPreviewUrl('ui_hero_image_url')"
                  :src="uiPreviewUrl('ui_hero_image_url')"
                  alt="preview hero"
                  class="ui-image-preview ui-image-preview--wide"
                  @error="($event.target.style.display = 'none')"
                />
                <img
                  v-if="field.key === 'ui_kshop_qr_url' && uiPreviewUrl('ui_kshop_qr_url')"
                  :src="uiPreviewUrl('ui_kshop_qr_url')"
                  alt="preview kshop qr"
                  class="ui-image-preview"
                  @error="($event.target.style.display = 'none')"
                />
                <p
                  v-if="(field.key === 'ui_logo_url' || field.key === 'ui_hero_image_url' || field.key === 'ui_kshop_qr_url') && uiImageFieldHint(field.key)"
                  class="muted ui-image-url-warn"
                >
                  {{ uiImageFieldHint(field.key) }}
                </p>
              </label>
              </template>
            </div>
          </div>

          <div class="ui-settings-actions">
            <input
              ref="uiImageFileInput"
              type="file"
              accept="image/*"
              class="ui-image-file-input"
              @change="onUiImageSelected"
            />
            <button type="button" class="btn primary admin-action-btn" @click="saveUiSettingsAdmin">บันทึก UI ทั้งหมด</button>
            <button type="button" class="btn ghost admin-action-btn" @click="loadUiSettingsAdmin">โหลดใหม่</button>
          </div>
          </div>
        </div>
      </div>
    </section>

    <section v-show="activeTab === 'blocks'" class="admin-section admin-drawer-section admin-blocks-section">
      <div class="admin-drawer-shell">
        <Transition name="admin-drawer-backdrop">
          <button
            v-if="blocksNavOpen && isMobile"
            type="button"
            class="admin-drawer-backdrop"
            aria-label="ปิดหัวข้อเวลา"
            @click="blocksNavOpen = false"
          />
        </Transition>

        <aside class="admin-drawer-nav" :class="{ 'admin-drawer-nav--open': blocksNavOpen || !isMobile }">
          <div class="admin-drawer-nav-head">
            <h3 class="admin-drawer-nav-title">เวลา</h3>
            <button
              type="button"
              class="admin-drawer-icon-btn admin-drawer-close"
              aria-label="ปิดหัวข้อ"
              @click="blocksNavOpen = false"
            >
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
          <nav class="admin-drawer-nav-list" aria-label="หัวข้อเวลา">
            <button
              v-for="section in visibleBlocksSections"
              :key="section.key"
              type="button"
              class="tab-btn admin-drawer-nav-item"
              :class="{ active: activeBlocksSection === section.key }"
              :aria-current="activeBlocksSection === section.key ? 'true' : undefined"
              @click="selectBlocksSection(section.key)"
            >
              <i class="ti" :class="section.icon" aria-hidden="true"></i>
              <span>{{ section.label }}</span>
            </button>
          </nav>
        </aside>

        <div class="admin-drawer-main">
          <header class="admin-drawer-toolbar">
            <button
              type="button"
              class="admin-drawer-icon-btn admin-drawer-menu-btn"
              :aria-expanded="blocksNavOpen"
              aria-label="เปิดหัวข้อเวลา"
              @click="toggleBlocksNav"
            >
              <i class="ti ti-menu-2" aria-hidden="true"></i>
            </button>
            <div class="admin-drawer-toolbar-text">
              <strong>{{ activeBlocksSectionMeta.label }}</strong>
              <span class="muted">{{ blocksToolbarSubtitle }}</span>
            </div>
          </header>

          <div class="admin-drawer-panel">
            <div v-show="activeBlocksSection === 'shop-hours'" id="blocks-shop-hours" class="admin-settings-section">
              <div class="admin-section-head">
                <h3>เวลาเปิด-ปิดปกติ</h3>
                <p class="muted">ใช้ทุกวันที่ไม่ได้ตั้งในแท็บ <strong>เวลาเปิด-ปิดเฉพาะวัน</strong></p>
              </div>
              <div class="admin-form-row" style="flex-wrap:wrap">
                <label class="admin-label-grow">
                  เวลาเปิดร้าน
                  <select v-model.number="shopOpenHour" class="admin-input">
                    <option v-for="h in hourOptions" :key="`open-${h}`" :value="h">{{ formatHmLabel(h, 0) }}</option>
                  </select>
                </label>
                <label class="admin-label-grow">
                  จองสุดท้ายได้ถึง
                  <select v-model.number="shopLastBookingHour" class="admin-input">
                    <option v-for="h in hourOptions" :key="`last-${h}`" :value="h">
                      {{ formatLastBookingOptionLabel(h, bookingSlotHours) }}
                    </option>
                  </select>
                </label>
                <button class="btn primary admin-action-btn" style="align-self:flex-end" @click="saveShopHours">บันทึกเวลาเปิด-ปิด</button>
              </div>
              <div class="shop-hours-preview">
                <i class="ti ti-clock" style="font-size:16px;color:var(--color-primary)"></i>
                ลูกค้าจะเห็นช่วง
                <strong>{{ formatHmLabel(shopOpenHour, 0) }} – {{ formatHmLabel(shopLastBookingHour, 0) }}</strong>
                (ปิดรับ {{ formatHmLabel(shopLastBookingHour + bookingSlotHours, 0) }})
              </div>
            </div>

            <div v-show="activeBlocksSection === 'day-hours'" id="blocks-day-hours" class="admin-settings-section">
              <template v-if="!selectedDayHoursDate">
                <div class="admin-section-head">
                  <h3>เวลาเปิด-ปิดเฉพาะวัน</h3>
                  <p class="muted">
                    สำหรับวันที่อยากเปิด-ปิดไม่ตามปกติ · กดวันในปฏิทินแล้วเพิ่มช่วงเวลา ·
                    วันที่ไม่ตั้งจะใช้แท็บ <strong>เวลาเปิด-ปิดปกติ</strong>
                  </p>
                </div>

                <div class="service-cal-nav">
                  <button type="button" class="btn service-cal-nav-btn" @click="shiftDayHoursMonth(-1)" aria-label="เดือนก่อน">
                    <i class="ti ti-chevron-left" aria-hidden="true"></i>
                  </button>
                  <span class="service-cal-month">{{ dayHoursMonthLabel }}</span>
                  <button type="button" class="btn service-cal-nav-btn" @click="shiftDayHoursMonth(1)" aria-label="เดือนถัดไป">
                    <i class="ti ti-chevron-right" aria-hidden="true"></i>
                  </button>
                </div>

                <div class="service-cal-weekdays">
                  <span v-for="wd in serviceWeekdays" :key="`dh-${wd}`" class="service-cal-wd">{{ wd }}</span>
                </div>

                <div class="service-cal-grid">
                  <div v-for="(week, wi) in dayHoursCalendarWeeks" :key="`dh-week-${wi}`" class="service-cal-week">
                    <button
                      v-for="(cell, ci) in week"
                      :key="`dh-${wi}-${ci}`"
                      type="button"
                      class="service-cal-day day-hours-cal-day"
                      :class="{
                        empty: !cell,
                        today: cell?.isToday,
                        'has-hours': cell && dayHoursDayHasEntries(cell.iso),
                      }"
                      :disabled="!cell"
                      @click="cell && openDayHoursDate(cell.iso)"
                    >
                      <span v-if="cell" class="service-cal-num">{{ cell.day }}</span>
                      <span v-if="cell && dayHoursDayCount(cell.iso)" class="day-hours-cal-badge">{{ dayHoursDayCount(cell.iso) }}</span>
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="service-day-header">
                  <button type="button" class="btn service-back-btn" @click="closeDayHoursDate">
                    <i class="ti ti-arrow-left" aria-hidden="true"></i>
                    กลับปฏิทิน
                  </button>
                  <div>
                    <h3>เวลาเปิด-ปิดวันที่ {{ formatServiceDateLabel(selectedDayHoursDate) }}</h3>
                    <p class="muted">ช่วงที่ตั้งวันนี้จะใช้แทนเวลาเปิด-ปิดปกติ · เพิ่มได้หลายรายการจนถึง 23:59</p>
                  </div>
                </div>

                <div v-if="dayHoursForSelectedDate.length === 0" class="state-card">
                  <i class="ti ti-clock state-card-icon" aria-hidden="true"></i>
                  <p class="state-card-title">ยังไม่ตั้งเวลาเฉพาะวัน</p>
                  <p class="muted">วันนี้ใช้เวลาเปิด-ปิดปกติ</p>
                </div>
                <div v-for="item in dayHoursForSelectedDate" :key="item.id" class="admin-item">
                  <div>
                    <strong>{{ formatDayHourRange(item) }}</strong>
                  </div>
                  <div class="row">
                    <button type="button" class="btn" @click="openDayHourEdit(item)">แก้ไข</button>
                    <button type="button" class="btn danger" @click="removeDayHourEntry(item.id)">ลบ</button>
                  </div>
                </div>

                <div v-if="dayHourFormOpen && !dayHourEditingId" class="day-hour-form card-inner">
                  <h4>เพิ่มช่วงเวลา</h4>
                  <div class="admin-form-grid admin-option-grid">
        <label>
                      เริ่ม (ชม.)
                      <select v-model.number="dayHourStartH" class="admin-input">
                        <option v-for="h in dayHourAvailableStartHours" :key="`sh-${h}`" :value="h">
                          {{ String(h).padStart(2, '0') }}
                        </option>
                      </select>
                    </label>
                    <label>
                      เริ่ม (นาที)
                      <select v-model.number="dayHourStartM" class="admin-input">
                        <option v-for="m in dayHourAvailableStartMinutes" :key="`sm-${m}`" :value="m">
                          {{ String(m).padStart(2, '0') }}
                        </option>
                      </select>
                    </label>
                    <label>
                      สิ้นสุด (ชม.)
                      <select v-model.number="dayHourEndH" class="admin-input">
                        <option v-for="h in dayHourEndHourOptions" :key="`eh-${h}`" :value="h">
                          {{ String(h).padStart(2, '0') }}
                        </option>
                      </select>
                    </label>
                    <label>
                      สิ้นสุด (นาที)
                      <select v-model.number="dayHourEndM" class="admin-input">
                        <option v-for="m in dayHourEndMinuteOptions" :key="`em-${m}`" :value="m">
                          {{ String(m).padStart(2, '0') }}
                        </option>
                      </select>
        </label>
                  </div>
                  <div class="admin-form-row">
                    <button type="button" class="btn primary admin-action-btn" :disabled="dayHourSaving" @click="saveDayHourEntry">
                      {{ dayHourSaving ? 'กำลังบันทึก...' : 'บันทึก' }}
                    </button>
                    <button type="button" class="btn admin-action-btn" @click="closeDayHourForm">ยกเลิก</button>
                  </div>
      </div>

                <div v-if="!dayHourFormOpen || dayHourEditingId" class="day-hour-actions">
                  <button
                    type="button"
                    class="btn primary day-hour-add-btn"
                    :disabled="dayHourGenerating"
                    @click="generateFullDayHours"
                  >
                    <i class="ti ti-calendar-plus" aria-hidden="true"></i>
                    {{ dayHourGenerating ? 'กำลังสร้าง...' : 'เพิ่มเวลาทั้งวัน' }}
                  </button>
                  <button
                    v-if="dayHourCanAddMore"
                    type="button"
                    class="btn primary day-hour-add-btn day-hour-add-btn-secondary"
                    @click="openDayHourForm"
                  >
                    <i class="ti ti-plus" aria-hidden="true"></i>
                    เพิ่มช่วงเวลา
                  </button>
                  <p v-if="!dayHourCanAddMore && dayHoursForSelectedDate.length" class="muted day-hour-full-note">
                    ครบช่วงเวลาในวันนี้แล้ว (ถึง 23:59)
                  </p>
                </div>
              </template>
            </div>

            <div v-show="activeBlocksSection === 'slot-display'" id="blocks-slot-display" class="admin-settings-section">
              <div class="admin-section-head">
                <h3>ความยาวคิว</h3>
                <p class="muted">กำหนดความยาวคิวและวิธีแสดงช่วงเวลาในหน้าจองลูกค้า</p>
              </div>
              <div class="admin-form-row" style="flex-wrap:wrap;margin-bottom:12px">
                <label class="admin-label-grow">
                  ความยาวคิว (ชม.)
                  <select v-model.number="bookingSlotHours" class="admin-input">
                    <option :value="1">1 ชั่วโมง</option>
                    <option :value="2">2 ชั่วโมง</option>
                    <option :value="3">3 ชั่วโมง</option>
                    <option :value="4">4 ชั่วโมง</option>
                  </select>
                </label>
                <button type="button" class="btn primary admin-action-btn" style="align-self:flex-end" @click="saveBookingSlotHours">
                  บันทึกความยาวคิว
                </button>
              </div>

              <div class="service-option-form card-inner" style="margin-bottom:14px">
                <h4>ขยายเวลาจองตามบริการ</h4>
                <p class="muted">
                  เมื่อเปิด คิวจะยาวตามบริการที่เลือก · คิวถัดไปเริ่มจากเวลาจบจริง (เช่น 13:00–14:20 แล้วต่อ 14:20–15:20) · ช่วงที่ตั้งชนกันถูกรวมเป็นเส้นเดียว · ช่วงพักที่ขาดยังไม่จอง · เศษท้ายวันที่สั้นกว่า 1 ชม. ไม่เปิดเป็นคิวใหม่
                </p>
                <div class="admin-switch-stack" style="margin-bottom:10px">
                  <AdminSwitch
                    v-model="extendBookingByServices"
                    label="ขยายเวลาจองตามบริการ"
                    :disabled="settingToggleSaving === 'extend-booking:enabled'"
                    @update:model-value="(v) => saveExtendBookingToggle('enabled', v)"
                  />
                  <AdminSwitch
                    v-if="extendBookingByServices"
                    v-model="extendBookingPastClose"
                    label="ขยายเกินเวลาปิดร้านได้"
                    hint="ลูกค้าจองได้แม้บริการรวมยาวเกินเวลาปิด (ยังติดคิวถัดไปไม่ได้)"
                    :disabled="settingToggleSaving === 'extend-booking:past_close_enabled'"
                    @update:model-value="(v) => saveExtendBookingToggle('past_close_enabled', v)"
                  />
                </div>
                <div class="shop-hours-preview">
                  <i class="ti ti-hourglass" style="font-size:16px;color:var(--color-primary)"></i>
                  <template v-if="extendBookingByServices">
                    เปิดอยู่ — ตั้ง <strong>ระยะเวลา (นาที)</strong> ในแต่ละบริการด้วย
                  </template>
                  <template v-else>ปิดอยู่ — คิวใช้ความยาวตามที่ตั้งไว้เท่านั้น</template>
                </div>
              </div>

              <div class="service-option-form card-inner" style="margin-bottom:14px">
                <h4>ช่องว่างระหว่างคิว</h4>
                <p class="muted">
                  ไม่เกี่ยวกับความยาวคิวมาตรฐาน — ใช้กำหนดช่วงว่างสั้น ๆ ระหว่างคิว (เช่น 10:15–11:00) ว่าจะเปิดให้จองได้หรือไม่
                </p>
                <div class="admin-switch-stack" style="margin-bottom:10px">
                  <AdminSwitch
                    v-model="bookingMinGapEnabled"
                    label="เปิดจองช่องว่างระหว่างคิว"
                    hint="ปิด = ใช้ค่า 60 นาที (ช่องว่างสั้นกว่า 1 ชม. ไม่เปิดจอง)"
                    :disabled="settingToggleSaving === 'booking-min-gap:enabled'"
                    @update:model-value="saveBookingMinGapToggle"
                  />
                </div>
                <div v-if="bookingMinGapEnabled" class="admin-form-row" style="flex-wrap:wrap;align-items:flex-end;gap:10px">
                  <label class="admin-label-grow">
                    ช่องว่างขั้นต่ำ (นาที)
                    <input
                      v-model.number="bookingMinGapMinutes"
                      type="number"
                      min="15"
                      max="120"
                      step="15"
                      class="admin-input"
                      :disabled="settingToggleSaving === 'booking-min-gap:minutes'"
                      @change="saveBookingMinGapMinutes"
                    />
                  </label>
                  <p class="muted" style="margin:0;flex:1 1 220px">
                    ตัวอย่าง 30 น. → gap 45 น. (10:15–11:00) เปิดจองได้ · 45 น. → gap 45 น. พอดี · 60 น. = ค่าเดิม
                  </p>
                </div>
              </div>

              <div class="booking-view-toggle" role="group" aria-label="รูปแบบแสดงเวลาหน้าจอง">
                <button
                  type="button"
                  class="view-toggle-btn"
                  :class="{ active: bookingDisplayMode === 'normal' }"
                  :disabled="settingToggleSaving === 'booking-display'"
                  @click="selectBookingDisplayMode('normal')"
                >
                  <i class="ti ti-list" aria-hidden="true"></i>
                  ปกติ (ทีละชม.)
                </button>
                <button
                  type="button"
                  class="view-toggle-btn"
                  :class="{ active: bookingDisplayMode === 'slots_2h' }"
                  :disabled="settingToggleSaving === 'booking-display'"
                  @click="selectBookingDisplayMode('slots_2h')"
                >
                  <i class="ti ti-clock" aria-hidden="true"></i>
                  ช่วงบล็อก (กระโดด {{ bookingSlotHours }} ชม.)
                </button>
              </div>
              <div v-if="bookingDisplayMode === 'slots_2h'" class="shop-hours-preview">
                <i class="ti ti-layout-list" style="font-size:16px;color:var(--color-primary)"></i>
                ตัวอย่าง: {{ displaySlotPreview }}
              </div>
            </div>

            <div v-show="activeBlocksSection === 'advance'" id="blocks-advance-days" class="admin-settings-section">
              <div class="admin-section-head">
                <h3>จองล่วงหน้า</h3>
                <p class="muted">กำหนดจำนวนวันล่วงหน้าแล้วกดบันทึก — ระบบจะล็อกวันสิ้นสุดจากวันที่กดบันทึก (ไม่เลื่อนตามวันนี้)</p>
              </div>
              <div class="admin-form-row">
                <label class="admin-label-grow">
                  จองล่วงหน้าได้ (วัน)
                  <input v-model.number="advanceDays" type="number" min="1" max="365" step="1" class="admin-input" />
                </label>
                <button class="btn primary admin-action-btn" @click="saveAdvanceDays">บันทึก</button>
              </div>
              <div class="shop-hours-preview">
                <i class="ti ti-calendar-event" style="font-size:16px;color:var(--color-primary)"></i>
                เปิดจองถึง <strong>{{ formatBookUntilLabel(bookUntilDate) }}</strong>
                <span v-if="bookUntilDate" class="muted">({{ advanceDays }} วัน นับจากวันที่กดบันทึกล่าสุด)</span>
              </div>
            </div>

            <div v-show="activeBlocksSection === 'bulk'" class="admin-settings-section">
              <div class="admin-section-head">
                <h3>ปิดหลายวัน</h3>
                <p class="muted">ปิดทั้งวัน หรือ บางช่วงเวลา ตั้งแต่วันที่ที่เลือก</p>
              </div>

      <div class="bulk-block-box">
        <div class="admin-form-grid admin-bulk-settings">
          <label>
            ประเภท
            <select v-model="bulkBlockType" class="admin-input">
              <option value="partial">ปิดบางช่วงเวลา</option>
              <option value="full_day">ปิดทั้งวัน</option>
            </select>
          </label>
          <label v-if="bulkBlockType === 'partial'">
            เริ่ม (ชม.)
            <input v-model="bulkBlockStart" type="number" min="0" max="23" class="admin-input" />
          </label>
          <label v-if="bulkBlockType === 'partial'">
            ถึง (ชม.)
            <input v-model="bulkBlockEnd" type="number" min="1" max="24" class="admin-input" />
          </label>
        </div>
        <div class="admin-form-grid admin-bulk-grid">
          <label>
            เริ่มจากวันที่
            <input v-model="bulkStartDate" type="date" class="admin-input" />
          </label>
          <label>
            จำนวนวัน
            <input v-model.number="bulkDays" type="number" min="1" max="90" class="admin-input" />
          </label>
        </div>
        <div class="admin-form-row">
          <label class="admin-label-grow">
            หมายเหตุ
            <input v-model="bulkBlockNote" type="text" placeholder="เช่น พนักงานไม่พอ / ร้านปิดปรับปรุง" class="admin-input" />
          </label>
        </div>
        <p class="bulk-preview">{{ bulkPreviewText }}</p>
        <div class="bulk-preset-row">
          <button type="button" class="btn" :class="{ primary: bulkDays === 7 }" @click="bulkDays = 7">7 วัน</button>
          <button type="button" class="btn" :class="{ primary: bulkDays === 15 }" @click="bulkDays = 15">15 วัน</button>
          <button type="button" class="btn" :class="{ primary: bulkDays === 30 }" @click="bulkDays = 30">30 วัน</button>
          <button type="button" class="btn primary admin-action-btn" @click="createBulkBlocks">
            ยืนยันปิดล่วงหน้า
          </button>
                </div>
        </div>
      </div>

            <div v-show="activeBlocksSection === 'calendar'" class="admin-settings-section">
              <template v-if="!selectedBlockDate">
                <div class="admin-section-head">
                  <h3>ปิดทีละวัน</h3>
                  <p class="muted">กดวันที่ในปฏิทินเพื่อจัดการรายการปิด · สีตามสถานที่ให้บริการ</p>
                </div>

                <div class="service-cal-nav">
                  <button type="button" class="btn service-cal-nav-btn" @click="shiftBlockMonth(-1)" aria-label="เดือนก่อน">
                    <i class="ti ti-chevron-left" aria-hidden="true"></i>
                  </button>
                  <span class="service-cal-month">{{ blockMonthLabel }}</span>
                  <button type="button" class="btn service-cal-nav-btn" @click="shiftBlockMonth(1)" aria-label="เดือนถัดไป">
                    <i class="ti ti-chevron-right" aria-hidden="true"></i>
                  </button>
                </div>

                <div class="service-cal-weekdays">
                  <span v-for="wd in serviceWeekdays" :key="`blk-${wd}`" class="service-cal-wd">{{ wd }}</span>
                </div>

                <div class="service-cal-grid">
                  <div v-for="(week, wi) in blockCalendarWeeks" :key="`blk-week-${wi}`" class="service-cal-week">
                    <button
                      v-for="(cell, ci) in week"
                      :key="`blk-${wi}-${ci}`"
                      type="button"
                      class="service-cal-day block-cal-day"
                      :class="{
                        empty: !cell,
                        today: cell?.isToday && !blockDayColor(cell.iso),
                        'has-block': cell && blockDayMarker(cell.iso) && !blockDayColor(cell.iso),
                      }"
                      :style="cell ? blockDayStyle(cell.iso) : undefined"
                      :disabled="!cell"
                      @click="cell && openBlockDay(cell.iso)"
                    >
                      <span v-if="cell" class="service-cal-num">{{ cell.day }}</span>
                      <span
                        v-if="cell && blockDayMarker(cell.iso)"
                        class="block-cal-marker"
                        :class="blockDayMarker(cell.iso)"
                        :title="blockDayMarker(cell.iso) === 'full' ? 'ปิดทั้งวัน' : 'ปิดบางช่วงเวลา'"
                      >
                        {{ blockDayMarker(cell.iso) === 'full' ? '×' : '!' }}
                      </span>
                    </button>
                  </div>
                </div>

                <div class="booking-cal-legend block-cal-legend">
                  <span><span class="block-cal-marker full inline">×</span> ปิดทั้งวัน</span>
                  <span><span class="block-cal-marker partial inline">!</span> ปิดบางช่วงเวลา</span>
                </div>
              </template>

              <template v-else>
                <div class="service-day-header">
                  <button type="button" class="btn service-back-btn" @click="closeBlockDay">
                    <i class="ti ti-arrow-left" aria-hidden="true"></i>
                    กลับปฏิทิน
                  </button>
                  <div>
                    <h3>ปิดรับคิววันที่ {{ formatServiceDateLabel(selectedBlockDate) }}</h3>
                    <p v-if="blockDayColor(selectedBlockDate)" class="muted">
                      สถานที่ให้บริการ:
                      <span
                        class="block-day-color-dot"
                        :style="{ background: blockDayColor(selectedBlockDate) }"
                      ></span>
                    </p>
                  </div>
                </div>

                <div v-if="selectedDayBlocks.length === 0" class="state-card">
                  <i class="ti ti-calendar-off state-card-icon" aria-hidden="true"></i>
                  <p class="state-card-title">ยังไม่มีรายการปิดในวันนี้</p>
                </div>
                <div v-for="item in selectedDayBlocks" :key="item.id" class="admin-item">
                  <div>
                    <strong>
                      {{
                        item.is_full_day
                          ? 'ปิดทั้งวัน'
                          : `ปิดเวลา ${item.start_hour}:00 - ${item.end_hour}:00`
                      }}
                    </strong>
                    <p v-if="item.note" class="muted">{{ item.note }}</p>
                  </div>
                  <button class="btn danger" @click="removeBlock(item.id)">ลบ</button>
                </div>

                <h4 class="admin-subtitle">เพิ่มรายการปิดวันนี้</h4>
      <div class="admin-form-grid">
        <label>
          ประเภท
          <select v-model="blockType" class="admin-input">
            <option value="partial">ปิดบางช่วงเวลา</option>
            <option value="full_day">ปิดทั้งวัน</option>
          </select>
        </label>
        <label v-if="blockType === 'partial'">
          เริ่ม
          <input v-model="blockStart" type="number" min="0" max="23" class="admin-input" />
        </label>
        <label v-if="blockType === 'partial'">
          ถึง
          <input v-model="blockEnd" type="number" min="1" max="24" class="admin-input" />
        </label>
      </div>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          หมายเหตุ
          <input v-model="blockNote" type="text" placeholder="เช่น พนักงานไม่พอ / ร้านปิดปรับปรุง" class="admin-input" />
        </label>
                  <button class="btn primary admin-action-btn" @click="createBlock">เพิ่มรายการปิด</button>
      </div>

                <h4 class="admin-subtitle admin-extra-title">เปิดรับเพิ่ม (นอกเวลาปกติ)</h4>
                <p class="muted admin-extra-hint">
                  เช่น เปิด 19:00–21:00 วันพิเศษ ทั้งที่ปกติปิดรับ 19:00
                </p>

                <div v-if="selectedDayExtraHours.length === 0" class="state-card">
                  <i class="ti ti-clock-plus state-card-icon" aria-hidden="true"></i>
                  <p class="state-card-title">ยังไม่มีช่วงเปิดเพิ่มในวันนี้</p>
                </div>
                <div v-for="item in selectedDayExtraHours" :key="item.id" class="admin-item admin-extra-item">
        <div>
                    <strong>เปิดเพิ่ม {{ item.start_hour }}:00 – {{ item.end_hour }}:00</strong>
                    <p v-if="item.note" class="muted">{{ item.note }}</p>
                  </div>
                  <button class="btn danger" @click="removeExtraHour(item.id)">ลบ</button>
                </div>

                <div class="admin-form-grid">
                  <label>
                    เริ่ม (ชม.)
                    <input v-model="extraStart" type="number" min="0" max="23" class="admin-input" />
                  </label>
                  <label>
                    ถึง (ชม.)
                    <input v-model="extraEnd" type="number" min="1" max="24" class="admin-input" />
                  </label>
                </div>
                <div class="admin-form-row">
                  <label class="admin-label-grow">
                    หมายเหตุ
                    <input v-model="extraNote" type="text" placeholder="เช่น เปิดคิวพิเศษช่วงเย็น" class="admin-input" />
                  </label>
                  <button class="btn primary admin-action-btn" @click="createExtraHour">เพิ่มช่วงเปิดรับ</button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── รีวิว TikTok / Instagram ── -->
    <section v-show="activeTab === 'reviews'" class="admin-section">
      <div class="admin-section-head">
        <h3>คลิปรีวิว</h3>
        <p class="muted">วางลิงก์ TikTok หรือ Instagram ทีละคลิป</p>
      </div>

      <div id="reviews-clip-form" class="admin-settings-section">
      <template v-if="!clipForm.id">
      <div class="admin-form-row showcase-clip-form">
        <label class="admin-label-grow">
          ลิงก์ TikTok / Instagram
          <input
            v-model="clipForm.tiktok_url"
            type="url"
            class="admin-input"
            placeholder="https://www.tiktok.com/... หรือ https://www.instagram.com/p/..."
          />
        </label>
        <label class="admin-label-grow">
          ชื่อแสดง (ไม่บังคับ)
          <input
            v-model="clipForm.title"
            type="text"
            class="admin-input"
            placeholder="เช่น เจล french"
          />
        </label>
        <label class="admin-filter-item">
          แสดง
          <select v-model="clipForm.is_active" class="admin-input">
            <option :value="true">เปิด</option>
            <option :value="false">ปิด</option>
          </select>
        </label>
        </div>

      <div class="row">
        <button type="button" class="btn primary" @click="saveShowcaseClip">
          เพิ่มคลิป
        </button>
      </div>
      </template>
      </div>

      <div v-if="showcaseClips.length === 0" class="state-card" style="margin-top:14px">
        <i class="ti ti-brand-tiktok state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">ยังไม่มีคลิป</p>
        <p class="muted">วางลิงก์ด้านบนแล้วกดเพิ่มคลิป</p>
      </div>

      <div v-for="(item, index) in showcaseClips" :key="item.id" class="admin-item showcase-clip-item">
        <div class="showcase-clip-info">
          <img
            v-if="item.id && !showcaseThumbFailed.has(item.id)"
            :src="clipThumbnailSrc(item.id)"
            alt=""
            class="showcase-clip-preview"
            @error="onShowcaseThumbError(item.id)"
          />
          <div v-else class="showcase-clip-preview showcase-clip-preview-empty">ไม่มีปก</div>
          <div>
            <strong>{{ item.title || `คลิป #${index + 1}` }}</strong>
            <span class="user-badge-provider">{{ item.source === 'instagram' ? 'Instagram' : 'TikTok' }}</span>
            <span v-if="!item.is_active" class="user-badge-provider">ปิดแสดง</span>
            <p class="muted">ลำดับ {{ index + 1 }}</p>
          </div>
        </div>
        <div class="row">
          <button type="button" class="btn" :disabled="index === 0" @click="moveShowcaseClip(item, 'up')">
            ↑
          </button>
          <button
            type="button"
            class="btn"
            :disabled="index === showcaseClips.length - 1"
            @click="moveShowcaseClip(item, 'down')"
          >
            ↓
          </button>
          <button type="button" class="btn" @click="refreshShowcaseThumbnail(item)">ดึงปก</button>
          <button type="button" class="btn" @click="startEditClip(item)">แก้ไข</button>
          <button type="button" class="btn" @click="toggleShowcaseClip(item)">
            {{ item.is_active ? 'ปิดแสดง' : 'เปิดแสดง' }}
          </button>
          <button type="button" class="btn danger" @click="removeShowcaseClip(item)">ลบ</button>
        </div>
      </div>
    </section>

    <AdminManualPanel v-if="activeTab === 'manual'" />

    <AdminRenewalPanel
      v-if="showRenewalTab && activeTab === 'renewal'"
      :is-super-admin="isSuperAdmin"
      :shop-slug="shopSlug"
      :active="true"
      :branch-usage="currentBranchUsage"
      :branch-shops="branchShopsForRenewal"
      :format-usage-expiry-date="formatUsageExpiryDate"
      @shops-changed="onRenewalShopsChanged"
    />

    <AdminShopFeaturesPanel
      v-if="isSuperAdmin && shopSlug === 'default' && activeTab === 'features'"
      :is-super-admin="isSuperAdmin"
      :shop-slug="shopSlug"
      :active="true"
    />

    <!-- ── ผู้ใช้ ── -->
    <section v-show="activeTab === 'users'" class="admin-section">
      <div class="admin-section-head">
        <h3>รายชื่อผู้ใช้</h3>
        <p v-if="shopSlug === 'default'" class="muted">ผู้ใช้ทั้งหมดในระบบ</p>
        <p v-else class="muted">ลูกค้าที่เคยจองสาขา /{{ shopSlug }}</p>
      </div>
      <div class="admin-form-row" style="margin-bottom:14px;flex-wrap:wrap">
        <label class="admin-label-grow">
          ค้นหา
          <input
            v-model="userSearch"
            type="text"
            placeholder="ชื่อหรืออีเมล..."
            class="admin-input"
          />
        </label>
        <button
          v-if="canManageShopAdmins"
          type="button"
          class="btn primary admin-action-btn"
          style="align-self:flex-end"
          @click="openStaffAdd"
        >
          <i class="ti ti-user-plus" aria-hidden="true"></i>
          {{ staffAddBtnLabel }}
        </button>
      </div>

      <p v-if="usersTotal > 0" class="muted admin-users-count">
        แสดง {{ users.length }} จาก {{ usersTotal }} คน
      </p>

      <div v-if="usersLoading" class="state-card">
        <i class="ti ti-loader-2 state-card-icon" aria-hidden="true"></i>
        <span class="state-card-title">กำลังโหลดรายชื่อ</span>
      </div>
      <div v-else-if="filteredUsers.length === 0" class="state-card">
        <i class="ti ti-users state-card-icon" aria-hidden="true"></i>
        <span class="state-card-title">ไม่พบผู้ใช้</span>
      </div>

      <div ref="usersListRef" class="admin-users-list">
      <div v-for="u in filteredUsers" :key="u.id" class="admin-item user-item">
        <div class="user-info">
          <strong>{{ u.name }}</strong>
          <span class="user-badge-provider">{{ providerLabel(u.provider) }}</span>
          <span v-if="u.is_admin" class="user-badge-admin">
            แอดมิน · {{ adminShopLabel(u) }}
          </span>
          <p class="muted">{{ u.email || '-' }}</p>
          <p v-if="u.provider === 'phone'" class="muted">ล็อกอิน: {{ u.provider_id }}</p>
          <p class="muted">
            แต้ม {{ u.total_points }} ·
            จอง {{ u.total_bookings }} ครั้ง ·
            เสร็จ {{ u.completed_bookings }} ครั้ง ·
            ยกเลิก {{ u.cancelled_bookings ?? 0 }} ครั้ง ·
            สมัคร {{ formatDateKey(u.created_at) }}
          </p>
          <p v-if="u.admin_note" class="user-admin-note">หมายเหตุ: {{ u.admin_note }}</p>
        </div>
        <div class="row" style="flex-shrink:0">
          <button type="button" class="btn" @click="openSendMessageModal(u)">ส่งข้อความ</button>
          <button type="button" class="btn primary" @click="openAdminChat(u.id)">ไปแชท</button>
          <button type="button" class="btn primary" @click="openUserHistory(u)">ประวัติจอง</button>
          <button type="button" class="btn" @click="editUser(u)">แก้ไขข้อมูล</button>
          <button
            v-if="canToggleUserAdmin(u)"
            class="btn"
            :class="u.is_admin ? 'danger' : ''"
            @click="toggleAdmin(u)"
          >
            {{ u.is_admin ? 'ถอดแอดมิน' : 'ให้สิทธิ์แอดมิน' }}
          </button>
          <button v-if="!u.is_admin" class="btn danger" @click="deleteUser(u)">ลบ</button>
        </div>
      </div>
      <div ref="usersSentinelRef" class="admin-users-sentinel" aria-hidden="true"></div>
      </div>
      <p v-if="usersLoadingMore" class="muted admin-users-loading">กำลังโหลดเพิ่ม...</p>
      <p
        v-else-if="usersHasMore && filteredUsers.length > 0"
        class="muted admin-users-load-hint"
      >
        เลื่อนลงล่างสุดเพื่อโหลดเพิ่มอีก {{ USER_PAGE_SIZE }} คน
      </p>
    </section>

    <Teleport to="body">
      <div
        v-if="shopEditOpen"
        class="booking-edit-backdrop"
        @click.self="closeShopEdit"
      >
        <div class="booking-edit-modal card" role="dialog" aria-labelledby="shop-edit-title">
          <div class="booking-edit-header">
            <h3 id="shop-edit-title">แก้ไขสาขา</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="closeShopEdit">×</button>
          </div>
          <p v-if="shopEditItem" class="muted booking-edit-meta">/{{ shopEditItem.slug }}</p>
          <label class="booking-edit-field">
            ชื่อสาขา
            <input v-model="shopEditName" id="shop-edit-name-input" class="admin-input" @input="shopEditError = ''" />
          </label>
          <AdminSwitch v-model="shopEditActive" label="เปิดใช้งาน" />
          <label class="booking-edit-field">
            จำกัดเวลาใช้งาน (วัน)
            <input
              v-model="shopEditUsageLimitDays"
              type="number"
              min="1"
              max="3650"
              class="admin-input"
              placeholder="ว่าง = ไม่จำกัด"
              @input="shopEditError = ''"
            />
            <span class="usage-preset-row">
              <button type="button" class="btn usage-preset-btn" @click="shopEditUsageLimitDays = ''">ไม่จำกัด</button>
              <button
                v-for="days in USAGE_PRESET_DAYS"
                :key="`edit-usage-${days}`"
                type="button"
                class="btn usage-preset-btn"
                @click="shopEditUsageLimitDays = String(days)"
              >
                {{ days }} ว.
              </button>
            </span>
          </label>
          <p v-if="shopEditItem?.usage_expires_at" class="muted booking-edit-meta">
            หมดอายุ: {{ formatUsageExpiryDate(shopEditItem.usage_expires_at) }}
            <template v-if="shopEditItem.usage_days_remaining != null">
              · เหลือ {{ shopEditItem.usage_days_remaining }} วัน
            </template>
          </p>
          <label v-if="hasUsageLimitInput(shopEditUsageLimitDays)" class="admin-checkbox">
            <input v-model="shopEditResetUsage" type="checkbox" />
            เริ่มนับระยะเวลาใหม่ (จากวันนี้)
          </label>
          <p v-if="shopEditError" class="alert error">{{ shopEditError }}</p>
          <div class="booking-edit-actions">
            <button type="button" class="btn" :disabled="shopEditSaving" @click="closeShopEdit">ยกเลิก</button>
            <button type="button" class="btn primary" :disabled="shopEditSaving" @click="saveShopEdit">
              {{ shopEditSaving ? 'กำลังบันทึก...' : 'บันทึก' }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="chatSendOpen"
        class="booking-edit-backdrop"
        @click.self="closeSendMessageModal"
      >
        <div id="admin-chat-send-modal" class="booking-edit-modal card" role="dialog" aria-labelledby="chat-send-title">
          <div class="booking-edit-header">
            <h3 id="chat-send-title">ส่งข้อความ</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="closeSendMessageModal">×</button>
          </div>
          <p v-if="chatSendUser" class="muted booking-edit-meta">
            ถึง <strong>{{ chatSendUser.name }}</strong>
            · {{ chatSendUser.email || '-' }}
          </p>
          <label class="booking-edit-field">
            ข้อความ
            <textarea
              id="admin-chat-send-input"
              v-model="chatSendBody"
              rows="4"
              class="admin-input"
              placeholder="พิมพ์ข้อความ..."
              maxlength="2000"
              @input="chatSendError = ''"
            />
          </label>
          <p v-if="chatSendError" class="alert error">{{ chatSendError }}</p>
          <div class="booking-edit-actions">
            <button type="button" class="btn" :disabled="chatSendSaving" @click="closeSendMessageModal">ยกเลิก</button>
            <button type="button" class="btn primary" :disabled="chatSendSaving || !chatSendBody.trim()" @click="submitSendMessageModal">
              {{ chatSendSaving ? 'กำลังส่ง...' : 'ส่งข้อความ' }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="userHistoryOpen"
        class="booking-edit-backdrop"
        @click.self="closeUserHistory"
      >
        <div class="booking-edit-modal card user-history-modal" role="dialog" aria-labelledby="user-history-title">
          <div class="booking-edit-header">
            <h3 id="user-history-title">ประวัติการจอง</h3>
            <button type="button" class="btn booking-edit-close" aria-label="ปิด" @click="closeUserHistory">
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>

          <template v-if="userHistoryUser">
            <p class="muted booking-edit-meta">
              <strong>{{ userHistoryUser.name }}</strong>
              · {{ userHistoryUser.email || '-' }}
            </p>
            <p class="muted booking-edit-meta">
              {{ providerLabel(userHistoryUser.provider) }}
              <template v-if="userHistoryUser.provider === 'phone'"> · {{ userHistoryUser.provider_id }}</template>
              · แต้ม {{ userHistoryUser.total_points ?? 0 }}
            </p>
          </template>

          <p v-if="userHistoryLoading" class="muted user-history-empty">กำลังโหลด...</p>
          <p v-else-if="userHistoryError" class="user-history-error">{{ userHistoryError }}</p>
          <p v-else-if="userHistoryBookings.length === 0" class="muted user-history-empty">ยังไม่มีประวัติการจอง</p>

          <div v-else class="user-history-list">
            <div v-for="item in userHistoryBookings" :key="item.id" class="user-history-item">
              <div class="user-history-item-main">
                <strong>{{ formatServiceDateLabel(formatDateKey(item.booking_date)) }}</strong>
                <span class="user-history-time">{{ bookingTimeRange(item) }}</span>
                <span class="user-history-status" :class="statusBadgeClass(item.status)">
                  {{ statusLabel(item.status) }}
                </span>
              </div>
              <p v-if="item.nail_options?.length" class="muted user-history-services">
                {{ item.nail_options.map((o) => o.option_name).join(', ') }}
              </p>
              <p class="muted user-history-meta">
                จองเมื่อ {{ formatCreatedAt(item.created_at) }}
                <template v-if="item.status === 'done'">
                  · ยอด {{ formatBookingTotal(item.total) }}
                  <template v-if="item.completed_at"> · เสร็จ {{ formatCreatedAt(item.completed_at) }}</template>
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="staffAddOpen"
        id="admin-staff-add-modal"
        class="booking-edit-backdrop"
        @click.self="closeStaffAdd"
      >
        <div class="booking-edit-modal card" role="dialog" aria-labelledby="staff-add-title">
          <div class="booking-edit-header">
            <h3 id="staff-add-title">{{ staffAddBtnLabel }} (แอดมิน)</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="closeStaffAdd">×</button>
          </div>
          <p v-if="isSuperAdmin" class="muted booking-edit-meta">
            สร้างบัญชีล็อกอินเบอร์โทร + ให้สิทธิ์แอดมินตามสาขาที่เลือก
          </p>
          <p v-else class="muted booking-edit-meta">
            สร้างบัญชีล็อกอินเบอร์โทร + ให้สิทธิ์แอดมินสาขา <strong>/{{ shopSlug }}</strong> เท่านั้น
          </p>

          <label class="booking-edit-field">
            ชื่อ *
            <input
              v-model="staffAddName"
              type="text"
              class="admin-input"
              placeholder="ชื่อที่ใช้ล็อกอิน"
              @input="staffAddError = ''"
            />
          </label>

          <label class="booking-edit-field">
            เบอร์โทร *
            <input
              v-model="staffAddPhone"
              type="tel"
              class="admin-input"
              placeholder="เช่น 0812345678"
              @input="staffAddError = ''"
            />
          </label>

          <label v-if="isSuperAdmin" class="booking-edit-field">
            สาขาที่ดูแล
            <select v-model="staffAddShopSlug" class="admin-input" @change="staffAddError = ''">
              <option value="default">ทุกสาขา (แอดมินหลัก)</option>
              <option v-for="shop in branchShopOptions" :key="shop.id" :value="shop.slug">
                {{ shop.name }} ({{ shop.slug }})
              </option>
            </select>
          </label>

          <p class="muted booking-edit-meta">
            ช่างล็อกอินที่หน้าเข้าสู่ระบบด้วย <strong>ชื่อ + เบอร์โทร</strong> เหมือนลูกค้า
          </p>

          <p v-if="staffAddError" class="alert error">{{ staffAddError }}</p>

          <div class="booking-edit-actions">
            <button type="button" class="btn" :disabled="staffAddSaving" @click="closeStaffAdd">
              ยกเลิก
            </button>
            <button type="button" class="btn primary" :disabled="staffAddSaving" @click="saveStaffAdd">
              {{ staffAddSaving ? 'กำลังสร้าง...' : 'สร้างแอดมิน' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="userEditOpen"
        class="booking-edit-backdrop"
        @click.self="closeUserEdit"
      >
        <div id="admin-user-edit-modal" class="booking-edit-modal card" role="dialog" aria-labelledby="user-edit-title">
          <div class="booking-edit-header">
            <h3 id="user-edit-title">แก้ไขข้อมูลผู้ใช้</h3>
            <button type="button" class="btn booking-edit-close" aria-label="ปิด" @click="closeUserEdit">
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>

          <p v-if="userEditItem" class="muted booking-edit-meta">
            {{ providerLabel(userEditItem.provider) }} · สมัคร {{ formatDateKey(userEditItem.created_at) }}
          </p>
          <p v-if="userEditItem" class="muted booking-edit-meta user-edit-readonly-stats">
            จอง {{ userEditItem.total_bookings }} ครั้ง · เสร็จ {{ userEditItem.completed_bookings }} ครั้ง ·
            ยกเลิก {{ userEditItem.cancelled_bookings ?? 0 }} ครั้ง
            <span class="user-edit-readonly-hint">(คำนวณจากคิว แก้ไขไม่ได้)</span>
          </p>

          <label class="booking-edit-field">
            ชื่อ
            <input
              v-model="userEditName"
              type="text"
              class="admin-input"
              @input="userEditError = ''"
            />
          </label>

          <label class="booking-edit-field">
            รหัสล็อกอิน
            <input
              v-if="userEditItem?.provider === 'phone'"
              v-model="userEditLoginId"
              type="tel"
              class="admin-input"
              placeholder="เบอร์โทรที่ใช้ล็อกอิน"
              @input="userEditError = ''"
            />
            <input
              v-else
              :value="userEditItem?.provider_id || '-'"
              type="text"
              class="admin-input"
              disabled
            />
            <span v-if="userEditItem?.provider !== 'phone'" class="user-edit-readonly-hint">
              บัญชี {{ providerLabel(userEditItem?.provider) }} ล็อกอินผ่าน {{ providerLabel(userEditItem?.provider) }} โดยตรง
            </span>
          </label>

          <label class="booking-edit-field">
            อีเมล
            <input
              v-model="userEditEmail"
              type="email"
              class="admin-input"
              @input="userEditError = ''"
            />
          </label>

          <label class="booking-edit-field">
            แต้ม
            <input
              v-model.number="userEditPoints"
              type="number"
              min="0"
              step="1"
              class="admin-input"
              @input="userEditError = ''"
            />
          </label>

          <AdminSwitch
            v-if="canEditUserAdminRights(userEditItem)"
            v-model="userEditIsAdmin"
            label="สิทธิ์แอดมิน"
            :disabled="userEditItem?.id === auth.user?.id && userEditItem?.is_admin"
            @update:model-value="userEditError = ''"
          />

          <label v-if="isSuperAdmin && userEditIsAdmin" class="booking-edit-field">
            สาขาที่ดูแล
            <select v-model="userEditAdminShopSlug" class="admin-input" @change="userEditError = ''">
              <option value="default">ทุกสาขา (แอดมินหลัก)</option>
              <option v-for="shop in branchShopOptions" :key="shop.id" :value="shop.slug">
                {{ shop.name }} ({{ shop.slug }})
              </option>
            </select>
          </label>

          <p
            v-else-if="canEditUserAdminRights(userEditItem) && userEditIsAdmin"
            class="muted booking-edit-meta"
          >
            สาขาที่ดูแล: <strong>{{ shopStore.shopName || shopSlug }}</strong> (/{{ shopSlug }})
          </p>

          <label class="booking-edit-field">
            หมายเหตุ
            <textarea
              v-model="userEditNote"
              class="admin-input user-edit-note"
              rows="4"
              placeholder="บันทึกหมายเหตุเกี่ยวกับลูกค้า..."
              @input="userEditError = ''"
            />
          </label>

          <p v-if="userEditError" class="alert error">{{ userEditError }}</p>

          <div class="booking-edit-actions">
            <button type="button" class="btn" :disabled="userEditSaving" @click="closeUserEdit">
              ยกเลิก
            </button>
            <button
              type="button"
              class="btn primary"
              :disabled="userEditSaving"
              @click="saveUserEdit"
            >
              {{ userEditSaving ? 'กำลังบันทึก...' : 'บันทึก' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="bookingAddOpen"
        class="booking-edit-backdrop"
        @click.self="closeBookingAdd"
      >
        <div class="booking-edit-modal card" role="dialog" aria-labelledby="booking-add-title">
          <div class="booking-edit-header">
            <h3 id="booking-add-title">เพิ่มคิว</h3>
            <button type="button" class="btn booking-edit-close" aria-label="ปิด" @click="closeBookingAdd">
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>

          <p class="muted booking-edit-meta">
            วันที่ {{ formatServiceDateLabel(bookingAddDate) }}
            <span v-if="bookingAddDate && bookingAddDate < todayYmd()"> · จองย้อนหลัง</span>
          </p>

          <label class="booking-edit-field">
            ค้นหาลูกค้า
            <input
              v-model="bookingAddUserQuery"
              type="search"
              class="admin-input"
              placeholder="ชื่อ อีเมล หรือเบอร์โทร"
              @input="bookingAddError = ''"
            />
          </label>

          <label class="booking-edit-field">
            ลูกค้า
            <select v-model="bookingAddUserId" class="admin-input" @change="bookingAddError = ''">
              <option value="">-- เลือกลูกค้า --</option>
              <option v-for="u in bookingAddUsers" :key="u.id" :value="u.id">
                {{ u.name }} ({{ u.email }})
              </option>
            </select>
          </label>

          <label class="booking-edit-field">
            เวลาเริ่ม
            <select v-model="bookingAddSlotKey" class="admin-input" @change="bookingAddError = ''">
              <option v-if="!bookingAddHourOptions.length" value="" disabled>ไม่มีช่วงเวลาว่าง</option>
              <option v-for="opt in bookingAddHourOptions" :key="opt.key" :value="opt.key">
                {{ opt.label }}
              </option>
            </select>
          </label>

          <label class="booking-edit-field">
            สถานะ
            <select v-model="bookingAddStatus" class="admin-input" @change="bookingAddError = ''">
              <option value="awaiting_payment">รอชำระเงิน</option>
              <option value="pending">ชำระแล้ว / รอให้บริการ</option>
              <option value="done">ทำเสร็จแล้ว</option>
            </select>
          </label>

          <label class="booking-edit-field">
            ยอดเงิน (บาท)
            <input
              v-model="bookingAddTotal"
              type="number"
              min="0"
              step="1"
              class="admin-input"
              :placeholder="bookingAddStatus === 'done' ? 'จำเป็นสำหรับสถานะทำเสร็จแล้ว' : 'ไม่บังคับ'"
              @input="bookingAddError = ''"
            />
          </label>

          <div class="booking-edit-services">
            <p class="booking-edit-label">บริการ</p>
            <p class="muted booking-edit-hint">เลือกหมวดหมู่ก่อน แล้วเลือกบริการ · แสดงเฉพาะวันจองนี้</p>
            <p v-if="bookingAddLoading" class="muted">กำลังโหลดรายการบริการ...</p>
            <template v-else>
              <div v-if="bookingAddRequiredOptions.length" class="booking-edit-option-list booking-edit-required-list">
                <p class="booking-edit-sub-label">บริการบังคับ</p>
                <label
                  v-for="opt in bookingAddRequiredOptions"
                  :key="`add-req-${opt.id}`"
                  class="booking-edit-option required selected"
                >
                  <input
                    v-model="bookingAddSelectedIds"
                    type="checkbox"
                    class="booking-edit-option-input"
                    :value="String(opt.id)"
                    disabled
                  />
                  <span class="booking-edit-option-name">
                    {{ opt.option_name }}
                    <span v-if="formatBookingOptionDuration(opt)" class="booking-edit-option-duration">
                      {{ formatBookingOptionDuration(opt) }}
                    </span>
                    <span class="booking-edit-required">บังคับ</span>
                  </span>
                  <span v-if="opt.description" class="booking-edit-option-desc">{{ opt.description }}</span>
                </label>
              </div>

              <div v-if="bookingAddBookableCategories.length > 1" class="admin-booking-category-row">
                <button
                  v-for="cat in bookingAddBookableCategories"
                  :key="`add-cat-${cat.id}`"
                  type="button"
                  class="admin-booking-category-btn"
                  :class="{ active: bookingAddSelectedCategoryId === cat.id }"
                  @click="bookingAddSelectedCategoryId = cat.id; bookingAddError = ''"
                >
                  {{ cat.name }}
                  <span class="admin-booking-category-count">({{ cat.count }})</span>
                </button>
              </div>
              <p v-else-if="bookingAddBookableCategories.length === 1" class="muted booking-edit-sub-label">
                หมวด {{ bookingAddBookableCategories[0].name }}
              </p>

              <div v-if="bookingAddCategoryOptions.length" class="booking-edit-option-list">
                <label
                  v-for="opt in bookingAddCategoryOptions"
                  :key="opt.id"
                  class="booking-edit-option"
                  :class="{ selected: bookingAddSelectedIds.includes(String(opt.id)) }"
                >
                  <input
                    v-model="bookingAddSelectedIds"
                    type="checkbox"
                    class="booking-edit-option-input"
                    :value="String(opt.id)"
                    @change="bookingAddError = ''"
                  />
                  <span class="booking-edit-option-name">
                    {{ opt.option_name }}
                    <span v-if="formatBookingOptionDuration(opt)" class="booking-edit-option-duration">
                      {{ formatBookingOptionDuration(opt) }}
                    </span>
                  </span>
                  <span v-if="opt.description" class="booking-edit-option-desc">{{ opt.description }}</span>
                </label>
              </div>
              <p v-else-if="!bookingAddRequiredOptions.length" class="muted">ไม่มีบริการให้เลือก</p>
            </template>
          </div>

          <p
            v-if="bookingAddSelectedIds.length && (bookingAddSelectedTotalMinutes > 0 || extendBookingByServices)"
            class="booking-edit-duration-summary"
          >
            <span v-if="bookingAddSelectedTotalMinutes > 0">
              รวมเวลาบริการ {{ bookingAddServiceDurationLabel }}
            </span>
            <span v-if="extendBookingByServices && bookingAddPredictedEndLabel">
              <template v-if="bookingAddSelectedTotalMinutes > 0"> · </template>
              คาดว่าจบ {{ bookingAddPredictedEndLabel }}
            </span>
          </p>

          <p v-if="bookingAddError" class="alert error">{{ bookingAddError }}</p>

          <div class="booking-edit-actions">
            <button type="button" class="btn" :disabled="bookingAddSaving" @click="closeBookingAdd">
              ยกเลิก
            </button>
            <button
              type="button"
              class="btn primary"
              :disabled="bookingAddSaving || bookingAddLoading"
              @click="saveBookingAdd"
            >
              {{ bookingAddSaving ? 'กำลังบันทึก...' : 'บันทึก' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="bookingEditOpen"
        class="booking-edit-backdrop"
        @click.self="closeBookingEdit"
      >
        <div id="admin-booking-edit-modal" class="booking-edit-modal card" role="dialog" aria-labelledby="booking-edit-title">
          <div class="booking-edit-header">
            <h3 id="booking-edit-title">{{ isBookingRestoreMode ? 'เลือกเวลาเพื่อคืนสถานะจอง' : 'แก้ไขข้อมูลคิว' }}</h3>
            <button type="button" class="btn booking-edit-close" aria-label="ปิด" @click="closeBookingEdit">
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>

          <p v-if="isBookingRestoreMode" class="alert-banner warning booking-restore-banner" role="status">
            <i class="ti ti-alert-triangle" aria-hidden="true"></i>
            <span>{{ bookingRestoreConflictHint }} · เวลาเดิม {{ bookingEditCurrentHourLabel }}</span>
          </p>

          <label class="booking-edit-field">
            วันจอง
            <input
              v-model="bookingEditDate"
              type="date"
              class="admin-input"
              :disabled="bookingEditLoading"
              @change="onBookingEditDateChange"
            />
          </label>

          <p v-if="bookingEditOriginalSlotKey && !isBookingRestoreMode" class="muted booking-edit-current-hour">
            เวลาปัจจุบัน: {{ bookingEditCurrentHourLabel }}
          </p>

          <p
            v-if="bookingEditSelectedIds.length && (bookingEditSelectedTotalMinutes > 0 || extendBookingByServices)"
            class="booking-edit-duration-summary"
          >
            <span v-if="bookingEditSelectedTotalMinutes > 0">
              รวมเวลาบริการ {{ bookingEditServiceDurationLabel }}
            </span>
            <span v-if="extendBookingByServices && bookingEditPredictedEndLabel">
              <template v-if="bookingEditSelectedTotalMinutes > 0"> · </template>
              คาดว่าจบ {{ bookingEditPredictedEndLabel }}
            </span>
          </p>

          <label class="booking-edit-field">
            {{ isBookingRestoreMode ? 'เวลาคิวที่คืนสถานะ' : 'ย้ายไปเวลา' }}
            <select
              v-model="bookingEditMoveToSlotKey"
              class="admin-input"
              :class="{ 'booking-restore-slot': isBookingRestoreMode }"
              :disabled="bookingEditLoading"
              @change="bookingEditError = ''"
            >
              <option value="">{{ isBookingRestoreMode ? '— เลือกเวลาว่าง —' : '— คงเวลาเดิม —' }}</option>
              <option v-if="!bookingEditHourOptions.length" value="" disabled>
                {{ isBookingRestoreMode ? 'วันนี้ไม่มีช่วงว่าง' : 'ไม่มีช่วงว่างอื่น' }}
              </option>
              <option v-for="opt in bookingEditHourOptions" :key="opt.key" :value="opt.key">
                {{ opt.label }}
              </option>
            </select>
          </label>

          <template v-if="!isBookingRestoreMode">
          <label class="booking-edit-field">
            ค้นหาลูกค้า
            <input
              v-model="bookingEditUserQuery"
              type="search"
              class="admin-input"
              placeholder="ชื่อ / อีเมล"
              @input="bookingEditError = ''"
            />
          </label>

          <label class="booking-edit-field">
            ลูกค้า
            <select v-model="bookingEditUserId" class="admin-input" @change="bookingEditError = ''">
              <option value="">-- เลือกลูกค้า --</option>
              <option v-for="u in bookingEditUsers" :key="u.id" :value="u.id">
                {{ u.name }} ({{ u.email }})
              </option>
            </select>
          </label>

          <label class="booking-edit-field">
            ยอดเงิน (บาท)
            <input
              v-model="bookingEditTotal"
              type="number"
              min="0"
              step="1"
              class="admin-input"
              @input="bookingEditError = ''"
            />
          </label>

          <div class="booking-edit-services">
            <p class="booking-edit-label">บริการ</p>
            <p class="muted booking-edit-hint">เลือกหมวดหมู่ก่อน แล้วเลือกบริการ · แสดงเฉพาะวันจองนี้</p>
            <p v-if="bookingEditLoading" class="muted">กำลังโหลดรายการบริการ...</p>
            <template v-else>
              <p v-if="bookingEditOrphaned.length" class="booking-edit-orphaned">
                บริการเดิมที่ถูกลบแล้ว (จะถูกเอาออกเมื่อบันทึก):
                {{ bookingEditOrphaned.map((o) => o.option_name).join(', ') }}
              </p>

              <div v-if="bookingEditRequiredOptions.length" class="booking-edit-option-list booking-edit-required-list">
                <p class="booking-edit-sub-label">บริการบังคับ</p>
                <label
                  v-for="opt in bookingEditRequiredOptions"
                  :key="`edit-req-${opt.id}`"
                  class="booking-edit-option required selected"
                >
                  <input
                    v-model="bookingEditSelectedIds"
                    type="checkbox"
                    class="booking-edit-option-input"
                    :value="String(opt.id)"
                    disabled
                  />
                  <span class="booking-edit-option-name">
                    {{ opt.option_name }}
                    <span v-if="formatBookingOptionDuration(opt)" class="booking-edit-option-duration">
                      {{ formatBookingOptionDuration(opt) }}
                    </span>
                    <span class="booking-edit-required">บังคับ</span>
                  </span>
                  <span v-if="opt.description" class="booking-edit-option-desc">{{ opt.description }}</span>
                </label>
              </div>

              <div v-if="bookingEditBookableCategories.length > 1" class="admin-booking-category-row">
                <button
                  v-for="cat in bookingEditBookableCategories"
                  :key="`edit-cat-${cat.id}`"
                  type="button"
                  class="admin-booking-category-btn"
                  :class="{ active: bookingEditSelectedCategoryId === cat.id }"
                  @click="bookingEditSelectedCategoryId = cat.id; bookingEditError = ''"
                >
                  {{ cat.name }}
                  <span class="admin-booking-category-count">({{ cat.count }})</span>
                </button>
              </div>
              <p v-else-if="bookingEditBookableCategories.length === 1" class="muted booking-edit-sub-label">
                หมวด {{ bookingEditBookableCategories[0].name }}
              </p>

              <div v-if="bookingEditCategoryOptions.length" class="booking-edit-option-list">
                <label
                  v-for="opt in bookingEditCategoryOptions"
                  :key="opt.id"
                  class="booking-edit-option"
                  :class="{ selected: bookingEditSelectedIds.includes(String(opt.id)) }"
                >
                  <input
                    v-model="bookingEditSelectedIds"
                    type="checkbox"
                    class="booking-edit-option-input"
                    :value="String(opt.id)"
                    @change="bookingEditError = ''"
                  />
                  <span class="booking-edit-option-name">
                    {{ opt.option_name }}
                    <span v-if="formatBookingOptionDuration(opt)" class="booking-edit-option-duration">
                      {{ formatBookingOptionDuration(opt) }}
                    </span>
                  </span>
                  <span v-if="opt.description" class="booking-edit-option-desc">{{ opt.description }}</span>
                </label>
              </div>
              <p v-else-if="!bookingEditRequiredOptions.length" class="muted">ไม่มีบริการให้เลือกในวันนี้</p>
            </template>
          </div>
          </template>

          <p v-if="bookingEditError" class="alert error">{{ bookingEditError }}</p>

          <div class="booking-edit-actions">
            <button type="button" class="btn" :disabled="bookingEditSaving" @click="closeBookingEdit">
              ยกเลิก
            </button>
            <button
              type="button"
              class="btn primary"
              :disabled="bookingEditSaving || bookingEditLoading || (isBookingRestoreMode && !bookingEditMoveToSlotKey)"
              @click="saveBookingEdit"
            >
              {{
                bookingEditSaving
                  ? (isBookingRestoreMode ? 'กำลังคืนสถานะ...' : 'กำลังบันทึก...')
                  : (isBookingRestoreMode ? 'คืนสถานะจอง' : 'บันทึก')
              }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="dayHourEditingId"
        class="booking-edit-backdrop"
        @click.self="closeDayHourForm"
      >
        <div id="admin-day-hour-edit-modal" class="booking-edit-modal card" role="dialog" aria-labelledby="day-hour-edit-title">
          <div class="booking-edit-header">
            <h3 id="day-hour-edit-title">แก้ไขช่วงเวลา</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="closeDayHourForm">×</button>
          </div>
          <p v-if="selectedDayHoursDate" class="muted booking-edit-meta">
            วันที่ {{ formatServiceDateLabel(selectedDayHoursDate) }}
          </p>
          <p class="muted booking-edit-meta">
            ถ้าขยายเวลาสิ้นสุด ช่วงถัดไปที่ต่อกันจะเลื่อนเวลาเริ่มให้อัตโนมัติ
          </p>
          <div class="admin-form-grid admin-option-grid">
            <label>
              เริ่ม (ชม.)
              <select v-model.number="dayHourStartH" class="admin-input">
                <option v-for="h in dayHourAvailableStartHours" :key="`esh-${h}`" :value="h">
                  {{ String(h).padStart(2, '0') }}
                </option>
              </select>
            </label>
            <label>
              เริ่ม (นาที)
              <select v-model.number="dayHourStartM" class="admin-input">
                <option v-for="m in dayHourAvailableStartMinutes" :key="`esm-${m}`" :value="m">
                  {{ String(m).padStart(2, '0') }}
                </option>
              </select>
            </label>
            <label>
              สิ้นสุด (ชม.)
              <select v-model.number="dayHourEndH" class="admin-input">
                <option v-for="h in dayHourEndHourOptions" :key="`eeh-${h}`" :value="h">
                  {{ String(h).padStart(2, '0') }}
                </option>
              </select>
            </label>
            <label>
              สิ้นสุด (นาที)
              <select v-model.number="dayHourEndM" class="admin-input">
                <option v-for="m in dayHourEndMinuteOptions" :key="`eem-${m}`" :value="m">
                  {{ String(m).padStart(2, '0') }}
                </option>
              </select>
            </label>
          </div>
          <div class="booking-edit-actions">
            <button type="button" class="btn" :disabled="dayHourSaving" @click="closeDayHourForm">
              ยกเลิก
            </button>
            <button type="button" class="btn primary" :disabled="dayHourSaving" @click="saveDayHourEntry">
              {{ dayHourSaving ? 'กำลังบันทึก...' : 'บันทึก' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="categoryForm.id"
        class="booking-edit-backdrop"
        @click.self="resetCategoryForm"
      >
        <div id="admin-category-edit-modal" class="booking-edit-modal card" role="dialog" aria-labelledby="category-edit-title">
          <div class="booking-edit-header">
            <h3 id="category-edit-title">แก้ไขหมวดหมู่</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="resetCategoryForm">×</button>
          </div>
          <div class="admin-form-grid admin-option-grid">
            <label>
              ชื่อหมวดหมู่ *
              <input v-model="categoryForm.name" type="text" class="admin-input" placeholder="เช่น มือ, เท้า, ต่อเล็บ" />
            </label>
            <label>
              รายละเอียด
              <input v-model="categoryForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
            </label>
            <label>
              ลำดับแสดง
              <input v-model.number="categoryForm.sort_order" type="number" min="0" step="1" class="admin-input" />
            </label>
          </div>
          <AdminSwitch v-model="categoryForm.is_active" label="เปิดใช้งาน" />
          <div class="booking-edit-actions">
            <button type="button" class="btn" @click="resetCategoryForm">ยกเลิก</button>
            <button type="button" class="btn primary" @click="saveServiceCategory">บันทึก</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="optionForm.id"
        class="booking-edit-backdrop"
        @click.self="resetOptionForm"
      >
        <div id="admin-option-edit-modal" class="booking-edit-modal admin-edit-modal-wide card" role="dialog" aria-labelledby="option-edit-title">
          <div class="booking-edit-header">
            <h3 id="option-edit-title">แก้ไขบริการ</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="resetOptionForm">×</button>
          </div>
          <p v-if="optionEditScopeLabel" class="muted booking-edit-meta">{{ optionEditScopeLabel }}</p>
          <div class="admin-form-grid admin-option-grid">
            <label>
              ชื่อบริการ *
              <input v-model="optionForm.option_name" type="text" class="admin-input" placeholder="เช่น ทาสีเจลมือ" />
            </label>
            <label>
              รายละเอียด
              <input v-model="optionForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
            </label>
            <label>
              หมวดหมู่
              <select v-model="optionForm.category_id" class="admin-input">
                <option value="">— ไม่ระบุ —</option>
                <option v-for="cat in activeServiceCategories" :key="`edit-cat-${cat.id}`" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </label>
            <label>
              ราคา (บาท)
              <input v-model.number="optionForm.price" type="number" min="0" step="1" class="admin-input" />
            </label>
            <label>
              ระยะเวลา (นาที)
              <input v-model.number="optionForm.duration_min" type="number" min="0" step="1" class="admin-input" />
            </label>
            <label class="admin-color-field admin-color-field-full">
              <span class="admin-color-label-row">
                สีแสดงในปฏิทิน
                <AdminSwitch compact v-model="optionFormUseColor" label="ใช้สี" />
              </span>
              <template v-if="optionFormUseColor">
                <div class="color-picker-row">
                  <input v-model="optionForm.color" type="color" class="admin-color-input" />
                  <input v-model="optionForm.color" type="text" class="admin-input" maxlength="7" placeholder="#C4847A" />
                </div>
                <div class="color-preset-row">
                  <button
                    v-for="preset in optionColorPresets"
                    :key="`edit-opt-${preset.value}`"
                    type="button"
                    class="color-preset-btn"
                    :class="{ active: optionForm.color === preset.value }"
                    :style="{ background: preset.value }"
                    :title="preset.label"
                    :aria-label="preset.label"
                    @click="setOptionColor(preset.value)"
                  ></button>
                </div>
              </template>
              <p v-else class="muted admin-color-hint">ไม่ใช้สี — วันในปฏิทินจะไม่เปลี่ยนจากบริการนี้</p>
            </label>
          </div>
          <div class="admin-form-row" style="margin-bottom:16px">
            <AdminSwitch v-model="optionForm.is_active" label="แสดงให้ลูกค้าเลือกจอง" />
            <AdminSwitch v-model="optionForm.is_required" label="บังคับเลือกเมื่อจอง" />
          </div>
          <div class="booking-edit-actions">
            <button type="button" class="btn" @click="resetOptionForm">ยกเลิก</button>
            <button type="button" class="btn primary" @click="saveNailOption">บันทึก</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="locationForm.id"
        class="booking-edit-backdrop"
        @click.self="resetLocationForm"
      >
        <div id="admin-location-edit-modal" class="booking-edit-modal card" role="dialog" aria-labelledby="location-edit-title">
          <div class="booking-edit-header">
            <h3 id="location-edit-title">แก้ไขสถานที่</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="resetLocationForm">×</button>
          </div>
          <div class="admin-form-grid admin-option-grid">
            <label>
              ชื่อสถานที่ *
              <input v-model="locationForm.name" type="text" class="admin-input" placeholder="เช่น จุฬา, เกษตร" />
            </label>
            <label>
              รายละเอียด
              <input v-model="locationForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
            </label>
            <label>
              ลำดับแสดง
              <input v-model.number="locationForm.sort_order" type="number" min="0" step="1" class="admin-input" />
            </label>
            <label>
            ลิงก์แผนที่
            <input v-model="locationForm.map_url" type="url" class="admin-input" placeholder="https://maps.google.com/..." />
          </label>
          <label class="admin-color-field">
              สีในปฏิทิน
              <div class="color-picker-row">
                <input v-model="locationForm.color" type="color" class="admin-color-input" />
                <input v-model="locationForm.color" type="text" class="admin-input" maxlength="7" placeholder="#C4847A" />
              </div>
              <div class="color-preset-row">
                <button
                  v-for="preset in optionColorPresets"
                  :key="`edit-loc-${preset.value}`"
                  type="button"
                  class="color-preset-btn"
                  :class="{ active: locationForm.color === preset.value }"
                  :style="{ background: preset.value }"
                  :title="preset.label"
                  :aria-label="preset.label"
                  @click="setLocationColor(preset.value)"
                ></button>
              </div>
            </label>
          </div>
          <AdminSwitch v-model="locationForm.is_active" label="แสดงเป็นปุ่มลัด" />
          <div class="booking-edit-actions">
            <button type="button" class="btn" @click="resetLocationForm">ยกเลิก</button>
            <button type="button" class="btn primary" @click="saveServiceLocation">บันทึก</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="clipForm.id"
        class="booking-edit-backdrop"
        @click.self="resetClipForm"
      >
        <div id="admin-clip-edit-modal" class="booking-edit-modal card" role="dialog" aria-labelledby="clip-edit-title">
          <div class="booking-edit-header">
            <h3 id="clip-edit-title">แก้ไขคลิป</h3>
            <button type="button" class="booking-edit-close" aria-label="ปิด" @click="resetClipForm">×</button>
          </div>
          <label class="booking-edit-field">
            ลิงก์ TikTok / Instagram
            <input
              v-model="clipForm.tiktok_url"
              type="url"
              class="admin-input"
              placeholder="https://www.tiktok.com/... หรือ https://www.instagram.com/p/..."
            />
          </label>
          <label class="booking-edit-field">
            ชื่อแสดง (ไม่บังคับ)
            <input
              v-model="clipForm.title"
              type="text"
              class="admin-input"
              placeholder="เช่น เจล french"
            />
          </label>
          <label class="booking-edit-field">
            แสดง
            <select v-model="clipForm.is_active" class="admin-input">
              <option :value="true">เปิด</option>
              <option :value="false">ปิด</option>
            </select>
          </label>
          <div class="booking-edit-actions">
            <button type="button" class="btn" @click="resetClipForm">ยกเลิก</button>
            <button type="button" class="btn primary" @click="saveShowcaseClip">บันทึก</button>
          </div>
        </div>
      </div>
    </Teleport>

  </main>
</template>

<style scoped>
.admin-page {
  width: 100%;
  max-width: none;
  min-width: 0;
  margin: 0;
  padding: var(--page-padding-x);
  padding-bottom: max(var(--space-4), var(--bottom-nav-safe));
  background: var(--color-background);
  box-sizing: border-box;
}

.admin-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0 var(--space-3);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-3);
  min-width: 0;
  flex-wrap: wrap;
}

.admin-brand-wrap {
  min-width: 0;
  flex: 1 1 0;
}

.admin-sub {
  margin: 2px 0 0;
  font-size: var(--text-caption);
}

.admin-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: var(--btn-secondary-height);
}

.admin-top-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.admin-share-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--btn-secondary-height);
  color: var(--color-primary-dark);
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  background: var(--color-primary-light);
}

.admin-share-btn:hover {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-light) 80%, var(--color-primary) 20%);
}

@media (max-width: 640px) {
  .admin-top-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .admin-brand-wrap {
    flex: 1 1 auto;
  }

  .admin-top-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

.admin-tab-wrap {
  position: relative;
  margin-bottom: 12px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.admin-tab-wrap::before,
.admin-tab-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  z-index: 2;
  pointer-events: none;
}

.admin-tab-wrap::before {
  left: 0;
  background: linear-gradient(to right, var(--color-surface), transparent);
}

.admin-tab-wrap::after {
  right: 0;
  background: linear-gradient(to left, var(--color-surface), transparent);
}

.admin-nav {
  display: flex;
  gap: 8px;
  padding: 4px 0 10px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.admin-nav::-webkit-scrollbar {
  display: none;
}

.admin-nav-item {
  flex: 0 0 auto;
  min-width: unset;
  flex-direction: row;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}

.admin-nav-item i {
  font-size: 18px;
}

.admin-nav-item:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-secondary);
  background: var(--color-surface-elevated);
}

.admin-nav-item:active {
  transform: scale(0.98);
}

.admin-nav-item.active {
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.admin-users-count {
  margin: 0 0 10px;
}

.admin-users-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.admin-users-sentinel {
  width: 100%;
  height: 1px;
}

.admin-users-loading,
.admin-users-load-hint {
  margin: 12px 0 0;
  text-align: center;
}

.admin-push-reminder {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  width: 100%;
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: none;
  font-size: var(--text-caption);
  line-height: 1.4;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: filter var(--transition), transform var(--transition);
}

.admin-push-reminder i {
  flex-shrink: 0;
  margin-right: 1px;
  font-size: 12px;
}

.admin-push-reminder-link {
  flex-shrink: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 700;
}

.admin-push-reminder:active {
  transform: scale(0.99);
}

.admin-renewal-reminder {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  margin: 0 0 var(--space-3);
  padding: 8px 12px;
  border: none;
  font-size: var(--text-caption);
  line-height: 1.45;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: filter var(--transition), transform var(--transition);
}

.admin-renewal-reminder i {
  flex-shrink: 0;
  font-size: 14px;
}

.admin-renewal-reminder-link {
  flex-shrink: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 700;
}

.admin-renewal-reminder:active {
  transform: scale(0.99);
}

.alert-banner {
  margin: 0 0 var(--space-3);
}

.admin-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-5) 0;
}

.admin-section {
  padding: 0;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.admin-section-head {
  margin: 0 0 var(--space-4);
}

.admin-section-head h3 {
  margin: 0 0 var(--space-1);
  font-size: var(--text-h3);
  font-weight: 600;
  color: var(--color-text-primary);
}

.admin-section-head .muted {
  margin: 0;
  font-size: var(--text-caption);
}

.admin-form-row {
  display: flex;
  gap: 12px;
  align-items: end;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.admin-form-row > .admin-switch {
  flex: 1 1 180px;
  align-self: center;
}

.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.admin-filter-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 10px;
}

.booking-view-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.view-toggle-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  min-height: var(--touch-min);
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}

.view-toggle-btn i { font-size: 16px; }

.view-toggle-btn:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.view-toggle-btn.active {
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.view-toggle-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

.view-toggle-btn:disabled:hover {
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.view-toggle-btn.active:disabled:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-primary-dark);
}

.admin-filter-item {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
}

.admin-label-grow {
  flex: 1;
  min-width: 0;
}

.admin-input {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin-top: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: var(--text-body);
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
}

.register-pin-admin-input {
  max-width: 160px;
  letter-spacing: 0.35em;
  font-weight: 700;
  text-align: center;
}

.admin-action-btn {
  min-width: 120px;
  font-weight: 600;
}

.admin-option-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.bulk-block-box {
  margin: 12px 0 16px;
  padding: 14px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}

.bulk-block-box h4,
.admin-subtitle {
  margin: 0 0 8px;
  font-size: 15px;
}

.admin-extra-title {
  margin-top: 1.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-soft, rgba(196, 132, 122, 0.15));
}

.admin-extra-hint {
  margin: 0.35rem 0 0.75rem;
  font-size: 0.85rem;
}

.admin-extra-item strong {
  color: var(--color-primary);
}

.bulk-preview {
  margin: 8px 0 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary-dark);
  font-size: var(--text-body);
  font-weight: 600;
}

.showcase-clip-form {
  margin-top: 12px;
}

.showcase-clip-info {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.showcase-clip-preview {
  width: 54px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--color-text-primary);
}

.showcase-clip-preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 4px;
}

.admin-bulk-settings {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 10px;
}

.bulk-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.admin-bulk-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-blocks-section label {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.admin-blocks-section .admin-form-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr));
}

.admin-blocks-section .admin-bulk-settings {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 6.5rem), 1fr));
}

.admin-blocks-section .admin-bulk-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
}

.admin-blocks-section .bulk-block-box {
  overflow: hidden;
}

.admin-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.badge-active,
.badge-inactive {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
}

.badge-active {
  background: color-mix(in srgb, var(--color-success) 16%, transparent);
  color: var(--color-success);
}

.badge-inactive {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
}

.badge-required {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.badge-location {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  background: color-mix(in srgb, var(--color-info) 16%, transparent);
  color: var(--color-info);
}

.badge-category {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.service-category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.service-category-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-size: 13px;
  font-weight: 600;
}

.service-category-chip.inactive {
  opacity: 0.55;
}

.badge-no-color {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.admin-color-field-full {
  grid-column: 1 / -1;
}

.admin-color-label-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.admin-color-label-row > .admin-switch {
  flex: 0 0 auto;
  min-height: 32px;
}

.admin-checkbox-inline {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.admin-color-hint {
  margin: 6px 0 0;
  font-size: 12px;
}

.service-location-add {
  margin-bottom: 14px;
}

.service-location-add h4 {
  margin: 0 0 4px;
  font-size: 15px;
}

.location-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.location-preset-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 16px;
  font-weight: 600;
}

.location-preset-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.location-preset-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, .12);
  flex-shrink: 0;
}

.location-preset-added {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.badge-everyday {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: 600;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.service-cal-header h3 {
  margin: 0 0 4px;
}

.service-cal-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 16px 0 12px;
}

.service-cal-nav-btn {
  width: var(--touch-min);
  height: var(--touch-min);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.service-cal-month {
  min-width: 160px;
  text-align: center;
  font-size: var(--text-h3);
  font-weight: 700;
  color: var(--color-text-primary);
}

.service-cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 4px;
  max-width: 100%;
}

.service-cal-wd {
  text-align: center;
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 4px 0;
}

.service-cal-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
}

.service-cal-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  max-width: 100%;
}

.service-cal-day {
  position: relative;
  min-height: 52px;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 6px 2px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition), background var(--transition);
  overflow: hidden;
}

.service-cal-day:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.service-cal-day:not(.empty):hover {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  background: var(--color-primary-light);
}

.service-cal-day.empty {
  border: none;
  background: transparent;
  cursor: default;
  min-height: 0;
}

.service-cal-day.today {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.service-cal-day.has-options {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-elevated));
}

.booking-cal-day,
.block-cal-day {
  min-height: 58px;
}

.block-cal-day.has-block {
  background: var(--color-surface-muted);
}

.block-cal-marker {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
}

.block-cal-marker.full {
  color: var(--color-error);
}

.block-cal-marker.partial {
  color: var(--color-warning);
}

.block-cal-marker.inline {
  display: inline-block;
  margin-top: 0;
  margin-right: 4px;
  vertical-align: middle;
}

.block-cal-legend {
  margin-top: 14px;
}

.day-hours-cal-day {
  position: relative;
}

.day-hours-cal-day.has-hours {
  background: var(--color-primary-light);
}

.day-hours-cal-badge {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.day-hour-form {
  margin-top: 14px;
}

.day-hour-add-btn {
  margin-top: 14px;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.day-hour-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.day-hour-actions .day-hour-add-btn {
  margin-top: 0;
}

.day-hour-add-btn-secondary {
  background: var(--color-surface);
  color: var(--color-primary-dark);
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.day-hour-full-note {
  margin-top: 12px;
}

.block-day-color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  vertical-align: middle;
  margin-left: 4px;
  border: 1px solid rgba(0, 0, 0, .12);
}

.booking-cal-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  flex-wrap: wrap;
}

.booking-stat-paid { color: var(--color-success); }
.booking-stat-sep { color: var(--color-text-muted); }
.booking-stat-unpaid { color: var(--color-primary); }

.booking-stat-cancelled {
  margin-left: 4px;
  color: var(--color-text-secondary);
  font-weight: 800;
}

.booking-cal-alert {
  position: absolute;
  top: 4px;
  right: 5px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--color-warning);
  color: var(--color-surface-elevated);
  font-size: 11px;
  font-weight: 800;
  line-height: 16px;
  text-align: center;
}

.booking-cal-alert.inline {
  position: static;
  display: inline-block;
  vertical-align: middle;
}

.booking-cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.legend-paid,
.legend-unpaid,
.legend-cancelled {
  display: inline-block;
  min-width: 18px;
  text-align: center;
  font-weight: 700;
  margin-right: 4px;
}

.legend-paid { color: var(--color-success); }
.legend-unpaid { color: var(--color-primary); }
.legend-cancelled { color: var(--color-text-secondary); }

.service-cal-day.has-bookings {
  background: var(--color-surface-muted);
}

.revenue-cal-day {
  cursor: default;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow: hidden;
}

.revenue-cal-day.has-revenue {
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface-elevated));
}

.revenue-cal-day .service-cal-num {
  font-size: 12px;
  line-height: 1.1;
}

.revenue-cal-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1px;
  margin-top: auto;
  padding-top: 2px;
  min-width: 0;
}

.revenue-cal-deposit {
  font-size: 9px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-warning);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.revenue-cal-total {
  font-size: 9px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-success);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.revenue-cal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
}

.revenue-cal-count {
  font-size: 9px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.revenue-cal-cancelled {
  color: var(--color-error);
  font-weight: 800;
}

.revenue-cal-amount {
  flex: 1;
  min-width: 0;
  color: var(--color-success);
  word-break: break-word;
}

.revenue-month-summary {
  margin-top: 20px;
}

.revenue-summary-grid {
  display: flex;
  gap: 8px;
  align-items: stretch;
  width: 100%;
  min-width: 0;
}

.revenue-summary-slot {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  text-align: center;
}

.revenue-summary-slot-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.revenue-summary-slot-head i {
  font-size: 18px;
  color: var(--color-text-muted);
}

.revenue-summary-slot--deposit {
  border-color: color-mix(in srgb, var(--color-deposit) 42%, var(--color-border));
  background: color-mix(in srgb, var(--color-deposit) 10%, var(--color-surface-muted));
}

.revenue-summary-slot--deposit .revenue-summary-slot-head i,
.revenue-summary-slot--deposit .revenue-summary-label {
  color: var(--color-deposit);
}

.revenue-summary-slot--total {
  border-color: color-mix(in srgb, var(--color-revenue) 42%, var(--color-border));
  background: color-mix(in srgb, var(--color-revenue) 10%, var(--color-surface-muted));
}

.revenue-summary-slot--total .revenue-summary-slot-head i,
.revenue-summary-slot--total .revenue-summary-label {
  color: var(--color-revenue);
}

.revenue-summary-slot--compare {
  border-color: var(--color-border);
  background: var(--color-surface-muted);
}

.revenue-summary-slot--compare .revenue-summary-slot-head i,
.revenue-summary-slot--compare .revenue-summary-label {
  color: var(--color-text-muted);
}

.revenue-compare-ref {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

.revenue-compare-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 2px;
}

.revenue-compare-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.revenue-compare-metric {
  font-size: 11px;
  color: var(--color-text-muted);
}

.revenue-compare-row .revenue-change {
  font-size: 15px;
  font-weight: 700;
}

.revenue-summary-deposit {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-deposit);
  line-height: 1.2;
}

.revenue-summary-sub {
  font-size: 11px;
  line-height: 1.35;
}

.revenue-change {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.revenue-change i {
  font-size: 14px;
}

.revenue-change--up {
  color: var(--color-success);
}

.revenue-change--down {
  color: var(--color-error);
}

.revenue-change--flat {
  color: var(--color-text-muted);
}

@media (max-width: 520px) {
  .admin-page {
    padding: 12px;
  }

  .admin-section {
    padding: 0;
  }

  .admin-nav-item {
    min-width: unset;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-caption);
  }

  .admin-nav-item i {
    font-size: 15px;
  }

  .admin-form-grid {
    grid-template-columns: 1fr;
  }

  .admin-filter-row {
    grid-template-columns: 1fr;
  }

  .service-cal-weekdays,
  .service-cal-week {
    gap: 2px;
  }

  .service-cal-wd {
    font-size: 10px;
    padding: 2px 0;
  }

  .service-cal-day {
    min-height: 48px;
    padding: 3px 1px;
    border-radius: 8px;
  }

  .booking-cal-day,
  .block-cal-day {
    min-height: 52px;
  }

  .service-cal-num {
    font-size: 11px;
  }

  .booking-cal-stats {
    font-size: 8px;
    gap: 1px;
  }

  .block-cal-marker {
    font-size: 11px;
  }

  .booking-cal-alert {
    width: 14px;
    height: 14px;
    font-size: 9px;
    line-height: 14px;
  }

  .revenue-section .service-cal-weekdays,
  .revenue-section .service-cal-week {
    gap: 2px;
  }

  .revenue-section .service-cal-wd {
    font-size: 10px;
    padding: 2px 0;
  }

  .revenue-section .service-cal-day {
    min-height: 58px;
    padding: 3px 2px;
    border-radius: 8px;
  }

  .revenue-section .revenue-cal-day {
    min-height: 58px;
  }

  .revenue-section .revenue-cal-deposit,
  .revenue-section .revenue-cal-total,
  .revenue-section .revenue-cal-count {
    font-size: 8px;
  }

  .revenue-section .service-cal-num {
    font-size: 11px;
  }

  .revenue-summary-deposit,
  .revenue-summary-total {
    font-size: 20px;
  }
}

@media (max-width: 520px) {
  .revenue-summary-grid {
    flex-wrap: wrap;
  }

  .revenue-summary-slot--deposit,
  .revenue-summary-slot--total {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
    padding: var(--space-2);
  }

  .revenue-summary-slot--compare {
    flex: 1 1 100%;
  }

  .revenue-summary-deposit,
  .revenue-summary-total {
    font-size: 18px;
  }

  .revenue-summary-label {
    font-size: 11px;
    line-height: 1.25;
  }

  .revenue-summary-sub {
    font-size: 10px;
  }

  .revenue-compare-rows {
    flex-direction: row;
    justify-content: center;
    gap: 20px;
  }

  .revenue-compare-row {
    flex: 0 1 auto;
  }
}

.revenue-summary-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
}

.revenue-summary-label {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--color-text-muted);
}

.revenue-summary-total {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-revenue);
  line-height: 1.2;
}

.revenue-summary-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-top: 10px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.revenue-stat-item strong {
  font-weight: 800;
  color: var(--color-text-primary);
}

.revenue-stat-cancelled strong {
  color: var(--color-error);
}

.revenue-stat-done strong {
  color: var(--color-success);
}

.revenue-stat-sep {
  color: var(--color-text-muted);
}

.service-cal-num {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.service-cal-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-top: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: 700;
}

.service-everyday-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.service-everyday-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.service-everyday-head h4 {
  margin: 0;
  font-size: 15px;
}

.service-day-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.booking-add-btn {
  margin-left: auto;
  flex-shrink: 0;
}

.service-day-header > div {
  flex: 1 1 160px;
  min-width: 0;
}

.admin-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  box-shadow: var(--shadow-card);
  margin-top: var(--space-3);
}

.admin-item-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 4px;
}

.admin-item > div:first-child,
.admin-item-body {
  min-width: 0;
}

.admin-item .row {
  flex-wrap: wrap;
  width: 100%;
  gap: 8px;
}

.admin-item .row .btn {
  flex: 1 1 calc(50% - 4px);
  min-width: 0;
  font-size: 12px;
  padding: 10px 8px;
  line-height: 1.35;
  white-space: normal;
  text-align: center;
}

.service-day-header h3 {
  margin: 0 0 4px;
}

.service-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.service-option-form {
  margin-bottom: 20px;
}

.card-inner {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.card-inner h4 {
  margin: 0 0 12px;
  font-size: 15px;
}

.admin-color-field {
  grid-column: 1 / -1;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.admin-color-input {
  width: 44px;
  height: 40px;
  padding: 2px;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  background: var(--color-surface-elevated);
  cursor: pointer;
}

.color-preset-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.color-preset-btn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.color-preset-btn.active {
  border-color: var(--color-text-primary);
  box-shadow: 0 0 0 2px var(--color-surface-elevated), 0 0 0 4px var(--color-text-primary);
}

.option-color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-left: 8px;
  border-radius: 999px;
  vertical-align: middle;
  border: 1px solid rgba(15, 23, 42, .12);
}

.shop-hours-preview {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-primary);
  max-width: 100%;
  flex-wrap: wrap;
}

.user-item {
  align-items: flex-start;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.user-badge-provider {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  vertical-align: middle;
}

.user-badge-admin {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
  vertical-align: middle;
}

.user-admin-note {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.user-edit-note {
  resize: vertical;
  min-height: 96px;
  font-family: inherit;
}

.user-edit-readonly-stats {
  line-height: 1.5;
}

.user-edit-readonly-hint {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.user-history-modal {
  width: min(100%, 520px);
}

.user-history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: min(60vh, 480px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  margin-top: 4px;
}

.user-history-item {
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-muted);
}

.user-history-item-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.user-history-time {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.user-history-status {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 99px;
}

.user-history-status--awaiting {
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
}

.user-history-status--pending {
  background: color-mix(in srgb, var(--color-info) 18%, transparent);
  color: var(--color-info);
}

.user-history-status--done {
  background: color-mix(in srgb, var(--color-success) 16%, transparent);
  color: var(--color-success);
}

.user-history-status--cancelled {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.user-history-services {
  margin: 6px 0 0;
  font-size: 13px;
}

.user-history-meta {
  margin: 4px 0 0;
  font-size: 12px;
}

.user-history-empty {
  margin: 12px 0 0;
  text-align: center;
}

.user-history-error {
  margin: 12px 0 0;
  color: var(--color-error);
  font-size: 13px;
}

.user-item .btn.primary {
  white-space: nowrap;
}

.service-order-btn {
  min-width: 36px;
  padding: 6px 8px;
}

.service-order-btn i {
  font-size: 16px;
  line-height: 1;
}

.user-edit-admin-check {
  margin-bottom: 14px;
}

@media (max-width: 820px) {
  .user-item .row {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .user-item .row .btn {
    width: 100%;
  }

  .service-day-header {
    flex-direction: column;
    align-items: stretch;
  }

  .booking-add-btn {
    margin-left: 0;
    width: 100%;
  }

  .admin-nav-item {
    min-width: unset;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-caption);
  }

  .admin-nav-item i {
    font-size: 16px;
  }

  .admin-filter-row {
    grid-template-columns: 1fr;
  }

  .admin-option-grid {
    grid-template-columns: 1fr;
  }

  .admin-bulk-grid,
  .admin-bulk-settings {
    grid-template-columns: 1fr;
  }

  .admin-blocks-section .admin-form-grid,
  .admin-blocks-section .admin-bulk-settings,
  .admin-blocks-section .admin-bulk-grid {
    grid-template-columns: 1fr;
  }

  .admin-blocks-section .bulk-preset-row .btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
  }

  .admin-blocks-section .bulk-preset-row .admin-action-btn {
    flex: 1 1 100%;
  }

  .bulk-preset-row .btn {
    flex: 1 1 calc(50% - 8px);
  }

  .admin-form-row {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-filter-row {
    grid-template-columns: 1fr;
  }

  .admin-action-btn {
    width: 100%;
  }
}

@media (min-width: 600px) {
  .admin-page {
    padding: 20px 24px 28px;
  }

  .admin-top-bar {
    padding: 16px 0 18px;
  }

  .admin-form-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .admin-option-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-filter-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-item {
    gap: 16px;
  }
}

@media (min-width: 768px) {
  .admin-item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .admin-item .row {
    width: auto;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }

  .admin-item .row .btn {
    flex: 0 1 auto;
    font-size: 14px;
    padding: 8px 12px;
    white-space: nowrap;
  }

  .service-day-header {
    flex-wrap: nowrap;
  }

  .booking-add-btn {
    width: auto;
    margin-left: auto;
  }

  .admin-page {
    padding: 24px 28px 32px;
  }

  .admin-tab-wrap::before,
  .admin-tab-wrap::after {
    display: none;
  }

  .admin-nav {
    flex-wrap: wrap;
    overflow-x: visible;
    gap: 10px;
  }

  .admin-nav-item {
    flex: 1 1 calc(25% - 10px);
    min-width: 120px;
    flex-direction: row;
    justify-content: center;
    padding: 12px 14px;
    font-size: 13px;
  }

  .admin-nav-item i {
    font-size: 17px;
  }

  .admin-section {
    padding: 22px 24px;
  }

  .admin-form-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .admin-option-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .admin-bulk-settings {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .admin-bulk-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .service-cal-day {
    min-height: 60px;
  }

  .booking-cal-day,
  .block-cal-day {
    min-height: 64px;
  }

  .revenue-cal-day {
    min-height: 80px;
  }
}

@media (min-width: 1024px) {
  .admin-page {
    padding: 28px 32px 40px;
  }

  .admin-nav-item {
    flex: 1 1 calc(14.28% - 10px);
    min-width: 0;
  }

  .admin-form-row {
    flex-wrap: wrap;
  }

  .admin-action-btn {
    width: auto;
    min-width: 140px;
  }

}

.booking-edit-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-admin-modal, 2000);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.booking-edit-modal {
  width: min(100%, 480px);
  max-height: min(90vh, 720px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px;
  margin: 0;
  position: relative;
  z-index: 1;
}

.admin-edit-modal-wide {
  width: min(100%, 560px);
}

.booking-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.booking-edit-header h3 {
  margin: 0;
}

.booking-edit-close {
  padding: 6px 10px;
  min-width: 0;
}

.booking-edit-meta {
  margin: 0 0 16px;
}

.booking-edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.booking-edit-services {
  margin-bottom: 16px;
}

.booking-edit-label {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.booking-edit-hint {
  margin: 0 0 10px;
  font-size: 12px;
}

.booking-edit-sub-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.booking-edit-required-list {
  margin-bottom: 12px;
}

.admin-booking-category-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
}

.admin-booking-category-btn {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  color: var(--color-text-primary);
  min-height: var(--touch-min);
}

.admin-booking-category-btn.active {
  background: var(--color-primary-light);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-primary-dark);
}

.admin-booking-category-btn.active .admin-booking-category-count {
  color: var(--color-primary-dark);
}

.admin-booking-category-count {
  font-size: 12px;
  color: var(--color-text-muted);
}

.booking-edit-orphaned {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
  font-size: 13px;
  line-height: 1.45;
}

.booking-edit-option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.booking-edit-option {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  align-items: start;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-muted);
  cursor: pointer;
}

.booking-edit-option.selected {
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-elevated));
}

.booking-edit-option.required {
  cursor: default;
}

.booking-edit-option-input {
  margin-top: 3px;
}

.booking-edit-current-hour {
  margin: 0 0 8px;
}

.booking-restore-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
}

.booking-edit-duration-summary {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-info) 12%, var(--color-surface-elevated));
  color: var(--color-info);
  font-size: 13px;
  line-height: 1.45;
}

.booking-edit-option-duration {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-info) 20%, transparent);
  color: var(--color-info);
  font-size: 11px;
  font-weight: 600;
}

.booking-edit-option-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.booking-edit-required {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-error) 16%, transparent);
  color: var(--color-error);
  font-size: 11px;
  font-weight: 700;
}

.booking-edit-option-desc {
  grid-column: 2;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.booking-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.admin-settings-section {
  scroll-margin-top: 88px;
}

.admin-drawer-section {
  padding: 0;
  overflow: hidden;
}

.admin-drawer-shell {
  display: flex;
  min-height: 360px;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.admin-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  border: none;
  padding: 0;
  background: rgba(45, 36, 36, 0.35);
  cursor: pointer;
}

.admin-drawer-backdrop-enter-active,
.admin-drawer-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.admin-drawer-backdrop-enter-from,
.admin-drawer-backdrop-leave-to {
  opacity: 0;
}

.admin-drawer-nav {
  flex-shrink: 0;
  width: 260px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-surface-elevated);
  border-right: 1px solid var(--color-border);
  z-index: 36;
}

.admin-drawer-nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-3) var(--space-2);
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
}

.admin-drawer-nav-title {
  margin: 0;
  font-size: var(--text-h3);
  font-weight: 600;
  color: var(--color-text-primary);
}

.admin-drawer-close {
  display: none;
}

.admin-drawer-nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.admin-drawer-nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
  min-height: var(--touch-min);
}

.admin-drawer-nav-item i {
  flex-shrink: 0;
  font-size: 16px;
  opacity: 0.85;
}

.admin-drawer-nav-item:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-primary);
}

.admin-drawer-nav-item.active {
  background: var(--color-primary-light);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-primary-dark);
  font-weight: 600;
}

.admin-drawer-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.admin-drawer-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 2;
}

.admin-drawer-toolbar-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-drawer-toolbar-text strong {
  font-size: var(--text-body);
  color: var(--color-text-primary);
  line-height: var(--lh-tight);
}

.admin-drawer-toolbar-text .muted {
  font-size: var(--text-caption);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-drawer-icon-btn {
  width: var(--touch-min);
  height: var(--touch-min);
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  padding: 0;
}

.admin-drawer-icon-btn:hover {
  background: var(--color-surface-muted);
}

.admin-drawer-panel {
  flex: 1;
  min-width: 0;
  padding: var(--space-4);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.admin-drawer-panel .admin-settings-section h3,
.admin-drawer-panel .ui-settings-group-title {
  margin-top: 0;
}

@media (min-width: 641px) {
  .admin-drawer-nav {
    width: 260px;
    opacity: 1;
    pointer-events: auto;
    transform: none;
    position: relative;
    flex-shrink: 0;
  }

  .admin-drawer-menu-btn,
  .admin-drawer-close {
    display: none;
  }
}

@media (max-width: 640px) {
  .admin-drawer-nav:not(.admin-drawer-nav--open) {
    width: 0;
    overflow: hidden;
    border-right: none;
    padding: 0;
    opacity: 0;
    pointer-events: none;
  }
}

@media (max-width: 640px) {
  .admin-drawer-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(88vw, 280px);
    max-width: 280px;
    transform: translateX(-105%);
    transition: transform 0.25s ease;
    box-shadow: 4px 0 24px rgba(45, 36, 36, 0.12);
  }

  .admin-drawer-nav--open {
    transform: translateX(0);
  }

  .admin-drawer-close {
    display: inline-flex;
  }
}

/* UX.md: หัวข้อเป็นแท็บเม็ดยาเลื่อนแนวนอน ไม่ใช้เมนูซ้อน */
.admin-drawer-shell {
  flex-direction: column;
}

.admin-drawer-nav-head,
.admin-drawer-toolbar,
.admin-drawer-backdrop {
  display: none !important;
}

.admin-drawer-nav,
.admin-drawer-nav.admin-drawer-nav--open,
.admin-drawer-nav:not(.admin-drawer-nav--open) {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  max-width: none !important;
  height: auto !important;
  transform: none !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  overflow: visible !important;
  border-right: none !important;
  border-bottom: 1px solid var(--color-border);
  box-shadow: none !important;
  padding: 0 !important;
}

.admin-drawer-nav-list {
  flex-direction: row;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: var(--space-2) 0 var(--space-3);
  gap: var(--space-2);
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.admin-drawer-nav-list::-webkit-scrollbar {
  display: none;
}

.admin-drawer-nav-item {
  width: auto;
  flex: 0 0 auto;
}

.admin-drawer-panel {
  padding: var(--space-4) 0;
}

.admin-shop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-shop-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.admin-shop-row .admin-shop-item {
  flex: 1 1 220px;
}

.admin-shop-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
}

.admin-shop-item.inactive {
  opacity: 0.65;
}

.shop-inactive-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-error) 16%, transparent);
  color: var(--color-error);
  font-size: 11px;
  font-weight: 700;
}

.shop-usage-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.shop-usage-badge--ok {
  background: color-mix(in srgb, var(--color-success) 16%, transparent);
  color: var(--color-success);
}

.shop-usage-badge--warn {
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
}

.shop-usage-badge--expired {
  background: color-mix(in srgb, var(--color-error) 16%, transparent);
  color: var(--color-error);
}

.usage-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.usage-preset-btn {
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.2;
}

.line-branch-panel {
  margin: 0 0 16px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-muted);
}

.line-branch-title {
  margin: 0 0 6px;
  font-size: 15px;
}

.line-branch-hint {
  margin: 0 0 12px;
  font-size: 13px;
}

.line-branch-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line-branch-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
}

.line-branch-info {
  flex: 1 1 160px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.line-branch-toggle {
  margin: 0;
  white-space: nowrap;
}

.line-branch-setup-btn {
  padding: 4px 10px;
  font-size: 12px;
}

.admin-shop-line-toggle {
  margin: 0;
  font-size: 12px;
  white-space: nowrap;
}

.shop-line-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.shop-line-badge--on {
  background: color-mix(in srgb, var(--color-success) 16%, transparent);
  color: var(--color-success);
}

.shop-line-badge--warn {
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
}

.shop-line-badge--premium {
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary-dark);
}

.line-push-status-off {
  color: var(--color-error);
}

.admin-shop-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-elevated);
  cursor: pointer;
  font-family: inherit;
}

.admin-shop-item.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.ui-settings-group-title {
  margin: 0 0 8px;
  font-size: 1rem;
}

.ui-settings-hint {
  margin: 0 0 12px;
  font-size: 13px;
}

.ui-field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ui-field-toggle {
  grid-column: 1 / -1;
}

.ui-field-toggle-hint {
  margin: 0;
  font-size: var(--text-caption);
}

.ui-color-input {
  width: 56px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.ui-image-preview {
  max-width: 80px;
  max-height: 80px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--color-border);
}

.ui-image-preview--wide {
  max-width: 100%;
  max-height: 120px;
}

.ui-settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ui-image-upload-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ui-image-upload-btn {
  display: inline-flex;
  align-items: center;
  border: 2px solid var(--color-border);
  gap: 6px;
}

.ui-image-upload-hint {
  font-size: 12px;
}

.ui-image-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.btn-link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.admin-setup-wizard {
  margin-bottom: var(--space-3);
  border-color: color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
}

.admin-setup-wizard-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.admin-setup-wizard-head h3 {
  margin: 0 0 4px;
}

.admin-setup-dismiss {
  flex-shrink: 0;
}

.admin-setup-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-setup-step {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.admin-setup-step.done {
  opacity: 0.72;
}

.admin-setup-step-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.admin-setup-go {
  min-width: 100px;
}

.admin-booking-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.admin-booking-actions .btn {
  min-height: var(--touch-min);
}
</style>

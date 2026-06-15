<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import Swal from 'sweetalert2'
import { colorForDate, dayTintStyle, isValidHexColor, optionVisibleOnDate, optionBookableOnDate } from '../utils/nailOptionHelpers'

const router = useRouter()
const auth = useAuthStore()

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
const blockMonth = ref(todayYm())
const selectedBlockDate = ref('')
const blocks = ref([])
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
const useCouponCode = ref('')
const nailOptions = ref([])
const serviceMonth = ref(todayYm())
const selectedServiceDate = ref('')
const showEveryDayForm = ref(false)
const serviceWeekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const serviceThMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const optionColorPresets = [
  { label: 'แดง', value: '#e11d48' },
  { label: 'เขียว', value: '#22c55e' },
  { label: 'น้ำเงิน', value: '#3b82f6' },
  { label: 'ส้ม', value: '#f97316' },
]
const serviceLocations = ref([])
const locationForm = ref({
  id: null,
  name: '',
  color: '#3b82f6',
  description: '',
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
  color: '#e11d48',
  show_from_date: '',
  show_to_date: '',
})
const loading = ref(false)
const message = ref('')
const errorMessage = ref('')
const activeTab = ref('bookings')

const adminTabs = [
  { key: 'bookings', label: 'จัดการคิว', icon: 'ti-calendar' },
  { key: 'services', label: 'บริการ', icon: 'ti-list-check' },
  { key: 'settings', label: 'ตั้งค่า', icon: 'ti-settings' },
  { key: 'blocks', label: 'ปิดร้าน', icon: 'ti-calendar-off' },
  { key: 'users', label: 'ผู้ใช้', icon: 'ti-users' },
]

// ── Shop hours ─────────────────────────────
const shopOpenHour = ref(9)
const shopLastBookingHour = ref(18)
const hourOptions = Array.from({ length: 23 }, (_, i) => i)

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

async function loadShopHours() {
  try {
    const { data } = await api.get('/api/admin/settings/shop-hours')
    shopOpenHour.value = data.open_hour ?? 9
    shopLastBookingHour.value = data.last_booking_hour ?? 18
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดเวลาร้านไม่สำเร็จ'
  }
}

async function saveShopHours() {
  if (shopOpenHour.value >= shopLastBookingHour.value - 1) {
    errorMessage.value = 'เวลาเปิดต้องน้อยกว่าเวลาจองสุดท้ายอย่างน้อย 2 ชั่วโมง'
    return
  }
  message.value = ''
  errorMessage.value = ''
  try {
    await api.patch('/api/admin/settings/shop-hours', {
      open_hour: shopOpenHour.value,
      last_booking_hour: shopLastBookingHour.value,
    })
    message.value = `บันทึกเวลาร้านแล้ว: เปิด ${shopOpenHour.value}:00 – จองสุดท้าย ${shopLastBookingHour.value}:00 (ปิด ${shopLastBookingHour.value + 2}:00)`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกเวลาร้านไม่สำเร็จ'
  }
}

// ── Users ────────────────────────────────────
const users = ref([])
const userSearch = ref('')

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(u =>
    u.name?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q)
  )
})

async function loadUsers() {
  try {
    const { data } = await api.get('/api/admin/users')
    users.value = data
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดผู้ใช้ไม่สำเร็จ'
  }
}

async function toggleAdmin(user) {
  const next = !user.is_admin
  const ok = await Swal.fire({
    title: next ? 'ให้สิทธิ์แอดมิน' : 'ถอดสิทธิ์แอดมิน',
    text: `${next ? 'ให้' : 'ถอด'}สิทธิ์แอดมินของ "${user.name}" ใช่ไหม`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return
  try {
    await api.patch(`/api/admin/users/${user.id}/set-admin`, { is_admin: next })
    user.is_admin = next
    message.value = `${next ? 'ให้' : 'ถอด'}สิทธิ์แอดมิน "${user.name}" แล้ว`
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'อัปเดตสิทธิ์ไม่สำเร็จ'
  }
}

async function deleteUser(user) {
  const ok = await Swal.fire({
    title: 'ลบผู้ใช้',
    html: `ลบ <strong>${user.name}</strong> และข้อมูลการจองทั้งหมดของผู้ใช้นี้<br><span style="color:#b91c1c">การลบไม่สามารถยกเลิกได้</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626',
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

function providerLabel(p) {
  return { google: 'Google', facebook: 'Facebook', line: 'LINE', phone: 'เบอร์โทร' }[p] || p
}

function switchTab(tab) {
  if (activeTab.value === tab) return
  if (activeTab.value === 'services') closeServiceDay()
  if (activeTab.value === 'bookings') closeBookingDay()
  if (activeTab.value === 'blocks') closeBlockDay()
  activeTab.value = tab
  message.value = ''
  errorMessage.value = ''
}

const filtered = computed(() => bookings.value)

const bookingMonthLabel = computed(() => {
  const [y, m] = bookingMonth.value.split('-').map(Number)
  return `${serviceThMonths[m - 1]} ${y + 543}`
})

const bookingCalendarWeeks = computed(() => buildCalendarWeeks(bookingMonth.value))

function bookingDayStats(iso) {
  return bookingDaySummary.value[iso] || { unpaid_count: 0, paid_count: 0 }
}

function bookingDayHasBookings(iso) {
  const stats = bookingDayStats(iso)
  return stats.unpaid_count > 0 || stats.paid_count > 0
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
    for (const row of data || []) map[row.date] = row
    bookingDaySummary.value = map
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

async function reloadBookingViews() {
  await Promise.all([loadBookings(), loadBookingCalendarSummary()])
}

// ── รูปแบบแสดงเวลาหน้าจองลูกค้า ─────────────
const bookingDisplayMode = ref('normal')

const displaySlotPreview = computed(() => {
  const result = []
  for (let h = shopOpenHour.value; h <= shopLastBookingHour.value; h += 2) {
    result.push(`${String(h).padStart(2, '0')}:00–${String(h + 2).padStart(2, '0')}:00`)
  }
  return result.join(' · ')
})

async function loadBookingDisplay() {
  try {
    const { data } = await api.get('/api/admin/settings/booking-display')
    bookingDisplayMode.value = data.display_mode === 'slots_2h' ? 'slots_2h' : 'normal'
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดรูปแบบแสดงเวลาไม่สำเร็จ'
  }
}

async function saveBookingDisplay() {
  message.value = ''
  errorMessage.value = ''
  try {
    await api.patch('/api/admin/settings/booking-display', {
      display_mode: bookingDisplayMode.value,
    })
    message.value = bookingDisplayMode.value === 'slots_2h'
      ? 'บันทึกแล้ว: หน้าจองแสดงช่วงเวลา 2 ชม.'
      : 'บันทึกแล้ว: หน้าจองแสดงแบบปกติ (ทีละชั่วโมง)'
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'บันทึกรูปแบบแสดงเวลาไม่สำเร็จ'
  }
}

async function loadBookings() {
  loading.value = true
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
    loading.value = false
  }
}

async function loadBlocks() {
  try {
    const { data } = await api.get('/api/admin/blocks', { params: { month: blockMonth.value } })
    blocks.value = data
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

async function saveDepositSetting() {
  const ok = await Swal.fire({
    title: 'ยืนยันบันทึกยอดมัดจำ',
    text: `ตั้งยอดมัดจำเป็น ${depositAmount.value} บาท ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

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

  const ok = await Swal.fire({
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

  const ok = await Swal.fire({
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
  const ok = await Swal.fire({
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

async function markDone(id) {
  const ok = await Swal.fire({
    title: 'ยืนยันทำคิวเสร็จ',
    text: 'ต้องการปิดคิวนี้และให้แต้ม +10 ใช่ไหม',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/complete`)
    message.value = data?.message || 'อัปเดตสำเร็จ'
    await Promise.all([reloadBookingViews(), auth.fetchMe().catch(() => null)])
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'อัปเดตไม่สำเร็จ'
  }
}

async function confirmPayment(id) {
  const ok = await Swal.fire({
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

async function useCoupon() {
  message.value = ''
  errorMessage.value = ''
  const code = String(useCouponCode.value || '').trim().toUpperCase()
  if (!code) {
    errorMessage.value = 'กรุณากรอกรหัสคูปอง'
    return
  }

  const ok = await Swal.fire({
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
  const ok = await Swal.fire({
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
  const ok = await Swal.fire({
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
  const ok = await Swal.fire({
    title: 'ลบรายการจอง',
    text: 'ลบคิวที่ยกเลิกแล้วออกจากระบบ ใช่ไหม? ไม่สามารถกู้คืนได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626',
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
}

const serviceMonthLabel = computed(() => {
  const [y, m] = serviceMonth.value.split('-').map(Number)
  return `${serviceThMonths[m - 1]} ${y + 543}`
})

const serviceCalendarWeeks = computed(() => buildCalendarWeeks(serviceMonth.value))

const selectedDayOptions = computed(() => {
  if (!selectedServiceDate.value) return []
  return nailOptions.value.filter(item => optionVisibleOnDate(item, selectedServiceDate.value))
})

const everyDayOptions = computed(() =>
  nailOptions.value.filter(item => !formatDateKey(item.show_from_date) && !formatDateKey(item.show_to_date))
)

const activeLocationPresets = computed(() =>
  serviceLocations.value.filter((loc) => loc.is_active)
)

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
  optionForm.value = {
    id: null,
    option_name: '',
    description: '',
    price: 0,
    duration_min: 60,
    is_active: true,
    is_required: false,
    color: '#e11d48',
    show_from_date: '',
    show_to_date: '',
  }
}

function resetOptionFormForDay() {
  optionForm.value = {
    id: null,
    option_name: '',
    description: '',
    price: 0,
    duration_min: 60,
    is_active: true,
    is_required: false,
    color: '#e11d48',
    show_from_date: selectedServiceDate.value,
    show_to_date: selectedServiceDate.value,
  }
}

function openEveryDayOptionForm() {
  selectedServiceDate.value = ''
  showEveryDayForm.value = true
  resetOptionForm()
  message.value = ''
  errorMessage.value = ''
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
    await Swal.fire({
      title: 'มีสถานที่นี้แล้ว',
      text: `วันนี้มี "${preset.name}" อยู่แล้ว`,
      icon: 'info',
      confirmButtonText: 'ตกลง',
    })
    return
  }

  const ok = await Swal.fire({
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
      duration_min: 60,
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
    color: '#3b82f6',
    description: '',
    is_active: true,
    sort_order: serviceLocations.value.length,
  }
}

function setLocationColor(color) {
  locationForm.value.color = color
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
    color: item.color && isValidHexColor(item.color) ? item.color : '#3b82f6',
    description: item.description || '',
    is_active: Boolean(item.is_active),
    sort_order: Number(item.sort_order) || 0,
  }
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
  const ok = await Swal.fire({
    title: isEdit ? 'ยืนยันแก้ไขสถานที่' : 'ยืนยันเพิ่มสถานที่',
    text: `${isEdit ? 'แก้ไข' : 'เพิ่ม'} "${name}" ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  const payload = {
    name,
    color: colorValue,
    description: String(locationForm.value.description || '').trim() || null,
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
  const ok = await Swal.fire({
    title: 'ลบสถานที่',
    text: `ลบ "${item.name}" จากรายการปุ่มลัด ใช่ไหม (บริการที่สร้างไปแล้วไม่หาย)`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626',
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

async function loadNailOptions() {
  try {
    const { data } = await api.get('/api/admin/nailoptions')
    nailOptions.value = data
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดรายการบริการไม่สำเร็จ'
  }
}

function startEditOption(item) {
  const from = formatDateKey(item.show_from_date)
  const to = formatDateKey(item.show_to_date)
  optionForm.value = {
    id: item.id,
    option_name: item.option_name,
    description: item.description || '',
    price: Number(item.price),
    duration_min: Number(item.duration_min),
    is_active: Boolean(item.is_active),
    is_required: Boolean(item.is_required),
    color: item.color && isValidHexColor(item.color) ? item.color : '#e11d48',
    show_from_date: from || '',
    show_to_date: to || '',
  }
  if (!from && !to) {
    showEveryDayForm.value = true
    selectedServiceDate.value = ''
  } else if (from && to && from === to) {
    selectedServiceDate.value = from
    showEveryDayForm.value = false
  } else if (from) {
    selectedServiceDate.value = from
    showEveryDayForm.value = false
  }
}

async function saveNailOption() {
  const name = String(optionForm.value.option_name || '').trim()
  if (!name) {
    errorMessage.value = 'กรุณากรอกชื่อบริการ'
    return
  }

  const isEdit = Boolean(optionForm.value.id)
  const ok = await Swal.fire({
    title: isEdit ? 'ยืนยันแก้ไขบริการ' : 'ยืนยันเพิ่มบริการ',
    text: `${isEdit ? 'แก้ไข' : 'เพิ่ม'} "${name}" ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
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
  const colorValue = String(optionForm.value.color || '').trim()
  if (colorValue && !isValidHexColor(colorValue)) {
    errorMessage.value = 'รูปแบบสีไม่ถูกต้อง ใช้ #RRGGBB'
    return
  }

  const payload = {
    option_name: name,
    description: String(optionForm.value.description || '').trim() || null,
    price: Number(optionForm.value.price),
    duration_min: Number(optionForm.value.duration_min),
    is_active: Boolean(optionForm.value.is_active),
    is_required: Boolean(optionForm.value.is_required),
    color: colorValue || null,
    show_from_date: showFrom || null,
    show_to_date: showTo || null,
  }

  try {
    if (isEdit) {
      await api.patch(`/api/admin/nailoptions/${optionForm.value.id}`, payload)
      message.value = 'แก้ไขบริการแล้ว'
    } else {
      await api.post('/api/admin/nailoptions', payload)
      message.value = 'เพิ่มบริการแล้ว'
    }
    if (selectedServiceDate.value) resetOptionFormForDay()
    else if (showEveryDayForm.value) resetOptionForm()
    else resetOptionForm()
    await loadNailOptions()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกบริการไม่สำเร็จ'
  }
}

async function removeNailOption(item) {
  const label = optionDeleteLabel(item)
  const ok = await Swal.fire({
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
    if (optionForm.value.id === item.id) {
      if (selectedServiceDate.value) resetOptionFormForDay()
      else resetOptionForm()
    }
    await loadNailOptions()
  } catch (error) {
    const msg = error?.response?.data?.error || 'ลบบริการไม่สำเร็จ'
    errorMessage.value = msg
    await Swal.fire({ title: 'ลบไม่สำเร็จ', text: msg, icon: 'error' })
  }
}

function statusLabel(s) {
  const map = {
    awaiting_payment: 'รอชำระเงิน',
    pending: 'ชำระแล้ว / รอให้บริการ',
    done: 'ทำเสร็จแล้ว',
    cancelled: 'ยกเลิกแล้ว',
  }
  return map[s] || s
}

function backToBooking() {
  router.push('/bookings')
}

onMounted(loadBookingCalendarSummary)
onMounted(loadBlocks)
onMounted(loadDepositSetting)
onMounted(loadNailOptions)
onMounted(loadServiceLocations)
onMounted(loadShopHours)
onMounted(loadAdvanceDays)
onMounted(loadBookingDisplay)
onMounted(loadUsers)
</script>

<template>
  <main class="page">
    <header class="topbar card">
      <div>
        <h2>แอดมิน</h2>
        <p class="muted">เข้าสู่ระบบโดย {{ auth.user?.name || '-' }}</p>
      </div>
      <button class="btn" @click="backToBooking">กลับหน้าจอง</button>
    </header>

    <nav class="admin-nav card" aria-label="เมนูแอดมิน">
      <button
        v-for="tab in adminTabs"
        :key="tab.key"
        type="button"
        class="admin-nav-item"
        :class="{ active: activeTab === tab.key }"
        :aria-current="activeTab === tab.key ? 'page' : undefined"
        @click="switchTab(tab.key)"
      >
        <i class="ti" :class="tab.icon" aria-hidden="true"></i>
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <p v-if="message" class="alert success">{{ message }}</p>
    <p v-if="errorMessage" class="alert error">{{ errorMessage }}</p>

    <section v-show="activeTab === 'bookings'" class="card admin-section">
      <template v-if="!selectedBookingDate">
        <div class="service-cal-header">
          <h3>จัดการคิวตามวัน</h3>
          <p class="muted">กดวันที่ในปฏิทินเพื่อดูรายการคิว · สีตามสถานที่ให้บริการ</p>
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
              </span>
              <span v-if="cell && bookingDayHasUnpaid(cell.iso)" class="booking-cal-alert" title="มีคิวยังไม่ชำระ">!</span>
            </button>
          </div>
        </div>

        <div class="booking-cal-legend">
          <span><span class="legend-paid">2</span> ชำระแล้ว</span>
          <span><span class="legend-unpaid">1</span> รอชำระ</span>
          <span><span class="booking-cal-alert inline">!</span> มีคิวยังไม่ชำระ</span>
        </div>
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
              รอชำระ {{ bookingDayStats(selectedBookingDate).unpaid_count }}
            </p>
          </div>
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

        <p v-if="loading" class="muted">กำลังโหลด...</p>

        <div v-if="filtered.length === 0 && !loading" class="muted">ไม่มีคิวในวันที่เลือก</div>
        <div v-for="item in filtered" :key="item.id" class="admin-item">
          <div>
            <strong>{{ item.start_hour }}:00 - {{ item.end_hour ?? (Number(item.start_hour) + 2) }}:00</strong>
            <p class="muted">{{ item.user_name }} ({{ item.user_email }})</p>
            <p class="muted">สถานะ: {{ statusLabel(item.status) }}</p>
            <p class="muted">
              บริการ:
              {{
                item.nail_options?.length
                  ? item.nail_options.map((opt) => opt.option_name).join(', ')
                  : '-'
              }}
            </p>
            <p class="muted">จองเมื่อ {{ formatCreatedAt(item.created_at) }}</p>
          </div>
          <div class="row">
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
              class="btn primary"
              @click="markDone(item.id)"
            >
              ทำเสร็จ +10 แต้ม
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
              class="btn danger"
              @click="deleteBooking(item.id)"
            >
              ลบ
            </button>
          </div>
        </div>
      </template>
    </section>

    <section v-show="activeTab === 'services'" class="card admin-section">
      <!-- ปฏิทินเลือกวัน -->
      <template v-if="!selectedServiceDate">
        <div class="service-cal-header">
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

          <div v-if="showEveryDayForm" class="service-option-form card-inner">
            <h4>{{ optionForm.id ? 'แก้ไขบริการทุกวัน' : 'เพิ่มบริการทุกวัน' }}</h4>
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
                ราคา (บาท)
                <input v-model.number="optionForm.price" type="number" min="0" step="1" class="admin-input" />
              </label>
              <label>
                ระยะเวลา (นาที)
                <input v-model.number="optionForm.duration_min" type="number" min="1" step="1" class="admin-input" />
              </label>
              <label class="admin-color-field">
                สีแสดงในปฏิทิน
                <div class="color-picker-row">
                  <input v-model="optionForm.color" type="color" class="admin-color-input" />
                  <input v-model="optionForm.color" type="text" class="admin-input" maxlength="7" placeholder="#e11d48" />
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
              </label>
            </div>
            <div class="admin-form-row">
              <label class="admin-checkbox">
                <input v-model="optionForm.is_active" type="checkbox" />
                แสดงให้ลูกค้าเลือกจอง
              </label>
              <label class="admin-checkbox">
                <input v-model="optionForm.is_required" type="checkbox" />
                บังคับเลือกเมื่อจอง
              </label>
              <button class="btn primary admin-action-btn" @click="saveNailOption">
                {{ optionForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ' }}
              </button>
              <button class="btn admin-action-btn" @click="closeEveryDayForm">ยกเลิก</button>
            </div>
          </div>

          <div v-if="everyDayOptions.length === 0 && !showEveryDayForm" class="muted">ยังไม่มีบริการทุกวัน</div>
          <div v-for="item in everyDayOptions" :key="item.id" class="admin-item">
            <div>
              <strong>{{ item.option_name }}</strong>
              <span v-if="item.color" class="option-color-dot" :style="{ background: item.color }" :title="item.color"></span>
              <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
                {{ item.is_active ? 'เปิดใช้งาน' : 'ปิด' }}
              </span>
              <span v-if="item.is_required" class="badge-required">บังคับเลือก</span>
              <span class="badge-everyday">ทุกวัน</span>
              <p class="muted">{{ item.description || '-' }}</p>
              <p class="muted">ราคา {{ Number(item.price) }} บาท · {{ item.duration_min }} นาที</p>
            </div>
            <div class="row">
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
          <p v-if="activeLocationPresets.length === 0" class="muted">
            ยังไม่มีสถานที่ — ไปที่แท็บ <strong>ตั้งค่า</strong> เพื่อเพิ่ม
          </p>
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

        <div class="service-option-form card-inner">
          <h4>{{ optionForm.id ? 'แก้ไขบริการ' : 'เพิ่มบริการอื่น' }}</h4>
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
              ราคา (บาท)
              <input v-model.number="optionForm.price" type="number" min="0" step="1" class="admin-input" />
            </label>
            <label>
              ระยะเวลา (นาที)
              <input v-model.number="optionForm.duration_min" type="number" min="1" step="1" class="admin-input" />
            </label>
            <label class="admin-color-field">
              สีแสดงในปฏิทิน
              <div class="color-picker-row">
                <input v-model="optionForm.color" type="color" class="admin-color-input" />
                <input v-model="optionForm.color" type="text" class="admin-input" maxlength="7" placeholder="#e11d48" />
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
            </label>
          </div>
          <div class="admin-form-row">
            <label class="admin-checkbox">
              <input v-model="optionForm.is_active" type="checkbox" />
              แสดงให้ลูกค้าเลือกจอง
            </label>
            <label class="admin-checkbox">
              <input v-model="optionForm.is_required" type="checkbox" />
              บังคับเลือกเมื่อจอง
            </label>
            <button class="btn primary admin-action-btn" @click="saveNailOption">
              {{ optionForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ' }}
            </button>
            <button v-if="optionForm.id" class="btn admin-action-btn" @click="resetOptionFormForDay">ยกเลิกแก้ไข</button>
          </div>
        </div>

        <h4 class="admin-subtitle">รายการในวันนี้ ({{ selectedDayOptions.length }})</h4>
        <div v-if="selectedDayOptions.length === 0" class="muted">ยังไม่มีบริการในวันนี้</div>
        <div v-for="item in selectedDayOptions" :key="item.id" class="admin-item">
          <div>
            <strong>{{ item.option_name }}</strong>
            <span v-if="item.color" class="option-color-dot" :style="{ background: item.color }" :title="item.color"></span>
            <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
              {{ item.is_active ? 'เปิดใช้งาน' : 'ปิด' }}
            </span>
            <span v-if="item.is_required" class="badge-required">บังคับเลือก</span>
            <span v-if="isLocationPresetName(item.option_name)" class="badge-location">สถานที่</span>
            <span v-if="!formatDateKey(item.show_from_date) && !formatDateKey(item.show_to_date)" class="badge-everyday">ทุกวัน</span>
            <p class="muted">{{ item.description || '-' }}</p>
            <p class="muted">ราคา {{ Number(item.price) }} บาท · {{ item.duration_min }} นาที</p>
            <p v-if="formatDateKey(item.show_from_date) || formatDateKey(item.show_to_date)" class="muted">
              {{ optionShowRangeText(item) }}
            </p>
          </div>
          <div class="row">
            <button class="btn" @click="startEditOption(item)">แก้ไข</button>
            <button class="btn danger" @click="removeNailOption(item)">ลบ</button>
          </div>
        </div>
      </template>
    </section>

    <section v-show="activeTab === 'settings'" class="card admin-section">
      <h3>ตั้งค่ายอดมัดจำ</h3>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          ยอดมัดจำ (บาท)
          <input v-model.number="depositAmount" type="number" min="1" step="1" class="admin-input" />
        </label>
        <button class="btn primary admin-action-btn" @click="saveDepositSetting">บันทึกยอดมัดจำ</button>
      </div>
      <p class="muted">ค่านี้จะถูกนำไปแสดงในหน้าชำระของลูกค้าทันที</p>

      <hr class="admin-divider" />

      <h3>เวลาเปิด-ปิดร้าน</h3>
      <p class="muted">กำหนดช่วงเวลาที่ลูกค้าสามารถเลือกจองได้ในหน้าจอง (ทุกคิวใช้เวลา 2 ชั่วโมง)</p>
      <div class="admin-form-row" style="flex-wrap:wrap">
        <label class="admin-label-grow">
          เวลาเปิดร้าน
          <select v-model.number="shopOpenHour" class="admin-input">
            <option v-for="h in hourOptions" :key="h" :value="h">{{ String(h).padStart(2,'0') }}:00</option>
          </select>
        </label>
        <label class="admin-label-grow">
          จองสุดท้ายได้ถึง
          <select v-model.number="shopLastBookingHour" class="admin-input">
            <option v-for="h in hourOptions" :key="h" :value="h">{{ String(h).padStart(2,'0') }}:00 (ปิด {{ String(h+2).padStart(2,'0') }}:00)</option>
          </select>
        </label>
        <button class="btn primary admin-action-btn" style="align-self:flex-end" @click="saveShopHours">บันทึกเวลาร้าน</button>
      </div>
      <div class="shop-hours-preview">
        <i class="ti ti-clock" style="font-size:16px;color:#e11d48"></i>
        ลูกค้าจะเห็นช่วงเวลา
        <strong>{{ String(shopOpenHour).padStart(2,'0') }}:00 – {{ String(shopLastBookingHour).padStart(2,'0') }}:00</strong>
        (ปิดรับ {{ String(shopLastBookingHour + 2).padStart(2,'0') }}:00)
      </div>

      <hr class="admin-divider" />

      <h3>รูปแบบแสดงเวลาหน้าจองลูกค้า</h3>
      <p class="muted">กำหนดว่าหน้าจองของลูกค้าแสดงเวลาแบบไหน</p>
      <div class="booking-view-toggle" role="group" aria-label="รูปแบบแสดงเวลาหน้าจอง">
        <button
          type="button"
          class="view-toggle-btn"
          :class="{ active: bookingDisplayMode === 'normal' }"
          @click="bookingDisplayMode = 'normal'"
        >
          <i class="ti ti-list" aria-hidden="true"></i>
          ปกติ (ทีละชม.)
        </button>
        <button
          type="button"
          class="view-toggle-btn"
          :class="{ active: bookingDisplayMode === 'slots_2h' }"
          @click="bookingDisplayMode = 'slots_2h'"
        >
          <i class="ti ti-clock" aria-hidden="true"></i>
          ช่วง 2 ชม.
        </button>
      </div>
      <div class="admin-form-row" style="margin-top:10px">
        <button class="btn primary admin-action-btn" @click="saveBookingDisplay">บันทึกรูปแบบแสดงเวลา</button>
      </div>
      <div v-if="bookingDisplayMode === 'slots_2h'" class="shop-hours-preview">
        <i class="ti ti-layout-list" style="font-size:16px;color:#e11d48"></i>
        ตัวอย่าง: {{ displaySlotPreview }}
      </div>

      <hr class="admin-divider" />

      <h3>สถานที่ให้บริการ (ปุ่มลัด)</h3>
      <p class="muted">จัดการปุ่ม “เพิ่มสถานที่” ตอนเพิ่มบริการในแต่ละวัน · ชื่อสถานที่ต้องไม่ซ้ำในรายการนี้</p>

      <div class="service-option-form card-inner">
        <h4>{{ locationForm.id ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่ใหม่' }}</h4>
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
          <label class="admin-color-field">
            สีในปฏิทิน
            <div class="color-picker-row">
              <input v-model="locationForm.color" type="color" class="admin-color-input" />
              <input v-model="locationForm.color" type="text" class="admin-input" maxlength="7" placeholder="#3b82f6" />
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
          <label class="admin-checkbox">
            <input v-model="locationForm.is_active" type="checkbox" />
            แสดงเป็นปุ่มลัด
          </label>
          <button class="btn primary admin-action-btn" @click="saveServiceLocation">
            {{ locationForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มสถานที่' }}
          </button>
          <button v-if="locationForm.id" type="button" class="btn admin-action-btn" @click="resetLocationForm">ยกเลิกแก้ไข</button>
        </div>
      </div>

      <div v-if="serviceLocations.length === 0" class="muted" style="margin-top:10px">ยังไม่มีสถานที่ในระบบ</div>
      <div v-for="item in serviceLocations" :key="item.id" class="admin-item">
        <div>
          <strong>{{ item.name }}</strong>
          <span class="option-color-dot" :style="{ background: item.color }" :title="item.color"></span>
          <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
            {{ item.is_active ? 'แสดงปุ่ม' : 'ซ่อนปุ่ม' }}
          </span>
          <p class="muted">{{ item.description || '-' }}</p>
          <p class="muted">ลำดับ {{ item.sort_order }}</p>
        </div>
        <div class="row">
          <button type="button" class="btn" @click="startEditLocation(item)">แก้ไข</button>
          <button type="button" class="btn danger" @click="removeServiceLocation(item)">ลบ</button>
        </div>
      </div>

      <hr class="admin-divider" />

      <h3>จำนวนวันจองล่วงหน้า</h3>
      <p class="muted">กำหนดจำนวนวันล่วงหน้าแล้วกดบันทึก — ระบบจะล็อกวันสิ้นสุดจากวันที่กดบันทึก (ไม่เลื่อนตามวันนี้)</p>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          จองล่วงหน้าได้ (วัน)
          <input v-model.number="advanceDays" type="number" min="1" max="365" step="1" class="admin-input" />
        </label>
        <button class="btn primary admin-action-btn" @click="saveAdvanceDays">บันทึก</button>
      </div>
      <div class="shop-hours-preview">
        <i class="ti ti-calendar-event" style="font-size:16px;color:#e11d48"></i>
        เปิดจองถึง <strong>{{ formatBookUntilLabel(bookUntilDate) }}</strong>
        <span v-if="bookUntilDate" class="muted">({{ advanceDays }} วัน นับจากวันที่กดบันทึกล่าสุด)</span>
      </div>

      <hr class="admin-divider" />

      <h3>ใช้คูปองลูกค้า</h3>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          รหัสคูปอง (10 หลัก)
          <input v-model="useCouponCode" type="text" maxlength="10" placeholder="กรอกรหัสคูปอง" class="admin-input" />
        </label>
        <button class="btn primary admin-action-btn" @click="useCoupon">ยืนยันใช้คูปอง</button>
      </div>
    </section>

    <section v-show="activeTab === 'blocks'" class="card admin-section admin-blocks-section">
      <template v-if="!selectedBlockDate">
        <div class="service-cal-header">
          <h3>ปิดวัน / ปิดช่วงเวลา</h3>
          <p class="muted">กดวันที่ในปฏิทินเพื่อจัดการรายการปิด · สีตามสถานที่ให้บริการ</p>
        </div>

        <div class="bulk-block-box">
          <h4>ปิดล่วงหน้า 7 / 15 / 30 วัน (ทั้งวัน หรือ บางช่วงเวลา)</h4>
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

        <div v-if="selectedDayBlocks.length === 0" class="muted">ยังไม่มีรายการปิดในวันนี้</div>
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
      </template>
    </section>

    <!-- ── ผู้ใช้ ── -->
    <section v-show="activeTab === 'users'" class="card admin-section">
      <h3>รายชื่อผู้ใช้</h3>
      <div class="admin-form-row" style="margin-bottom:14px">
        <label class="admin-label-grow">
          ค้นหา
          <input
            v-model="userSearch"
            type="text"
            placeholder="ชื่อหรืออีเมล..."
            class="admin-input"
          />
        </label>
      </div>

      <p v-if="filteredUsers.length === 0" class="muted">ไม่พบผู้ใช้</p>

      <div v-for="u in filteredUsers" :key="u.id" class="admin-item user-item">
        <div class="user-info">
          <strong>{{ u.name }}</strong>
          <span class="user-badge-provider">{{ providerLabel(u.provider) }}</span>
          <p class="muted">{{ u.email || '-' }}</p>
          <p class="muted">
            แต้ม {{ u.total_points }} ·
            จอง {{ u.total_bookings }} ครั้ง ·
            เสร็จ {{ u.completed_bookings }} ครั้ง ·
            สมัคร {{ formatDateKey(u.created_at) }}
          </p>
        </div>
        <div class="row" style="flex-shrink:0">
          <button
            class="btn"
            :class="u.is_admin ? 'danger' : ''"
            @click="toggleAdmin(u)"
          >
            {{ u.is_admin ? 'ถอดแอดมิน' : 'ให้สิทธิ์แอดมิน' }}
          </button>
          <button class="btn danger" @click="deleteUser(u)">ลบ</button>
        </div>
      </div>
    </section>

  </main>
</template>

<style scoped>
.admin-nav {
  display: flex;
  gap: 8px;
  padding: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}

.admin-nav::-webkit-scrollbar {
  display: none;
}

.admin-nav-item {
  flex: 1 0 auto;
  min-width: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
}

.admin-nav-item i {
  font-size: 18px;
}

.admin-nav-item:hover {
  border-color: #cbd5e1;
  color: #334155;
}

.admin-nav-item.active {
  border-color: #e11d48;
  background: #fff1f2;
  color: #e11d48;
}

.alert {
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
}

.alert.success {
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.alert.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.admin-divider {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 20px 0;
}

.admin-section {
  border-radius: 14px;
  padding: 18px;
}

.admin-form-row {
  display: flex;
  gap: 12px;
  align-items: end;
  margin-bottom: 10px;
}

.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.admin-filter-row {
  display: grid;
  grid-template-columns: 220px 220px;
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
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
}

.view-toggle-btn i { font-size: 16px; }

.view-toggle-btn:hover {
  border-color: #cbd5e1;
  color: #334155;
}

.view-toggle-btn.active {
  border-color: #e11d48;
  background: #fff1f2;
  color: #e11d48;
}

.admin-filter-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
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
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 8px 10px;
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
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
}

.bulk-block-box h4,
.admin-subtitle {
  margin: 0 0 8px;
  font-size: 15px;
}

.bulk-preview {
  margin: 8px 0 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 14px;
  font-weight: 600;
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
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.badge-active {
  background: #dcfce7;
  color: #166534;
}

.badge-inactive {
  background: #fee2e2;
  color: #991b1b;
}

.badge-required {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #fff1f2;
  color: #e11d48;
}

.badge-location {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #eff6ff;
  color: #1d4ed8;
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
  color: #94a3b8;
}

.badge-everyday {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #eef2ff;
  color: #4338ca;
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
  width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.service-cal-month {
  min-width: 160px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.service-cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.service-cal-wd {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  padding: 4px 0;
}

.service-cal-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-cal-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.service-cal-day {
  position: relative;
  min-height: 52px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 6px 4px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color .15s, background .15s;
}

.service-cal-day:not(.empty):hover {
  border-color: #fbcfe8;
  background: #fdf2f8;
}

.service-cal-day.empty {
  border: none;
  background: transparent;
  cursor: default;
  min-height: 0;
}

.service-cal-day.today {
  border-color: #e11d48;
  box-shadow: 0 0 0 1px rgba(225, 29, 72, .12);
}

.service-cal-day.has-options {
  background: #fff1f2;
}

.booking-cal-day,
.block-cal-day {
  min-height: 58px;
}

.block-cal-day.has-block {
  background: #f8fafc;
}

.block-cal-marker {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
}

.block-cal-marker.full {
  color: #991b1b;
}

.block-cal-marker.partial {
  color: #b45309;
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
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.booking-stat-paid { color: #15803d; }
.booking-stat-sep { color: #94a3b8; }
.booking-stat-unpaid { color: #e11d48; }

.booking-cal-alert {
  position: absolute;
  top: 4px;
  right: 5px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #fbbf24;
  color: #92400e;
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
  color: #64748b;
}

.legend-paid,
.legend-unpaid {
  display: inline-block;
  min-width: 18px;
  text-align: center;
  font-weight: 700;
  margin-right: 4px;
}

.legend-paid { color: #15803d; }
.legend-unpaid { color: #e11d48; }

.service-cal-day.has-bookings {
  background: #f8fafc;
}

.service-cal-num {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
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
  background: #e11d48;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.service-everyday-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
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
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
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
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
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
  border-color: #1e293b;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #1e293b;
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
  background: #fff1f2;
  border: 1px solid #fecdd3;
  font-size: 13px;
  color: #1e293b;
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
  background: #f1f5f9;
  color: #475569;
  vertical-align: middle;
}

@media (max-width: 820px) {
  .admin-nav-item {
    min-width: 76px;
    padding: 8px 10px;
    font-size: 11px;
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

  .admin-action-btn {
    width: 100%;
  }
}
</style>

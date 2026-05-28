<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { useAuthStore } from '../stores/auth'
import { useBookingStore } from '../stores/booking'
import api from '../api/axios'

const router = useRouter()
const auth = useAuthStore()
const bookingStore = useBookingStore()

const selectedDate = ref(toLocalYmd(new Date()))
const busy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const slots = Array.from({ length: 10 }, (_, i) => i + 9)

const bookings = computed(() => bookingStore.bookingsByDate[selectedDate.value] || [])
const blockedSlots = computed(() => bookingStore.blocksByDate[selectedDate.value] || [])
const nailOptions = computed(() => bookingStore.nailOptions || [])
const myCoupons = ref([])
const todayDate = startOfDay(new Date())
const maxBookDate = addDays(todayDate, 30)
const windowStartDate = ref(startOfDay(new Date()))
const isMobile = ref(false)

const weekdayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const visibleDayCount = computed(() => (isMobile.value ? 4 : 7))

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toLocalYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseYmdLocal(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const weekDays = computed(() => {
  const items = Array.from({ length: visibleDayCount.value }, (_, index) => {
    const date = addDays(windowStartDate.value, index)
    if (date > maxBookDate) return null
    const iso = toLocalYmd(date)
    return {
      iso,
      day: date.getDate(),
      label: weekdayNames[date.getDay()],
      isToday: iso === toLocalYmd(todayDate),
    }
  })
  return items.filter(Boolean)
})
const visibleWeekDays = computed(() => weekDays.value.filter((day) => !isClosedDay(day.iso)))
const visibleSlots = computed(() => slots.filter((hour) => !isHourBlocked(hour)))

function formatDate(date) {
  const d = parseYmdLocal(date)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })
}

function updateScreenMode() {
  isMobile.value = window.innerWidth <= 820
}

function toHourLabel(hour) {
  return `${hour}:00`
}

const canGoPrev = computed(() => windowStartDate.value > todayDate)
const canGoNext = computed(() => addDays(windowStartDate.value, visibleDayCount.value) <= maxBookDate)

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isClosedDay(date) {
  const blocks = bookingStore.blocksByDate[date] || []
  return blocks.some((b) => b.is_full_day)
}

function isHourBlocked(hour) {
  return blockedSlots.value.some((b) => {
    if (b.is_full_day) return true
    const start = Number(b.start_hour)
    const end = Number(b.end_hour)
    return hour >= start && hour < end
  })
}

function bookingForHour(hour) {
  return bookings.value.find((b) => {
    const start = Number(b.start_hour)
    const end = Number(b.end_hour ?? start + 2)
    return hour >= start && hour < end
  })
}

function isStartSlot(hour) {
  const booking = bookingForHour(hour)
  return booking && Number(booking.start_hour) === hour
}

function canBook(hour) {
  if (hour > 18) return false
  return !bookingForHour(hour) && !bookingForHour(hour + 1) && !isHourBlocked(hour) && !isHourBlocked(hour + 1)
}

async function loadDate() {
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const beforeLoadDate = selectedDate.value
    await Promise.all([
      bookingStore.fetchByDate(selectedDate.value),
      bookingStore.fetchNailOptions(selectedDate.value).catch(() => []),
    ])

    if (isClosedDay(beforeLoadDate)) {
      await refreshBlocksAndEnsureSelection()

      if (selectedDate.value !== beforeLoadDate) {
        await loadDate()
        return
      }

      bookingStore.bookingsByDate[selectedDate.value] = []
      errorMessage.value = 'วันนี้ร้านปิดรับคิว'
      return
    }
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'
  }
}

async function book(startHour) {
  if (!nailOptions.value.length) {
    await Swal.fire({
      title: 'ไม่มีบริการให้เลือก',
      text: 'วันนี้ยังไม่มีสถานที่/บริการที่เปิดรับจอง กรุณาเลือกวันอื่น',
      icon: 'warning',
    })
    return
  }

  const optionsHtml = nailOptions.value.map((option) => `
    <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0;text-align:left">
      <input type="checkbox" name="nail-option" value="${option.id}" />
      <span>${escapeHtml(option.option_name)} </span>
    </label>
  `).join('')
//<span>${escapeHtml(option.option_name)} (${Number(option.price).toFixed(0)} บาท)</span>
  const result = await Swal.fire({
    title: `เลือกบริการ ${toHourLabel(startHour)} - ${toHourLabel(startHour + 2)}`,
    html: `<div style="max-height:220px;overflow:auto">${optionsHtml}</div>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันการจอง',
    cancelButtonText: 'ยกเลิก',
    preConfirm: () => {
      const selected = Array.from(document.querySelectorAll('input[name="nail-option"]:checked'))
        .map((el) => el.value)
      if (!selected.length) {
        Swal.showValidationMessage('กรุณาเลือกบริการอย่างน้อย 1 รายการ')
      }
      return selected
    },
  })
  if (!result.isConfirmed) return
  const optionIds = result.value || []

  errorMessage.value = ''
  successMessage.value = ''
  busy.value = true
  try {
    const booking = await bookingStore.bookSlot(selectedDate.value, startHour, optionIds)
    await Swal.fire({
      title: 'จองแล้ว รอชำระเงิน',
      text: `กรุณาโอนและส่งสลิปทาง LINE เพื่อรอแอดมินยืนยัน`,
      icon: 'success',
      confirmButtonText: 'ไปหน้าชำระเงิน',
    })
    router.push({
      path: `/payment/${booking.id}`,
      query: {
        date: selectedDate.value,
        start: String(startHour),
        end: String(startHour + 2),
      },
    })
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'จองคิวไม่สำเร็จ'
    await Swal.fire({
      title: 'จองไม่สำเร็จ',
      text: errorMessage.value,
      icon: 'error',
    })
    if (error?.response?.status === 409) {
      // Refresh latest server state so conflicting slot appears as occupied immediately.
      await loadDate()
    }
  } finally {
    busy.value = false
  }
}

async function cancel(bookingId) {
  const result = await Swal.fire({
    title: 'ยืนยันการยกเลิก',
    text: 'ต้องการยกเลิกคิวนี้ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
  })
  if (!result.isConfirmed) return

  errorMessage.value = ''
  successMessage.value = ''
  busy.value = true
  try {
    await bookingStore.cancelBooking(bookingId, selectedDate.value)
    successMessage.value = 'ยกเลิกคิวแล้ว'
    await Swal.fire({
      title: 'ยกเลิกสำเร็จ',
      text: successMessage.value,
      icon: 'success',
      timer: 1300,
      showConfirmButton: false,
    })
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ยกเลิกคิวไม่สำเร็จ'
    await Swal.fire({
      title: 'ยกเลิกไม่สำเร็จ',
      text: errorMessage.value,
      icon: 'error',
    })
  } finally {
    busy.value = false
  }
}

async function loadMyCoupons() {
  try {
    const { data } = await api.get('/api/coupons/my')
    myCoupons.value = (data || []).filter((item) => !item.is_used)
  } catch {
    myCoupons.value = []
  }
}

async function redeemCoupon() {
  const result = await Swal.fire({
    title: 'แลกคูปองลด 20%',
    text: 'ใช้ 100 แต้มเพื่อแลกคูปอง 1 ใบ ใช่หรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'แลกคูปอง',
    cancelButtonText: 'ยกเลิก',
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
    await Swal.fire({
      title: 'แลกคูปองไม่สำเร็จ',
      text: error?.response?.data?.error || 'เกิดข้อผิดพลาด',
      icon: 'error',
    })
  }
}

async function showMyCoupons() {
  await loadMyCoupons()
  const html = myCoupons.value.length
    ? myCoupons.value.map((coupon) => (
      `<div style="padding:8px 0;border-bottom:1px solid #eee;text-align:left">
        <strong>${coupon.coupon_code}</strong><br/>
        ส่วนลด ${coupon.discount_percent}% 
      </div>`
    )).join('')
    : '<p>ยังไม่มีคูปอง</p>'

  await Swal.fire({
    title: 'คูปองของฉัน',
    html: `<div style="max-height:240px;overflow:auto">${html}</div>`,
    confirmButtonText: 'ปิด',
  })
}

function selectDate(date) {
  const picked = parseYmdLocal(date)
  if (picked < todayDate || picked > maxBookDate) return
  selectedDate.value = date
  loadDate()
}

async function refreshBlocksAndEnsureSelection() {
  const from = toLocalYmd(windowStartDate.value)
  const to = toLocalYmd(addDays(windowStartDate.value, visibleDayCount.value - 1))
  await bookingStore.fetchBlocksRange(from, to)

  if (!visibleWeekDays.value.find((d) => d.iso === selectedDate.value)) {
    if (visibleWeekDays.value[0]) {
      selectedDate.value = visibleWeekDays.value[0].iso
    }
  }
}

async function prevWeek() {
  if (!canGoPrev.value) return
  windowStartDate.value = addDays(windowStartDate.value, -visibleDayCount.value)
  if (windowStartDate.value < todayDate) {
    windowStartDate.value = new Date(todayDate)
  }
  await refreshBlocksAndEnsureSelection()
  await loadDate()
}

async function nextWeek() {
  if (!canGoNext.value) return
  windowStartDate.value = addDays(windowStartDate.value, visibleDayCount.value)
  if (windowStartDate.value > maxBookDate) {
    windowStartDate.value = new Date(maxBookDate)
  }
  await refreshBlocksAndEnsureSelection()
  await loadDate()
}

function logout() {
  auth.logout()
  router.push('/login')
}

function goToPayment(booking) {
  router.push({
    path: `/payment/${booking.id}`,
    query: {
      date: selectedDate.value,
      start: String(booking.start_hour),
      end: String(booking.end_hour ?? Number(booking.start_hour) + 2),
    },
  })
}

onMounted(async () => {
  updateScreenMode()
  window.addEventListener('resize', updateScreenMode)
  await refreshBlocksAndEnsureSelection()
  await Promise.all([
    loadDate(),
    bookingStore.fetchMyBookings().catch(() => null),
    loadMyCoupons(),
  ])
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenMode)
})
</script>

<template>
  <main class="page booking-page">
    <header class="topbar card">
      <div>
        <h2>จองคิวเล็บ</h2>
        <p class="muted">
          {{ auth.user?.name || '-' }} | แต้มสะสม {{ auth.user?.total_points || 0 }}
        </p>
      </div>
      <div class="row">
        <button
          v-if="(auth.user?.total_points || 0) >= 100"
          class="btn primary"
          @click="redeemCoupon"
        >
          แลกคูปอง (100 แต้ม)
        </button>
        <button class="btn" @click="showMyCoupons">คูปองของฉัน</button>
        <button v-if="auth.isAdmin" class="btn" @click="router.push('/admin')">หน้าแอดมิน</button>
        <button class="btn" @click="logout">ออกจากระบบ</button>
      </div>
    </header>

    <section class="card booking-card">
      <div class="calendar-nav">
        <button class="btn" :disabled="!canGoPrev" @click="prevWeek">ก่อนหน้า</button>
        <h3>{{ formatDate(selectedDate) }}</h3>
        <button class="btn" :disabled="!canGoNext" @click="nextWeek">ถัดไป</button>
      </div>
      <div class="week-strip">
        <button
          v-for="day in visibleWeekDays"
          :key="day.iso"
          class="day-pill"
          :class="{ active: selectedDate === day.iso, today: day.isToday }"
          @click="selectDate(day.iso)"
        >
          <span>{{ day.label }}</span>
          <strong>{{ day.day }}</strong>
        </button>
      </div>
      <p v-if="visibleWeekDays.length === 0" class="muted">ช่วงวันที่นี้ปิดทั้งวันทั้งหมด</p>

    

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="success">{{ successMessage }}</p>

      <div class="slot-grid">
        <div v-for="hour in visibleSlots" :key="hour" class="slot-row">
          <div class="slot-hour">{{ toHourLabel(hour) }}</div>
          <div
            class="slot-card"
            :class="{
              mine: bookingForHour(hour)?.is_mine,
              occupied: Boolean(bookingForHour(hour)),
              blocked: bookingForHour(hour) && !isStartSlot(hour),
            }"
          >
            <template v-if="bookingForHour(hour) && isStartSlot(hour)">
              <div>
                <strong class="booking-time strike">
                  {{ toHourLabel(bookingForHour(hour).start_hour) }} -
                  {{ toHourLabel(bookingForHour(hour).end_hour) }}
                </strong>
                <p class="muted">โดย {{ bookingForHour(hour).user_name }}</p>
              </div>
              <div class="slot-actions">
                <button
                  v-if="bookingForHour(hour).is_mine && bookingForHour(hour).status === 'awaiting_payment'"
                  class="btn danger"
                  :disabled="busy"
                  @click="cancel(bookingForHour(hour).id)"
                >
                  ยกเลิก
                </button>
                <button
                  v-if="bookingForHour(hour).is_mine && bookingForHour(hour).status === 'awaiting_payment'"
                  class="btn"
                  :disabled="busy"
                  @click="goToPayment(bookingForHour(hour))"
                >
                  ไปหน้าชำระ
                </button>
                <span
                  v-if="!bookingForHour(hour).is_mine || bookingForHour(hour).status !== 'awaiting_payment'"
                  class="muted"
                >
                  {{
                    bookingForHour(hour).status === 'awaiting_payment'
                      ? 'รอชำระเงิน'
                      : bookingForHour(hour).status === 'pending'
                        ? 'ไม่ว่าง/ชำระเงินสำเร็จ'
                        : 'ไม่ว่าง'
                  }}
                </span>
              </div>
            </template>
            <template v-else-if="bookingForHour(hour) && !isStartSlot(hour)">
              <p class="muted">ไม่ว่าง (ต่อเนื่องจากคิวก่อนหน้า)</p>
              <span class="muted">-</span>
            </template>
            <template v-else>
              <div>
                <strong>{{ toHourLabel(hour) }} - {{ toHourLabel(hour + 2) }}</strong>
                <p class="muted">ว่าง</p>
              </div>
              <button class="btn primary" :disabled="busy || !canBook(hour)" @click="book(hour)">จอง</button>
            </template>
          </div>
        </div>
      </div>
      <p v-if="visibleSlots.length === 0" class="muted">วันนี้ไม่มีช่วงเวลาที่เปิดรับคิว</p>
    </section>
  </main>
</template>

import { defineStore } from 'pinia'
import api from '../api/axios'
import { normalizeShopOpenHour, normalizeShopLastBookingHour, normalizeBookingSlotHours } from '../utils/bookingSlots'

function toLocalYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseYmd(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function normalizeDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    return toLocalYmd(new Date(value))
  }
  return toLocalYmd(new Date(value))
}

export const useBookingStore = defineStore('booking', {
  state: () => ({
    bookingsByDate: {},
    blocksByDate: {},
    extraHoursByDate: {},
    dayHoursByDate: {},
    nailOptions: [],
    allNailOptions: [],
    myBookings: [],
    loading: false,
    shopOpenHour: 9,
    shopLastBookingHour: 18,
    bookingSlotHours: 2,
    advanceDays: 30,
    bookUntilDate: '',
    bookingDisplayMode: 'normal',
    unpaidAutoCancelEnabled: true,
    unpaidExpireHours: 24,
  }),
  actions: {
    async fetchByDate(date) {
      this.loading = true
      try {
        const { data } = await api.get('/api/bookings', { params: { date } })
        if (Array.isArray(data)) {
          this.bookingsByDate[date] = data
          this.blocksByDate[date] = []
          return data
        }

        this.bookingsByDate[date] = data.bookings || []
        this.blocksByDate[date] = (data.blocks || []).map((item) => ({
          ...item,
          block_date: normalizeDateKey(item.block_date),
        }))
        return this.bookingsByDate[date]
      } finally {
        this.loading = false
      }
    },
    async fetchBlocksRange(from, to) {
      const { data } = await api.get('/api/bookings/blocks', { params: { from, to } })
      const fromDate = parseYmd(from)
      const toDate = parseYmd(to)
      const dateCursor = new Date(fromDate)
      while (dateCursor <= toDate) {
        const key = toLocalYmd(dateCursor)
        this.blocksByDate[key] = []
        dateCursor.setDate(dateCursor.getDate() + 1)
      }

      for (const item of data || []) {
        const key = normalizeDateKey(item.block_date)
        if (!this.blocksByDate[key]) this.blocksByDate[key] = []
        this.blocksByDate[key].push({ ...item, block_date: key })
      }
      return data
    },
    async fetchDayHoursForDate(date) {
      if (!date) return []
      try {
        const { data } = await api.get('/api/bookings/day-hours', { params: { date } })
        const rows = (data || []).map((row) => ({
          ...row,
          start_hour: Number(row.start_hour),
          start_minute: Number(row.start_minute ?? 0),
          end_hour: Number(row.end_hour),
          end_minute: Number(row.end_minute ?? 0),
        }))
        this.dayHoursByDate = { ...this.dayHoursByDate, [date]: rows }
        return rows
      } catch {
        this.dayHoursByDate = { ...this.dayHoursByDate, [date]: [] }
        return []
      }
    },
    async fetchExtraHoursRange(from, to) {
      const { data } = await api.get('/api/bookings/extra-hours', { params: { from, to } })
      const fromDate = parseYmd(from)
      const toDate = parseYmd(to)
      const dateCursor = new Date(fromDate)
      while (dateCursor <= toDate) {
        const key = toLocalYmd(dateCursor)
        this.extraHoursByDate[key] = []
        dateCursor.setDate(dateCursor.getDate() + 1)
      }

      for (const item of data || []) {
        const key = normalizeDateKey(item.extra_date)
        if (!this.extraHoursByDate[key]) this.extraHoursByDate[key] = []
        this.extraHoursByDate[key].push({ ...item, extra_date: key })
      }
      return data
    },
    async bookSlot(booking_date, slotOrHour, option_ids) {
      const payload = typeof slotOrHour === 'object' && slotOrHour != null
        ? {
          booking_date,
          start_hour: slotOrHour.startHour,
          start_minute: slotOrHour.startMinute ?? 0,
          end_hour: slotOrHour.endHour,
          end_minute: slotOrHour.endMinute ?? 0,
          option_ids: option_ids || [],
        }
        : {
          booking_date,
          start_hour: slotOrHour,
          option_ids: option_ids || [],
        }
      const { data } = await api.post('/api/bookings', payload)
      await this.fetchByDate(booking_date)
      await this.fetchMyBookings()
      return data?.booking
    },
    async fetchNailOptions(date) {
      const params = date ? { date } : {}
      const { data } = await api.get('/api/bookings/options', { params })
      this.nailOptions = data || []
      return this.nailOptions
    },
    async fetchAllNailOptions() {
      try {
        const { data } = await api.get('/api/bookings/options')
        this.allNailOptions = data || []
        return this.allNailOptions
      } catch {
        return this.allNailOptions
      }
    },
    async cancelBooking(bookingId, date) {
      await api.delete(`/api/bookings/${bookingId}`)
      if (date) await this.fetchByDate(date)
      await this.fetchMyBookings()
    },
    async fetchMyBookings() {
      const { data } = await api.get('/api/bookings/my')
      this.myBookings = data
      return data
    },
    async fetchShopHours() {
      try {
        const { data } = await api.get('/api/bookings/shop-hours')
        this.shopOpenHour = normalizeShopOpenHour(data.open_hour)
        this.shopLastBookingHour = normalizeShopLastBookingHour(
          data.last_booking_hour,
          this.shopOpenHour,
          data.slot_hours
        )
        this.bookingSlotHours = normalizeBookingSlotHours(data.slot_hours)
      } catch {
        // ใช้ค่า default ถ้าโหลดไม่ได้
      }
    },
    async fetchAdvanceDays() {
      try {
        const { data } = await api.get('/api/bookings/advance-days')
        this.advanceDays = data.advance_days ?? 30
        this.bookUntilDate = data.book_until_date || ''
      } catch {
        // ใช้ค่า default ถ้าโหลดไม่ได้
      }
    },
    async fetchBookingDisplay() {
      try {
        const { data } = await api.get('/api/bookings/booking-display')
        this.bookingDisplayMode = data.display_mode === 'slots_2h' ? 'slots_2h' : 'normal'
      } catch {
        // ใช้ค่า default ถ้าโหลดไม่ได้
      }
    },
    async fetchUnpaidExpireSetting() {
      try {
        const { data } = await api.get('/api/bookings/unpaid-expire-setting')
        this.unpaidAutoCancelEnabled = data.enabled !== false
        this.unpaidExpireHours = Number(data.expire_hours) || 24
      } catch {
        // ใช้ค่า default
      }
    },
    async fetchBookingSettings() {
      await Promise.all([
        this.fetchShopHours(),
        this.fetchAdvanceDays(),
        this.fetchBookingDisplay(),
        this.fetchUnpaidExpireSetting(),
      ])
    },
  },
})

import { defineStore } from 'pinia'
import api from '../api/axios'

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
    nailOptions: [],
    myBookings: [],
    loading: false,
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
    async bookSlot(booking_date, start_hour, option_ids) {
      const { data } = await api.post('/api/bookings', { booking_date, start_hour, option_ids: option_ids || [] })
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
  },
})

/** Canonical booking statuses. DB values must stay these four keys. */

export const BOOKING_STATUS = {
  awaiting_payment: {
    key: 'awaiting_payment',
    label: 'รอชำระ',
    customerSlotLabel: 'ไม่ว่าง · รอชำระ',
    icon: 'ti-clock',
    tone: 'warning',
  },
  pending: {
    key: 'pending',
    label: 'รอทำ',
    customerSlotLabel: 'ไม่ว่าง · รอทำ',
    icon: 'ti-calendar-event',
    tone: 'info',
  },
  done: {
    key: 'done',
    label: 'ทำเสร็จ',
    customerSlotLabel: 'ไม่ว่าง · ทำเสร็จ',
    icon: 'ti-check',
    tone: 'success',
  },
  cancelled: {
    key: 'cancelled',
    label: 'ยกเลิก',
    customerSlotLabel: 'ไม่ว่าง · ยกเลิก',
    icon: 'ti-x',
    tone: 'muted',
  },
}

/** Calendar cell paid_count = pending + done (SQL). Not a DB status. */
export const CALENDAR_PAID_LABEL = 'ชำระแล้ว'

export const BOOKING_STATUS_FILTERS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'awaiting_payment', label: BOOKING_STATUS.awaiting_payment.label },
  { value: 'pending', label: BOOKING_STATUS.pending.label },
  { value: 'done', label: BOOKING_STATUS.done.label },
  { value: 'cancelled', label: BOOKING_STATUS.cancelled.label },
]

export function bookingStatusMeta(status) {
  return BOOKING_STATUS[status] || {
    key: status,
    label: status || '',
    customerSlotLabel: status || '',
    icon: 'ti-help-circle',
    tone: 'muted',
  }
}

export function bookingStatusLabel(status, { audience } = {}) {
  const meta = bookingStatusMeta(status)
  return audience === 'customer' ? meta.customerSlotLabel : meta.label
}

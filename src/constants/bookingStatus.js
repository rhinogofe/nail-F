/** Canonical booking statuses. DB values must stay these four keys. */

/** Calendar cell paid_count = pending + done (SQL). Not a DB status. */
export const CALENDAR_PAID_LABEL = 'ชำระแล้ว'

export const BOOKING_STATUS = {
  awaiting_payment: {
    key: 'awaiting_payment',
    label: 'รอชำระ',
    description: 'ลูกค้าจองแล้ว ยังไม่ยืนยันการชำระ',
    customerSlotLabel: 'ไม่ว่าง · รอชำระ',
    icon: 'ti-clock',
    tone: 'warning',
  },
  pending: {
    key: 'pending',
    label: 'รอทำ',
    description: 'ยืนยันชำระแล้ว รอให้บริการ',
    customerSlotLabel: `ไม่ว่าง · ${CALENDAR_PAID_LABEL}`,
    icon: 'ti-calendar-event',
    tone: 'info',
  },
  done: {
    key: 'done',
    label: 'ทำเสร็จ',
    description: 'ให้บริการเสร็จแล้ว (ลูกค้าได้แต้มตามที่ตั้งไว้)',
    customerSlotLabel: `ไม่ว่าง · ${CALENDAR_PAID_LABEL}`,
    icon: 'ti-check',
    tone: 'success',
  },
  cancelled: {
    key: 'cancelled',
    label: 'ยกเลิก',
    description: 'คิวถูกยกเลิก',
    customerSlotLabel: 'ไม่ว่าง',
    icon: 'ti-x',
    tone: 'muted',
  },
}

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
    description: '',
    customerSlotLabel: 'ไม่ว่าง',
    icon: 'ti-help-circle',
    tone: 'muted',
  }
}

export function bookingStatusLabel(status, { audience } = {}) {
  const meta = bookingStatusMeta(status)
  return audience === 'customer' ? meta.customerSlotLabel : meta.label
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { BOOKING_STATUS, BOOKING_STATUS_FILTERS, bookingStatusLabel } from './bookingStatus.js'

test('exactly the four DB statuses are defined', () => {
  assert.deepEqual(Object.keys(BOOKING_STATUS), ['awaiting_payment', 'pending', 'done', 'cancelled'])
})

test('admin labels match the agreed wording', () => {
  assert.equal(bookingStatusLabel('awaiting_payment'), 'รอชำระ')
  assert.equal(bookingStatusLabel('pending'), 'รอทำ')
  assert.equal(bookingStatusLabel('done'), 'ทำเสร็จ')
  assert.equal(bookingStatusLabel('cancelled'), 'ยกเลิก')
})

test('day-list filter covers every status plus "all"', () => {
  assert.deepEqual(BOOKING_STATUS_FILTERS.map((f) => f.value), ['', ...Object.keys(BOOKING_STATUS)])
  for (const f of BOOKING_STATUS_FILTERS.slice(1)) assert.equal(f.label, BOOKING_STATUS[f.value].label)
})

test('customer slot labels do not expose internal workflow words', () => {
  for (const key of Object.keys(BOOKING_STATUS)) {
    const label = bookingStatusLabel(key, { audience: 'customer' })
    assert.match(label, /^ไม่ว่าง/)
    assert.doesNotMatch(label, /รอทำ|ทำเสร็จ/)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as status from './bookingStatus.js'

const DB_STATUSES = ['awaiting_payment', 'pending', 'done', 'cancelled']
// «ทำเสร็จแล้ว» is fine for customers; bare «ทำเสร็จ» is the admin wording.
const INTERNAL_WORDS = /รอทำ|ทำเสร็จ(?!แล้ว)/
const CUSTOMER_EXPORTS = new Set(['BOOKING_STATUS_CUSTOMER_LABELS', 'bookingStatusCustomerLabel'])

test('customer label set covers the four DB statuses with the agreed wording', () => {
  assert.deepEqual(status.BOOKING_STATUS_CUSTOMER_LABELS, {
    awaiting_payment: 'รอชำระ',
    pending: 'ชำระแล้ว · รอรับบริการ',
    done: 'ทำเสร็จแล้ว',
    cancelled: 'ยกเลิก',
  })
})

test('customer labels never contain «รอทำ» or a bare «ทำเสร็จ»', () => {
  assert.equal(typeof status.bookingStatusCustomerLabel, 'function', 'bookingStatusCustomerLabel must be exported')
  for (const key of DB_STATUSES) {
    const label = status.bookingStatusCustomerLabel(key)
    assert.ok(label, `missing customer label for ${key}`)
    assert.doesNotMatch(label, INTERNAL_WORDS, `${key} → ${label}`)
  }
})

test('ProfileView imports only the customer label set from bookingStatus', () => {
  const source = readFileSync(new URL('../views/ProfileView.vue', import.meta.url), 'utf8')
  const fromStatus = /from\s*['"][^'"]*constants\/bookingStatus(?:\.js)?['"]/

  const namespaceImport = /import\s*\*\s*as\s+\w+\s*from\s*['"][^'"]*constants\/bookingStatus(?:\.js)?['"]/
  assert.doesNotMatch(source, namespaceImport, 'ProfileView must not import the whole bookingStatus module')

  const named = [...source.matchAll(/import\s*\{([^}]*)\}\s*(from\s*['"][^'"]+['"])/g)]
    .filter((m) => fromStatus.test(m[2]))
    .flatMap((m) => m[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean))

  assert.ok(named.length > 0, 'ProfileView should import its status labels from constants/bookingStatus')
  for (const name of named) {
    assert.ok(CUSTOMER_EXPORTS.has(name), `ProfileView imports admin export "${name}"`)
  }
})

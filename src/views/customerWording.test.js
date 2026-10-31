import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CUSTOMER_FILES = [
  '../views/ProfileView.vue',
  '../views/BookingView.vue',
  '../views/PaymentView.vue',
  '../views/ChatView.vue',
  '../views/ReviewsView.vue',
  '../components/BottomNav.vue',
  '../components/AccountMenuDrawer.vue',
]

// Shop-internal wording; «ทำเสร็จแล้ว» is the customer form and is allowed.
const INTERNAL_WORDS = /รอทำ|ทำเสร็จ(?!แล้ว)/

for (const file of CUSTOMER_FILES) {
  test(`${file.split('/').pop()} has no hard-coded «รอทำ» or bare «ทำเสร็จ»`, () => {
    const lines = readFileSync(new URL(file, import.meta.url), 'utf8').split(/\r?\n/)
    const hits = lines
      .map((text, index) => ({ line: index + 1, text: text.trim() }))
      .filter(({ text }) => INTERNAL_WORDS.test(text))
    assert.deepEqual(hits, [], hits.map(({ line, text }) => `:${line} ${text}`).join('\n'))
  })
}

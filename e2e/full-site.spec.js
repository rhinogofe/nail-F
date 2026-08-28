import { test, expect } from '@playwright/test'

const ADMIN_TABS = [
  'จัดการคิว',
  'สรุปยอด',
  'บริการ',
  'ตั้งค่า',
  'UI',
  'เวลา',
  'รีวิว',
  'คู่มือ',
  'ผู้ใช้',
  'ฟังก์ชัน',
]

const FEATURE_GROUPS = [
  'เมนูลูกค้า',
  'แท็บแอดมิน',
  'ตั้งค่าระบบ',
  'UI & ข้อความ',
  'เนื้อหา',
  'เวลา & คิว',
  'ฟังก์ชันจอง/ชำระ',
]

const CUSTOMER_NAV = ['จอง', 'รีวิว', 'แชท', 'บัญชี', 'แอดมิน']

const UI_SECTIONS = [
  'แบรนด์ & รูปภาพ',
  'ชำระเงิน',
  'LINE',
  'ข้อความจองคิว',
  'หน้าอื่นๆ',
  'แอดมิน',
  'สีธีม',
]

async function clickAllDrawerSections(page, navName) {
  const nav = page.getByRole('navigation', { name: navName })
  await expect(nav).toBeVisible()
  const buttons = nav.getByRole('button')
  const count = await buttons.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i)
    const label = (await btn.textContent())?.trim() || `section-${i}`
    await btn.click()
    await expect(btn).toHaveAttribute('aria-current', 'true')
  }
}

async function pickServicesInSheet(page) {
  await page.waitForTimeout(500)

  const categoryPill = page.locator('.category-pill').first()
  if (await categoryPill.isVisible().catch(() => false)) {
    await categoryPill.click()
  }

  const requiredChecks = page.locator('.option-card.required input[type="checkbox"]')
  const reqCount = await requiredChecks.count()
  for (let i = 0; i < reqCount; i += 1) {
    const input = requiredChecks.nth(i)
    if (!(await input.isChecked())) {
      await input.check({ force: true }).catch(() => null)
    }
  }

  const optionalChecks = page.locator('.option-card:not(.required):visible')
  const optCount = await optionalChecks.count()
  if (optCount > 0) {
    await optionalChecks.first().click()
  }
}

test.describe('Customer booking flow', () => {
  test('loads booking page with slot list or empty state', async ({ page }) => {
    await page.goto('/default/bookings')
    await expect(page.getByRole('navigation', { name: 'เมนูหลัก' })).toBeVisible()
    const slotsOrEmpty = page.locator('.slot-row, .empty-state')
    await expect(slotsOrEmpty.first()).toBeVisible({ timeout: 15000 })
  })

  test('customer nav pages load', async ({ page }) => {
    await page.goto('/default/bookings')
    const nav = page.getByRole('navigation', { name: 'เมนูหลัก' })

    for (const label of CUSTOMER_NAV) {
      const btn = nav.getByRole('button', { name: label, exact: true })
      if (!(await btn.isVisible().catch(() => false))) continue
      await btn.click()
      await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
  })

  test('book a free slot through payment page', async ({ page }) => {
    await page.goto('/default/bookings')
    await page.waitForTimeout(800)

    const freeSlot = page.locator('.slot-card.free').first()
    const hasFree = await freeSlot.isVisible().catch(() => false)
    test.skip(!hasFree, 'ไม่มีช่องว่างให้จองในวันนี้')

    await freeSlot.getByRole('button', { name: 'จอง' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'ยืนยันการจอง' })).toBeVisible()

    await page.getByRole('button', { name: /เลือกบริการ/ }).click()
    await expect(page.getByRole('heading', { name: 'เลือกบริการ' })).toBeVisible()

    await pickServicesInSheet(page)

    const confirmBtn = page.getByRole('button', { name: /ยืนยันการจอง/ })
    await expect(confirmBtn).toBeEnabled({ timeout: 10000 })
    await confirmBtn.click()

    await expect(page).toHaveURL(/\/default\/payment\//, { timeout: 15000 })
    await expect(page.getByText(/รหัสจอง|ชำระเงิน|มัดจำ/).first()).toBeVisible()
  })
})

test.describe('Admin — all tabs and settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/default/admin')
    await expect(page.getByRole('navigation', { name: 'เมนูแอดมิน' })).toBeVisible()
  })

  test('all admin tabs switch without errors', async ({ page }) => {
    const adminNav = page.getByRole('navigation', { name: 'เมนูแอดมิน' })
    for (const label of ADMIN_TABS) {
      const btn = adminNav.getByRole('button', { name: label })
      if (!(await btn.isVisible().catch(() => false))) continue
      await btn.click()
      await expect(btn).toHaveAttribute('aria-current', 'page')
    }
  })

  test('settings sections are navigable', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ตั้งค่า' }).click()
    await clickAllDrawerSections(page, 'หัวข้อตั้งค่า')
  })

  test('time sections are navigable', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'เวลา' }).click()
    await clickAllDrawerSections(page, 'หัวข้อเวลา')
  })

  test('UI sections are navigable', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'UI' }).click()
    const uiNav = page.getByRole('navigation', { name: 'หัวข้อ UI' })
    await expect(uiNav).toBeVisible()

    for (const label of UI_SECTIONS) {
      await uiNav.getByRole('button', { name: label }).click()
      await expect(uiNav.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'true')
    }
  })
})

test.describe('Admin — shop features panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/default/admin')
    await expect(page.getByRole('navigation', { name: 'เมนูแอดมิน' })).toBeVisible()
    const featuresBtn = page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ฟังก์ชัน' })
    await expect(featuresBtn).toBeVisible({ timeout: 15000 })
    await featuresBtn.click()
    await expect(page.getByRole('heading', { name: 'ฟังก์ชันตามสาขา' })).toBeVisible({ timeout: 15000 })
  })

  test('all feature groups show toggle cards', async ({ page }) => {
    const groupNav = page.getByRole('navigation', { name: 'หมวดฟังก์ชัน' })
    await expect(groupNav).toBeVisible()

    for (const label of FEATURE_GROUPS) {
      await groupNav.getByRole('button', { name: label }).click()
      await expect(page.locator('.shop-features-card').first()).toBeVisible()
      const cards = page.locator('.shop-features-card')
      expect(await cards.count()).toBeGreaterThan(0)
    }
  })

  test('customer menu toggles work (slide switch)', async ({ page }) => {
    await page.getByRole('navigation', { name: 'หมวดฟังก์ชัน' }).getByRole('button', { name: 'เมนูลูกค้า' }).click()

    const reviewCard = page.locator('.shop-features-card').filter({ hasText: 'รีวิว' }).first()
    await expect(reviewCard).toBeVisible()

    const toggle = reviewCard.locator('label.admin-switch')
    await expect(toggle).toBeVisible()

    const input = reviewCard.getByRole('switch')
    const wasChecked = await input.isChecked()
    await reviewCard.locator('label.admin-switch').click()
    await expect(input).toBeChecked({ checked: !wasChecked })
    await page.waitForTimeout(400)
    await reviewCard.locator('label.admin-switch').click()
    await expect(input).toBeChecked({ checked: wasChecked })
  })

  test('expand inline settings on settings_deposit item', async ({ page }) => {
    await page.getByRole('navigation', { name: 'หมวดฟังก์ชัน' }).getByRole('button', { name: 'ตั้งค่าระบบ' }).click()

    const depositCard = page.locator('.shop-features-card').filter({ hasText: 'มัดจำ' }).first()
    await depositCard.getByRole('button', { name: /ตั้งค่า/ }).click()
    await expect(depositCard.locator('.shop-features-card-body')).toBeVisible()
  })
})

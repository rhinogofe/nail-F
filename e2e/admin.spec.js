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

test.describe('Admin page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/default/admin')
    await expect(page.getByRole('navigation', { name: 'เมนูแอดมิน' })).toBeVisible()
  })

  test('loads admin dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'จัดการคิวตามวัน' })).toBeVisible()
  })

  test('main tabs switch without errors', async ({ page }) => {
    for (const label of ADMIN_TABS) {
      await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: label }).click()
      await expect(page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('settings sections are navigable', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ตั้งค่า' }).click()
    const settingsNav = page.getByRole('navigation', { name: 'หัวข้อตั้งค่า' })
    await expect(settingsNav).toBeVisible()
    const buttons = settingsNav.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i += 1) {
      const btn = buttons.nth(i)
      await btn.click()
      await expect(btn).toHaveAttribute('aria-current', 'true')
    }
  })

  test('time sections are navigable', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'เวลา' }).click()
    const timeNav = page.getByRole('navigation', { name: 'หัวข้อเวลา' })
    await expect(timeNav).toBeVisible()
    const buttons = timeNav.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i += 1) {
      const btn = buttons.nth(i)
      await btn.click()
      await expect(btn).toHaveAttribute('aria-current', 'true')
    }
  })

  test('services tab shows everyday options', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'บริการ' }).click()
    await expect(page.getByRole('button', { name: '+ เพิ่มบริการทุกวัน' })).toBeVisible()
  })

  test('users tab loads user list area', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ผู้ใช้' }).click()
    await expect(page.getByRole('heading', { name: 'รายชื่อผู้ใช้' })).toBeVisible()
  })
})

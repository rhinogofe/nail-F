import { test, expect } from '@playwright/test'

const ADMIN_TABS = [
  'จัดการคิว',
  'สรุปยอด',
  'บริการ',
  'ตั้งค่า',
  'UI',
  'เวลา',
  'รีวิว',
  'ผู้ใช้',
]

const SETTINGS_SECTIONS = [
  'มัดจำ',
  'คูปองแลกแต้ม',
  'LINE แจ้งเตือน',
  'แจ้งเตือนในแอป',
  'ยกเลิกอัตโนมัติ',
  'ร้าน / สาขา',
  'สถานที่บริการในแต่ละวัน',
  'ใช้คูปอง',
]

const TIME_SECTIONS = [
  'เวลาเปิด-ปิดปกติ',
  'เวลาเปิด-ปิดเฉพาะวัน',
  'ความยาวคิว & แสดงผล',
  'จองล่วงหน้า',
  'ปิดหลายวัน',
  'ปิดทีละวัน',
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

    for (const label of SETTINGS_SECTIONS) {
      await settingsNav.getByRole('button', { name: label }).click()
      await expect(settingsNav.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'true')
    }
  })

  test('time sections are navigable', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'เวลา' }).click()
    const timeNav = page.getByRole('navigation', { name: 'หัวข้อเวลา' })
    await expect(timeNav).toBeVisible()

    for (const label of TIME_SECTIONS) {
      await timeNav.getByRole('button', { name: label }).click()
      await expect(timeNav.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'true')
    }

    await timeNav.getByRole('button', { name: 'จองล่วงหน้า' }).click()
    await expect(page.getByRole('heading', { name: 'จำนวนวันจองล่วงหน้า' })).toBeVisible()
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

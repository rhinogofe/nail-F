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

  test('website buttons open editor and copy public link', async ({ page, context }) => {
    await expect(page.getByRole('button', { name: 'แก้ไขเว็บไซต์' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'แชร์ลิงก์เว็บไซต์' })).toBeVisible()
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await page.getByRole('button', { name: 'แชร์ลิงก์เว็บไซต์' }).click()
    await expect(page.getByText('คัดลอกลิงก์เว็บไซต์แล้ว')).toBeVisible()
    await page.getByRole('button', { name: 'แก้ไขเว็บไซต์' }).click()
    await expect(page).toHaveURL(/\/default\/booking-site\/admin$/)
    await expect(page.getByRole('heading', { name: 'ตั้งค่าทั่วไป & ลิงก์จอง' })).toBeVisible()
  })

  test('booking site editor can set service text colors', async ({ page }) => {
    await page.getByRole('button', { name: 'แก้ไขเว็บไซต์' }).click()
    await expect(page).toHaveURL(/\/default\/booking-site\/admin$/)
    await page.locator('aside').getByRole('button', { name: 'บริการ' }).click()
    await expect(page.getByRole('heading', { name: 'บริการ' })).toBeVisible()
    await expect(page.getByText('สีชื่อบริการ (ว่าง = ตามธีม)').first()).toBeVisible()
    await expect(page.getByText('สีรายละเอียด (ว่าง = ตามธีม)').first()).toBeVisible()
    await expect(page.getByText('สีลิงก์จองเลย (ว่าง = ตามธีม)').first()).toBeVisible()
    await page.locator('aside').getByRole('button', { name: 'ธีมสี' }).click()
    await page.getByRole('tab', { name: 'สีบริการ' }).click()
    await expect(page.getByRole('heading', { name: 'สีข้อความบริการ' })).toBeVisible()
    await expect(page.getByText('ชื่อบริการ (ว่าง = สีตัวอักษร)')).toBeVisible()

    await page.goto('/default/booking-site')
    const vars = await page.locator('.booking-site').evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        roomTitle: s.getPropertyValue('--room-title').trim(),
        ink: s.getPropertyValue('--ink').trim(),
        roomText: s.getPropertyValue('--room-text').trim(),
        mute: s.getPropertyValue('--mute').trim(),
      }
    })
    expect(vars.roomTitle).toBe(vars.ink)
    expect(vars.roomText).toBe(vars.mute)
  })

  test('booking site theme presets appear and can be applied', async ({ page }) => {
    await page.getByRole('button', { name: 'แก้ไขเว็บไซต์' }).click()
    await expect(page).toHaveURL(/\/default\/booking-site\/admin$/)
    await page.locator('aside').getByRole('button', { name: 'ธีมสี' }).click()
    await page.getByRole('tab', { name: 'ธีมสำเร็จรูป' }).click()
    await expect(page.getByRole('heading', { name: 'ธีมสำเร็จรูป' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Rose Blush/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Nude Minimal/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Lavender Dream/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Emerald Spa/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Midnight Gold/ })).toBeVisible()
    page.once('dialog', dialog => dialog.accept())
    await page.locator('.preset-card', { hasText: 'Rose Blush' }).getByRole('button', { name: 'ใช้ธีมนี้' }).click()
    await expect(page.getByText('ใช้ธีม ชมพูพาสเทล แล้ว')).toBeVisible()
    await expect(page.locator('.preset-card.on').getByText('กำลังใช้ธีมนี้')).toBeVisible()
    await page.getByRole('tab', { name: 'สีหลัก' }).click()
    await expect(page.getByText('พื้นหลังหลัก')).toBeVisible()
    await expect(page.locator('label').filter({ hasText: 'พื้นหลังหลัก' }).locator('input').last()).toHaveValue('#fbf4f1')
    await page.getByRole('button', { name: 'บันทึกทั้งหมด' }).click()
    await expect(page.getByText(/บันทึกแล้ว/)).toBeVisible()
    await page.goto('/default/booking-site')
    await expect(page.locator('.booking-site')).toBeVisible()
    const bg = await page.locator('.booking-site').evaluate((el) => getComputedStyle(el).getPropertyValue('--bg').trim())
    expect(bg.toLowerCase()).toBe('#fbf4f1')
    await page.goto('/default/booking-site/admin')
    await page.locator('aside').getByRole('button', { name: 'ธีมสี' }).click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'รีเซ็ตกลับเป็นธีมเริ่มต้น' }).click()
    await page.getByRole('button', { name: 'บันทึกทั้งหมด' }).click()
    await expect(page.getByText(/บันทึกแล้ว/)).toBeVisible()
  })

  test('booking site hero can toggle date and booking bar per slide', async ({ page }) => {
    await page.getByRole('button', { name: 'แก้ไขเว็บไซต์' }).click()
    await expect(page).toHaveURL(/\/default\/booking-site\/admin$/)
    await page.locator('aside').getByRole('button', { name: 'Hero (สไลด์หน้าแรก)' }).click()
    await expect(page.getByRole('heading', { name: 'Hero (สไลด์หน้าแรก)' })).toBeVisible()
    await expect(page.getByText('แสดงแถบเลือกวันและจองคิว').first()).toBeVisible()

    await page.goto('/default/booking-site')
    await expect(page.getByLabel('เลือกวัน')).toBeVisible()
    await expect(page.locator('.bar .go')).toBeVisible()
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

  test('new shop form lists five type presets', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ตั้งค่า' }).click()
    await page.getByRole('navigation', { name: 'หัวข้อตั้งค่า' }).getByRole('button', { name: 'ร้าน / สาขา' }).click()
    const presetSelect = page.locator('#settings-shops').getByLabel('เทมเพลตร้าน')
    await expect(presetSelect).toBeVisible()
    await expect(presetSelect.locator('option[value="nails"]')).toHaveCount(1)
    await expect(presetSelect.locator('option[value="hair"]')).toHaveCount(1)
    await expect(presetSelect.locator('option[value="lashes"]')).toHaveCount(1)
    await expect(presetSelect.locator('option[value="brows"]')).toHaveCount(1)
    await expect(presetSelect.locator('option[value="spa"]')).toHaveCount(1)
  })

  test('deposit full-payment toggle saves immediately', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ตั้งค่า' }).click()
    await page.getByRole('navigation', { name: 'หัวข้อตั้งค่า' }).getByRole('button', { name: 'มัดจำ' }).click()
    const section = page.locator('#settings-deposit')
    const toggle = section.getByRole('switch', { name: 'ชำระเต็มจำนวนตามราคาบริการ' })
    await expect(toggle).toBeVisible()
    const was = await toggle.isChecked()
    await toggle.click()
    await expect(section.locator('label.admin-switch').getByText('บันทึกแล้ว')).toBeVisible({ timeout: 10000 })
    await toggle.click()
    await expect(toggle).toBeChecked({ checked: was, timeout: 10000 })
  })

  test('deposit amount saves on blur', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ตั้งค่า' }).click()
    await page.getByRole('navigation', { name: 'หัวข้อตั้งค่า' }).getByRole('button', { name: 'มัดจำ' }).click()
    const section = page.locator('#settings-deposit')
    const toggle = section.getByRole('switch', { name: 'ชำระเต็มจำนวนตามราคาบริการ' })
    if (await toggle.isChecked()) {
      await toggle.click()
      await expect(section.locator('label.admin-switch').getByText('บันทึกแล้ว')).toBeVisible({ timeout: 10000 })
    }
    const input = section.getByRole('spinbutton', { name: 'ยอดมัดจำ (บาท)' })
    await expect(input).toBeEnabled()
    const amountRow = section.locator('.admin-form-row')
    const original = await input.inputValue()
    const next = original === '301' ? '302' : '301'
    await input.fill(next)
    await expect(amountRow.getByText('บันทึกแล้ว')).toHaveCount(0)
    await input.blur()
    await expect(amountRow.getByText('บันทึกแล้ว')).toBeVisible({ timeout: 10000 })

    await page.reload()
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'ตั้งค่า' }).click()
    await page.getByRole('navigation', { name: 'หัวข้อตั้งค่า' }).getByRole('button', { name: 'มัดจำ' }).click()
    await expect(input).toHaveValue(next)

    await input.fill(original)
    await input.blur()
    await expect(input).toHaveValue(original, { timeout: 10000 })
  })

  test('UI tab shows a floating save bar only while edits are unsaved', async ({ page }) => {
    await page.getByRole('navigation', { name: 'เมนูแอดมิน' }).getByRole('button', { name: 'UI' }).click()
    const field = page.locator('#settings-ui').getByRole('textbox', { name: 'ชื่อแบรนด์ (ส่วนหลัก)' })
    await expect(field).toBeVisible()
    const original = await field.inputValue()
    const bar = page.locator('.admin-ui-dirty-bar')
    await expect(bar).toHaveCount(0)

    await field.fill(`${original}x`)
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('มีการแก้ไขที่ยังไม่บันทึก')
    await expect(bar).toBeInViewport()

    await bar.getByRole('button', { name: 'ยกเลิก' }).click()
    await expect(bar).toHaveCount(0)
    await expect(field).toHaveValue(original)
  })

  test('booking calendar shows location color legend', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'จัดการคิวตามวัน' })).toBeVisible()
    await expect(page.getByText('สีพื้นช่องวัน = สถานที่ให้บริการ ไม่ใช่สถานะคิว')).toBeVisible()
  })
})

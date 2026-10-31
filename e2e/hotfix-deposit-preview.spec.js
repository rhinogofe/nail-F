import { test, expect } from '@playwright/test'
import { openSettingsSection } from './helpers/adminSettings.js'

test('deposit preview shows the saved amount, not a draft or an out-of-range value', async ({ page }) => {
  await openSettingsSection(page, 'มัดจำ')
  const section = page.locator('#settings-deposit')
  const toggle = section.getByRole('switch', { name: 'ชำระเต็มจำนวนตามราคาบริการ' })
  if (await toggle.isChecked()) {
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await expect(section.locator('label.admin-switch').getByText('บันทึกแล้ว')).toBeVisible({ timeout: 8000 })
  }

  const input = section.getByRole('spinbutton', { name: 'ยอดมัดจำ (บาท)' })
  const saved = await input.inputValue()
  const savedText = Number(saved).toLocaleString('th-TH')
  const preview = section.locator('.shop-hours-preview')
  const showsSaved = new RegExp(`มัดจำ\\s*${savedText.replace(/[,.]/g, '\\$&')}\\s*บาท`)
  await expect(preview).toHaveText(showsSaved)

  await input.fill('777')
  await expect(preview).toHaveText(showsSaved)

  await input.fill('0')
  await input.blur()
  const error = section.getByText('ยอดมัดจำต้องมากกว่า 0')
  await expect(error).toBeVisible()
  await expect(preview).toHaveText(showsSaved)

  const inputBox = await input.boundingBox()
  const errorBox = await error.boundingBox()
  expect(errorBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height - 1)

  await input.fill(saved)
  await input.blur()
  await expect(error).toHaveCount(0)
})

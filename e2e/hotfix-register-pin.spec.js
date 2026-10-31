import { test, expect } from '@playwright/test'
import { openSettingsSection } from './helpers/adminSettings.js'

const URL = '/api/admin/settings/register-pin'

test.describe('Register-shop PIN', () => {
  let patches

  test.beforeEach(async ({ page }) => {
    patches = []
    // Never touch the real PIN: the register-shop flow in other tests depends on it.
    await page.route(`**${URL}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      const body = route.request().postDataJSON()
      patches.push(body)
      return route.fulfill({ json: { success: true, pin: body.pin, configured: /^\d{4}$/.test(body.pin) } })
    })
    await openSettingsSection(page, 'รหัสสร้างร้านค้า')
  })

  test('clearing the PIN asks first; cancelling restores it without calling the API', async ({ page }) => {
    const section = page.locator('#settings-register-pin')
    const input = section.getByRole('textbox', { name: 'รหัส 4 หลัก' })
    const saved = await input.inputValue()
    expect(saved).toMatch(/^\d{4}$/)
    // The router closes any SweetAlert for 1s after each navigation (scheduleOverlayCleanup);
    // a real admin never clears the PIN that fast, so wait it out instead of racing it.
    await page.waitForTimeout(1100)

    await input.fill('')
    await input.blur()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('ปิดรับสมัครร้านใหม่?')
    await dialog.getByRole('button', { name: 'ยกเลิก' }).click()

    await expect(input).toHaveValue(saved)
    expect(patches).toHaveLength(0)

    await input.fill('')
    await input.blur()
    await expect(dialog).toContainText('ปิดรับสมัครร้านใหม่?')
    await dialog.getByRole('button', { name: 'ปิดรับสมัคร' }).click()
    await expect.poll(() => patches.length).toBe(1)
    expect(patches[0]).toEqual({ pin: '' })
  })

  test('a PIN shorter than 4 digits is still not saved', async ({ page }) => {
    const section = page.locator('#settings-register-pin')
    const input = section.getByRole('textbox', { name: 'รหัส 4 หลัก' })
    await input.fill('12')
    await input.blur()
    await expect(section.getByText('รหัสต้องเป็นตัวเลข 4 หลัก')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(patches).toHaveLength(0)
  })
})

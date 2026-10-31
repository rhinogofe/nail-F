import { test, expect } from '@playwright/test'
import { adminApi, delayFirstPatch, openSettingsSection, trackPatches } from './helpers/adminSettings.js'

const URL = '/api/admin/settings/unpaid-auto-cancel'

test.describe('Auto-cancel settings (switch + hours)', () => {
  let original

  test.beforeEach(async ({ page }) => {
    await page.goto('/default/admin')
    original = (await adminApi(page, 'GET', URL)).data
    await adminApi(page, 'PATCH', URL, { enabled: true, expire_hours: 24 })
    await openSettingsSection(page, 'ยกเลิกอัตโนมัติ')
  })

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    if (original) await adminApi(page, 'PATCH', URL, original)
  })

  test('latest action wins when the hours save is slow and the switch is flipped right after', async ({ page }) => {
    const section = page.locator('#settings-unpaid')
    const toggle = section.getByRole('switch', { name: 'เปิดยกเลิกอัตโนมัติ' })
    const hours = section.getByRole('spinbutton', { name: 'ยกเลิกหลัง (ชั่วโมง)' })
    await expect(toggle).toBeChecked()
    await expect(hours).toHaveValue('24')

    const patches = trackPatches(page, URL)
    await delayFirstPatch(page, `**${URL}`)
    await hours.fill('48')
    await hours.blur()
    await toggle.click()

    await expect.poll(() => patches.settled, { timeout: 8000 }).toBe(2)
    expect((await adminApi(page, 'GET', URL)).data).toEqual({ enabled: false, expire_hours: 48 })
    await expect(toggle).not.toBeChecked()
    await expect(hours).toHaveValue('48')
  })

  test('requests from this form never overlap', async ({ page }) => {
    const section = page.locator('#settings-unpaid')
    const toggle = section.getByRole('switch', { name: 'เปิดยกเลิกอัตโนมัติ' })
    const hours = section.getByRole('spinbutton', { name: 'ยกเลิกหลัง (ชั่วโมง)' })

    const patches = trackPatches(page, URL)
    let inFlight = 0
    let maxInFlight = 0
    await page.route(`**${URL}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 600))
      await route.continue()
      inFlight -= 1
    })

    await hours.fill('36')
    await hours.blur()
    await toggle.click()

    await expect.poll(() => patches.settled, { timeout: 8000 }).toBe(2)
    expect(maxInFlight).toBe(1)
    expect((await adminApi(page, 'GET', URL)).data).toEqual({ enabled: false, expire_hours: 36 })
  })
})

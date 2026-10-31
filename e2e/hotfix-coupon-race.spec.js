import { test, expect } from '@playwright/test'
import { adminApi, delayFirstPatch, openSettingsSection, trackPatches } from './helpers/adminSettings.js'

const URL = '/api/admin/settings/coupon'
const START = { discount_percent: 20, required_points: 100, completion_points: 10, manual_completion_points: false }

function couponFields(page) {
  const section = page.locator('#settings-coupon')
  const fieldLabel = (text) => section.locator('label').filter({ hasText: text })
  return {
    section,
    discount: section.getByRole('spinbutton', { name: 'ส่วนลด (%)' }),
    points: section.getByRole('spinbutton', { name: 'แต้มที่ใช้แลก' }),
    discountLabel: fieldLabel('ส่วนลด (%)'),
    pointsLabel: fieldLabel('แต้มที่ใช้แลก'),
  }
}

test.describe('Coupon settings (one form, several fields)', () => {
  let original

  test.beforeEach(async ({ page }) => {
    await page.goto('/default/admin')
    const current = (await adminApi(page, 'GET', URL)).data
    original = current && {
      discount_percent: current.discount_percent,
      required_points: current.required_points,
      completion_points: current.completion_points,
      manual_completion_points: current.manual_completion_points,
    }
    await adminApi(page, 'PATCH', URL, START)
    await openSettingsSection(page, 'คูปองแลกแต้ม')
  })

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    if (original) await adminApi(page, 'PATCH', URL, original)
  })

  test('a slow save of one field does not overwrite a later field on the server', async ({ page }) => {
    const { discount, points } = couponFields(page)
    await expect(discount).toHaveValue('20')

    const patches = trackPatches(page, URL)
    await delayFirstPatch(page, `**${URL}`)
    await discount.fill('30')
    await discount.blur()
    await points.fill('150')
    await points.blur()

    await expect.poll(() => patches.settled, { timeout: 8000 }).toBe(2)
    const settled = (await adminApi(page, 'GET', URL)).data
    expect([settled.discount_percent, settled.required_points]).toEqual([30, 150])
  })

  test('an out-of-range value in another field is not sent and the error stays on that field', async ({ page }) => {
    const { discount, points, discountLabel, pointsLabel } = couponFields(page)

    await points.fill('0')
    await points.blur()
    await expect(pointsLabel.getByText('แต้มที่ใช้แลกต้องมากกว่า 0')).toBeVisible()

    const sent = []
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().endsWith(URL)) sent.push(req.postDataJSON())
    })
    await discount.fill('25')
    await discount.blur()

    await expect(discountLabel.getByText('บันทึกแล้ว')).toBeVisible({ timeout: 8000 })
    await expect(pointsLabel.getByText('แต้มที่ใช้แลกต้องมากกว่า 0')).toBeVisible()
    expect(sent.every((body) => body.required_points !== 0)).toBe(true)
    const server = (await adminApi(page, 'GET', URL)).data
    expect([server.discount_percent, server.required_points]).toEqual([25, 100])
  })

  test('a failed save restores only the field that changed, not one saved meanwhile', async ({ page }) => {
    const { discount, points, discountLabel } = couponFields(page)

    const patches = trackPatches(page, URL)
    await delayFirstPatch(page, `**${URL}`, {
      respond: (route) => route.fulfill({ status: 500, json: { error: 'จำลองบันทึกไม่สำเร็จ' } }),
    })
    await discount.fill('40')
    await discount.blur()
    await points.fill('180')
    await points.blur()

    await expect.poll(() => patches.settled, { timeout: 8000 }).toBe(2)
    await expect(discountLabel.getByText('จำลองบันทึกไม่สำเร็จ')).toBeVisible()
    await expect(discount).toHaveValue('20')
    await expect(points).toHaveValue('180')
    expect((await adminApi(page, 'GET', URL)).data.discount_percent).toBe(20)
  })
})

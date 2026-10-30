import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('register shop loads PIN step and shop-type presets from config', async ({ page }) => {
  const configResponse = page.waitForResponse((res) => (
    res.url().includes('/api/auth/register-shop/config') && res.ok()
  ))
  await page.goto('/default/register-shop')
  await expect(page.getByRole('heading', { name: 'รหัสสร้างร้าน' })).toBeVisible()
  const config = await (await configResponse).json()
  expect(config.enabled).toBeTruthy()
  expect(config.presets.map((item) => item.key)).toEqual(['nails', 'hair', 'lashes', 'brows', 'spa'])
  await expect(page.getByRole('heading', { name: 'ประเภทร้าน' })).toHaveCount(0)
})

test('register shop preset picker seeds starter services', async ({ page }) => {
  await page.route('**/api/auth/verify-register-pin', async (route) => {
    await route.fulfill({ json: { success: true } })
  })
  await page.route('**/api/auth/register-shop-owner', async (route) => {
    await route.fulfill({ json: { token: 'register-test-token' } })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      json: {
        id: 'user-1',
        name: 'ทดสอบ',
        is_admin: false,
        is_super_admin: false,
        admin_shop_slug: null,
        managed_shop_slugs: [],
      },
    })
  })

  await page.goto('/default/register-shop')
  await page.locator('.register-pin-input').fill('1234')
  await page.getByRole('button', { name: 'ถัดไป' }).click()

  await expect(page.getByRole('heading', { name: 'ข้อมูลเจ้าของร้าน' })).toBeVisible()
  await page.getByPlaceholder('ชื่อ-นามสกุล').fill('สมชาย ทดสอบ')
  await page.getByPlaceholder('0812345678').fill('0812345678')
  await page.getByRole('button', { name: 'ถัดไป' }).click()

  await expect(page.getByRole('heading', { name: 'ข้อมูลร้าน' })).toBeVisible()
  await page.getByRole('textbox', { name: 'ชื่อร้าน' }).fill('กอฟเทส 1!')
  await expect(page.locator('.register-slug-input')).toHaveValue('กอฟเทส-1')
  await page.getByRole('button', { name: 'ถัดไป' }).click()

  await expect(page.getByRole('heading', { name: 'ประเภทร้าน' })).toBeVisible()
  const nails = page.getByRole('option', { name: /ร้านทำเล็บ/ })
  const hair = page.getByRole('option', { name: /ร้านตัดผม/ })
  const lashes = page.getByRole('option', { name: /ร้านต่อขนตา/ })
  const brows = page.getByRole('option', { name: /ร้านคิ้ว/ })
  const spa = page.getByRole('option', { name: /ร้านสปา/ })
  await expect(nails).toBeVisible()
  await expect(hair).toBeVisible()
  await expect(lashes).toBeVisible()
  await expect(brows).toBeVisible()
  await expect(spa).toBeVisible()

  await hair.click()
  await expect(hair).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  await expect(page.getByRole('heading', { name: 'แบรนด์ & รูปภาพ' })).toBeVisible()
  const brandMain = page.getByRole('textbox', { name: 'ชื่อแบรนด์ (ส่วนหลัก)' })
  const brandAccent = page.getByRole('textbox', { name: 'ชื่อแบรนด์ (ส่วนเน้น)' })
  await expect(brandMain).not.toHaveValue('')
  await expect(brandAccent).not.toHaveValue('')
  const main = await brandMain.inputValue()
  const accent = await brandAccent.inputValue()
  expect(`${main}${accent}`.replace(/\s+/g, '')).toBe('กอฟเทส1')
})

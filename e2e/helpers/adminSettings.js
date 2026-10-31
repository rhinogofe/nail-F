import { expect } from '@playwright/test'

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL || 'http://localhost:3000'

/** Calls the admin API with the logged-in test admin's token (same auth the app uses). */
export async function adminApi(page, method, path, body) {
  return page.evaluate(async ({ apiBase, method, path, body }) => {
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'X-Shop-Slug': 'default',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  }, { apiBase: API_BASE, method, path, body })
}

export async function openSettingsSection(page, label) {
  await page.goto('/default/admin')
  const adminNav = page.getByRole('navigation', { name: 'เมนูแอดมิน' })
  await expect(adminNav).toBeVisible()
  await adminNav.getByRole('button', { name: 'ตั้งค่า' }).click()
  await page.getByRole('navigation', { name: 'หัวข้อตั้งค่า' }).getByRole('button', { name: label }).click()
}

/** Counts PATCH requests to `path` so a test can wait until every save the form sent has settled. */
export function trackPatches(page, path) {
  const state = { sent: 0, settled: 0 }
  const matches = (req) => req.method() === 'PATCH' && new URL(req.url()).pathname === path
  page.on('request', (req) => { if (matches(req)) state.sent += 1 })
  page.on('requestfinished', (req) => { if (matches(req)) state.settled += 1 })
  page.on('requestfailed', (req) => { if (matches(req)) state.settled += 1 })
  return state
}

/** Holds the first matching PATCH for `delayMs`, then lets it through (or answers it via `respond`). */
export async function delayFirstPatch(page, urlPattern, { delayMs = 1500, respond } = {}) {
  let held = false
  await page.route(urlPattern, async (route) => {
    if (route.request().method() !== 'PATCH' || held) return route.continue()
    held = true
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    if (respond) return respond(route)
    return route.continue()
  })
}

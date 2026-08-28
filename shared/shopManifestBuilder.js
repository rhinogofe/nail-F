export const DEFAULT_APP_NAME = 'Nail Thuean'
export const MANIFEST_THEME = '#FAF6F3'
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const MANIFEST_ICONS = [
  {
    src: '/icon-192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: '/icon-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: '/icon-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  },
]

export function parseManifestSlug(pathname) {
  const match = String(pathname || '').match(/^\/manifest\/([a-z0-9]+(?:-[a-z0-9]+)*)\.webmanifest$/i)
  if (!match) return null
  const slug = match[1].toLowerCase()
  return SLUG_RE.test(slug) ? slug : null
}

export function shopManifestPath(shopSlug) {
  const slug = String(shopSlug || '').trim().toLowerCase()
  if (!slug || !SLUG_RE.test(slug)) return '/manifest.webmanifest'
  return `/manifest/${slug}.webmanifest`
}

export function buildShopManifest(shopSlug, shopName) {
  const slug = String(shopSlug || '').trim().toLowerCase()
  const name = String(shopName || '').trim() || DEFAULT_APP_NAME
  return {
    name,
    short_name: name,
    description: `จองคิว ${name}`,
    start_url: `/${slug}/login`,
    scope: '/',
    display: 'standalone',
    background_color: MANIFEST_THEME,
    theme_color: MANIFEST_THEME,
    lang: 'th',
    icons: MANIFEST_ICONS,
  }
}

export function buildDefaultManifest() {
  return {
    name: DEFAULT_APP_NAME,
    short_name: DEFAULT_APP_NAME,
    description: 'จองคิวออนไลน์ ง่าย สะดวก',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: MANIFEST_THEME,
    theme_color: MANIFEST_THEME,
    lang: 'th',
    icons: MANIFEST_ICONS,
  }
}

export function manifestResponseHeaders() {
  return {
    'Content-Type': 'application/manifest+json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
  }
}

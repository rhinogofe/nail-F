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

export function logoIconVersion(logoUrl) {
  const logo = String(logoUrl || '').trim()
  if (!logo) return '0'
  const match = logo.match(/\/api\/bookings\/ui-images\/(?:logo|hero|kshop_qr)\/([^/?#]+)/i)
  if (match?.[1]) {
    return match[1].replace(/\.[^.]+$/, '').slice(0, 12)
  }
  let hash = 5381
  for (let i = 0; i < logo.length; i += 1) {
    hash = (hash * 33) ^ logo.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

export function normalizeApiBase(apiBase) {
  const raw = String(apiBase || '').trim().replace(/\/$/, '')
  if (!raw) return raw
  try {
    const url = new URL(raw)
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (!isLocal && url.protocol === 'http:') {
      url.protocol = 'https:'
    }
    return url.origin
  } catch {
    return raw
  }
}

export function shopIconUrl(apiBase, slug, size, version) {
  const base = normalizeApiBase(apiBase)
  const v = version != null && version !== '' ? `?v=${encodeURIComponent(String(version))}` : ''
  return `${base}/api/shops/${encodeURIComponent(slug)}/icon/${size}.png${v}`
}

export function buildShopManifestIcons(apiBase, slug, version) {
  return [
    {
      src: shopIconUrl(apiBase, slug, 192, version),
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: shopIconUrl(apiBase, slug, 512, version),
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: shopIconUrl(apiBase, slug, 512, version),
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ]
}

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

export function buildShopManifest(shopSlug, shopName, { apiBase, iconVersion } = {}) {
  const slug = String(shopSlug || '').trim().toLowerCase()
  const name = String(shopName || '').trim() || DEFAULT_APP_NAME
  const icons = apiBase
    ? buildShopManifestIcons(apiBase, slug, iconVersion ?? '0')
    : MANIFEST_ICONS
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
    icons,
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

import {
  DEFAULT_APP_NAME,
  logoIconVersion,
  shopIconUrl,
  shopManifestPath,
} from '../../shared/shopManifestBuilder.js'

export {
  shopManifestPath,
  logoIconVersion,
  shopIconUrl,
} from '../../shared/shopManifestBuilder.js'

function upsertLink(rel, attrs) {
  let link = document.querySelector(`link[rel="${rel}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) link.setAttribute(key, value)
  }
}

export function syncShopIcons({ shopSlug, iconVersion, apiBase } = {}) {
  if (typeof document === 'undefined') return

  const slug = String(shopSlug || '').trim().toLowerCase()
  if (!slug) return

  const base = String(
    apiBase || import.meta.env.VITE_API_BASE_URL || '',
  ).replace(/\/$/, '')
  if (!base) return

  const version = iconVersion ?? '0'
  upsertLink('icon', {
    type: 'image/png',
    sizes: '32x32',
    href: shopIconUrl(base, slug, 32, version),
  })
  upsertLink('apple-touch-icon', {
    sizes: '180x180',
    href: shopIconUrl(base, slug, 180, version),
  })
}

export function syncShopManifestLink({ shopSlug, shopName, iconVersion, apiBase } = {}) {
  // Client-side fallback — iOS Add to Home Screen reads the server-injected
  // manifest link from the initial HTML (Netlify app-shell edge function).
  if (typeof document === 'undefined') return

  const slug = String(shopSlug || '').trim().toLowerCase()
  const href = shopManifestPath(slug)

  let manifestLink = document.querySelector('link[rel="manifest"]')
  if (!manifestLink) {
    manifestLink = document.createElement('link')
    manifestLink.rel = 'manifest'
    document.head.appendChild(manifestLink)
  }
  if (manifestLink.getAttribute('href') !== href) {
    manifestLink.setAttribute('href', href)
  }

  const appTitle = slug
    ? (String(shopName || '').trim() || DEFAULT_APP_NAME)
    : DEFAULT_APP_NAME

  let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
  if (!appleTitle) {
    appleTitle = document.createElement('meta')
    appleTitle.name = 'apple-mobile-web-app-title'
    document.head.appendChild(appleTitle)
  }
  appleTitle.setAttribute('content', appTitle)

  if (slug) {
    syncShopIcons({ shopSlug: slug, iconVersion, apiBase })
  }
}

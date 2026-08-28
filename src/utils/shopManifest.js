import {
  DEFAULT_APP_NAME,
  shopManifestPath,
} from '../../shared/shopManifestBuilder.js'

export { shopManifestPath } from '../../shared/shopManifestBuilder.js'

export function syncShopManifestLink({ shopSlug, shopName } = {}) {
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
}

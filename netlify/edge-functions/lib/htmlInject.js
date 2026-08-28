const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Line\/|line-poker|Applebot/i

export const SHOP_APP_PATH_RE =
  /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(bookings|login|reviews|profile|chat|admin|location|payment|register-shop)(?:\/|$)/

const MANIFEST_LINK_RE =
  /<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"\s+id="app-manifest"\s*\/?>/i

const APPLE_TITLE_RE =
  /<meta\s+name="apple-mobile-web-app-title"\s+content="[^"]*"\s*\/?>/i

const SKIP_PATH_PREFIXES = ['/manifest/', '/assets/']
const SKIP_EXACT_PATHS = new Set([
  '/manifest.webmanifest',
  '/firebase-messaging-sw.js',
  '/version.json',
  '/favicon.svg',
  '/icons.svg',
])

export function isBotUserAgent(userAgent) {
  return BOT_UA.test(userAgent || '')
}

export function parseShopSlugFromPath(pathname) {
  const match = String(pathname || '').match(SHOP_APP_PATH_RE)
  return match ? match[1].toLowerCase() : null
}

export function shouldProcessAppShell(request) {
  const { pathname } = new URL(request.url)

  if (SKIP_EXACT_PATHS.has(pathname)) return false
  for (const prefix of SKIP_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return false
  }

  if (/\.[a-z0-9]+$/i.test(pathname) && !pathname.endsWith('.html')) {
    return false
  }

  const accept = request.headers.get('accept') || ''
  const ua = request.headers.get('user-agent') || ''
  if (!accept.includes('text/html') && !isBotUserAgent(ua)) {
    return false
  }

  return Boolean(parseShopSlugFromPath(pathname))
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

export function injectShopManifest(html, shopSlug, shopName) {
  const slug = String(shopSlug || '').trim().toLowerCase()
  const title = escapeHtml(String(shopName || slug).trim() || slug)
  const manifestLink =
    `<link rel="manifest" href="/manifest/${slug}.webmanifest" id="app-manifest" />`

  let next = html.replace(MANIFEST_LINK_RE, manifestLink)
  next = next.replace(
    APPLE_TITLE_RE,
    `<meta name="apple-mobile-web-app-title" content="${title}" />`,
  )
  return next
}

export function injectShareMeta(html, meta, pageUrl) {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const url = escapeHtml(meta.url || pageUrl)
  const tags = [
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${url}">`,
  ]
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}">`)
  }

  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  next = next.replace(/<meta[^>]+(?:name="description"|property="og:[^"]+")[^>]*>\s*/gi, '')
  next = next.replace(/<\/title>/i, `</title>\n    ${tags.join('\n    ')}`)
  return next
}

export function appShellCacheControl(isBot) {
  return isBot ? 'public, max-age=300' : 'no-store, no-cache, must-revalidate, max-age=0'
}

export function apiBaseUrl() {
  return (
    Deno.env.get('API_BASE_URL') ||
    Deno.env.get('VITE_API_BASE_URL') ||
    'https://nail-b.onrender.com'
  ).replace(/\/$/, '')
}

async function fetchShopName(slug, base) {
  try {
    const res = await fetch(`${base}/api/shops/${encodeURIComponent(slug)}`)
    if (!res.ok) return slug
    const shop = await res.json()
    const name = String(shop?.name || '').trim()
    return name || slug
  } catch {
    return slug
  }
}

export async function buildShopAppShellHtml(request, { isBot = false } = {}) {
  const slug = parseShopSlugFromPath(new URL(request.url).pathname)
  if (!slug) return null

  const base = apiBaseUrl()
  const htmlPromise = fetch(new URL('/index.html', request.url))
  const shopNamePromise = fetchShopName(slug, base)
  const previewPromise = isBot
    ? fetch(`${base}/api/shops/${encodeURIComponent(slug)}/share-preview`)
    : Promise.resolve(null)

  const [htmlRes, shopName, previewRes] = await Promise.all([
    htmlPromise,
    shopNamePromise,
    previewPromise,
  ])

  if (!htmlRes.ok) return null

  let html = injectShopManifest(await htmlRes.text(), slug, shopName)

  if (isBot && previewRes?.ok) {
    html = injectShareMeta(html, await previewRes.json(), request.url)
  }

  return html
}

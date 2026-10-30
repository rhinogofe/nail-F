export const SLUG_RE = /^[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u
export const MAX_SLUG_LENGTH = 80
export const RESERVED_SHOP_SLUGS = new Set([
  'default',
  'api',
  'assets',
  'manifest',
  'bookings',
  'login',
  'admin',
  'register-shop',
  'reviews',
  'profile',
  'chat',
  'location',
  'payment',
  'booking-site',
  'shops',
  'presets',
  'auth',
  'icons',
  'favicon',
])

export function slugifyShopName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')
}

export function isShopSlugFormat(slug) {
  const s = String(slug || '').trim()
  if (!s || s.length > MAX_SLUG_LENGTH) return false
  return SLUG_RE.test(s)
}

export function isCreatableShopSlug(slug) {
  const s = String(slug || '').trim()
  if (!isShopSlugFormat(s)) return false
  return !RESERVED_SHOP_SLUGS.has(s.toLowerCase())
}

export function encodeShopSlugHeader(slug) {
  const s = String(slug || '').trim()
  if (!s) return ''
  return encodeURIComponent(s)
}

function graphemes(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text)].map(
      (part) => part.segment,
    )
  }
  return Array.from(text)
}

export function splitBrandName(value) {
  const text = String(value || '')
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return { main: '', accent: '' }
  const words = text.split(' ').filter(Boolean)
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2)
    return {
      main: words.slice(0, mid).join(' '),
      accent: words.slice(mid).join(' '),
    }
  }
  const chars = graphemes(text)
  if (chars.length < 2) return { main: text, accent: text }
  const mid = Math.ceil(chars.length / 2)
  return {
    main: chars.slice(0, mid).join(''),
    accent: chars.slice(mid).join(''),
  }
}

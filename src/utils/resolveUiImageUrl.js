export function resolveUiImageUrl(url, shopSlug) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return u
  if (u.startsWith('/api/bookings/ui-images/')) {
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
    const slug = shopSlug || localStorage.getItem('shopSlug') || 'default'
    const params = new URLSearchParams({ shop: slug })
    return `${base}${u}?${params.toString()}`
  }
  return u
}

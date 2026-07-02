export function clipThumbnailSrc(clipId) {
  if (!clipId) return ''
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const token = localStorage.getItem('token') || ''
  const params = new URLSearchParams()
  if (token) params.set('token', token)
  const qs = params.toString()
  return `${base}/api/reviews/clips/${clipId}/thumbnail${qs ? `?${qs}` : ''}`
}

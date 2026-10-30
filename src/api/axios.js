import axios from 'axios'
import { encodeShopSlugHeader, isShopSlugFormat } from '../utils/shopSlug'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
})

function shopSlugFromUrl() {
  if (typeof window === 'undefined') return ''
  const segment = String(window.location.pathname || '')
    .split('/')
    .filter(Boolean)[0] || ''
  let slug = segment.trim().toLowerCase()
  try {
    slug = decodeURIComponent(segment).trim().toLowerCase()
  } catch {
    slug = segment.trim().toLowerCase()
  }
  return isShopSlugFormat(slug) ? slug : ''
}

function resolveShopSlug() {
  const fromStorage = String(localStorage.getItem('shopSlug') || '').trim().toLowerCase()
  if (fromStorage && isShopSlugFormat(fromStorage)) return fromStorage

  const fromUrl = shopSlugFromUrl()
  if (fromUrl) {
    localStorage.setItem('shopSlug', fromUrl)
    return fromUrl
  }
  return ''
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const shopSlug = resolveShopSlug()
  const headers = config.headers || {}
  const existingShopSlug =
    headers['X-Shop-Slug']
    ?? (typeof headers.get === 'function' ? headers.get('X-Shop-Slug') : undefined)
  // Per-request slug (e.g. super admin editing another branch) must win over storage/URL.
  if (shopSlug && (existingShopSlug == null || existingShopSlug === '')) {
    if (typeof headers.set === 'function') {
      headers.set('X-Shop-Slug', encodeShopSlugHeader(shopSlug))
    } else {
      headers['X-Shop-Slug'] = encodeShopSlugHeader(shopSlug)
    }
    config.headers = headers
  }
  return config
})

export default api

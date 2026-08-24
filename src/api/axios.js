import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const shopSlug = localStorage.getItem('shopSlug')
  const headers = config.headers || {}
  const existingShopSlug =
    headers['X-Shop-Slug']
    ?? (typeof headers.get === 'function' ? headers.get('X-Shop-Slug') : undefined)
  // Per-request slug (e.g. super admin editing another branch) must win over localStorage.
  if (shopSlug && (existingShopSlug == null || existingShopSlug === '')) {
    if (typeof headers.set === 'function') {
      headers.set('X-Shop-Slug', shopSlug)
    } else {
      headers['X-Shop-Slug'] = shopSlug
    }
    config.headers = headers
  }
  return config
})

export default api

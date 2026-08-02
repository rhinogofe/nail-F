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
  if (shopSlug) {
    config.headers['X-Shop-Slug'] = shopSlug
  }
  return config
})

export default api

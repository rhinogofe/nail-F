import api from '../api/axios'
import { compressImage } from '../utils/compressChatImage'

export function apiOrigin() {
  return (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function img(u) {
  if (!u) return u
  if (/^https?:\/\//i.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return u
  if (u.startsWith('/api/')) return apiOrigin() + u
  return u
}

export function bookingLink(base, o = {}) {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const u = new URL(base || '/', origin)
    for (const [k, v] of Object.entries(o)) {
      if (v == null || v === '') continue
      u.searchParams.set(k, v)
    }
    return u.toString()
  } catch {
    return base
  }
}

export async function getPublicContent(slug) {
  const { data } = await api.get(`/api/shops/${encodeURIComponent(slug)}/booking-site`)
  return data
}

export async function getContent() {
  const { data } = await api.get('/api/admin/booking-site')
  return data
}

export async function saveContent(content) {
  const { data } = await api.put('/api/admin/booking-site', content)
  return data
}

export async function listImages(folder) {
  const { data } = await api.get(`/api/admin/booking-site/images/${encodeURIComponent(folder)}`)
  return data
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

async function filePayload(file) {
  if (file.size <= 1.4 * 1024 * 1024 && /^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
    const dataUrl = await readAsDataUrl(file)
    const base64 = dataUrl.split(',')[1] || ''
    return { image_data: base64, image_mime: file.type }
  }
  const { base64, mime } = await compressImage(file, { maxWidth: 1920, quality: 0.84 })
  return { image_data: base64, image_mime: mime }
}

export async function upload(file, folder) {
  const payload = await filePayload(file)
  const { data } = await api.post(
    `/api/admin/booking-site/upload/${encodeURIComponent(folder)}`,
    payload,
  )
  return data
}

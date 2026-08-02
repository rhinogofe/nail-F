/** ImgBB page URLs (ibb.co/xxx) are HTML pages, not image files */
export function isDirectImageUrl(url) {
  const u = String(url || '').trim()
  if (!u) return false
  if (/^https?:\/\/i\.ibb\.co\//i.test(u)) return true
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) return true
  if (u.startsWith('/') && !u.startsWith('//')) return true
  if (/^https?:\/\/.+/i.test(u) && !/ibb\.co\/[^/?#]+$/i.test(u)) return true
  return false
}

export function imageUrlHint(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (/^https?:\/\/ibb\.co\//i.test(u) && !/^https?:\/\/i\.ibb\.co\//i.test(u)) {
    return 'ลิงก์ ibb.co เป็นหน้าเว็บ — ใช้ Direct link จาก ImgBB (ขึ้นต้น i.ibb.co หรือลงท้าย .jpg/.png)'
  }
  if (!isDirectImageUrl(u)) {
    return 'URL อาจไม่ใช่ลิงก์รูปโดยตรง — ลอง copy "Image link" / BBCode direct จาก ImgBB'
  }
  return ''
}

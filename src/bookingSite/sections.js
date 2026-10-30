export const defaultNav = [
  { section: 'top', label: 'หน้าแรก', show: true },
  { section: 'rooms', label: 'บริการ', show: true },
  { section: 'news', label: 'รีวิว', show: true },
  { section: 'promo', label: 'โปรโมชั่น', show: true },
  { section: 'dining', label: 'บรรยากาศ', show: false },
  { section: 'about', label: 'ที่อยู่ร้าน', show: true },
  { section: 'book', label: 'จองเลย', show: true },
  { section: 'contact', label: 'ติดต่อ', show: false }
]

export const navSectionOptions = [
  ['top', 'หน้าแรก'],
  ['rooms', 'บริการ (การ์ด)'],
  ['news', 'รีวิว'],
  ['promo', 'โปรโมชั่น'],
  ['about', 'ที่อยู่ร้าน'],
  ['book', 'จองเลย (ลิงก์จอง)'],
  ['dining', 'บรรยากาศ / สิ่งอำนวยความสะดวก'],
  ['contact', 'ติดต่อ (ท้ายหน้า)']
]

const hash = { top: 'top', about: 'about', rooms: 'rooms', promo: 'promo', dining: 'dining', news: 'news', contact: 'contact' }

export function isSectionVisible(c, section, showImg) {
  if (!c) return false
  switch (section) {
    case 'about':
      return !!(String(c.about?.title || '').trim() || String(c.about?.text || '').trim() || String(c.site?.address || '').trim() || c.about?.mapUrl || c.location?.mapUrl || (showImg(c.about) && c.about?.image))
    case 'rooms':
      return (c.rooms?.length || 0) > 0
    case 'promo':
      return (c.promos?.length || 0) > 0
    case 'dining':
      return !!(String(c.dining?.title || '').trim() || String(c.dining?.text || '').trim() || showImg(c.dining))
    case 'news':
      return (c.news?.length || 0) > 0
    case 'contact':
      return true
    case 'top':
      return true
    case 'book':
      return !!c.site?.bookingUrl
    default:
      return false
  }
}

export function navHref(section) {
  return hash[section] ? '#' + hash[section] : null
}

export const PAGE_SECTIONS = ['rooms', 'news', 'promo', 'dining', 'about']

/** ลำดับส่วนบนหน้า — ตามเมนูหัวเว็บ (รายการที่ไม่ใช่ส่วนเนื้อหา จะข้าม) */
export function pageSectionOrder(nav, fallback = defaultNav) {
  const list = nav?.length ? nav : fallback
  const out = []
  const seen = new Set()
  const hidden = new Set(list.filter(n => n.show === false).map(n => n.section))
  for (const n of list) {
    if (PAGE_SECTIONS.includes(n.section) && n.show !== false && !seen.has(n.section)) {
      out.push(n.section)
      seen.add(n.section)
    }
  }
  for (const s of PAGE_SECTIONS) {
    if (!seen.has(s) && !hidden.has(s)) out.push(s)
  }
  return out
}

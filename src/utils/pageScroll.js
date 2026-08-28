const PAGE_SCROLL_ROOT_SELECTOR = '.app-page, .admin-page'

export function getPageScrollElement() {
  if (typeof document === 'undefined') return null
  return document.querySelector(PAGE_SCROLL_ROOT_SELECTOR)
}

export function resetPageScroll() {
  const el = getPageScrollElement()
  if (el) {
    el.scrollTop = 0
    el.scrollLeft = 0
    return
  }
  if (typeof window !== 'undefined') {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}

export function getPageScrollTop() {
  const el = getPageScrollElement()
  if (el) return el.scrollTop
  if (typeof window === 'undefined') return 0
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

export { PAGE_SCROLL_ROOT_SELECTOR }

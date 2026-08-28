import { getPageScrollElement } from './pageScroll'

const LOCK_CLASS = 'app-scroll-locked'
const PAGE_LOCK_CLASS = 'page-scroll-locked'

let lockCount = 0
let savedScrollY = 0
let lockedPageEl = null

export function lockBodyScroll() {
  if (typeof document === 'undefined') return
  lockCount += 1
  if (lockCount > 1) return

  lockedPageEl = getPageScrollElement()
  if (lockedPageEl) {
    savedScrollY = lockedPageEl.scrollTop
    lockedPageEl.classList.add(PAGE_LOCK_CLASS)
    return
  }

  savedScrollY = window.scrollY || window.pageYOffset || 0
  document.body.style.top = `-${savedScrollY}px`
  document.body.classList.add(LOCK_CLASS)
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) return
  lockCount -= 1
  if (lockCount > 0) return

  if (lockedPageEl) {
    lockedPageEl.classList.remove(PAGE_LOCK_CLASS)
    lockedPageEl.scrollTop = savedScrollY
    lockedPageEl = null
    savedScrollY = 0
    return
  }

  document.body.classList.remove(LOCK_CLASS)
  document.body.style.removeProperty('top')
  window.scrollTo(0, savedScrollY)
  savedScrollY = 0
}

export function releaseAllBodyScrollLocks() {
  if (typeof document === 'undefined') return
  lockCount = 0
  if (lockedPageEl) {
    lockedPageEl.classList.remove(PAGE_LOCK_CLASS)
    lockedPageEl = null
  }
  document.body.classList.remove(LOCK_CLASS)
  document.body.style.removeProperty('top')
  savedScrollY = 0
}

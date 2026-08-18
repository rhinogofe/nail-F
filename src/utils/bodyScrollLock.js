const LOCK_CLASS = 'app-scroll-locked'

let lockCount = 0
let savedScrollY = 0

export function lockBodyScroll() {
  if (typeof document === 'undefined') return
  lockCount += 1
  if (lockCount > 1) return

  savedScrollY = window.scrollY || window.pageYOffset || 0
  document.body.style.top = `-${savedScrollY}px`
  document.body.classList.add(LOCK_CLASS)
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) return
  lockCount -= 1
  if (lockCount > 0) return

  document.body.classList.remove(LOCK_CLASS)
  document.body.style.removeProperty('top')
  window.scrollTo(0, savedScrollY)
}

export function releaseAllBodyScrollLocks() {
  if (typeof document === 'undefined') return
  lockCount = 0
  document.body.classList.remove(LOCK_CLASS)
  document.body.style.removeProperty('top')
}

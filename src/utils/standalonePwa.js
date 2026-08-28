/** True when opened from Home Screen / installed PWA (not in Safari browser chrome). */
export function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

/** Dev-only helper — call from browser console: `window.__debugStandalonePwa()` */
export function debugStandalonePwa() {
  if (!import.meta.env.DEV) return isStandalonePwa()
  const standalone = isStandalonePwa()
  console.info('[PWA] standalone:', standalone, {
    displayMode: window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone: window.navigator.standalone === true,
  })
  return standalone
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__debugStandalonePwa = debugStandalonePwa
}

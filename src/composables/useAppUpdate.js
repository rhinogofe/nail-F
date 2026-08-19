import { onMounted, onUnmounted, ref } from 'vue'

const POLL_INTERVAL_MS = 5 * 60 * 1000
const INITIAL_CHECK_DELAY_MS = 30 * 1000
const VERSION_URL = '/version.json'
const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev'

export function useAppUpdate() {
  const updateAvailable = ref(false)
  let timer = null

  async function checkForUpdate() {
    if (import.meta.env.DEV || CURRENT_BUILD_ID === 'dev') return

    try {
      const res = await fetch(`${VERSION_URL}?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return

      const data = await res.json()
      if (data?.buildId && data.buildId !== CURRENT_BUILD_ID) {
        updateAvailable.value = true
      }
    } catch {
      // ignore transient network errors during polling
    }
  }

  function reload() {
    window.location.reload()
  }

  function onVisibilityChange() {
    if (!document.hidden && !updateAvailable.value) {
      checkForUpdate()
    }
  }

  onMounted(() => {
    if (import.meta.env.DEV || CURRENT_BUILD_ID === 'dev') return

    timer = setInterval(checkForUpdate, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    setTimeout(checkForUpdate, INITIAL_CHECK_DELAY_MS)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    updateAvailable,
    reload,
    checkForUpdate,
  }
}

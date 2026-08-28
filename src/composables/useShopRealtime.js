import { onUnmounted, unref, watch } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export function useShopRealtime({ enabled, shopSlug, auth = false, onChange }) {
  let source = null
  let debounceTimer = null

  function isEnabled() {
    return Boolean(unref(enabled))
  }

  function currentShop() {
    return String(unref(shopSlug) || localStorage.getItem('shopSlug') || '').trim()
  }

  function disconnect() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (source) {
      source.close()
      source = null
    }
  }

  function scheduleChange(event) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      onChange?.(event)
    }, 250)
  }

  function connect() {
    if (!isEnabled()) return
    disconnect()

    const shop = currentShop()
    if (!shop) return

    const url = new URL(
      auth ? `${API_BASE}/api/admin/bookings/events` : `${API_BASE}/api/bookings/events`
    )
    url.searchParams.set('shop', shop)
    if (auth) {
      const token = localStorage.getItem('token')
      if (!token) return
      url.searchParams.set('token', token)
    }

    source = new EventSource(url.toString())
    source.onmessage = (message) => {
      let payload = null
      try {
        payload = JSON.parse(message.data)
      } catch {
        payload = { type: 'updated' }
      }
      scheduleChange(payload)
    }
  }

  watch(
    () => [isEnabled(), currentShop()],
    ([active]) => {
      if (active) connect()
      else disconnect()
    },
    { immediate: true },
  )

  function onVisibilityChange() {
    if (!document.hidden && isEnabled()) connect()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    disconnect()
  })

  return { connect, disconnect }
}

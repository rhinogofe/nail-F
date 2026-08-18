import { onUnmounted, unref, watch } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export function useAdminBookingRealtime({ enabled, onChange }) {
  let source = null
  let debounceTimer = null

  function isEnabled() {
    return Boolean(unref(enabled))
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

  function scheduleChange() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      onChange?.()
    }, 250)
  }

  function connect() {
    if (!isEnabled()) return
    disconnect()

    const token = localStorage.getItem('token')
    const shop = localStorage.getItem('shopSlug')
    if (!token || !shop) return

    const url = new URL(`${API_BASE}/api/admin/bookings/events`)
    url.searchParams.set('shop', shop)
    url.searchParams.set('token', token)

    source = new EventSource(url.toString())
    source.onmessage = () => scheduleChange()
  }

  watch(
    enabled,
    (active) => {
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

import { ref, onMounted, onUnmounted } from 'vue'

export function useUnpaidCountdown(getSettings) {
  const nowMs = ref(Date.now())
  let timer = null

  function tick() {
    nowMs.value = Date.now()
  }

  function start() {
    stop()
    timer = setInterval(tick, 1000)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop()
      return
    }
    tick()
    start()
  }

  onMounted(() => {
    start()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  function getRemainingMs(createdAt) {
    const settings = typeof getSettings === 'function' ? getSettings() : getSettings?.value
    if (!settings?.enabled || !createdAt) return null
    const created = new Date(createdAt).getTime()
    if (Number.isNaN(created)) return null
    const hours = Number(settings.expireHours ?? settings.expire_hours ?? 24)
    const deadline = created + hours * 60 * 60 * 1000
    return Math.max(0, deadline - nowMs.value)
  }

  function formatRemaining(ms) {
    if (ms == null) return ''
    if (ms <= 0) return '00:00'
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  function countdownLabel(booking) {
    if (!booking || booking.status !== 'awaiting_payment') return ''
    const ms = getRemainingMs(booking.created_at)
    if (ms == null) return ''
    const time = formatRemaining(ms)
    return booking.is_mine ? `ชำระภายใน ${time}` : `ว่างใน ${time}`
  }

  function isExpired(createdAt) {
    const ms = getRemainingMs(createdAt)
    return ms != null && ms <= 0
  }

  return {
    nowMs,
    getRemainingMs,
    formatRemaining,
    countdownLabel,
    isExpired,
  }
}

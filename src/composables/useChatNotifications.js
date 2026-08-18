import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import { useShopStore } from '../stores/shop'
import {
  FCM_FOREGROUND_MESSAGE_EVENT,
  PUSH_DEVICE_STATUS_EVENT,
  getStoredFcmToken,
  showOsNotificationForChatItem,
} from '../utils/pushNotifications'

const POLL_MS = 12000
const POLL_MS_PUSH = 45000
const AUTO_DISMISS_MS = 2000

function getPollIntervalMs() {
  return getStoredFcmToken() ? POLL_MS_PUSH : POLL_MS
}

export function useChatNotifications() {
  const auth = useAuthStore()
  const shopStore = useShopStore()
  const route = useRoute()

  const notifications = ref([])
  const lastSeenAt = ref(null)
  const seenIds = ref(new Set())
  let pollTimer = null
  let pollInFlight = false
  const dismissTimers = new Map()

  const shopSlug = computed(
    () => route.params.shopSlug || localStorage.getItem('shopSlug') || 'default'
  )

  const isAdminForShop = computed(() => auth.canAccessShopAdmin(shopSlug.value))

  const isOnChatPage = computed(() => /\/chat$/.test(route.path))

  const activeChatUserId = computed(() => String(route.query.userId || ''))

  function shouldNotify(item) {
    if (isOnChatPage.value) {
      if (!isAdminForShop.value) return false
      if (activeChatUserId.value && item.user_id === activeChatUserId.value) return false
      if (activeChatUserId.value && item.related_user_id === activeChatUserId.value) return false
    }
    return true
  }

  function buildChatNotificationUrl(item) {
    const base = `/${shopSlug.value}/chat`
    if (isAdminForShop.value) {
      if (item.is_system_thread && item.user_id) {
        return `${base}?userId=${item.user_id}`
      }
      if (item.related_user_id) {
        return `${base}?userId=${item.related_user_id}`
      }
      if (item.user_id) {
        return `${base}?userId=${item.user_id}`
      }
      return base
    }
    if (item.user_id) {
      return `${base}?userId=${item.user_id}`
    }
    return base
  }

  function pushNotification(item) {
    if (seenIds.value.has(item.id)) return
    seenIds.value.add(item.id)

    const title = isAdminForShop.value
      ? (item.notification_title || item.user_name || 'ลูกค้า')
      : (shopStore.shopName || 'แอดมิน')

    notifications.value = [
      {
        id: item.id,
        user_id: item.user_id || null,
        related_user_id: item.related_user_id || null,
        is_system_thread: Boolean(item.is_system_thread),
        title,
        body: item.body,
        image_url: item.image_url,
        created_at: item.created_at,
      },
      ...notifications.value,
    ].slice(0, 5)

    const pushHandlesOs = Boolean(getStoredFcmToken())
    if (
      !pushHandlesOs
      && typeof Notification !== 'undefined'
      && Notification.permission === 'granted'
    ) {
      showOsNotificationForChatItem({
        title,
        body: item.body,
        url: buildChatNotificationUrl(item),
        messageId: item.id,
      })
    }

    if (dismissTimers.has(item.id)) {
      clearTimeout(dismissTimers.get(item.id))
    }
    dismissTimers.set(
      item.id,
      setTimeout(() => dismissNotification(item.id), AUTO_DISMISS_MS)
    )
  }

  function dismissNotification(id) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
    if (dismissTimers.has(id)) {
      clearTimeout(dismissTimers.get(id))
      dismissTimers.delete(id)
    }
  }

  function markBaselineNow() {
    lastSeenAt.value = new Date().toISOString()
  }

  async function pollNotifications() {
    if (!auth.isLoggedIn || pollInFlight) return
    if (typeof document !== 'undefined' && document.hidden) return

    pollInFlight = true
    try {
      const params = {}
      if (lastSeenAt.value) params.after = lastSeenAt.value

      const url = isAdminForShop.value
        ? '/api/admin/chat/notifications'
        : '/api/chat/notifications'

      const { data } = await api.get(url, { params })
      const rows = data || []
      if (!rows.length) return

      let latest = lastSeenAt.value
      const systemRows = []
      const otherRows = []
      for (const row of rows) {
        if (!latest || new Date(row.created_at) > new Date(latest)) {
          latest = row.created_at
        }
        if (!shouldNotify(row)) continue
        if (row.is_system_thread) systemRows.push(row)
        else otherRows.push(row)
      }
      if (systemRows.length) {
        otherRows.push(systemRows[systemRows.length - 1])
      }
      for (const row of otherRows) {
        pushNotification(row)
      }
      if (latest) lastSeenAt.value = latest
    } catch {
      /* ignore polling errors */
    } finally {
      pollInFlight = false
    }
  }

  function restartPollTimer() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    if (typeof document !== 'undefined' && document.hidden) return
    if (!auth.isLoggedIn) return
    pollTimer = setInterval(pollNotifications, getPollIntervalMs())
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
      return
    }
    window.setTimeout(() => {
      if (document.hidden || !auth.isLoggedIn) return
      pollNotifications()
      restartPollTimer()
    }, 400)
  }

  function onPushDeviceStatusChanged() {
    restartPollTimer()
  }

  function onFcmForegroundMessage() {
    pollNotifications()
  }

  onMounted(() => {
    markBaselineNow()
    pollNotifications()
    restartPollTimer()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener(PUSH_DEVICE_STATUS_EVENT, onPushDeviceStatusChanged)
    window.addEventListener(FCM_FOREGROUND_MESSAGE_EVENT, onFcmForegroundMessage)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener(PUSH_DEVICE_STATUS_EVENT, onPushDeviceStatusChanged)
    window.removeEventListener(FCM_FOREGROUND_MESSAGE_EVENT, onFcmForegroundMessage)
    if (pollTimer) clearInterval(pollTimer)
    dismissTimers.forEach((timer) => clearTimeout(timer))
    dismissTimers.clear()
  })

  watch(shopSlug, () => {
    notifications.value = []
    seenIds.value = new Set()
    markBaselineNow()
    pollNotifications()
  })

  watch(isAdminForShop, () => {
    notifications.value = []
    seenIds.value = new Set()
    markBaselineNow()
    pollNotifications()
  })

  watch(isOnChatPage, (onChat) => {
    if (onChat) markBaselineNow()
  })

  watch(activeChatUserId, () => {
    if (isOnChatPage.value) markBaselineNow()
  })

  watch(
    () => auth.isLoggedIn,
    (loggedIn) => {
      if (!loggedIn) {
        notifications.value = []
        seenIds.value = new Set()
        lastSeenAt.value = null
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = null
        return
      }
      markBaselineNow()
      pollNotifications()
      restartPollTimer()
    }
  )

  return {
    notifications,
    dismissNotification,
    markBaselineNow,
    pollNotifications,
  }
}

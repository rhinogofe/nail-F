import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import {
  FCM_PUSH_RECEIVED_EVENT,
  PUSH_DEVICE_STATUS_EVENT,
  getStoredFcmToken,
} from '../utils/pushNotifications'

const POLL_MS = 30000
const POLL_MS_PUSH = 90000

function getPollIntervalMs() {
  return getStoredFcmToken() ? POLL_MS_PUSH : POLL_MS
}

export function useChatUnread() {
  const auth = useAuthStore()
  const route = useRoute()
  const unreadCount = ref(0)
  let timer = null

  const shopSlug = computed(
    () => route.params.shopSlug || localStorage.getItem('shopSlug') || 'default'
  )

  const isAdminForShop = computed(() => auth.canAccessShopAdmin(shopSlug.value))

  async function refresh() {
    if (!auth.isLoggedIn) {
      unreadCount.value = 0
      return
    }
    if (typeof document !== 'undefined' && document.hidden) return
    try {
      const url = isAdminForShop.value
        ? '/api/admin/chat/unread-count'
        : '/api/chat/unread-count'
      const { data } = await api.get(url)
      unreadCount.value = data?.count || 0
    } catch {
      /* ignore polling errors */
    }
  }

  function restartTimer() {
    if (timer) clearInterval(timer)
    timer = null
    if (typeof document !== 'undefined' && document.hidden) return
    if (!auth.isLoggedIn) return
    timer = setInterval(refresh, getPollIntervalMs())
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (timer) clearInterval(timer)
      timer = null
      return
    }
    window.setTimeout(() => {
      if (document.hidden || !auth.isLoggedIn) return
      refresh()
      restartTimer()
    }, 500)
  }

  function onPushReceived() {
    refresh()
  }

  function onPushDeviceStatusChanged() {
    restartTimer()
  }

  onMounted(() => {
    refresh()
    restartTimer()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener(FCM_PUSH_RECEIVED_EVENT, onPushReceived)
    window.addEventListener(PUSH_DEVICE_STATUS_EVENT, onPushDeviceStatusChanged)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener(FCM_PUSH_RECEIVED_EVENT, onPushReceived)
    window.removeEventListener(PUSH_DEVICE_STATUS_EVENT, onPushDeviceStatusChanged)
    if (timer) clearInterval(timer)
  })

  watch([shopSlug, isAdminForShop], refresh)

  watch(
    () => auth.isLoggedIn,
    (loggedIn) => {
      if (!loggedIn) {
        unreadCount.value = 0
        if (timer) clearInterval(timer)
        timer = null
        return
      }
      refresh()
      restartTimer()
    }
  )

  return { unreadCount, refresh }
}

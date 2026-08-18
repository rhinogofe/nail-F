import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'

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
    timer = setInterval(refresh, 20000)
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

  onMounted(() => {
    refresh()
    restartTimer()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (timer) clearInterval(timer)
  })

  watch([shopSlug, isAdminForShop], refresh)

  return { unreadCount, refresh }
}

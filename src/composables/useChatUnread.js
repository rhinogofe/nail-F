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

  const isAdminForShop = computed(
    () => auth.isAdmin && auth.canAccessShopAdmin(shopSlug.value)
  )

  async function refresh() {
    if (!auth.isLoggedIn) {
      unreadCount.value = 0
      return
    }
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

  onMounted(() => {
    refresh()
    timer = setInterval(refresh, 15000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  watch([shopSlug, isAdminForShop], refresh)

  return { unreadCount, refresh }
}

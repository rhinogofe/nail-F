import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useShopRoute() {
  const route = useRoute()
  const shopSlug = computed(
    () => route.params.shopSlug || localStorage.getItem('shopSlug') || 'default'
  )

  function shopPath(suffix = '') {
    const path = suffix.startsWith('/') ? suffix : `/${suffix}`
    return `/${shopSlug.value}${path}`
  }

  return { shopSlug, shopPath }
}

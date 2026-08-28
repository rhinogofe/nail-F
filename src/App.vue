<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useShopStore } from './stores/shop'
import AppUpdateBanner from './components/AppUpdateBanner.vue'
import { useAppUpdate } from './composables/useAppUpdate'
import {
  initPushNotificationsWhenReady,
} from './utils/pushNotifications'
import { syncShopManifestLink } from './utils/shopManifest'

const route = useRoute()
const auth = useAuthStore()
const shopStore = useShopStore()
const isAdminRoute = computed(() => /\/admin$/.test(route.path))
const isNavRoute = computed(() =>
  /\/(bookings|reviews|location|chat|profile)(\/|$)/.test(route.path),
)
const { updateAvailable, reload } = useAppUpdate()

let stopPushListener = null

function syncManifestFromRoute() {
  syncShopManifestLink({
    shopSlug: route.params.shopSlug,
    shopName: route.params.shopSlug ? shopStore.shopName : undefined,
  })
}

function syncPushListener() {
  stopPushListener?.()
  stopPushListener = null
  if (!auth.isLoggedIn) return
  initPushNotificationsWhenReady()
    .then((stop) => {
      if (typeof stop === 'function') stopPushListener = stop
    })
    .catch(() => {})
}

onMounted(() => {
  syncManifestFromRoute()
  syncPushListener()
})

onUnmounted(() => {
  stopPushListener?.()
})

watch(
  () => [route.params.shopSlug, shopStore.shop?.name],
  () => {
    syncManifestFromRoute()
  },
  { immediate: true },
)

watch(() => auth.isLoggedIn, () => {
  syncPushListener()
})
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--admin': isAdminRoute,
      'app-shell--nav': isNavRoute,
    }"
  >
    <AppUpdateBanner :visible="updateAvailable" @reload="reload" />
    <router-view />
  </div>
</template>

<style>
.app-shell {
  height: 100%;
  width: 100%;
  max-width: var(--page-max-width);
  margin: 0 auto;
  background: var(--color-background);
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.app-shell--admin {
  max-width: none;
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--color-background);
}

@media (min-width: 431px) {
  body {
    background: var(--color-surface-muted);
  }
}

@media (min-width: 768px) {
  .app-shell--admin {
    padding: 0 clamp(16px, 2vw, 32px);
  }
}

@media (min-width: 900px) {
  .app-shell--nav {
    max-width: none;
    width: 100%;
  }

  .app-shell--nav .app-update-banner {
    left: var(--sidebar-width);
    transform: none;
    width: calc(100% - var(--sidebar-width));
  }

  .app-shell--admin .app-update-banner {
    left: 0;
    transform: none;
    width: 100%;
  }
}
</style>

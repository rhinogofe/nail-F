<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import AppUpdateBanner from './components/AppUpdateBanner.vue'
import { useAppUpdate } from './composables/useAppUpdate'
import {
  initPushNotificationsWhenReady,
} from './utils/pushNotifications'

const route = useRoute()
const auth = useAuthStore()
const isAdminRoute = computed(() => /\/admin$/.test(route.path))
const isNavRoute = computed(() =>
  /\/(bookings|reviews|location|chat|profile)(\/|$)/.test(route.path),
)
const { updateAvailable, reload } = useAppUpdate()

let stopPushListener = null

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
  syncPushListener()
})

onUnmounted(() => {
  stopPushListener?.()
})

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
  max-width: min(1200px, 100%);
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
    padding: 0 var(--space-5);
  }
}

@media (min-width: 900px) {
  .app-shell--nav {
    max-width: min(var(--page-wide-max), 100%);
    width: 100%;
  }

  .app-shell--nav .app-update-banner {
    left: max(0px, calc((100vw - min(var(--page-wide-max), 100vw)) / 2));
    transform: none;
    width: min(100%, var(--page-wide-max));
  }
}
</style>

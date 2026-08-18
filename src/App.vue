<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ChatNotificationStack from './components/ChatNotificationStack.vue'
import { useAuthStore } from './stores/auth'
import {
  initPushNotificationsWhenReady,
} from './utils/pushNotifications'

const route = useRoute()
const auth = useAuthStore()
const isAdminRoute = computed(() => /\/admin$/.test(route.path))

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
  <div class="app-shell" :class="{ 'app-shell--admin': isAdminRoute }">
    <router-view />
    <ChatNotificationStack />
  </div>
</template>

<style>
.app-shell {
  min-height: 100svh;
  max-width: var(--page-max-width);
  margin: 0 auto;
  background: var(--color-background);
  position: relative;
  isolation: isolate;
}

.app-shell--admin {
  max-width: min(1200px, 100%);
  width: 100%;
  overflow-x: clip;
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
</style>

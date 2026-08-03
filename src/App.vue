<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ChatNotificationStack from './components/ChatNotificationStack.vue'

const route = useRoute()
const isAdminRoute = computed(() => /\/admin$/.test(route.path))
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

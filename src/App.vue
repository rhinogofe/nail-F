<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isAdminRoute = computed(() => /\/admin$/.test(route.path))
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--admin': isAdminRoute }">
    <router-view />
  </div>
</template>

<style>
.app-shell {
  min-height: 100svh;
  max-width: 430px;
  margin: 0 auto;
  background: var(--color-surface);
  position: relative;
}

.app-shell--admin {
  max-width: min(1200px, 100%);
  width: 100%;
  overflow-x: clip;
  box-sizing: border-box;
}

@media (min-width: 431px) {
  body {
    background: #F5F0ED;
  }
}

@media (min-width: 768px) {
  .app-shell--admin {
    padding: 0 20px;
  }
}
</style>

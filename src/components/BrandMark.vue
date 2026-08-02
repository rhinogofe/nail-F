<script setup>
import { computed } from 'vue'
import { useUiSettingsStore } from '../stores/uiSettings'

const props = defineProps({
  showSparkle: { type: Boolean, default: false },
})

const ui = useUiSettingsStore()
const brandMain = computed(() => ui.brandMain)
const brandAccent = computed(() => ui.brandAccent)
</script>

<template>
  <div class="brand">
    {{ brandMain }}<span v-if="brandAccent" class="brand-accent">{{ brandAccent }}</span>
    <i v-if="showSparkle" class="ti ti-sparkles brand-icon-sm" aria-hidden="true"></i>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useUiSettingsStore } from '../stores/uiSettings'

defineProps({
  showSparkle: { type: Boolean, default: false },
})

const ui = useUiSettingsStore()
const brandMain = computed(() => ui.brandMain)
const brandAccent = computed(() => ui.brandAccent)
const brandLabel = computed(() => {
  const main = brandMain.value || ''
  const accent = brandAccent.value || ''
  return accent ? `${main}${accent}` : main
})
</script>

<template>
  <div class="brand" :title="brandLabel">
    <span class="brand-text">
      {{ brandMain }}<span v-if="brandAccent" class="brand-accent">{{ brandAccent }}</span>
      <i v-if="showSparkle" class="ti ti-sparkles brand-icon-sm" aria-hidden="true"></i>
    </span>
  </div>
</template>

<style scoped>
.brand {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.brand-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-h3);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.brand-accent {
  color: var(--color-primary);
}

.brand-icon-sm {
  display: inline;
  font-size: 16px;
  color: var(--color-primary);
  vertical-align: -2px;
}
</style>

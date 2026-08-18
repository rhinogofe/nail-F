<script setup>
import { computed } from 'vue'
import { usePushNotifications } from '../composables/usePushNotifications'

const {
  enabled,
  configured,
  supported,
  loading,
  errorMessage,
  helpText,
  toggle,
} = usePushNotifications()

const canToggle = computed(() => configured.value && supported.value)

const statusNote = computed(() => {
  if (!configured.value) return 'รอตั้งค่า Firebase บนเซิร์ฟเวอร์ (backend .env)'
  if (!supported.value) return helpText.value
  return helpText.value
})

async function onToggle(event) {
  const next = event.target.checked
  try {
    await toggle(next)
  } catch {
    event.target.checked = !next
  }
}
</script>

<template>
  <div class="push-toggle-card">
    <div class="push-toggle-copy">
      <strong class="push-toggle-title">
        <i class="ti ti-bell" aria-hidden="true"></i>
        แจ้งเตือนนอกแอป
      </strong>
      <p class="push-toggle-desc muted">{{ statusNote }}</p>
      <p v-if="!configured" class="push-toggle-note muted">Backend ต้องอ่าน Service Account ได้ — restart npm run dev</p>
      <p v-if="errorMessage" class="push-toggle-error">{{ errorMessage }}</p>
    </div>

    <label class="push-toggle-switch" :class="{ disabled: !canToggle || loading }">
      <input
        type="checkbox"
        :checked="enabled"
        :disabled="!canToggle || loading"
        @change="onToggle"
      />
      <span class="push-toggle-track" aria-hidden="true">
        <span class="push-toggle-thumb"></span>
      </span>
    </label>
  </div>
</template>

<style scoped>
.push-toggle-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.push-toggle-copy {
  min-width: 0;
  flex: 1;
}

.push-toggle-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-body);
  color: var(--color-text-primary);
}

.push-toggle-title i {
  color: var(--color-primary);
  font-size: 18px;
}

.push-toggle-desc,
.push-toggle-note,
.push-toggle-error {
  margin: 6px 0 0;
  font-size: var(--text-caption);
  line-height: 1.45;
}

.push-toggle-error {
  color: var(--color-error);
}

.push-toggle-switch {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 32px;
  cursor: pointer;
}

.push-toggle-switch.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.push-toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.push-toggle-track {
  display: block;
  width: 52px;
  height: 32px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-muted) 28%, transparent);
  transition: background var(--transition);
  position: relative;
}

.push-toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(45, 36, 36, 0.18);
  transition: transform var(--transition);
}

.push-toggle-switch input:checked + .push-toggle-track {
  background: linear-gradient(145deg, var(--color-primary), var(--color-primary-dark));
}

.push-toggle-switch input:checked + .push-toggle-track .push-toggle-thumb {
  transform: translateX(20px);
}

.push-toggle-switch input:focus-visible + .push-toggle-track {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>

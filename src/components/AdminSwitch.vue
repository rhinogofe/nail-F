<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

function onChange(event) {
  if (props.disabled) {
    event.target.checked = props.modelValue
    return
  }
  emit('update:modelValue', event.target.checked)
}
</script>

<template>
  <label
    class="admin-switch"
    :class="{
      'admin-switch--disabled': disabled,
      'admin-switch--compact': compact,
      'admin-switch--on': modelValue,
    }"
  >
    <span v-if="label || hint || $slots.default" class="admin-switch-copy">
      <span class="admin-switch-label">
        <slot>{{ label }}</slot>
      </span>
      <span v-if="hint" class="admin-switch-hint">{{ hint }}</span>
    </span>
    <span class="admin-switch-control" :class="{ disabled }">
      <input
        type="checkbox"
        role="switch"
        :checked="modelValue"
        :disabled="disabled"
        :aria-label="compact && label ? label : undefined"
        :aria-checked="modelValue"
        @change="onChange"
      />
      <span class="admin-switch-track" aria-hidden="true">
        <span class="admin-switch-thumb"></span>
      </span>
    </span>
  </label>
</template>

<style>
.admin-switch-stack {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-elevated);
}

.admin-switch-stack > .admin-switch {
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
  min-height: 48px;
}

.admin-switch-stack > .admin-switch:last-child {
  border-bottom: none;
}

.admin-switch-group {
  margin: 0 0 16px;
}

.admin-switch-group-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
</style>

<style scoped>
.admin-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  min-height: 44px;
  cursor: pointer;
  user-select: none;
}

.admin-switch--compact {
  display: inline-flex;
  min-height: 32px;
  gap: 8px;
}

.admin-switch--disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.admin-switch-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-switch-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.35;
}

.admin-switch-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.admin-switch-control {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 28px;
}

.admin-switch--compact .admin-switch-control {
  width: 44px;
  height: 26px;
}

.admin-switch-control input {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  width: 100%;
  height: 100%;
  cursor: inherit;
}

.admin-switch-track {
  display: block;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-muted) 32%, transparent);
  transition: background 180ms ease;
  position: relative;
}

.admin-switch--compact .admin-switch-track {
  width: 44px;
  height: 26px;
}

.admin-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(45, 36, 36, 0.2);
  transition: transform 180ms ease;
}

.admin-switch--compact .admin-switch-thumb {
  width: 20px;
  height: 20px;
}

.admin-switch-control input:checked + .admin-switch-track {
  background: var(--color-primary);
}

.admin-switch-control input:checked + .admin-switch-track .admin-switch-thumb {
  transform: translateX(20px);
}

.admin-switch--compact .admin-switch-control input:checked + .admin-switch-track .admin-switch-thumb {
  transform: translateX(18px);
}

.admin-switch-control input:focus-visible + .admin-switch-track {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>

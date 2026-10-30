<script setup>
defineProps({
  status: { type: String, default: 'idle' },
  error: { type: String, default: '' },
})

defineEmits(['retry'])
</script>

<template>
  <span
    v-if="status && status !== 'idle'"
    class="admin-save-status"
    :data-status="status"
    role="status"
  >
    <i v-if="status === 'saving'" class="ti ti-loader-2 admin-save-status-spin" aria-hidden="true"></i>
    <span v-if="status === 'saving'" class="admin-save-status-text">กำลังบันทึก</span>

    <i v-if="status === 'saved'" class="ti ti-check" aria-hidden="true"></i>
    <span v-if="status === 'saved'" class="admin-save-status-text">บันทึกแล้ว</span>

    <i v-if="status === 'invalid'" class="ti ti-alert-circle" aria-hidden="true"></i>
    <span v-if="status === 'invalid'" class="admin-save-status-text">{{ error }}</span>

    <template v-if="status === 'error'">
      <i class="ti ti-alert-triangle" aria-hidden="true"></i>
      <span class="admin-save-status-text">{{ error || 'บันทึกไม่สำเร็จ' }}</span>
      <button type="button" class="btn ghost admin-save-retry" @click="$emit('retry')">
        ลองใหม่
      </button>
    </template>
  </span>
</template>

<style>
.admin-save-status {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  min-height: var(--touch-min);
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.admin-save-status[data-status='saved'] {
  color: var(--color-success);
}

.admin-save-status[data-status='invalid'],
.admin-save-status[data-status='error'] {
  color: var(--color-error);
}

.admin-save-status-spin {
  animation: spin 0.8s linear infinite;
}

.admin-save-retry {
  min-height: var(--touch-min);
  padding-inline: var(--space-3);
}

.admin-ui-dirty-bar {
  position: sticky;
  bottom: 0;
  z-index: var(--z-toast);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding: var(--space-3);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.admin-ui-dirty-bar-text {
  flex: 1 1 160px;
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
}

.admin-ui-dirty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>

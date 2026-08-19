<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['reload'])
</script>

<template>
  <div v-if="visible" class="app-update-banner" role="status" aria-live="polite">
    <p class="app-update-banner__text">มีเวอร์ชันใหม่พร้อมใช้งาน</p>
    <button type="button" class="app-update-banner__btn" @click="emit('reload')">
      อัปเดต
    </button>
  </div>
</template>

<style scoped>
.app-update-banner {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: calc(var(--z-nav) + 5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: min(100%, var(--page-max-width));
  padding:
    calc(env(safe-area-inset-top, 0px) + var(--space-2))
    var(--space-4)
    var(--space-2);
  background: var(--color-primary-dark);
  color: var(--color-on-primary);
  box-shadow: 0 4px 16px rgba(45, 36, 36, 0.18);
  box-sizing: border-box;
}

.app-update-banner__text {
  margin: 0;
  font-size: var(--text-caption);
  font-weight: 500;
  line-height: var(--lh-tight);
}

.app-update-banner__btn {
  flex-shrink: 0;
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.14);
  color: inherit;
  font: inherit;
  font-size: var(--text-caption);
  font-weight: 600;
  cursor: pointer;
}

.app-update-banner__btn:active {
  background: rgba(255, 255, 255, 0.24);
}
</style>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

function visibleItems(items) {
  return (items || []).filter((item) => {
    const n = Number(item.value)
    if (Number.isFinite(n)) return n > 0
    return Boolean(item.value)
  })
}
</script>

<template>
  <span v-if="visibleItems(items).length" class="cal-stat-chips">
    <span
      v-for="item in visibleItems(items)"
      :key="item.key || item.title"
      class="cal-stat-chip"
      :class="`cal-stat-chip--${item.tone || 'muted'}`"
      :title="item.title"
    >
      <i class="ti" :class="item.icon" aria-hidden="true"></i>
      <span class="cal-stat-chip-value">{{ item.text ?? item.value }}</span>
    </span>
  </span>
</template>

<style>
.cal-stat-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-top: 4px;
}

.cal-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 16px;
  padding: 1px 4px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: 700;
  line-height: 1.2;
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.cal-stat-chip i {
  font-size: 12px;
}

.cal-stat-chip--success { color: var(--color-success); }
.cal-stat-chip--warning { color: var(--color-warning); }
.cal-stat-chip--muted { color: var(--color-text-secondary); }
.cal-stat-chip--info { color: var(--color-info); }
.cal-stat-chip--primary { color: var(--color-primary); }
</style>

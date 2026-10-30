<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  /** Legend mode: show every item with its label, including zero values. */
  legend: {
    type: Boolean,
    default: false,
  },
})

const visibleItems = computed(() => {
  if (props.legend) return props.items || []
  return (props.items || []).filter((item) => {
    const n = Number(item.value)
    if (Number.isFinite(n)) return n > 0
    return Boolean(item.value)
  })
})

function chipText(item) {
  if (props.legend && (item.value === undefined || item.value === null || item.value === '')) return ''
  return item.text ?? item.value
}
</script>

<template>
  <span
    v-if="visibleItems.length"
    class="cal-stat-chips"
    :class="{ 'cal-stat-chips--legend': legend }"
  >
    <span
      v-for="item in visibleItems"
      :key="item.key || item.title"
      class="cal-stat-chip-wrap"
    >
      <span
        class="cal-stat-chip"
        :class="`cal-stat-chip--${item.tone || 'muted'}`"
        :title="item.title"
      >
        <i class="ti" :class="item.icon" aria-hidden="true"></i>
        <span v-if="chipText(item) !== ''" class="cal-stat-chip-value">{{ chipText(item) }}</span>
      </span>
      <span v-if="legend" class="cal-stat-chip-label">{{ item.title }}</span>
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

.cal-stat-chips--legend {
  justify-content: flex-start;
  gap: var(--space-1) var(--space-3);
  margin-top: var(--space-3);
}

.cal-stat-chip-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
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
  font-size: var(--text-caption);
}

.cal-stat-chip-label {
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.cal-stat-chip--success { color: var(--color-success); }
.cal-stat-chip--warning { color: var(--color-warning); }
.cal-stat-chip--muted { color: var(--color-text-secondary); }
.cal-stat-chip--info { color: var(--color-info); }
.cal-stat-chip--primary { color: var(--color-primary); }
</style>

<script setup>
defineProps({
  extra: { type: String, default: '' },
})
</script>

<template>
  <p class="cal-location-legend">
    <i class="ti ti-palette" aria-hidden="true"></i>
    สีพื้นช่องวัน = สถานที่ให้บริการ ไม่ใช่สถานะคิว
    <span v-if="extra"> · {{ extra }}</span>
  </p>
</template>

<style>
.cal-location-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.cal-location-legend i {
  color: var(--color-primary);
}
</style>

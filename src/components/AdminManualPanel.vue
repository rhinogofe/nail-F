<script setup>
import { computed, ref } from 'vue'
import { ADMIN_MANUAL_SECTIONS } from '../constants/adminManual'

const sections = ADMIN_MANUAL_SECTIONS
const activeSection = ref(sections[0]?.key || 'overview')

function selectSection(key) {
  activeSection.value = key
}

const activeContent = computed(
  () => sections.find((s) => s.key === activeSection.value) || sections[0]
)
</script>

<template>
  <section class="admin-section admin-manual">
    <nav class="admin-subnav" aria-label="หัวข้อคู่มือการใช้งาน">
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="tab-btn"
        :class="{ active: activeSection === section.key }"
        :aria-current="activeSection === section.key ? 'true' : undefined"
        @click="selectSection(section.key)"
      >
        <i class="ti" :class="section.icon" aria-hidden="true"></i>
        {{ section.label }}
      </button>
    </nav>

    <div v-if="activeContent" class="admin-manual-panel">
      <div class="admin-section-head">
        <h3>{{ activeContent.label }}</h3>
        <p class="muted">{{ activeContent.summary }}</p>
      </div>

      <article
        v-for="(block, index) in activeContent.blocks"
        :key="`${activeContent.key}-${index}`"
        class="admin-manual-block"
      >
        <h4 class="admin-manual-block-title">{{ block.title }}</h4>
        <p
          v-for="(para, pIndex) in block.paragraphs || []"
          :key="`p-${pIndex}`"
          class="admin-manual-text"
        >
          {{ para }}
        </p>
        <ul v-if="block.bullets?.length" class="admin-manual-list">
          <li v-for="(item, bIndex) in block.bullets" :key="`b-${bIndex}`">{{ item }}</li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.admin-manual {
  padding: 0;
}

.admin-manual-panel {
  min-width: 0;
}

.admin-manual-block {
  margin-bottom: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-card);
}

.admin-manual-block:last-child {
  margin-bottom: 0;
}

.admin-manual-block-title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--color-text-primary);
}

.admin-manual-text {
  margin: 0 0 var(--space-2);
  font-size: var(--text-body);
  line-height: var(--lh-body);
  color: var(--color-text-secondary);
}

.admin-manual-text:last-child {
  margin-bottom: 0;
}

.admin-manual-list {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.admin-manual-list li {
  font-size: var(--text-body);
  line-height: 1.55;
  color: var(--color-text-secondary);
}
</style>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ADMIN_MANUAL_SECTIONS } from '../constants/adminManual'

const sections = ADMIN_MANUAL_SECTIONS
const activeSection = ref(sections[0]?.key || 'overview')
const navOpen = ref(false)
const isMobile = ref(false)

let mobileMq = null

function updateMobileLayout() {
  isMobile.value = mobileMq?.matches ?? window.innerWidth <= 640
  if (!isMobile.value) navOpen.value = true
}

function selectSection(key) {
  activeSection.value = key
  if (isMobile.value) navOpen.value = false
}

function toggleNav() {
  navOpen.value = !navOpen.value
}

const activeMeta = computed(
  () => sections.find((s) => s.key === activeSection.value) || sections[0]
)

const activeContent = computed(
  () => sections.find((s) => s.key === activeSection.value) || sections[0]
)

onMounted(() => {
  mobileMq = window.matchMedia('(max-width: 640px)')
  updateMobileLayout()
  mobileMq.addEventListener('change', updateMobileLayout)
})

onUnmounted(() => {
  mobileMq?.removeEventListener('change', updateMobileLayout)
})
</script>

<template>
  <section class="card admin-section admin-manual admin-drawer-section">
    <div class="admin-drawer-shell">
      <Transition name="admin-manual-backdrop">
        <button
          v-if="navOpen && isMobile"
          type="button"
          class="admin-manual-backdrop"
          aria-label="ปิดหัวข้อคู่มือ"
          @click="navOpen = false"
        />
      </Transition>

      <aside class="admin-manual-nav" :class="{ 'admin-manual-nav--open': navOpen || !isMobile }">
        <div class="admin-manual-nav-head">
          <h3 class="admin-manual-nav-title">หัวข้อคู่มือ</h3>
          <button
            type="button"
            class="admin-manual-icon-btn"
            aria-label="ปิดหัวข้อ"
            @click="navOpen = false"
          >
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>
        <nav class="admin-manual-nav-list" aria-label="หัวข้อคู่มือการใช้งาน">
          <button
            v-for="section in sections"
            :key="section.key"
            type="button"
            class="admin-manual-nav-item"
            :class="{ active: activeSection === section.key }"
            :aria-current="activeSection === section.key ? 'true' : undefined"
            @click="selectSection(section.key)"
          >
            <i class="ti" :class="section.icon" aria-hidden="true"></i>
            <span>{{ section.label }}</span>
          </button>
        </nav>
      </aside>

      <div class="admin-manual-main">
        <header class="admin-manual-toolbar">
          <button
            type="button"
            class="admin-manual-icon-btn admin-manual-menu-btn"
            :aria-expanded="navOpen"
            aria-label="เปิดหัวข้อคู่มือ"
            @click="toggleNav"
          >
            <i class="ti ti-menu-2" aria-hidden="true"></i>
          </button>
          <div class="admin-manual-toolbar-text">
            <strong>{{ activeMeta?.label }}</strong>
            <span class="muted">{{ activeMeta?.summary }}</span>
          </div>
        </header>

        <div v-if="activeContent" class="admin-manual-panel">
          <p class="admin-manual-intro muted">{{ activeContent.summary }}</p>

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
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-manual {
  padding: 0;
  overflow: hidden;
}

.admin-drawer-shell {
  display: flex;
  min-height: 420px;
  position: relative;
}

.admin-manual-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  border: 0;
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
}

.admin-manual-backdrop-enter-active,
.admin-manual-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.admin-manual-backdrop-enter-from,
.admin-manual-backdrop-leave-to {
  opacity: 0;
}

.admin-manual-nav {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  z-index: 41;
}

.admin-manual-nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--color-border);
}

.admin-manual-nav-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.admin-manual-nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  overflow-y: auto;
}

.admin-manual-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.admin-manual-nav-item i {
  font-size: 16px;
  flex-shrink: 0;
}

.admin-manual-nav-item.active {
  background: color-mix(in srgb, var(--color-primary-light) 70%, white);
  color: var(--color-primary-dark);
  font-weight: 600;
}

.admin-manual-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.admin-manual-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.admin-manual-toolbar-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-manual-toolbar-text strong {
  font-size: 14px;
}

.admin-manual-toolbar-text .muted {
  font-size: 12px;
}

.admin-manual-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.admin-manual-menu-btn {
  display: none;
}

.admin-manual-panel {
  padding: 16px;
  overflow-y: auto;
}

.admin-manual-intro {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
}

.admin-manual-block {
  margin-bottom: 18px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.admin-manual-block:last-child {
  margin-bottom: 0;
}

.admin-manual-block-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.admin-manual-text {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.6;
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
  gap: 6px;
}

.admin-manual-list li {
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-text-secondary);
}

@media (max-width: 640px) {
  .admin-drawer-shell {
    min-height: 360px;
  }

  .admin-manual-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-card);
  }

  .admin-manual-nav--open {
    transform: translateX(0);
  }

  .admin-manual-menu-btn {
    display: inline-flex;
  }

  .admin-manual-nav-head .admin-manual-icon-btn {
    display: inline-flex;
  }
}

@media (min-width: 641px) {
  .admin-manual-nav-head .admin-manual-icon-btn {
    display: none;
  }
}
</style>

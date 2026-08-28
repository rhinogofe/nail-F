<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'
import AdminShopFeatureInlineSettings from './AdminShopFeatureInlineSettings.vue'
import AdminSwitch from './AdminSwitch.vue'

const props = defineProps({
  isSuperAdmin: { type: Boolean, default: false },
  shopSlug: { type: String, default: '' },
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['saved'])

const isManager = computed(() => props.isSuperAdmin && props.shopSlug === 'default')

const loading = ref(true)
const savingKey = ref('')
const message = ref('')
const errorMessage = ref('')

const catalog = ref([])
const shops = ref([])
const defaultFeatures = ref({})

const selectedMode = ref('shop')
const selectedShopSlug = ref('')
const selectedGroupKey = ref('')
const expandedItemKey = ref('')
const expandedChildKey = ref('')

const DEFAULTS_ID = '__defaults__'

const selectedShop = computed(() =>
  shops.value.find((s) => s.slug === selectedShopSlug.value) || null
)

const selectedGroup = computed(() =>
  catalog.value.find((g) => g.key === selectedGroupKey.value) || catalog.value[0] || null
)

const groupItems = computed(() => selectedGroup.value?.items || [])

const currentFeatures = computed(() => {
  if (selectedMode.value === 'defaults') {
    return defaultFeatures.value
  }
  return selectedShop.value?.features || {}
})

const canEditBranch = computed(() => selectedMode.value === 'shop' && !!selectedShopSlug.value)

const shopRows = computed(() => [
  {
    id: DEFAULTS_ID,
    slug: DEFAULTS_ID,
    name: 'ค่าเริ่มต้น (ร้านใหม่)',
    is_active: true,
    isDefaults: true,
  },
  ...shops.value,
])

function isItemEnabled(itemKey) {
  return currentFeatures.value[itemKey] !== false
}

function isItemLocked(item) {
  return Boolean(item.locked)
}

function isConfigOnly(item) {
  return Boolean(item?.configOnly)
}

function hasSetup(item) {
  return Boolean(item?.setup) || (Array.isArray(item?.children) && item.children.some((c) => c.setup))
}

function hasChildren(item) {
  return Array.isArray(item?.children) && item.children.length > 0
}

function itemStatusLabel(item) {
  if (isConfigOnly(item)) return 'ตั้งค่า'
  return isItemEnabled(item.key) ? 'เปิด' : 'ปิด'
}

function isExpanded(itemKey) {
  return expandedItemKey.value === itemKey
}

function toggleExpand(item) {
  if (isExpanded(item.key)) {
    expandedItemKey.value = ''
    expandedChildKey.value = ''
    return
  }
  expandedItemKey.value = item.key
  expandedChildKey.value = ''
}

function activeSetupForItem(item) {
  if (expandedChildKey.value && item.children?.length) {
    const child = item.children.find((c) => c.key === expandedChildKey.value)
    if (child?.setup) return child.setup
  }
  return item.setup || null
}

function activeSetupLabelForItem(item) {
  if (expandedChildKey.value && item.children?.length) {
    const child = item.children.find((c) => c.key === expandedChildKey.value)
    if (child) return child.label
  }
  return item.label
}

async function loadAll() {
  if (!isManager.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [catalogRes, shopsRes, defaultsRes] = await Promise.all([
      api.get('/api/admin/shop-features/catalog'),
      api.get('/api/admin/shop-features/shops'),
      api.get('/api/admin/shop-features/defaults'),
    ])
    catalog.value = catalogRes.data?.groups || []
    shops.value = shopsRes.data?.shops || []
    defaultFeatures.value = defaultsRes.data?.features || {}
    if (!selectedGroupKey.value && catalog.value.length) {
      selectedGroupKey.value = catalog.value[0].key
    }
    if (selectedMode.value === 'shop' && !selectedShopSlug.value && shops.value.length) {
      selectedShopSlug.value = shops.value[0].slug
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.error || err.message || 'โหลดไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

function selectShop(row) {
  if (row.isDefaults) {
    selectedMode.value = 'defaults'
    selectedShopSlug.value = ''
  } else {
    selectedMode.value = 'shop'
    selectedShopSlug.value = row.slug
  }
  expandedItemKey.value = ''
  expandedChildKey.value = ''
}

function selectGroup(groupKey) {
  selectedGroupKey.value = groupKey
  expandedItemKey.value = ''
  expandedChildKey.value = ''
}

function selectChild(childKey) {
  expandedChildKey.value = childKey
}

function onInlineSaved(label) {
  message.value = `บันทึก "${label}" ของ ${selectedShop.value?.name || selectedShopSlug.value} แล้ว`
  emit('saved')
}

function onInlineError(err) {
  errorMessage.value = err
}

async function toggleItem(item, nextValue) {
  if (isItemLocked(item)) return
  const next = typeof nextValue === 'boolean' ? nextValue : !isItemEnabled(item.key)
  savingKey.value = item.key
  message.value = ''
  errorMessage.value = ''
  try {
    if (selectedMode.value === 'defaults') {
      const { data } = await api.patch('/api/admin/shop-features/defaults', {
        features: { [item.key]: next },
      })
      defaultFeatures.value = data.features || {}
      message.value = 'บันทึกค่าเริ่มต้นแล้ว — ร้านใหม่จะใช้ค่านี้'
    } else if (selectedShopSlug.value) {
      const { data } = await api.patch(`/api/admin/shop-features/${selectedShopSlug.value}`, {
        features: { [item.key]: next },
      })
      const idx = shops.value.findIndex((s) => s.slug === selectedShopSlug.value)
      if (idx >= 0) {
        shops.value[idx] = { ...shops.value[idx], features: data.features }
      }
      message.value = next ? `เปิด "${item.label}" แล้ว` : `ปิด "${item.label}" — สาขานี้จะไม่เห็น`
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.error || err.message || 'บันทึกไม่สำเร็จ'
  } finally {
    savingKey.value = ''
  }
}

async function resetShopToDefaults() {
  if (selectedMode.value !== 'shop' || !selectedShop.value) return
  const ok = await Swal.fire({
    title: 'รีเซ็ตเป็นค่าเริ่มต้น?',
    text: `ฟังก์ชันของ "${selectedShop.value.name}" จะกลับไปตามค่าเริ่มต้นร้านใหม่`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'รีเซ็ต',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  savingKey.value = '__reset__'
  try {
    const payload = {}
    for (const group of catalog.value) {
      for (const item of group.items) {
        if (!item.locked && !item.configOnly) {
          payload[item.key] = defaultFeatures.value[item.key] !== false
        }
      }
    }
    const { data } = await api.patch(`/api/admin/shop-features/${selectedShopSlug.value}`, {
      features: payload,
    })
    const idx = shops.value.findIndex((s) => s.slug === selectedShopSlug.value)
    if (idx >= 0) {
      shops.value[idx] = { ...shops.value[idx], features: data.features }
    }
    message.value = 'รีเซ็ตเป็นค่าเริ่มต้นแล้ว'
  } catch (err) {
    errorMessage.value = err.response?.data?.error || err.message || 'รีเซ็ตไม่สำเร็จ'
  } finally {
    savingKey.value = ''
  }
}

watch(
  () => props.active,
  (on) => {
    if (on && isManager.value) loadAll()
  },
  { immediate: true }
)

onMounted(() => {
  if (props.active && isManager.value) loadAll()
})
</script>

<template>
  <section v-if="isManager" class="admin-section shop-features-panel">
    <header class="shop-features-head admin-section-head">
      <div>
        <h3>ฟังก์ชันตามสาขา</h3>
        <p class="muted">เลือกสาขาและหมวด — สไลด์เปิด/ปิดได้ทันที</p>
      </div>
      <button type="button" class="btn ghost admin-action-btn" :disabled="loading" @click="loadAll">
        <i class="ti ti-refresh" aria-hidden="true"></i>
        รีเฟรช
      </button>
    </header>

    <p v-if="message" class="alert-banner success">{{ message }}</p>
    <p v-if="errorMessage" class="alert-banner error">{{ errorMessage }}</p>

    <div v-if="loading" class="state-card">
      <i class="ti ti-loader-2 state-card-icon" aria-hidden="true"></i>
      <span class="state-card-title">กำลังโหลดฟังก์ชัน</span>
    </div>

    <div v-else class="shop-features-layout">
      <!-- ชั้น 1: เลือกสาขา -->
      <nav class="shop-features-nav shop-features-shops" aria-label="ร้าน / สาขา">
        <button
          v-for="row in shopRows"
          :key="row.slug"
          type="button"
          class="shop-features-pill"
          :class="{
            active:
              (row.isDefaults && selectedMode === 'defaults')
              || (!row.isDefaults && selectedMode === 'shop' && selectedShopSlug === row.slug),
          }"
          @click="selectShop(row)"
        >
          {{ row.name }}
          <span v-if="row.isDefaults" class="shop-features-badge">เทมเพลต</span>
          <span v-if="!row.isDefaults && !row.is_active" class="shop-features-badge shop-features-badge--off">ปิด</span>
        </button>
      </nav>

      <div v-if="!shops.length" class="state-card">
        <i class="ti ti-building-store state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">ยังไม่มีสาขา</p>
        <p class="muted">สร้างได้ที่ตั้งค่า → ร้าน / สาขา</p>
      </div>

      <!-- ชั้น 2: เลือกหมวด -->
      <nav class="shop-features-nav shop-features-groups" aria-label="หมวดฟังก์ชัน">
        <button
          v-for="group in catalog"
          :key="group.key"
          type="button"
          class="shop-features-pill shop-features-pill--group"
          :class="{ active: selectedGroupKey === group.key }"
          @click="selectGroup(group.key)"
        >
          <i :class="['ti', group.icon]" aria-hidden="true"></i>
          {{ group.label }}
        </button>
      </nav>

      <!-- สรุปสถานะในหมวด -->
      <div v-if="selectedGroup && groupItems.length" class="shop-features-status-row" aria-hidden="true">
        <span
          v-for="item in groupItems"
          :key="item.key"
          class="shop-features-status-chip"
          :class="{
            'shop-features-status-chip--off': !isConfigOnly(item) && !isItemEnabled(item.key),
            'shop-features-status-chip--config': isConfigOnly(item),
          }"
        >
          {{ item.label }} {{ itemStatusLabel(item) }}
        </span>
      </div>

      <!-- รายการ toggle ทั้งหมดในหมวด -->
      <div v-if="selectedGroup" class="shop-features-list">
        <header class="shop-features-list-head">
          <div>
            <h4>{{ selectedGroup.label }}</h4>
            <p v-if="selectedGroup.hint" class="muted shop-features-group-hint">{{ selectedGroup.hint }}</p>
            <p v-if="selectedMode === 'defaults'" class="muted shop-features-mode-hint">
              กำลังตั้งค่าเริ่มต้น — ร้านที่สร้างใหม่จะได้ค่านี้
            </p>
            <p v-else-if="selectedShop" class="muted shop-features-mode-hint">
              สาขา: <strong>{{ selectedShop.name }}</strong>
            </p>
          </div>
          <button
            v-if="selectedMode === 'shop' && selectedShop"
            type="button"
            class="btn ghost admin-action-btn shop-features-reset-btn"
            :disabled="savingKey === '__reset__'"
            @click="resetShopToDefaults"
          >
            รีเซ็ตเป็นค่าเริ่มต้น
          </button>
        </header>

        <div class="shop-features-cards">
          <article
            v-for="item in groupItems"
            :key="item.key"
            class="shop-features-card"
            :class="{
              'shop-features-card--off': !isConfigOnly(item) && !isItemEnabled(item.key),
              'shop-features-card--expanded': isExpanded(item.key),
            }"
          >
            <div class="shop-features-card-main">
              <div class="shop-features-card-info">
                <strong class="shop-features-card-title">{{ item.label }}</strong>
                <span v-if="isItemLocked(item)" class="shop-features-locked">บังคับเปิด</span>
                <span v-else-if="isConfigOnly(item)" class="muted shop-features-card-desc">
                  ตั้งค่าเนื้อหา — ไม่มีสวิตช์เปิด/ปิด
                </span>
                <span v-else class="muted shop-features-card-desc">
                  เปิด/ปิดการแสดงให้สาขานี้
                </span>
              </div>

              <div class="shop-features-card-actions">
                <span
                  v-if="!isConfigOnly(item)"
                  class="shop-features-card-status"
                  :class="{ 'shop-features-card-status--on': isItemEnabled(item.key) }"
                >
                  {{ isItemEnabled(item.key) ? 'เปิด' : 'ปิด' }}
                </span>
                <AdminSwitch
                  v-if="!isConfigOnly(item)"
                  :model-value="isItemEnabled(item.key)"
                  compact
                  :disabled="isItemLocked(item) || savingKey === item.key"
                  @update:model-value="(v) => toggleItem(item, v)"
                >
                  <span class="visually-hidden">{{ item.label }} — {{ isItemEnabled(item.key) ? 'เปิด' : 'ปิด' }}</span>
                </AdminSwitch>
                <button
                  v-if="hasSetup(item) && !item.configNote"
                  type="button"
                  class="shop-features-expand-btn"
                  :aria-expanded="isExpanded(item.key)"
                  :aria-label="isExpanded(item.key) ? `ย่อ ${item.label}` : `ตั้งค่า ${item.label}`"
                  @click="toggleExpand(item)"
                >
                  <i
                    class="ti"
                    :class="isExpanded(item.key) ? 'ti-chevron-up' : 'ti-chevron-down'"
                    aria-hidden="true"
                  ></i>
                  {{ isExpanded(item.key) ? 'ย่อ' : 'ตั้งค่า' }}
                </button>
              </div>
            </div>

            <p v-if="item.configNote" class="shop-features-config-note">
              {{ item.configNote }}
            </p>

            <div v-if="isExpanded(item.key) && hasSetup(item)" class="shop-features-card-body">
              <nav
                v-if="hasChildren(item)"
                class="shop-features-nav shop-features-children"
                aria-label="รายการย่อย"
              >
                <button
                  v-for="child in item.children"
                  :key="child.key"
                  type="button"
                  class="shop-features-pill shop-features-pill--child"
                  :class="{ active: expandedChildKey === child.key }"
                  @click="selectChild(child.key)"
                >
                  {{ child.label }}
                </button>
              </nav>

              <AdminShopFeatureInlineSettings
                v-if="canEditBranch && activeSetupForItem(item)"
                :shop-slug="selectedShopSlug"
                :setup="activeSetupForItem(item)"
                :child-key="expandedChildKey"
                :label="activeSetupLabelForItem(item)"
                :active="true"
                @saved="onInlineSaved"
                @error="onInlineError"
              />
              <p v-else-if="selectedMode === 'defaults'" class="muted shop-features-inline-hint">
                เลือกสาขาจริงด้านบนเพื่อตั้งค่าข้อมูล — โหมดนี้ใช้เปิด/ปิดฟังก์ชันร้านใหม่เท่านั้น
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>

  <section v-else class="admin-section">
    <div class="state-card">
      <i class="ti ti-lock state-card-icon" aria-hidden="true"></i>
      <p class="state-card-title">เฉพาะแอดมินหลักที่ร้าน default</p>
    </div>
  </section>
</template>

<style scoped>
.shop-features-panel {
  overflow: hidden;
}

.shop-features-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.shop-features-head h3 {
  margin: 0 0 4px;
}

.shop-features-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.shop-features-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.shop-features-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.shop-features-pill:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.shop-features-pill.active {
  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-elevated));
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  color: var(--color-primary-dark);
}

.shop-features-pill--group {
  padding: 10px 16px;
  font-size: 14px;
}

.shop-features-pill--group .ti {
  font-size: 16px;
}

.shop-features-pill--child {
  padding: 6px 12px;
  font-size: 12px;
}

.shop-features-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary-dark);
}

.shop-features-badge--off {
  background: color-mix(in srgb, var(--color-text-muted) 14%, transparent);
  color: var(--color-text-muted);
}

.shop-features-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shop-features-status-chip {
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.shop-features-status-chip--off {
  opacity: 0.65;
}

.shop-features-status-chip--config {
  color: var(--color-primary-dark);
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
}

.shop-features-list {
  min-width: 0;
}

.shop-features-list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.shop-features-list-head h4 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.shop-features-group-hint,
.shop-features-mode-hint {
  margin: 4px 0 0;
  font-size: 13px;
}

.shop-features-reset-btn {
  flex-shrink: 0;
}

.shop-features-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shop-features-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card, var(--radius-md));
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-sm, none);
  overflow: hidden;
  transition: opacity 150ms ease;
}

.shop-features-card--off {
  opacity: 0.82;
}

.shop-features-card--expanded {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.shop-features-card-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}

.shop-features-card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 180px;
  min-width: 0;
}

.shop-features-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.shop-features-card-desc {
  font-size: 12px;
}

.shop-features-locked {
  font-size: 11px;
  color: var(--color-text-muted);
}

.shop-features-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.shop-features-card-status {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  min-width: 2.5em;
  text-align: right;
}

.shop-features-card-status--on {
  color: var(--color-primary-dark);
}

.shop-features-expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.shop-features-expand-btn:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  color: var(--color-primary-dark);
}

.shop-features-expand-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.shop-features-config-note {
  margin: 0;
  padding: 0 16px 14px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.shop-features-card-body {
  padding: 0 16px 16px;
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-text-muted) 4%, var(--color-surface-elevated));
}

.shop-features-children {
  padding: 12px 0 8px;
}

.shop-features-inline-hint {
  margin: 12px 0 0;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
}

@media (max-width: 640px) {
  .shop-features-card-main {
    flex-direction: column;
    align-items: stretch;
  }

  .shop-features-card-actions {
    justify-content: space-between;
    width: 100%;
  }

  .shop-features-status-row {
    display: none;
  }
}
</style>

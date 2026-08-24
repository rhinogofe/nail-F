<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'
import AdminShopFeatureInlineSettings from './AdminShopFeatureInlineSettings.vue'

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
const selectedItemKey = ref('')
const selectedChildKey = ref('')

const DEFAULTS_ID = '__defaults__'

const selectedShop = computed(() =>
  shops.value.find((s) => s.slug === selectedShopSlug.value) || null
)

const selectedGroup = computed(() =>
  catalog.value.find((g) => g.key === selectedGroupKey.value) || catalog.value[0] || null
)

const groupItems = computed(() => selectedGroup.value?.items || [])

const selectedItem = computed(() =>
  groupItems.value.find((item) => item.key === selectedItemKey.value) || groupItems.value[0] || null
)

const currentFeatures = computed(() => {
  if (selectedMode.value === 'defaults') {
    return defaultFeatures.value
  }
  return selectedShop.value?.features || {}
})

const canEditBranch = computed(() => selectedMode.value === 'shop' && !!selectedShopSlug.value)

const activeSetup = computed(() => {
  if (selectedChildKey.value && selectedItem.value?.children?.length) {
    const child = selectedItem.value.children.find((c) => c.key === selectedChildKey.value)
    if (child?.setup) return child.setup
  }
  return selectedItem.value?.setup || null
})

const activeSetupLabel = computed(() => {
  if (selectedChildKey.value && selectedItem.value?.children?.length) {
    const child = selectedItem.value.children.find((c) => c.key === selectedChildKey.value)
    if (child) return child.label
  }
  return selectedItem.value?.label || ''
})

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

function hasChildren(item) {
  return Array.isArray(item?.children) && item.children.length > 0
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
    syncSelectedItem()
  } catch (err) {
    errorMessage.value = err.response?.data?.error || err.message || 'โหลดไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

function syncSelectedItem() {
  const items = groupItems.value
  if (!items.length) {
    selectedItemKey.value = ''
    return
  }
  if (!items.some((item) => item.key === selectedItemKey.value)) {
    selectedItemKey.value = items[0].key
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
  selectedGroupKey.value = catalog.value[0]?.key || ''
  syncSelectedItem()
}

function selectGroup(groupKey) {
  selectedGroupKey.value = groupKey
  syncSelectedItem()
}

function selectItem(itemKey) {
  selectedItemKey.value = itemKey
  selectedChildKey.value = ''
}

function selectChild(childKey) {
  selectedChildKey.value = childKey
}

function onInlineSaved(label) {
  message.value = `บันทึก "${label}" ของ ${selectedShop.value?.name || selectedShopSlug.value} แล้ว`
  emit('saved')
}

function onInlineError(err) {
  errorMessage.value = err
}

async function toggleItem(item) {
  if (isItemLocked(item)) return
  const next = !isItemEnabled(item.key)
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

watch(selectedGroupKey, () => syncSelectedItem())

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
  <section v-if="isManager" class="card admin-section shop-features-panel">
    <header class="shop-features-head">
      <div>
        <h3>ฟังก์ชันตามสาขา</h3>
        <p class="muted">
          เลือกร้าน → เลือกหัวข้อ → ตั้งค่าในหน้านี้ · เปิด/ปิดฟังก์ชันแยกจากตั้งค่าเนื้อหา
        </p>
      </div>
      <button type="button" class="btn ghost admin-action-btn" :disabled="loading" @click="loadAll">
        <i class="ti ti-refresh" aria-hidden="true"></i>
        รีเฟรช
      </button>
    </header>

    <p v-if="message" class="shop-features-msg shop-features-msg--ok">{{ message }}</p>
    <p v-if="errorMessage" class="shop-features-msg shop-features-msg--err">{{ errorMessage }}</p>

    <div v-if="loading" class="muted shop-features-loading">กำลังโหลด...</div>

    <div v-else class="shop-features-layout">
      <aside class="shop-features-shops" aria-label="รายชื่อร้าน">
        <h4 class="shop-features-col-title">ร้าน / สาขา</h4>
        <ul class="shop-features-shop-list">
          <li
            v-for="row in shopRows"
            :key="row.slug"
            class="shop-features-shop-row"
            :class="{
              'shop-features-shop-row--active':
                (row.isDefaults && selectedMode === 'defaults')
                || (!row.isDefaults && selectedMode === 'shop' && selectedShopSlug === row.slug),
              'shop-features-shop-row--defaults': row.isDefaults,
            }"
          >
            <button type="button" class="shop-features-shop-btn" @click="selectShop(row)">
              <span class="shop-features-shop-name">{{ row.name }}</span>
              <span v-if="!row.isDefaults" class="muted shop-features-shop-slug">/{{ row.slug }}</span>
              <span v-if="!row.isDefaults && !row.is_active" class="shop-inactive-badge">ปิด</span>
              <span v-if="row.isDefaults" class="shop-features-defaults-badge">เทมเพลต</span>
            </button>
          </li>
        </ul>
        <p v-if="!shops.length" class="muted shop-features-empty">ยังไม่มีสาขา — สร้างได้ที่ ตั้งค่า → ร้าน/สาขา</p>
      </aside>

      <aside class="shop-features-groups" aria-label="หัวข้อและรายการย่อย">
        <h4 class="shop-features-col-title">หัวข้อ</h4>
        <nav class="shop-features-group-list">
          <button
            v-for="group in catalog"
            :key="group.key"
            type="button"
            class="shop-features-group-btn"
            :class="{ 'shop-features-group-btn--active': selectedGroupKey === group.key }"
            @click="selectGroup(group.key)"
          >
            <i :class="['ti', group.icon]" aria-hidden="true"></i>
            <span>{{ group.label }}</span>
            <span class="shop-features-group-count">{{ group.items.length }}</span>
          </button>
        </nav>

        <div v-if="selectedGroup" class="shop-features-subitems">
          <h4 class="shop-features-col-title shop-features-subitems-title">
            รายการย่อย · {{ selectedGroup.label }}
          </h4>
          <ul class="shop-features-subitem-list">
            <li
              v-for="item in groupItems"
              :key="item.key"
              class="shop-features-subitem-row"
              :class="{
                'shop-features-subitem-row--active': selectedItemKey === item.key,
                'shop-features-subitem-row--off': !isConfigOnly(item) && !isItemEnabled(item.key),
              }"
            >
              <button type="button" class="shop-features-subitem-btn" @click="selectItem(item.key)">
                <span class="shop-features-subitem-label">{{ item.label }}</span>
                <span v-if="isConfigOnly(item)" class="shop-features-subitem-status shop-features-subitem-status--config">
                  ตั้งค่า
                </span>
                <span v-else class="shop-features-subitem-status">{{ isItemEnabled(item.key) ? 'เปิด' : 'ปิด' }}</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      <div class="shop-features-items">
        <header class="shop-features-items-head">
          <div>
            <h4 class="shop-features-col-title">
              {{ selectedItem?.label || 'รายละเอียด' }}
            </h4>
            <p v-if="selectedGroup?.hint" class="muted shop-features-group-hint">{{ selectedGroup.hint }}</p>
            <p v-if="selectedMode === 'defaults'" class="muted shop-features-mode-hint">
              กำลังตั้งค่าเริ่มต้น — ร้านที่สร้างใหม่จะได้ค่านี้ · เลือกสาขาเพื่อแก้ข้อมูลจริง
            </p>
            <p v-else-if="selectedShop" class="muted shop-features-mode-hint">
              สาขา: <strong>{{ selectedShop.name }}</strong> — แก้ข้อมูลด้านล่างแล้วกดบันทึก
            </p>
          </div>
          <button
            v-if="selectedMode === 'shop' && selectedShop"
            type="button"
            class="btn ghost admin-action-btn"
            :disabled="savingKey === '__reset__'"
            @click="resetShopToDefaults"
          >
            รีเซ็ตเป็นค่าเริ่มต้น
          </button>
        </header>

        <div v-if="selectedItem" class="shop-features-detail">
          <div
            v-if="!isConfigOnly(selectedItem)"
            class="shop-features-item-row"
            :class="{ 'shop-features-item-row--off': !isItemEnabled(selectedItem.key) }"
          >
            <div class="shop-features-item-info">
              <strong>{{ selectedItem.label }}</strong>
              <span v-if="isItemLocked(selectedItem)" class="shop-features-locked">บังคับเปิด</span>
              <span v-else class="muted shop-features-item-desc">เปิด/ปิดการแสดงให้สาขานี้</span>
            </div>
            <div class="shop-features-item-actions">
              <label class="admin-checkbox shop-features-toggle">
                <input
                  type="checkbox"
                  :checked="isItemEnabled(selectedItem.key)"
                  :disabled="isItemLocked(selectedItem) || savingKey === selectedItem.key"
                  @change="toggleItem(selectedItem)"
                />
                {{ isItemEnabled(selectedItem.key) ? 'เปิด' : 'ปิด' }}
              </label>
            </div>
          </div>

          <p v-else class="shop-features-config-only-hint muted">
            หัวข้อนี้ใช้ตั้งค่าเนื้อหาเท่านั้น — ไม่มีสวิตช์เปิด/ปิดแยก
          </p>

          <p v-if="selectedItem.configNote" class="shop-features-config-note">
            {{ selectedItem.configNote }}
          </p>

          <div v-if="hasChildren(selectedItem)" class="shop-features-children">
            <h5 class="shop-features-children-title">รายการย่อย — เลือกเพื่อตั้งค่า</h5>
            <ul class="shop-features-children-list">
              <li
                v-for="child in selectedItem.children"
                :key="child.key"
                class="shop-features-child-row"
                :class="{ 'shop-features-child-row--active': selectedChildKey === child.key }"
              >
                <button type="button" class="shop-features-child-btn" @click="selectChild(child.key)">
                  <strong>{{ child.label }}</strong>
                </button>
              </li>
            </ul>
          </div>

          <AdminShopFeatureInlineSettings
            v-if="canEditBranch && activeSetup && !selectedItem.configNote"
            :shop-slug="selectedShopSlug"
            :setup="activeSetup"
            :child-key="selectedChildKey"
            :label="activeSetupLabel"
            :active="true"
            @saved="onInlineSaved"
            @error="onInlineError"
          />
          <p v-else-if="selectedMode === 'defaults' && activeSetup && !selectedItem.configNote" class="muted shop-features-inline-hint">
            เลือกสาขาจริงทางซ้ายเพื่อตั้งค่าข้อมูล — โหมดนี้ใช้เปิด/ปิดฟังก์ชันร้านใหม่เท่านั้น
          </p>
        </div>
        <p v-else class="muted">เลือกรายการย่อยจากคอลัมน์กลาง</p>
      </div>
    </div>
  </section>

  <section v-else class="card admin-section">
    <p class="muted">เฉพาะแอดมินหลักที่ร้าน default เท่านั้น</p>
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

.shop-features-subitem-status--config {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.shop-features-config-only-hint {
  margin: 0 0 10px;
  font-size: 13px;
}

.shop-features-config-note {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-text);
}

.shop-features-msg {
  margin: 0 0 10px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.shop-features-msg--ok {
  background: color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent);
  color: var(--color-text-secondary);
}

.shop-features-msg--err {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
}

.shop-features-loading {
  padding: 24px 0;
}

.shop-features-layout {
  display: grid;
  grid-template-columns: minmax(170px, 200px) minmax(200px, 260px) minmax(0, 1fr);
  gap: 0;
  min-height: 460px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.shop-features-col-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.shop-features-shops,
.shop-features-groups {
  background: color-mix(in srgb, var(--color-surface-elevated) 96%, var(--color-primary-light));
  border-right: 1px solid var(--color-border);
  padding: 14px 10px;
  overflow-y: auto;
  max-height: 620px;
}

.shop-features-items {
  padding: 14px 16px;
  overflow-y: auto;
  max-height: 620px;
}

.shop-features-shop-list,
.shop-features-group-list,
.shop-features-subitem-list,
.shop-features-children-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.shop-features-shop-row {
  margin-bottom: 4px;
}

.shop-features-shop-btn {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  text-align: left;
  padding: 10px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: background var(--transition), border-color var(--transition);
}

.shop-features-shop-row--active .shop-features-shop-btn {
  background: var(--color-primary-light);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.shop-features-shop-row--defaults .shop-features-shop-btn {
  border-style: dashed;
}

.shop-features-shop-name {
  font-weight: 600;
  font-size: 14px;
}

.shop-features-shop-slug {
  font-size: 12px;
}

.shop-features-defaults-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary-dark);
}

.shop-features-group-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
  transition: background var(--transition);
}

.shop-features-group-btn i {
  font-size: 16px;
  opacity: 0.85;
}

.shop-features-group-btn span:first-of-type {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.shop-features-group-btn--active {
  background: var(--color-primary-light);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-primary-dark);
  font-weight: 600;
}

.shop-features-group-count {
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-muted) 15%, transparent);
  color: var(--color-text-muted);
}

.shop-features-subitems {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--color-border);
}

.shop-features-subitems-title {
  font-size: 11px;
}

.shop-features-subitem-row {
  margin-bottom: 4px;
}

.shop-features-subitem-btn {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  text-align: left;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: background var(--transition), border-color var(--transition);
}

.shop-features-subitem-row--active .shop-features-subitem-btn {
  background: var(--color-primary-light);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.shop-features-subitem-row--off .shop-features-subitem-btn {
  opacity: 0.75;
}

.shop-features-subitem-label {
  flex: 1 1 120px;
  font-size: 13px;
  font-weight: 600;
}

.shop-features-subitem-status {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.shop-features-subitem-child-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-muted) 12%, transparent);
  color: var(--color-text-muted);
}

.shop-features-items-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.shop-features-group-hint,
.shop-features-mode-hint {
  margin: 4px 0 0;
  font-size: 13px;
}

.shop-features-item-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
}

.shop-features-item-row--off {
  opacity: 0.78;
  background: color-mix(in srgb, var(--color-text-muted) 6%, var(--color-surface-elevated));
}

.shop-features-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 180px;
}

.shop-features-item-desc {
  font-size: 12px;
}

.shop-features-locked {
  font-size: 11px;
  color: var(--color-text-muted);
}

.shop-features-item-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.shop-features-toggle {
  margin: 0;
  white-space: nowrap;
}

.shop-features-setup-btn {
  padding: 6px 12px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.shop-features-children {
  margin-top: 4px;
}

.shop-features-children-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.shop-features-child-row {
  margin-bottom: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.shop-features-child-row--active {
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.shop-features-child-btn {
  width: 100%;
  display: block;
  text-align: left;
  padding: 10px 12px;
  border: none;
  background: color-mix(in srgb, var(--color-surface-elevated) 90%, var(--color-primary-light));
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.shop-features-child-row--active .shop-features-child-btn {
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.shop-features-inline-hint {
  margin-top: 12px;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
}

.shop-features-empty {
  font-size: 13px;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .shop-features-layout {
    grid-template-columns: 1fr;
    min-height: unset;
  }

  .shop-features-shops,
  .shop-features-groups {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    max-height: 240px;
  }

  .shop-features-items {
    max-height: none;
  }
}
</style>

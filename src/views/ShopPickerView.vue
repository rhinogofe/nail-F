<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '../stores/shop'
import BrandMark from '../components/BrandMark.vue'
import { useUiSettingsStore } from '../stores/uiSettings'

const router = useRouter()
const shopStore = useShopStore()
const ui = useUiSettingsStore()
const loading = ref(true)

onMounted(async () => {
  try {
    await shopStore.fetchShops()
    if (shopStore.shops.length === 1) {
      router.replace(`/${shopStore.shops[0].slug}/bookings`)
      return
    }
    const saved = shopStore.slug
    if (saved && shopStore.shops.some((s) => s.slug === saved)) {
      router.replace(`/${saved}/bookings`)
      return
    }
  } finally {
    loading.value = false
  }
})

function enterShop(slug) {
  router.push(`/${slug}/bookings`)
}
</script>

<template>
  <main class="shop-picker app-page app-page--standalone center">
    <section class="card shop-picker-card">
      <div class="shop-picker-brand">
        <BrandMark show-sparkle />
      </div>
      <h1 class="shop-picker-title">{{ ui.get('ui_shop_picker_title', 'เลือกร้าน') }}</h1>
      <p class="muted shop-picker-sub">{{ ui.get('ui_shop_picker_subtitle', 'เลือกสาขาที่ต้องการจองคิว') }}</p>

      <div v-if="loading" class="state-card shop-state">
        <i class="ti ti-loader-2 state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">กำลังโหลดรายการร้าน...</p>
      </div>
      <div v-else-if="shopStore.error" class="state-card shop-state">
        <i class="ti ti-alert-circle state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">{{ shopStore.error }}</p>
      </div>

      <ul v-else-if="shopStore.shops.length" class="shop-list">
        <li v-for="shop in shopStore.shops" :key="shop.id">
          <button type="button" class="shop-item" @click="enterShop(shop.slug)">
            <span class="shop-item-left">
              <span class="shop-item-icon" aria-hidden="true">
                <i class="ti ti-building-store"></i>
              </span>
              <span class="shop-item-text">
                <span class="shop-item-name">{{ shop.name }}</span>
                <span class="shop-item-slug">/{{ shop.slug }}</span>
              </span>
            </span>
            <i class="ti ti-chevron-right shop-item-arrow" aria-hidden="true"></i>
          </button>
        </li>
      </ul>

      <div v-else class="state-card shop-state">
        <i class="ti ti-building-store state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">ยังไม่มีร้านในระบบ</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.shop-picker {
  padding: var(--space-6) var(--page-padding-x);
}

.shop-picker-card {
  width: 100%;
  max-width: 400px;
  padding: var(--space-6) var(--space-5);
}

.shop-picker-brand {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.shop-picker-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-h1);
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
}

.shop-picker-sub {
  margin: 0 0 var(--space-5);
  text-align: center;
}

.shop-state {
  padding: var(--space-6) var(--space-4);
}

.shop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.shop-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-elevated);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color var(--transition), background var(--transition), box-shadow var(--transition), transform var(--transition);
  min-height: var(--touch-min);
  box-shadow: var(--shadow-sm);
}

.shop-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: var(--shadow-md);
}

.shop-item:active {
  transform: scale(0.99);
}

.shop-item-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.shop-item-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-accent-light);
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
}

.shop-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.shop-item-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.shop-item-slug {
  font-size: var(--text-label);
  color: var(--color-text-muted);
}

.shop-item-arrow {
  color: var(--color-text-muted);
  font-size: 18px;
  flex-shrink: 0;
}

.shop-item:hover .shop-item-arrow {
  color: var(--color-primary);
}
</style>

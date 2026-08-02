<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '../stores/shop'
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
  <main class="shop-picker center">
    <section class="card shop-picker-card">
      <h1 class="shop-picker-title">{{ ui.get('ui_shop_picker_title', 'เลือกร้าน') }}</h1>
      <p class="muted shop-picker-sub">{{ ui.get('ui_shop_picker_subtitle', 'เลือกสาขาที่ต้องการจองคิว') }}</p>

      <p v-if="loading" class="muted">กำลังโหลด...</p>
      <p v-else-if="shopStore.error" class="error-text">{{ shopStore.error }}</p>

      <ul v-else-if="shopStore.shops.length" class="shop-list">
        <li v-for="shop in shopStore.shops" :key="shop.id">
          <button type="button" class="shop-item" @click="enterShop(shop.slug)">
            <span class="shop-item-name">{{ shop.name }}</span>
            <span class="shop-item-slug">/{{ shop.slug }}</span>
          </button>
        </li>
      </ul>

      <p v-else class="muted">ยังไม่มีร้านในระบบ</p>
    </section>
  </main>
</template>

<style scoped>
.shop-picker {
  min-height: 100svh;
  padding: 24px 16px;
}

.shop-picker-card {
  width: 100%;
  max-width: 400px;
  padding: 24px 20px;
}

.shop-picker-title {
  margin: 0 0 6px;
  font-size: 1.35rem;
}

.shop-picker-sub {
  margin: 0 0 20px;
}

.shop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shop-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color var(--transition), background var(--transition);
}

.shop-item:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-elevated);
}

.shop-item-name {
  font-weight: 600;
  color: var(--color-text);
}

.shop-item-slug {
  font-size: var(--text-label);
  color: var(--color-text-muted);
}

.error-text {
  color: var(--color-danger, #c0392b);
}
</style>

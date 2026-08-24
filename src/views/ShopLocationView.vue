<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomNav from '../components/BottomNav.vue'
import BrandMark from '../components/BrandMark.vue'
import AccountMenuDrawer from '../components/AccountMenuDrawer.vue'
import { useUiSettingsStore } from '../stores/uiSettings'
import { useShopRoute } from '../composables/useShopRoute'
import { hasShopMapUrl, resolveShopMapEmbedUrl } from '../utils/shopMapEmbed'

const ui = useUiSettingsStore()
const router = useRouter()
const { shopPath } = useShopRoute()
const ready = ref(false)

const pageTitle = computed(() => ui.get('ui_shop_location_page_title', 'ที่อยู่ร้าน'))
const openMapsLabel = computed(() => ui.get('ui_shop_open_maps_btn', 'เปิดใน Google Maps'))
const mapUrl = computed(() => String(ui.get('ui_shop_map_url', '')).trim())
const addressDetail = computed(() => String(ui.get('ui_shop_address_detail', '')).trim())
const embedUrl = computed(() =>
  resolveShopMapEmbedUrl(mapUrl.value, ui.get('ui_shop_map_embed_url', ''))
)
const hasMap = computed(() => hasShopMapUrl(mapUrl.value))

onMounted(() => {
  if (!hasMap.value) {
    router.replace(shopPath('/bookings'))
    return
  }
  ready.value = true
})

function openMaps() {
  if (!mapUrl.value) return
  window.open(mapUrl.value, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div v-if="ready && hasMap" class="app-page app-page--nav location-page">
    <header class="hdr app-header">
      <div class="hdr-top">
        <div class="hdr-title-wrap">
          <BrandMark />
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <AccountMenuDrawer />
      </div>
    </header>

    <main class="content app-content">
      <section v-if="embedUrl" class="map-panel" aria-label="แผนที่ร้าน">
        <div class="map-embed-wrap">
          <iframe
            :src="embedUrl"
            class="map-embed"
            :title="pageTitle"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen
          />
        </div>
      </section>

      <section v-if="addressDetail" class="address-card">
        <h2 class="address-title">
          <i class="ti ti-map-pin" aria-hidden="true"></i>
          รายละเอียดที่อยู่
        </h2>
        <p class="address-text">{{ addressDetail }}</p>
      </section>

      <button type="button" class="btn-open-maps" @click="openMaps">
        <i class="ti ti-external-link" aria-hidden="true"></i>
        {{ openMapsLabel }}
      </button>
    </main>

    <BottomNav active="location" />
  </div>
</template>

<style scoped>
.location-page {
  padding: 0;
  background: var(--color-background);
}

.hdr {
  padding-bottom: var(--space-2);
}

.hdr-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
}

.hdr-title-wrap {
  flex: 1 1 0;
  min-width: 0;
}

.page-title {
  margin: var(--space-1) 0 0;
  font-size: var(--text-h2);
  line-height: var(--lh-tight);
  color: var(--color-text-primary);
}

.content {
  padding: 0 var(--page-padding-x) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.map-panel {
  border-radius: var(--radius-card);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-card);
}

.map-embed-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  min-height: 220px;
  background: var(--color-surface);
}

.map-embed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.address-card {
  padding: var(--space-4);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-card);
}

.address-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.address-text {
  margin: 0;
  font-size: var(--text-body);
  line-height: 1.55;
  color: var(--color-text-secondary);
  white-space: pre-line;
}

.btn-open-maps {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: 14px var(--space-4);
  border-radius: var(--radius-card);
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-light) 45%, white);
  color: var(--color-primary);
  font-size: var(--text-body);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.btn-open-maps:active {
  transform: scale(0.99);
}
</style>

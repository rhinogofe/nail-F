<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import BrandMark from '../components/BrandMark.vue'
import AccountMenuDrawer from '../components/AccountMenuDrawer.vue'
import { useUiSettingsStore } from '../stores/uiSettings'
import { useShopRoute } from '../composables/useShopRoute'
import { useShopRealtime } from '../composables/useShopRealtime'
import { hasShopMapUrl, normalizeMapIframeUrl, resolveShopMapEmbedUrl } from '../utils/shopMapEmbed'

const ui = useUiSettingsStore()
const router = useRouter()
const { shopPath, shopSlug } = useShopRoute()

const loadingMap = ref(false)
const mapChecked = ref(false)
const embedUrl = ref('')

const pageTitle = computed(() => ui.get('ui_shop_location_page_title', 'ที่อยู่ร้าน'))
const openMapsLabel = computed(() => ui.get('ui_shop_open_maps_btn', 'เปิดใน Google Maps'))
const mapUrl = computed(() => String(ui.get('ui_shop_map_url', '')).trim())
const addressDetail = computed(() => String(ui.get('ui_shop_address_detail', '')).trim())
const hasMap = computed(() => hasShopMapUrl(mapUrl.value))

function uiSettingsReadyForShop() {
  return ui.loadedForSlug === shopSlug.value
}

async function ensureUiSettings() {
  if (uiSettingsReadyForShop()) return
  await ui.fetch().catch(() => null)
}

function redirectIfMissingMap(replaceIfMissing = false) {
  if (hasMap.value) return false
  if (replaceIfMissing) router.replace(shopPath('/bookings'))
  return true
}

async function resolveEmbedUrl() {
  const stored = normalizeMapIframeUrl(String(ui.get('ui_shop_map_embed_url', '')).trim())
  let url = stored || resolveShopMapEmbedUrl(mapUrl.value, '')

  if (url) return url

  try {
    const { data } = await api.get('/api/bookings/map-embed')
    url = String(data?.embed_url || '').trim()
    if (import.meta.env.DEV || !url) {
      console.warn('[map-embed] location page', {
        map_url: mapUrl.value,
        embed_url: url,
        debug: data?.debug || null,
      })
    }
    if (url) {
      ui.applyLocal({ ui_shop_map_embed_url: url })
    }
  } catch (err) {
    console.warn('[map-embed] location page fetch failed', err?.response?.data || err?.message)
  }

  return url
}

async function loadMapData() {
  if (!hasMap.value) {
    mapChecked.value = true
    return
  }

  const cached = normalizeMapIframeUrl(String(ui.get('ui_shop_map_embed_url', '')).trim())
    || resolveShopMapEmbedUrl(mapUrl.value, '')
  if (cached) {
    embedUrl.value = cached
    mapChecked.value = true
    return
  }

  loadingMap.value = true
  mapChecked.value = false
  try {
    embedUrl.value = await resolveEmbedUrl()
  } finally {
    loadingMap.value = false
    mapChecked.value = true
  }
}

async function initLocationPage({ replaceIfMissing = false } = {}) {
  if (uiSettingsReadyForShop()) {
    if (redirectIfMissingMap(replaceIfMissing)) return
    void loadMapData()
    return
  }

  await ensureUiSettings()
  if (redirectIfMissingMap(replaceIfMissing)) return
  void loadMapData()
}

async function refreshLocationPage() {
  await ui.fetch().catch(() => null)
  if (!hasMap.value) {
    router.replace(shopPath('/bookings'))
    return
  }
  void loadMapData()
}

useShopRealtime({
  enabled: true,
  shopSlug,
  onChange: (event) => {
    if (event?.type === 'settings' || !event?.type) {
      void refreshLocationPage()
    }
  },
})

onMounted(() => {
  void initLocationPage({ replaceIfMissing: true })
})

function openMaps() {
  if (!mapUrl.value) return
  window.open(mapUrl.value, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="app-page app-page--nav location-page">
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
      <section v-if="hasMap" class="map-panel" aria-label="แผนที่ร้าน">
        <div
          v-if="loadingMap"
          class="map-embed-wrap map-skeleton skeleton"
          aria-busy="true"
          aria-label="กำลังโหลดแผนที่"
        />

        <div v-else-if="embedUrl" class="map-embed-wrap">
          <iframe
            :src="embedUrl"
            class="map-embed"
            :title="pageTitle"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allow="fullscreen; geolocation"
            allowfullscreen
          />
        </div>

        <div v-else-if="mapChecked" class="map-empty-state">
          <i class="ti ti-map-off" aria-hidden="true"></i>
          <p>ไม่พบข้อมูลแผนที่</p>
        </div>

        <div
          v-else
          class="map-embed-wrap map-skeleton skeleton"
          aria-busy="true"
          aria-label="กำลังโหลดแผนที่"
        />
      </section>

      <section v-if="addressDetail" class="address-card">
        <h2 class="address-title">
          <i class="ti ti-map-pin" aria-hidden="true"></i>
          รายละเอียดที่อยู่
        </h2>
        <p class="address-text">{{ addressDetail }}</p>
      </section>

      <button v-if="hasMap" type="button" class="btn-open-maps" @click="openMaps">
        <i class="ti ti-external-link" aria-hidden="true"></i>
        {{ openMapsLabel }}
      </button>
    </main>

    <BottomNav active="location" />
  </div>
</template>

<style scoped>
.location-page {
  padding-top: 0;
  padding-right: 0;
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

.map-skeleton {
  border-radius: 0;
}

.map-embed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.map-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 220px;
  padding: var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.map-empty-state i {
  font-size: 28px;
}

.map-empty-state p {
  margin: 0;
  font-size: var(--text-body);
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

@media (min-width: 900px) {
  .map-embed-wrap,
  .map-empty-state {
    aspect-ratio: 32 / 9;
    min-height: 190px;
  }

  .btn-open-maps {
    width: auto;
    align-self: start;
    min-width: 220px;
  }
}
</style>

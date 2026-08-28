<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import BrandMark from '../components/BrandMark.vue'
import AccountMenuDrawer from '../components/AccountMenuDrawer.vue'
import { useUiSettingsStore } from '../stores/uiSettings'
import { useShopRoute } from '../composables/useShopRoute'
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock'
import { useShopRealtime } from '../composables/useShopRealtime'
import { clipThumbnailSrc } from '../utils/clipThumbnail'

const ui = useUiSettingsStore()
const { shopSlug } = useShopRoute()

const clips = ref([])
const failedThumbs = ref(new Set())
const loading = ref(false)
const errorMessage = ref('')
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerScrollRef = ref(null)
const playKey = ref(0)

function embedUrl(clip, autoplay = false) {
  if (!clip) return ''
  const source = clip.source || 'tiktok'
  if (source === 'instagram') {
    const url = clip.tiktok_url || ''
    const reelMatch = url.match(/\/reel\/([^/?]+)/i)
    if (reelMatch?.[1]) {
      return `https://www.instagram.com/reel/${reelMatch[1]}/embed`
    }
    const postId = clip.video_id || url.match(/\/p\/([^/?]+)/i)?.[1]
    if (!postId) return ''
    return `https://www.instagram.com/p/${postId}/embed`
  }

  const videoId = clip.video_id
  if (!videoId) return ''
  const params = new URLSearchParams()
  if (autoplay) params.set('autoplay', '1')
  const qs = params.toString()
  return `https://www.tiktok.com/embed/v2/${videoId}${qs ? `?${qs}` : ''}`
}

function clipSourceLabel(clip) {
  return (clip?.source || 'tiktok') === 'instagram' ? 'Instagram' : 'TikTok'
}

function clipFallbackIcon(clip) {
  return (clip?.source || 'tiktok') === 'instagram' ? 'ti ti-brand-instagram' : 'ti ti-brand-tiktok'
}

function openClipExternally(clip) {
  if (!clip?.tiktok_url) return
  window.open(clip.tiktok_url, '_blank', 'noopener,noreferrer')
}

function isActiveSlide(index) {
  return index === viewerIndex.value
}

function showThumb(clip) {
  return Boolean(clip?.id) && !failedThumbs.value.has(clip.id)
}

function onThumbError(clipId) {
  failedThumbs.value = new Set([...failedThumbs.value, clipId])
}

async function loadClips({ silent = false } = {}) {
  if (!silent) loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/api/reviews/clips')
    clips.value = data || []
    failedThumbs.value = new Set()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดคลิปไม่สำเร็จ'
  } finally {
    if (!silent) loading.value = false
  }
}

useShopRealtime({
  enabled: true,
  shopSlug,
  onChange: (event) => {
    const type = event?.type || ''
    if (type === 'reviews' || type === 'settings' || !type) {
      if (type === 'settings') void ui.fetch().catch(() => null)
      void loadClips({ silent: true })
    }
  },
})

async function openViewer(index) {
  viewerIndex.value = index
  playKey.value += 1
  viewerOpen.value = true
  lockBodyScroll()
  await nextTick()
  const el = viewerScrollRef.value
  if (el) {
    el.scrollTop = index * el.clientHeight
  }
}

function closeViewer() {
  viewerOpen.value = false
  unlockBodyScroll()
}

function onViewerScroll() {
  const el = viewerScrollRef.value
  if (!el || !el.clientHeight) return
  const index = Math.round(el.scrollTop / el.clientHeight)
  if (index >= 0 && index < clips.value.length && index !== viewerIndex.value) {
    viewerIndex.value = index
    playKey.value += 1
  }
}

onMounted(loadClips)
onUnmounted(() => unlockBodyScroll())
</script>

<template>
  <div class="app-page app-page--nav reviews-page">
    <header class="hdr app-header">
      <div class="hdr-top">
        <div class="hdr-title-wrap">
          <BrandMark />
          <h1 class="page-title">{{ ui.get('ui_reviews_title', 'รีวิว') }}</h1>
          <p class="page-sub">{{ ui.get('ui_reviews_subtitle', 'ผลงานจาก TikTok และ Instagram') }}</p>
        </div>
        <AccountMenuDrawer />
      </div>
    </header>

    <main class="content app-content">
      <p v-if="loading" class="muted loading-hint">กำลังโหลด...</p>
      <p v-else-if="errorMessage" class="alert-banner error content-alert">{{ errorMessage }}</p>

      <div v-else-if="clips.length === 0" class="empty state-card">
        <i class="ti ti-video-off state-card-icon" aria-hidden="true"></i>
        <p class="state-card-title">{{ ui.get('ui_reviews_empty', 'ยังไม่มีคลิปรีวิว') }}</p>
        <p class="muted">{{ ui.get('ui_reviews_empty_hint', 'รอแอดมินเพิ่มลิงก์ TikTok หรือ Instagram') }}</p>
      </div>

      <div v-else class="clip-grid" aria-label="คลิปรีวิว">
        <button
          v-for="(clip, index) in clips"
          :key="clip.id"
          type="button"
          class="clip-cell"
          @click="openViewer(index)"
        >
          <img
            v-if="showThumb(clip)"
            :src="clipThumbnailSrc(clip.id)"
            :alt="clip.title || `คลิป ${index + 1}`"
            class="clip-thumb"
            referrerpolicy="no-referrer"
            @error="onThumbError(clip.id)"
          />
          <div v-else class="clip-thumb-fallback">
            <i :class="clipFallbackIcon(clip)" aria-hidden="true"></i>
            <span class="clip-fallback-title">{{ clip.title || `คลิป ${index + 1}` }}</span>
          </div>
          <span class="clip-play" aria-hidden="true">
            <i class="ti ti-player-play-filled"></i>
          </span>
          <span class="clip-source-badge">{{ clipSourceLabel(clip) }}</span>
        </button>
      </div>
    </main>

    <Teleport to="body">
      <div v-if="viewerOpen" class="viewer" role="dialog" aria-modal="true" aria-label="ดูคลิป">
        <button type="button" class="viewer-close" aria-label="ปิด" @click="closeViewer">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>

        <div
          ref="viewerScrollRef"
          class="viewer-scroll"
          @scroll.passive="onViewerScroll"
        >
          <section
            v-for="(clip, index) in clips"
            :key="clip.id"
            class="viewer-slide"
          >
            <div class="viewer-embed-wrap">
              <iframe
                v-if="isActiveSlide(index)"
                :key="`${clip.id}-${viewerIndex}-${playKey}`"
                :src="embedUrl(clip, clip.source !== 'instagram')"
                class="viewer-embed"
                :class="{ 'viewer-embed-instagram': clip.source === 'instagram' }"
                :title="clip.title || `${clipSourceLabel(clip)} clip ${index + 1}`"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                scrolling="no"
              />
              <div v-else class="viewer-embed-placeholder">
                <img
                  v-if="showThumb(clip)"
                  :src="clipThumbnailSrc(clip.id)"
                  alt=""
                  class="viewer-embed-poster"
                  referrerpolicy="no-referrer"
                />
              </div>
            </div>

            <div class="viewer-meta">
              <p v-if="clip.title" class="viewer-title">{{ clip.title }}</p>
              <p class="viewer-hint">
                {{ index + 1 }} / {{ clips.length }}
                · เลื่อนลง = ถัดไป · เลื่อนขึ้น = ก่อนหน้า
              </p>
              <button type="button" class="viewer-tiktok-btn" @click="openClipExternally(clip)">
                เปิดใน {{ clipSourceLabel(clip) }}
              </button>
            </div>
          </section>
        </div>
      </div>
    </Teleport>

    <BottomNav active="reviews" />
  </div>
</template>

<style scoped>
.reviews-page {
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

.page-sub {
  margin: var(--space-1) 0 0;
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  line-height: 1.35;
}

.content {
  padding: 0 var(--page-padding-x) var(--space-4);
}

.content-alert {
  margin: var(--space-3) 0;
}

.loading-hint {
  text-align: center;
  padding: var(--space-4);
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--text-caption);
}

.empty {
  margin: var(--space-3) 0;
}

.clip-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  padding: var(--space-2) 0 0;
}

@media (min-width: 900px) {
  .clip-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
  }
}

.clip-cell {
  position: relative;
  aspect-ratio: 9 / 16;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-text-primary);
  cursor: pointer;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition), box-shadow var(--transition);
}

.clip-cell:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.clip-cell:active {
  transform: scale(0.98);
}

.clip-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.clip-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: linear-gradient(160deg, var(--color-text-primary), color-mix(in srgb, var(--color-primary-dark) 80%, var(--color-text-primary)));
  color: var(--color-on-primary);
  font-size: 28px;
  padding: var(--space-2);
}

.clip-fallback-title {
  font-size: var(--text-label);
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
  color: var(--color-surface-muted);
}

.clip-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(transparent 35%, color-mix(in srgb, var(--color-text-primary) 72%, transparent));
  color: var(--color-on-primary);
  font-size: 22px;
  pointer-events: none;
}

.clip-source-badge {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 55%, transparent);
  backdrop-filter: blur(6px);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: 600;
  pointer-events: none;
}

.viewer {
  position: fixed;
  inset: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: var(--page-max-width);
  z-index: var(--z-overlay);
  background: var(--color-text-primary);
}

@media (min-width: 900px) {
  .viewer {
    left: 0;
    transform: none;
    max-width: none;
  }
}

.viewer-close {
  position: absolute;
  top: max(var(--space-3), env(safe-area-inset-top));
  left: var(--space-3);
  z-index: 110;
  width: var(--touch-min);
  height: var(--touch-min);
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-text-primary) 72%, transparent);
  color: var(--color-on-primary);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.viewer-scroll {
  height: 100svh;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
}

.viewer-slide {
  height: 100svh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  position: relative;
  overflow: hidden;
  background: var(--color-text-primary);
}

.viewer-embed-wrap {
  position: absolute;
  top: calc(52px + env(safe-area-inset-top));
  left: 0;
  right: 0;
  bottom: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-embed {
  width: 100%;
  height: 100%;
  max-width: 100%;
  border: 0;
  display: block;
}

.viewer-embed-placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-embed-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.45;
}

.viewer-meta {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: var(--space-3) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
  color: var(--color-on-primary);
  text-align: center;
  background: linear-gradient(transparent, color-mix(in srgb, var(--color-text-primary) 92%, transparent));
}

.viewer-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-body);
  font-weight: 600;
}

.viewer-hint {
  margin: 0 0 var(--space-2);
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.viewer-embed-instagram {
  max-width: 540px;
  margin: 0 auto;
  border-radius: var(--radius-md);
  background: var(--color-on-primary);
}

.viewer-tiktok-btn {
  border: none;
  border-radius: var(--radius-pill);
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-size: var(--text-caption);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  min-height: var(--touch-min);
}
</style>

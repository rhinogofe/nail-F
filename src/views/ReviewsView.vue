<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import { clipThumbnailSrc } from '../utils/clipThumbnail'

const auth = useAuthStore()

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

async function loadClips() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/api/reviews/clips')
    clips.value = data || []
    failedThumbs.value = new Set()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดคลิปไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

function lockBodyScroll(lock) {
  document.body.style.overflow = lock ? 'hidden' : ''
}

async function openViewer(index) {
  viewerIndex.value = index
  playKey.value += 1
  viewerOpen.value = true
  lockBodyScroll(true)
  await nextTick()
  const el = viewerScrollRef.value
  if (el) {
    el.scrollTop = index * el.clientHeight
  }
}

function closeViewer() {
  viewerOpen.value = false
  lockBodyScroll(false)
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

const initials = computed(() => {
  const n = auth.user?.name || ''
  return n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'NA'
})

onMounted(loadClips)
onUnmounted(() => lockBodyScroll(false))
</script>

<template>
  <div class="page">
    <header class="hdr">
      <div class="hdr-top">
        <div class="hdr-title-wrap">
          <div class="brand">
            Nail<span class="brand-accent">Thuean</span>
          </div>
          <h1 class="page-title">รีวิว</h1>
          <p class="page-sub">ผลงานจาก TikTok และ Instagram</p>
        </div>
        <div class="avatar" :title="auth.user?.name">{{ initials }}</div>
      </div>
    </header>

    <main class="content">
      <p v-if="loading" class="muted loading-hint">กำลังโหลด...</p>
      <p v-else-if="errorMessage" class="alert error">{{ errorMessage }}</p>

      <div v-else-if="clips.length === 0" class="empty card">
        <i class="ti ti-video-off empty-icon" aria-hidden="true"></i>
        <p>ยังไม่มีคลิปรีวิว</p>
        <p class="muted">รอแอดมินเพิ่มลิงก์ TikTok หรือ Instagram</p>
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
.page {
  font-family: var(--font-body);
  background: var(--color-surface);
  display: block;
  padding: 0;
  gap: 0;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0) + 8px);
}

.hdr {
  background: rgba(255, 251, 249, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  padding: 10px var(--page-padding-x) 8px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.hdr-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hdr-title-wrap {
  min-width: 0;
}

.brand {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.brand-accent {
  color: var(--color-primary);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.page-title {
  margin: 2px 0 0;
  font-size: 18px;
  line-height: 1.2;
  color: #1e293b;
}

.page-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.35;
}

.content {
  padding: 0;
}

.loading-hint {
  text-align: center;
  padding: 16px;
}

.muted {
  color: #94a3b8;
  font-size: 13px;
}

.alert.error {
  background: #fef2f2;
  color: #b91c1c;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  margin: 14px 16px;
}

.empty {
  text-align: center;
  padding: 32px 16px;
  margin: 14px 16px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.empty-icon {
  font-size: 36px;
  color: #cbd5e1;
  display: block;
  margin-bottom: 8px;
}

.clip-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 8px var(--page-padding-x) 0;
}

.clip-cell {
  position: relative;
  aspect-ratio: 9 / 16;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: #2D2424;
  cursor: pointer;
  overflow: hidden;
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
  gap: 6px;
  background: linear-gradient(160deg, #1e293b, #0f172a);
  color: #fff;
  font-size: 28px;
  padding: 8px;
}

.clip-fallback-title {
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
  color: #e2e8f0;
}

.clip-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(transparent 40%, rgba(45, 36, 36, 0.55));
  color: #fff;
  font-size: 22px;
  pointer-events: none;
}

.viewer {
  position: fixed;
  inset: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  z-index: 100;
  background: #000;
}

.viewer-close {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  left: 12px;
  z-index: 110;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.65);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: #000;
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
  background: #0f172a;
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
  padding: 14px 16px max(18px, env(safe-area-inset-bottom));
  color: #fff;
  text-align: center;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.92));
}

.viewer-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}

.viewer-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #cbd5e1;
}

.viewer-embed-instagram {
  max-width: 540px;
  margin: 0 auto;
  border-radius: 12px;
  background: #fff;
}

.viewer-tiktok-btn {
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
</style>

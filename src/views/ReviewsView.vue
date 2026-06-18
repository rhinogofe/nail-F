<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import { useCoupons } from '../composables/useCoupons'

const auth = useAuthStore()
const { showMyCoupons } = useCoupons()

const clips = ref([])
const loading = ref(false)
const errorMessage = ref('')
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerScrollRef = ref(null)

function embedUrl(videoId) {
  if (!videoId) return ''
  return `https://www.tiktok.com/embed/v2/${videoId}`
}

function shouldRenderEmbed(index) {
  return Math.abs(index - viewerIndex.value) <= 1
}

function openOnTikTok(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function loadClips() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/api/reviews/clips')
    clips.value = data || []
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
        <div class="brand">
          Nail<span class="brand-accent">Thuean</span>
        </div>
        <div class="avatar" :title="auth.user?.name">{{ initials }}</div>
      </div>
      <h1 class="page-title">รีวิว</h1>
      <p class="page-sub">ผลงานจาก TikTok · กดดูคลิป · เลื่อนขึ้นลงเปลี่ยนคลิป</p>
    </header>

    <main class="content">
      <p v-if="loading" class="muted center">กำลังโหลด...</p>
      <p v-else-if="errorMessage" class="alert error">{{ errorMessage }}</p>

      <div v-else-if="clips.length === 0" class="empty card">
        <i class="ti ti-video-off empty-icon" aria-hidden="true"></i>
        <p>ยังไม่มีคลิปรีวิว</p>
        <p class="muted">รอแอดมินเพิ่มลิงก์ TikTok</p>
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
            v-if="clip.thumbnail_url"
            :src="clip.thumbnail_url"
            :alt="clip.title || `คลิป ${index + 1}`"
            class="clip-thumb"
            loading="lazy"
          />
          <div v-else class="clip-thumb-fallback">
            <i class="ti ti-brand-tiktok" aria-hidden="true"></i>
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
                v-if="shouldRenderEmbed(index)"
                :src="embedUrl(clip.video_id)"
                class="viewer-embed"
                :title="clip.title || `TikTok clip ${index + 1}`"
                allow="encrypted-media; fullscreen; picture-in-picture"
                allowfullscreen
                scrolling="no"
              />
              <div v-else class="viewer-embed-placeholder" />
            </div>

            <div class="viewer-meta">
              <p v-if="clip.title" class="viewer-title">{{ clip.title }}</p>
              <p class="viewer-hint">
                {{ index + 1 }} / {{ clips.length }}
                · เลื่อนลง = ถัดไป · เลื่อนขึ้น = ก่อนหน้า
              </p>
              <button type="button" class="viewer-tiktok-btn" @click="openOnTikTok(clip.tiktok_url)">
                เปิดใน TikTok
              </button>
            </div>
          </section>
        </div>
      </div>
    </Teleport>

    <BottomNav active="reviews" @coupons="showMyCoupons" />
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600&display=swap');

* {
  box-sizing: border-box;
}

.page {
  font-family: 'Noto Sans Thai', sans-serif;
  background: #fff;
  min-height: 100svh;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  padding-bottom: 72px;
}

.hdr {
  background: #fff;
  border-bottom: 0.5px solid #f1e8f0;
  padding: 14px 18px 12px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.hdr-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.brand {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.brand-accent {
  color: #e11d48;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fce7f3;
  color: #e11d48;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.page-title {
  margin: 0 0 4px;
  font-size: 20px;
  color: #1e293b;
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.content {
  padding: 2px 0 12px;
}

.center {
  text-align: center;
  padding: 24px 16px;
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
  gap: 2px;
}

.clip-cell {
  position: relative;
  aspect-ratio: 3 / 4;
  padding: 0;
  border: none;
  background: #0f172a;
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
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #1e293b, #0f172a);
  color: #fff;
  font-size: 28px;
}

.clip-play {
  position: absolute;
  left: 8px;
  bottom: 8px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.viewer {
  position: fixed;
  top: 0;
  bottom: 0;
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
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-scroll {
  height: 100dvh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
}

.viewer-slide {
  height: 100dvh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  flex-direction: column;
  background: #000;
}

.viewer-embed-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-embed {
  width: 100%;
  height: min(72dvh, 680px);
  border: 0;
  display: block;
}

.viewer-embed-placeholder {
  width: 100%;
  height: min(72dvh, 680px);
}

.viewer-meta {
  flex-shrink: 0;
  padding: 12px 16px max(16px, env(safe-area-inset-bottom));
  color: #fff;
  text-align: center;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
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

.viewer-tiktok-btn {
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  background: #ffe4e6;
  color: #e11d48;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
</style>

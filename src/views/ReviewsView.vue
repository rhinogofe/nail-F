<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import { useCoupons } from '../composables/useCoupons'

const auth = useAuthStore()
const { showMyCoupons } = useCoupons()

const clips = ref([])
const loading = ref(false)
const errorMessage = ref('')
const activeIndex = ref(0)

const activeClip = computed(() => clips.value[activeIndex.value] || null)

function embedUrl(videoId) {
  if (!videoId) return ''
  return `https://www.tiktok.com/embed/v2/${videoId}`
}

function openOnTikTok(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function goPrev() {
  if (activeIndex.value > 0) activeIndex.value -= 1
}

function goNext() {
  if (activeIndex.value < clips.value.length - 1) activeIndex.value += 1
}

async function loadClips() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/api/reviews/clips')
    clips.value = data || []
    if (activeIndex.value >= clips.value.length) {
      activeIndex.value = Math.max(0, clips.value.length - 1)
    }
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดคลิปไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

const initials = computed(() => {
  const n = auth.user?.name || ''
  return n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'NA'
})

onMounted(loadClips)
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
      <p class="page-sub">ผลงานจาก TikTok · เลื่อนดูคลิปถัดไป</p>
    </header>

    <main class="content">
      <p v-if="loading" class="muted center">กำลังโหลด...</p>
      <p v-else-if="errorMessage" class="alert error">{{ errorMessage }}</p>

      <div v-else-if="clips.length === 0" class="empty card">
        <i class="ti ti-video-off empty-icon" aria-hidden="true"></i>
        <p>ยังไม่มีคลิปรีวิว</p>
        <p class="muted">รอแอดมินเพิ่มลิงก์ TikTok</p>
      </div>

      <template v-else>
        <div class="carousel card">
          <div class="clip-counter">
            {{ activeIndex + 1 }} / {{ clips.length }}
          </div>

          <div v-if="activeClip" class="embed-wrap">
            <iframe
              :key="activeClip.id"
              :src="embedUrl(activeClip.video_id)"
              class="tiktok-embed"
              title="TikTok clip"
              allow="encrypted-media; fullscreen; picture-in-picture"
              allowfullscreen
              scrolling="no"
            />
          </div>

          <p v-if="activeClip?.title" class="clip-title">{{ activeClip.title }}</p>

          <div class="clip-actions">
            <button type="button" class="nav-btn" :disabled="activeIndex === 0" @click="goPrev">
              <i class="ti ti-chevron-left" aria-hidden="true"></i>
              ก่อนหน้า
            </button>
            <button type="button" class="link-btn" @click="openOnTikTok(activeClip?.tiktok_url)">
              เปิดใน TikTok
            </button>
            <button
              type="button"
              class="nav-btn"
              :disabled="activeIndex >= clips.length - 1"
              @click="goNext"
            >
              ถัดไป
              <i class="ti ti-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div class="thumb-row" aria-label="เลือกคลิป">
          <button
            v-for="(clip, index) in clips"
            :key="clip.id"
            type="button"
            class="thumb"
            :class="{ active: index === activeIndex }"
            @click="activeIndex = index"
          >
            {{ index + 1 }}
          </button>
        </div>
      </template>
    </main>

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
  background: #f8fafc;
  min-height: 100svh;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  padding-bottom: 72px;
}

.hdr {
  background: #fff;
  border-bottom: 0.5px solid #f1e8f0;
  padding: 14px 18px 16px;
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
  padding: 14px 16px 20px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.center {
  text-align: center;
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
}

.empty {
  text-align: center;
  padding: 32px 16px;
}

.empty-icon {
  font-size: 36px;
  color: #cbd5e1;
  display: block;
  margin-bottom: 8px;
}

.carousel {
  padding-bottom: 12px;
}

.clip-counter {
  text-align: center;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 10px;
}

.embed-wrap {
  width: 100%;
  min-height: 580px;
  border-radius: 14px;
  overflow: hidden;
  background: #000;
}

.tiktok-embed {
  width: 100%;
  height: 580px;
  border: 0;
  display: block;
}

.clip-title {
  margin: 12px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  text-align: center;
}

.clip-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
}

.nav-btn,
.link-btn {
  border: none;
  background: #f1f5f9;
  color: #334155;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.link-btn {
  background: #ffe4e6;
  color: #e11d48;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.thumb-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 2px 0;
}

.thumb {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.thumb.active {
  border-color: #e11d48;
  background: #ffe4e6;
  color: #e11d48;
}
</style>

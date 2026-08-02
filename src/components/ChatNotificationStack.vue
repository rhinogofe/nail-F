<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatNotifications } from '../composables/useChatNotifications'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { notifications, dismissNotification } = useChatNotifications()

const shopSlug = computed(
  () => route.params.shopSlug || localStorage.getItem('shopSlug') || 'default'
)

function timeAgo(value) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 60000) return 'เมื่อสักครู่'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ชม. ที่แล้ว`
  const days = Math.floor(hours / 24)
  return `${days} วันที่แล้ว`
}

function previewText(item) {
  const text = String(item.body || '').trim()
  if (text) return text
  if (item.image_url) return 'ส่งรูปภาพ'
  return 'ข้อความใหม่'
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'CH'
  return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function openNotification(item) {
  dismissNotification(item.id)
  const base = `/${shopSlug.value}/chat`
  if (item.user_id) {
    router.push(`${base}?userId=${item.user_id}`)
    return
  }
  router.push(base)
}

const visibleStack = computed(() => notifications.value.slice(0, 3))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="auth.isLoggedIn && visibleStack.length"
      class="chat-notify-stack"
      aria-live="polite"
      aria-label="การแจ้งเตือนแชท"
    >
      <TransitionGroup name="chat-notify">
        <button
          v-for="(item, index) in visibleStack"
          :key="item.id"
          type="button"
          class="chat-notify-card"
          :style="{ '--stack-index': index }"
          @click="openNotification(item)"
        >
          <span class="chat-notify-icon" aria-hidden="true">{{ initials(item.title) }}</span>
          <span class="chat-notify-body">
            <span class="chat-notify-top">
              <strong class="chat-notify-title">{{ item.title }}</strong>
              <time class="chat-notify-time">{{ timeAgo(item.created_at) }}</time>
            </span>
            <span class="chat-notify-preview">{{ previewText(item) }}</span>
          </span>
          <span
            v-if="item.image_url"
            class="chat-notify-thumb"
            aria-hidden="true"
          >
            <i class="ti ti-photo"></i>
          </span>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.chat-notify-stack {
  position: fixed;
  top: max(12px, env(safe-area-inset-top, 0));
  left: 50%;
  transform: translateX(-50%);
  width: min(392px, calc(100vw - 24px));
  z-index: 200;
  pointer-events: none;
}

.chat-notify-card {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  margin-bottom: 8px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  box-shadow:
    0 8px 28px rgba(45, 36, 36, 0.14),
    0 1px 0 rgba(255, 255, 255, 0.65) inset;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transform: translateY(calc(var(--stack-index, 0) * 2px));
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.chat-notify-card:active {
  transform: translateY(calc(var(--stack-index, 0) * 2px)) scale(0.985);
}

.chat-notify-icon {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(145deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.chat-notify-body {
  flex: 1;
  min-width: 0;
}

.chat-notify-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.chat-notify-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-notify-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.chat-notify-preview {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-notify-thumb {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(45, 36, 36, 0.06);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.chat-notify-enter-active,
.chat-notify-leave-active {
  transition: all 0.28s ease;
}

.chat-notify-enter-from {
  opacity: 0;
  transform: translateY(-16px);
}

.chat-notify-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

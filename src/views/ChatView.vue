<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import BrandMark from '../components/BrandMark.vue'
import { useAuthStore } from '../stores/auth'
import { useShopRoute } from '../composables/useShopRoute'
import { useUiSettingsStore } from '../stores/uiSettings'

const ui = useUiSettingsStore()
const auth = useAuthStore()
const route = useRoute()
const { shopSlug } = useShopRoute()

const isAdminMode = computed(() => auth.canAccessShopAdmin(shopSlug.value))

const messages = ref([])
const draft = ref('')
const loading = ref(true)
const sending = ref(false)
const errorMessage = ref('')
const messagesRef = ref(null)

const conversations = ref([])
const selectedUserId = ref('')
const activeUser = ref(null)
const conversationSearch = ref('')
const sidebarOpen = ref(true)
const isMobile = ref(false)
let pollTimer = null
let mobileMq = null

const filteredConversations = computed(() => {
  const q = conversationSearch.value.trim().toLowerCase()
  if (!q) return conversations.value
  return conversations.value.filter(
    (c) =>
      String(c.name || '').toLowerCase().includes(q)
      || String(c.email || '').toLowerCase().includes(q)
  )
})

const selectedConversation = computed(() =>
  conversations.value.find((c) => c.id === selectedUserId.value) || activeUser.value
)

const totalUnread = computed(() =>
  conversations.value.reduce((sum, c) => sum + (c.unread_count || 0), 0)
)

const emptyHint = computed(() => {
  if (loading.value) return 'กำลังโหลด...'
  return isAdminMode.value
    ? 'ยังไม่มีข้อความ — เลือกลูกค้าหรือส่งจากหน้าแอดมิน'
    : 'ยังไม่มีข้อความ — ส่งข้อความหาแอดมินได้เลย'
})

function updateMobileLayout() {
  isMobile.value = mobileMq?.matches ?? window.innerWidth <= 640
}

function formatTime(value) {
  if (!value) return ''
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatConvTime(value) {
  if (!value) return ''
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  const now = new Date()
  const sameDay = dt.toDateString() === now.toDateString()
  if (sameDay) {
    return dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }
  return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

function userInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebarOnMobile() {
  if (isMobile.value) sidebarOpen.value = false
}

async function loadCustomerMessages() {
  const { data } = await api.get('/api/chat/messages')
  messages.value = data || []
}

async function loadConversations() {
  const { data } = await api.get('/api/admin/chat/conversations')
  conversations.value = data || []
  if (selectedUserId.value) {
    const still = conversations.value.find((c) => c.id === selectedUserId.value)
    if (!still && activeUser.value) {
      conversations.value = [
        {
          id: activeUser.value.id,
          name: activeUser.value.name,
          email: activeUser.value.email,
          avatar_url: activeUser.value.avatar_url,
          last_message: messages.value.at(-1)?.body || '',
          last_sender_role: messages.value.at(-1)?.sender_role || 'admin',
          last_message_at: messages.value.at(-1)?.created_at || null,
          unread_count: 0,
        },
        ...conversations.value,
      ]
    }
  }
}

async function loadAdminMessages(userId, silent = false) {
  if (!userId) return
  if (!silent) loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get(`/api/admin/chat/conversations/${userId}/messages`)
    activeUser.value = data.user
    messages.value = data.messages || []
    selectedUserId.value = userId
    scrollToBottom()
    await loadConversations()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดข้อความไม่สำเร็จ'
  } finally {
    if (!silent) loading.value = false
  }
}

async function refreshChat(silent = false) {
  if (!silent) loading.value = true
  errorMessage.value = ''
  try {
    if (isAdminMode.value) {
      await loadConversations()
      if (selectedUserId.value) {
        await loadAdminMessages(selectedUserId.value, true)
      } else {
        messages.value = []
      }
    } else {
      await loadCustomerMessages()
      scrollToBottom()
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดข้อความไม่สำเร็จ'
  } finally {
    if (!silent) loading.value = false
  }
}

function selectConversation(conv) {
  if (!conv?.id) return
  loadAdminMessages(conv.id)
  closeSidebarOnMobile()
}

async function sendMessage() {
  const body = draft.value.trim()
  if (!body || sending.value) return

  sending.value = true
  errorMessage.value = ''
  try {
    if (isAdminMode.value) {
      if (!selectedUserId.value) return
      const { data } = await api.post(
        `/api/admin/chat/conversations/${selectedUserId.value}/messages`,
        { body }
      )
      messages.value = [...messages.value, data]
      await loadConversations()
    } else {
      const { data } = await api.post('/api/chat/messages', { body })
      messages.value = [...messages.value, data]
    }
    draft.value = ''
    scrollToBottom()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ส่งข้อความไม่สำเร็จ'
  } finally {
    sending.value = false
  }
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

const canSend = computed(() => {
  if (sending.value || !draft.value.trim()) return false
  if (isAdminMode.value) return Boolean(selectedUserId.value)
  return true
})

function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(() => refreshChat(true), 15000)
}

function syncSidebarForViewport() {
  if (!isAdminMode.value) return
  sidebarOpen.value = !isMobile.value || !selectedUserId.value
}

function onViewportChange() {
  updateMobileLayout()
  syncSidebarForViewport()
}

onMounted(async () => {
  mobileMq = window.matchMedia('(max-width: 640px)')
  onViewportChange()
  mobileMq.addEventListener('change', onViewportChange)

  const userId = route.query.userId
  if (isAdminMode.value) {
    sidebarOpen.value = !isMobile.value || !userId
    if (userId) {
      await loadConversations()
      await loadAdminMessages(String(userId))
    } else {
      await refreshChat()
    }
  } else {
    await refreshChat()
  }
  startPolling()
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  mobileMq?.removeEventListener('change', onViewportChange)
})

watch(
  () => messages.value.length,
  () => scrollToBottom()
)

watch(
  () => route.query.userId,
  (userId) => {
    if (isAdminMode.value && userId) {
      loadAdminMessages(String(userId))
      closeSidebarOnMobile()
    }
  }
)
</script>

<template>
  <div class="chat-page" :class="{ 'chat-page--admin': isAdminMode }">
    <!-- ── แอดมิน: sidebar ซ้าย + แชทขวา ── -->
    <template v-if="isAdminMode">
      <div class="chat-admin-shell">
        <Transition name="chat-backdrop">
          <button
            v-if="sidebarOpen && isMobile"
            type="button"
            class="chat-sidebar-backdrop"
            aria-label="ปิดรายการแชท"
            @click="sidebarOpen = false"
          />
        </Transition>

        <aside class="chat-sidebar" :class="{ 'chat-sidebar--open': sidebarOpen }">
          <div class="chat-sidebar-head">
            <h2 class="chat-sidebar-title">ข้อความ</h2>
            <button
              type="button"
              class="chat-icon-btn chat-sidebar-close"
              aria-label="ปิดรายการ"
              @click="sidebarOpen = false"
            >
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>

          <label class="chat-search-wrap">
            <i class="ti ti-search" aria-hidden="true"></i>
            <input
              v-model="conversationSearch"
              type="search"
              class="chat-search"
              placeholder="ค้นหาชื่อหรืออีเมล..."
              autocomplete="off"
            />
          </label>

          <div class="chat-conv-list">
            <p v-if="filteredConversations.length === 0" class="chat-sidebar-empty muted">
              ยังไม่มีการสนทนา
            </p>
            <button
              v-for="conv in filteredConversations"
              :key="conv.id"
              type="button"
              class="chat-conv"
              :class="{ active: selectedUserId === conv.id }"
              @click="selectConversation(conv)"
            >
              <span class="chat-avatar" aria-hidden="true">{{ userInitials(conv.name) }}</span>
              <span class="chat-conv-body">
                <span class="chat-conv-row">
                  <strong class="chat-conv-name">{{ conv.name }}</strong>
                  <time class="chat-conv-time">{{ formatConvTime(conv.last_message_at) }}</time>
                </span>
                <span class="chat-conv-row chat-conv-row-sub">
                  <span class="chat-conv-preview muted">
                    {{ conv.last_sender_role === 'admin' ? 'คุณ: ' : '' }}{{ conv.last_message }}
                  </span>
                  <span v-if="conv.unread_count > 0" class="chat-conv-unread">
                    {{ conv.unread_count > 99 ? '99+' : conv.unread_count }}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </aside>

        <div class="chat-main">
          <header class="chat-thread-head">
            <button
              type="button"
              class="chat-icon-btn chat-list-toggle"
              :aria-expanded="sidebarOpen"
              aria-label="เปิดรายการแชท"
              @click="toggleSidebar"
            >
              <i class="ti ti-menu-2" aria-hidden="true"></i>
              <span v-if="totalUnread > 0 && !sidebarOpen" class="chat-toggle-badge">
                {{ totalUnread > 99 ? '99+' : totalUnread }}
              </span>
            </button>
            <div v-if="selectedConversation" class="chat-thread-info">
              <span class="chat-thread-avatar">{{ userInitials(selectedConversation.name) }}</span>
              <div>
                <strong class="chat-thread-name">{{ selectedConversation.name }}</strong>
                <p class="chat-thread-meta muted">{{ selectedConversation.email || 'ลูกค้า' }}</p>
              </div>
            </div>
            <div v-else class="chat-thread-info">
              <strong class="chat-thread-name">แชทลูกค้า</strong>
              <p class="chat-thread-meta muted">เลือกลูกค้าเพื่อตอบข้อความ</p>
            </div>
          </header>

          <p v-if="errorMessage" class="alert error chat-alert">{{ errorMessage }}</p>

          <template v-if="selectedUserId">
            <div ref="messagesRef" class="chat-messages" aria-live="polite">
              <p v-if="loading" class="chat-empty muted">กำลังโหลด...</p>
              <p v-else-if="messages.length === 0" class="chat-empty muted">{{ emptyHint }}</p>
              <div
                v-for="msg in messages"
                :key="msg.id"
                class="chat-bubble-row"
                :class="msg.sender_role === 'admin' ? 'mine' : 'theirs'"
              >
                <div class="chat-bubble">
                  <p class="chat-body">{{ msg.body }}</p>
                  <time class="chat-time">{{ formatTime(msg.created_at) }}</time>
                </div>
              </div>
            </div>

            <form class="chat-compose" @submit.prevent="sendMessage">
              <textarea
                v-model="draft"
                rows="1"
                class="chat-input"
                placeholder="พิมพ์ข้อความ..."
                maxlength="2000"
                @keydown="onKeydown"
              />
              <button type="submit" class="btn primary chat-send" :disabled="!canSend">
                <i class="ti ti-send" aria-hidden="true"></i>
              </button>
            </form>
          </template>

          <div v-else class="chat-empty-state">
            <i class="ti ti-messages chat-empty-icon" aria-hidden="true"></i>
            <p class="chat-empty-title">ยังไม่ได้เลือกแชท</p>
            <p class="muted chat-empty-desc">กดปุ่มเมนูด้านซ้ายเพื่อดูรายชื่อลูกค้า</p>
            <button type="button" class="btn primary chat-open-list-btn" @click="sidebarOpen = true">
              เปิดรายการแชท
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── ลูกค้า ── -->
    <template v-else>
      <header class="chat-header">
        <BrandMark compact />
        <div class="chat-header-text">
          <h1>{{ ui.get('ui_chat_title', 'แชท') }}</h1>
          <p class="muted">พูดคุยกับแอดมินร้าน</p>
        </div>
      </header>

      <p v-if="errorMessage" class="alert error">{{ errorMessage }}</p>

      <div ref="messagesRef" class="chat-messages" aria-live="polite">
        <p v-if="messages.length === 0" class="chat-empty muted">{{ emptyHint }}</p>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="chat-bubble-row"
          :class="msg.sender_role === 'customer' ? 'mine' : 'theirs'"
        >
          <div class="chat-bubble">
            <p class="chat-body">{{ msg.body }}</p>
            <time class="chat-time">{{ formatTime(msg.created_at) }}</time>
          </div>
        </div>
      </div>

      <form class="chat-compose" @submit.prevent="sendMessage">
        <textarea
          v-model="draft"
          rows="2"
          class="chat-input"
          placeholder="พิมพ์ข้อความ..."
          maxlength="2000"
          @keydown="onKeydown"
        />
        <button type="submit" class="btn primary chat-send chat-send--label" :disabled="!canSend">
          {{ sending ? '...' : 'ส่ง' }}
        </button>
      </form>
    </template>

    <BottomNav active="chat" />
  </div>
</template>

<style scoped>
.chat-page {
  min-height: 100dvh;
  max-width: 430px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0));
  background: var(--color-bg);
  box-sizing: border-box;
}

.chat-page--admin {
  max-width: 900px;
}

/* ── Admin shell ── */
.chat-admin-shell {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.chat-sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  border: none;
  padding: 0;
  background: rgba(45, 36, 36, 0.35);
  cursor: pointer;
}

.chat-backdrop-enter-active,
.chat-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.chat-backdrop-enter-from,
.chat-backdrop-leave-to {
  opacity: 0;
}

.chat-sidebar {
  flex-shrink: 0;
  width: 280px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-surface-elevated);
  border-right: 1px solid var(--color-border);
  z-index: 36;
}

.chat-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  flex-shrink: 0;
}

.chat-sidebar-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.chat-sidebar-close {
  display: none;
}

.chat-search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 12px 10px;
  padding: 0 12px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg);
}

.chat-search-wrap i {
  color: var(--color-text-muted);
  font-size: 16px;
  flex-shrink: 0;
}

.chat-search {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 16px;
  color: var(--color-text-primary);
  outline: none;
}

.chat-conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-sidebar-empty {
  text-align: center;
  padding: 24px 12px;
  font-size: 13px;
}

.chat-conv {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s ease;
}

.chat-conv:hover {
  background: var(--color-bg);
}

.chat-conv.active {
  background: var(--color-primary-light);
}

.chat-avatar {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
}

.chat-conv-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.chat-conv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-conv-row-sub {
  align-items: center;
}

.chat-conv-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-conv-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.chat-conv-preview {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-conv-unread {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--color-bg);
}

.chat-thread-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.chat-icon-btn {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg);
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
}

.chat-list-toggle {
  display: none;
}

.chat-toggle-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
}

.chat-thread-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.chat-thread-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.chat-thread-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-thread-meta {
  margin: 1px 0 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-alert {
  margin: 8px 12px 0;
}

.chat-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
}

.chat-empty-icon {
  font-size: 48px;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.chat-empty-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
}

.chat-empty-desc {
  margin: 0 0 16px;
  font-size: 13px;
}

.chat-open-list-btn {
  min-width: 160px;
}

/* ── Shared messages ── */
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.chat-header-text h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.chat-header-text .muted {
  margin: 2px 0 0;
  font-size: 12px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.chat-empty {
  text-align: center;
  margin: auto;
  font-size: 14px;
}

.chat-bubble-row {
  display: flex;
}

.chat-bubble-row.mine {
  justify-content: flex-end;
}

.chat-bubble-row.theirs {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 82%;
  padding: 10px 12px;
  border-radius: 16px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
}

.chat-bubble-row.mine .chat-bubble {
  background: var(--color-primary-light);
  border-color: transparent;
}

.chat-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.45;
}

.chat-time {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--color-text-muted);
}

.chat-compose {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  min-width: 0;
  width: 0;
  resize: none;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.4;
  background: var(--color-bg);
  color: var(--color-text-primary);
  box-sizing: border-box;
  -webkit-text-size-adjust: 100%;
}

.chat-send {
  flex-shrink: 0;
  width: 44px;
  min-width: 44px;
  height: 44px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chat-send--label {
  width: auto;
  min-width: 52px;
  padding: 0 14px;
}

.alert.error {
  margin: 8px 16px 0;
}

/* ── Mobile: drawer sidebar ── */
@media (max-width: 640px) {
  .chat-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0));
    width: min(88vw, 300px);
    max-width: 300px;
    transform: translateX(-105%);
    transition: transform 0.25s ease;
    box-shadow: 4px 0 24px rgba(45, 36, 36, 0.12);
  }

  .chat-sidebar--open {
    transform: translateX(0);
  }

  .chat-sidebar-close {
    display: inline-flex;
  }

  .chat-list-toggle {
    display: inline-flex;
  }
}

/* ── Desktop: collapse sidebar ── */
@media (min-width: 641px) {
  .chat-sidebar:not(.chat-sidebar--open) {
    width: 0;
    overflow: hidden;
    border-right: none;
    padding: 0;
    opacity: 0;
    pointer-events: none;
  }

  .chat-sidebar--open {
    width: 280px;
    opacity: 1;
    pointer-events: auto;
  }

  .chat-list-toggle {
    display: inline-flex;
  }
}
</style>

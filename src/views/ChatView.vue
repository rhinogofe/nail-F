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

const isAdminMode = computed(
  () => auth.isAdmin && auth.canAccessShopAdmin(shopSlug.value)
)

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
let pollTimer = null

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

const headerSubtitle = computed(() =>
  isAdminMode.value
    ? (selectedConversation.value
      ? `แชทกับ ${selectedConversation.value.name}`
      : 'เลือกลูกค้าเพื่อตอบข้อความ')
    : 'พูดคุยกับแอดมินร้าน'
)

const emptyHint = computed(() => {
  if (loading.value) return 'กำลังโหลด...'
  return isAdminMode.value
    ? 'ยังไม่มีข้อความ — เลือกลูกค้าหรือส่งจากหน้าแอดมิน'
    : 'ยังไม่มีข้อความ — ส่งข้อความหาแอดมินได้เลย'
})

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

function scrollToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
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

onMounted(async () => {
  const userId = route.query.userId
  if (isAdminMode.value && userId) {
    await loadConversations()
    await loadAdminMessages(String(userId))
  } else {
    await refreshChat()
  }
  startPolling()
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
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
    }
  }
)
</script>

<template>
  <div class="chat-page" :class="{ 'chat-page--admin': isAdminMode }">
    <header class="chat-header">
      <BrandMark compact />
      <div class="chat-header-text">
        <h1>{{ ui.get('ui_chat_title', 'แชท') }}</h1>
        <p class="muted">{{ headerSubtitle }}</p>
      </div>
    </header>

    <div v-if="isAdminMode" class="chat-admin-layout">
      <aside class="chat-sidebar">
        <input
          v-model="conversationSearch"
          type="text"
          class="chat-search"
          placeholder="ค้นหาชื่อหรืออีเมล..."
        />
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
          <div class="chat-conv-top">
            <strong>{{ conv.name }}</strong>
            <span v-if="conv.unread_count > 0" class="chat-conv-unread">{{ conv.unread_count }}</span>
          </div>
          <p class="muted chat-conv-preview">
            {{ conv.last_sender_role === 'admin' ? 'คุณ: ' : '' }}{{ conv.last_message }}
          </p>
          <time class="chat-conv-time">{{ formatTime(conv.last_message_at) }}</time>
        </button>
      </aside>

      <div class="chat-main">
        <p v-if="errorMessage" class="alert error">{{ errorMessage }}</p>

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
              rows="2"
              class="chat-input"
              placeholder="พิมพ์ข้อความ..."
              maxlength="2000"
              @keydown="onKeydown"
            />
            <button type="submit" class="btn primary chat-send" :disabled="!canSend">
              {{ sending ? '...' : 'ส่ง' }}
            </button>
          </form>
        </template>

        <p v-else class="chat-placeholder muted">เลือกลูกค้าจากรายการด้านซ้าย</p>
      </div>
    </div>

    <template v-else>
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
        <button type="submit" class="btn primary chat-send" :disabled="!canSend">
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
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0) + 8px);
  background: var(--color-bg);
}

.chat-page--admin {
  max-width: 720px;
}

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

.chat-admin-layout {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.chat-sidebar {
  width: 38%;
  min-width: 128px;
  max-width: 200px;
  border-right: 1px solid var(--color-border);
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-surface-elevated);
}

.chat-search {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
}

.chat-sidebar-empty {
  font-size: 12px;
  text-align: center;
  margin: auto 0;
}

.chat-conv {
  text-align: left;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-bg);
  cursor: pointer;
  font-family: inherit;
}

.chat-conv.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.chat-conv-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.chat-conv-top strong {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-conv-unread {
  flex-shrink: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.chat-conv-preview {
  margin: 3px 0 0;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-conv-time {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--color-text-muted);
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.chat-placeholder {
  margin: auto;
  padding: 24px;
  font-size: 14px;
  text-align: center;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 160px;
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
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
}

.chat-send {
  flex-shrink: 0;
  min-width: 56px;
  min-height: 42px;
}

.alert.error {
  margin: 8px 16px 0;
}

@media (max-width: 520px) {
  .chat-page--admin .chat-admin-layout {
    flex-direction: column;
  }

  .chat-sidebar {
    width: 100%;
    max-width: none;
    max-height: 160px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
}
</style>

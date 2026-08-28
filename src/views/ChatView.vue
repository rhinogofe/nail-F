<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api/axios'
import BottomNav from '../components/BottomNav.vue'
import BrandMark from '../components/BrandMark.vue'
import ChatImage from '../components/ChatImage.vue'
import AccountMenuDrawer from '../components/AccountMenuDrawer.vue'
import { useAuthStore } from '../stores/auth'
import { useShopRoute } from '../composables/useShopRoute'
import { useUiSettingsStore } from '../stores/uiSettings'
import { compressChatImage } from '../utils/compressChatImage'
import { FCM_PUSH_RECEIVED_EVENT, repairPushRegistration } from '../utils/pushNotifications'

const ui = useUiSettingsStore()
const auth = useAuthStore()
const route = useRoute()
const { shopSlug } = useShopRoute()

const MAX_CHAT_IMAGES = 5

const isAdminMode = computed(() => auth.canAccessShopAdmin(shopSlug.value))

const messages = ref([])
const draft = ref('')
const loading = ref(true)
const sending = ref(false)
const uploading = ref(false)
const uploadProgress = ref('')
const errorMessage = ref('')
const messagesRef = ref(null)
const bottomAnchorRef = ref(null)
const imageInputRef = ref(null)
let scrollCleanup = null
const lightboxSrc = ref('')

// How close to the end still counts as "reading the newest messages".
const BOTTOM_LOCK_PX = 90
const isPinnedToBottom = ref(true)
const hasNewBelow = ref(false)
let programmaticScrollUntil = 0
let nextScrollMode = 'instant'

const conversations = ref([])
const selectedUserId = ref('')
const activeUser = ref(null)
const deletingMessageId = ref(null)
const conversationSearch = ref('')
const sidebarOpen = ref(true)
const isMobile = ref(false)
let pollTimer = null
let mobileMq = null

const filteredConversations = computed(() => {
  const q = conversationSearch.value.trim().toLowerCase()
  const system = conversations.value.find((c) => c.is_system)
  const customers = conversations.value.filter((c) => !c.is_system)
  const filteredCustomers = q
    ? customers.filter(
        (c) =>
          String(c.name || '').toLowerCase().includes(q)
          || String(c.email || '').toLowerCase().includes(q)
      )
    : customers
  if (!system) return filteredCustomers
  const showSystem = !q
    || 'ระบบ'.includes(q)
    || 'แจ้งเตือน'.includes(q)
    || String(system.email || '').toLowerCase().includes(q)
  return showSystem ? [system, ...filteredCustomers] : filteredCustomers
})

const selectedConversation = computed(() =>
  conversations.value.find((c) => c.id === selectedUserId.value) || activeUser.value
)

const selectedIsSystem = computed(() =>
  Boolean(selectedConversation.value?.is_system || activeUser.value?.is_system)
)

const totalUnread = computed(() =>
  conversations.value.reduce((sum, c) => sum + (c.unread_count || 0), 0)
)

const emptyHint = computed(() => {
  if (loading.value) return 'กำลังโหลด...'
  if (isAdminMode.value && selectedIsSystem.value) return 'ยังไม่มีแจ้งเตือน'
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

function userInitials(name, isSystem = false) {
  if (isSystem) return '⚙'
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function convPreview(conv) {
  if (conv.last_message) return conv.last_message
  if (conv.last_image_url) return '[รูปภาพ]'
  return ''
}

function openLightbox(src) {
  lightboxSrc.value = src
}

function closeLightbox() {
  lightboxSrc.value = ''
}

function pickImage() {
  imageInputRef.value?.click()
}

async function onImageSelected(event) {
  const files = Array.from(event.target.files || []).filter((f) => f.type.startsWith('image/'))
  event.target.value = ''
  if (!files.length || uploading.value || sending.value) return

  if (files.length > MAX_CHAT_IMAGES) {
    errorMessage.value = `เลือกได้สูงสุด ${MAX_CHAT_IMAGES} รูปต่อครั้ง`
    return
  }

  uploading.value = true
  uploadProgress.value = ''
  errorMessage.value = ''
  const caption = draft.value.trim()

  try {
    for (let i = 0; i < files.length; i += 1) {
      uploadProgress.value = files.length > 1 ? `กำลังส่งรูป ${i + 1}/${files.length}...` : 'กำลังส่งรูป...'
      const { base64, mime } = await compressChatImage(files[i])
      const data = await postChatPayload({
        body: i === 0 ? caption : '',
        imageData: base64,
        imageMime: mime,
      })
      messages.value = [...messages.value, data]
    }
    draft.value = ''
    if (isAdminMode.value) await loadConversations()
    scrollToBottom()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || err?.message || 'อัปโหลดรูปไม่สำเร็จ'
  } finally {
    uploading.value = false
    uploadProgress.value = ''
  }
}

async function postChatPayload({ body = '', imageData = null, imageMime = null } = {}) {
  const text = String(body ?? '').trim()
  if (!text && !imageData) return null
  if (isAdminMode.value && !selectedUserId.value) return null

  const payload = { body: text }
  if (imageData) {
    payload.image_data = imageData
    payload.image_mime = imageMime
  }

  if (isAdminMode.value) {
    const { data } = await api.post(
      `/api/admin/chat/conversations/${selectedUserId.value}/messages`,
      payload
    )
    return data
  }

  const { data } = await api.post('/api/chat/messages', payload)
  return data
}

async function sendChatPayload({ body = '', imageData = null, imageMime = null } = {}) {
  const text = String(body ?? '').trim()
  if (!text && !imageData) return
  if (isAdminMode.value && !selectedUserId.value) return

  sending.value = true
  errorMessage.value = ''
  try {
    // Sending always brings you back to the newest message, like every other
    // messenger, even if you were reading history.
    nextScrollMode = 'send'
    const data = await postChatPayload({ body: text, imageData, imageMime })
    if (data) messages.value = [...messages.value, data]
    if (isAdminMode.value) await loadConversations()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ส่งข้อความไม่สำเร็จ'
  } finally {
    sending.value = false
  }
}

async function deleteConversation() {
  if (!selectedUserId.value || !selectedConversation.value) return
  const isSystem = selectedIsSystem.value
  const name = selectedConversation.value.name || 'ลูกค้า'
  const question = isSystem
    ? 'ล้างข้อความระบบทั้งหมดใช่ไหม?\nการลบไม่สามารถยกเลิกได้'
    : `ลบประวัติแชทกับ "${name}" ทั้งหมดใช่ไหม?\nการลบไม่สามารถยกเลิกได้`
  if (!window.confirm(question)) return

  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/chat/conversations/${selectedUserId.value}`)
    messages.value = []
    if (!isSystem) {
      selectedUserId.value = ''
      activeUser.value = null
      sidebarOpen.value = true
    }
    await loadConversations()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ลบแชทไม่สำเร็จ'
  }
}

async function deleteMessage(msg) {
  if (!msg?.id || deletingMessageId.value) return
  if (!window.confirm('ลบข้อความนี้ใช่ไหม?')) return

  errorMessage.value = ''
  deletingMessageId.value = msg.id
  try {
    await api.delete(`/api/admin/chat/messages/${msg.id}`)
    messages.value = messages.value.filter((item) => item.id !== msg.id)
    await loadConversations()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'ลบข้อความไม่สำเร็จ'
  } finally {
    deletingMessageId.value = null
  }
}

function distanceFromBottom() {
  const el = messagesRef.value
  if (!el) return 0
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

// Programmatic scrolls fire scroll events too; ignore them so a smooth scroll
// passing through the middle of the list is not mistaken for the user reading
// older messages.
function jumpToBottom(smooth = false) {
  const el = messagesRef.value
  if (!el) return
  programmaticScrollUntil = Date.now() + (smooth ? 700 : 150)
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  isPinnedToBottom.value = true
  hasNewBelow.value = false
}

function onMessagesScroll() {
  if (Date.now() < programmaticScrollUntil) return
  const atBottom = distanceFromBottom() <= BOTTOM_LOCK_PX
  isPinnedToBottom.value = atBottom
  if (atBottom) hasNewBelow.value = false
}

// Images and web fonts change the list height after render, so re-pin a few
// times while the layout settles — but only while the user is still at the end.
function scrollToBottom({ smooth = false, force = false } = {}) {
  if (!force && !isPinnedToBottom.value) return
  scrollCleanup?.()

  const timers = []
  const repin = () => {
    if (!isPinnedToBottom.value) return
    jumpToBottom(false)
  }

  nextTick(() => {
    jumpToBottom(smooth)
    requestAnimationFrame(repin)
    for (const ms of [80, 250, 600]) timers.push(setTimeout(repin, ms))
  })

  scrollCleanup = () => {
    timers.forEach(clearTimeout)
    scrollCleanup = null
  }
}

function onMessagesMediaLoad(event) {
  if (event.target?.tagName !== 'IMG') return
  if (!isPinnedToBottom.value) return
  jumpToBottom(false)
}

function resetScrollState() {
  isPinnedToBottom.value = true
  hasNewBelow.value = false
  nextScrollMode = 'instant'
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebarAfterSelect() {
  sidebarOpen.value = false
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
          last_message: messages.value.at(-1)?.body || (messages.value.at(-1)?.image_url ? '[รูปภาพ]' : ''),
          last_image_url: messages.value.at(-1)?.image_url || null,
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
    if (!silent) loading.value = false
    await loadConversations()
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดข้อความไม่สำเร็จ'
  } finally {
    if (!silent) loading.value = false
    if (!silent) scrollToBottom({ force: true })
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
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'โหลดข้อความไม่สำเร็จ'
  } finally {
    if (!silent) loading.value = false
    if (!silent && (!isAdminMode.value || selectedUserId.value)) {
      scrollToBottom({ force: true })
    }
  }
}

async function selectConversation(conv) {
  if (!conv?.id) return
  closeSidebarAfterSelect()
  resetScrollState()
  await loadAdminMessages(conv.id)
}

async function openCustomerChat(userId) {
  if (!userId) return
  closeSidebarAfterSelect()
  resetScrollState()
  await loadAdminMessages(String(userId))
}

async function sendMessage() {
  const body = draft.value.trim()
  if (!body || sending.value || uploading.value) return
  await sendChatPayload({ body })
  draft.value = ''
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

const canSend = computed(() => {
  if (selectedIsSystem.value) return false
  if (sending.value || uploading.value || !draft.value.trim()) return false
  if (isAdminMode.value) return Boolean(selectedUserId.value)
  return true
})

const composeBusy = computed(() => sending.value || uploading.value)

function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(() => refreshChat(true), 15000)
}

function syncSidebarForViewport() {
  if (!isAdminMode.value) return
  sidebarOpen.value = !selectedUserId.value
}

function onViewportChange() {
  updateMobileLayout()
  syncSidebarForViewport()
}

function onFcmPushReceived() {
  if (document.hidden) return
  refreshChat(true)
}

watch(messagesRef, (el, prevEl) => {
  if (prevEl) {
    prevEl.removeEventListener('scroll', onMessagesScroll)
    prevEl.removeEventListener('load', onMessagesMediaLoad, true)
  }
  if (el) {
    el.addEventListener('scroll', onMessagesScroll, { passive: true })
    el.addEventListener('load', onMessagesMediaLoad, true)
  }
})

onMounted(async () => {
  mobileMq = window.matchMedia('(max-width: 640px)')
  onViewportChange()
  mobileMq.addEventListener('change', onViewportChange)
  window.addEventListener(FCM_PUSH_RECEIVED_EVENT, onFcmPushReceived)

  if (!isAdminMode.value) {
    void repairPushRegistration({ force: true })
  }

  const userId = route.query.userId
  if (isAdminMode.value) {
    sidebarOpen.value = !userId
    if (userId) {
      await loadConversations()
      await loadAdminMessages(String(userId))
      closeSidebarAfterSelect()
    } else {
      await refreshChat()
    }
  } else {
    await refreshChat()
  }
  startPolling()
})

onUnmounted(() => {
  window.removeEventListener(FCM_PUSH_RECEIVED_EVENT, onFcmPushReceived)
  if (pollTimer) clearInterval(pollTimer)
  scrollCleanup?.()
  const el = messagesRef.value
  if (el) {
    el.removeEventListener('scroll', onMessagesScroll)
    el.removeEventListener('load', onMessagesMediaLoad, true)
  }
  mobileMq?.removeEventListener('change', onViewportChange)
})

watch(
  () => messages.value.at(-1)?.id || '',
  (newId, oldId) => {
    if (!newId) return

    if (nextScrollMode === 'instant') {
      nextScrollMode = 'auto'
      scrollToBottom({ force: true })
      return
    }
    if (nextScrollMode === 'send') {
      nextScrollMode = 'auto'
      scrollToBottom({ smooth: true, force: true })
      return
    }

    if (newId === oldId) return
    if (isPinnedToBottom.value) {
      scrollToBottom({ smooth: true })
    } else {
      hasNewBelow.value = true
    }
  },
  { flush: 'post' }
)

watch(
  () => route.query.userId,
  async (userId) => {
    if (isAdminMode.value && userId) {
      closeSidebarAfterSelect()
      resetScrollState()
      await loadAdminMessages(String(userId))
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
              :class="{ active: selectedUserId === conv.id, 'chat-conv--system': conv.is_system }"
              @click="selectConversation(conv)"
            >
              <span class="chat-avatar" :class="{ 'chat-avatar--system': conv.is_system }" aria-hidden="true">{{ userInitials(conv.name, conv.is_system) }}</span>
              <span class="chat-conv-body">
                <span class="chat-conv-row">
                  <strong class="chat-conv-name">{{ conv.name }}</strong>
                  <time class="chat-conv-time">{{ formatConvTime(conv.last_message_at) }}</time>
                </span>
                <span class="chat-conv-row chat-conv-row-sub">
                  <span class="chat-conv-preview muted">
                    {{ conv.last_sender_role === 'admin' ? 'คุณ: ' : '' }}{{ convPreview(conv) }}
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
              <span class="chat-thread-avatar" :class="{ 'chat-avatar--system': selectedIsSystem }">{{ userInitials(selectedConversation.name, selectedIsSystem) }}</span>
              <div>
                <strong class="chat-thread-name">{{ selectedConversation.name }}</strong>
                <p class="chat-thread-meta muted">
                  {{ selectedIsSystem ? 'แจ้งเตือนการจอง · คิว · ชำระเงิน' : (selectedConversation.email || 'ลูกค้า') }}
                </p>
              </div>
            </div>
            <div v-else class="chat-thread-info">
              <strong class="chat-thread-name">แชทลูกค้า</strong>
              <p class="chat-thread-meta muted">เลือกลูกค้าเพื่อตอบข้อความ</p>
            </div>
            <button
              v-if="selectedUserId"
              type="button"
              class="chat-icon-btn chat-delete-btn"
              :aria-label="selectedIsSystem ? 'ล้างข้อความระบบ' : 'ลบประวัติแชท'"
              :title="selectedIsSystem ? 'ล้างข้อความระบบ' : 'ลบประวัติแชท'"
              @click="deleteConversation"
            >
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
            <AccountMenuDrawer />
          </header>

          <p v-if="errorMessage" class="alert error chat-alert">{{ errorMessage }}</p>
          <p v-if="uploadProgress" class="chat-upload-progress muted">{{ uploadProgress }}</p>

          <template v-if="selectedUserId">
            <div ref="messagesRef" class="chat-messages" aria-live="polite">
              <p v-if="loading && messages.length === 0" class="chat-empty muted">กำลังโหลด...</p>
              <p v-else-if="!loading && messages.length === 0" class="chat-empty muted">{{ emptyHint }}</p>
              <div
                v-for="msg in messages"
                :key="msg.id"
                class="chat-bubble-row"
                :class="selectedIsSystem
                  ? 'system-notify'
                  : (msg.sender_role === 'admin' ? 'mine' : 'theirs')"
              >
                <div class="chat-bubble" :class="{ 'chat-bubble--image': msg.image_url, 'chat-bubble--system': selectedIsSystem }">
                  <ChatImage
                    v-if="msg.image_url"
                    :filename="msg.image_url"
                    @open="openLightbox"
                  />
                  <p v-if="msg.body" class="chat-body">{{ msg.body }}</p>
                  <button
                    v-if="selectedIsSystem && msg.related_user_id"
                    type="button"
                    class="chat-related-link"
                    @click="openCustomerChat(msg.related_user_id)"
                  >
                    เปิดแชท{{ msg.related_user_name ? ` · ${msg.related_user_name}` : '' }}
                  </button>
                  <time class="chat-time">{{ formatTime(msg.created_at) }}</time>
                </div>
                <button
                  type="button"
                  class="chat-msg-delete"
                  aria-label="ลบข้อความนี้"
                  title="ลบข้อความนี้"
                  :disabled="deletingMessageId === msg.id"
                  @click="deleteMessage(msg)"
                >
                  <i class="ti ti-x" aria-hidden="true"></i>
                </button>
              </div>
              <div ref="bottomAnchorRef" class="chat-scroll-anchor" aria-hidden="true" />
            </div>

            <Transition name="chat-jump">
              <button
                v-if="!isPinnedToBottom && messages.length"
                type="button"
                class="chat-jump-btn"
                :class="{ 'chat-jump-btn--new': hasNewBelow }"
                @click="jumpToBottom(true)"
              >
                <i class="ti ti-arrow-down" aria-hidden="true"></i>
                {{ hasNewBelow ? 'ข้อความใหม่' : 'ล่าสุด' }}
              </button>
            </Transition>

            <form v-if="!selectedIsSystem" class="chat-compose" @submit.prevent="sendMessage">
              <input
                ref="imageInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="chat-file-input"
                multiple
                @change="onImageSelected"
              />
              <button
                type="button"
                class="chat-icon-btn chat-attach-btn"
                aria-label="แนบรูป"
                :title="`แนบรูป (สูงสุด ${MAX_CHAT_IMAGES} รูป)`"
                :disabled="composeBusy"
                @click="pickImage"
              >
                <i class="ti ti-photo" aria-hidden="true"></i>
              </button>
              <textarea
                v-model="draft"
                rows="1"
                class="chat-input"
                placeholder="พิมพ์ข้อความ..."
                maxlength="2000"
                :disabled="composeBusy"
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
        <div class="chat-header-brand">
          <BrandMark />
        </div>
        <div class="chat-header-text">
          <h1>{{ ui.get('ui_chat_title', 'แชท') }}</h1>
          <p class="muted">พูดคุยกับแอดมินร้าน</p>
        </div>
        <AccountMenuDrawer />
      </header>

      <p v-if="errorMessage" class="alert error">{{ errorMessage }}</p>
      <p v-if="uploadProgress" class="chat-upload-progress muted">{{ uploadProgress }}</p>

      <div ref="messagesRef" class="chat-messages" aria-live="polite">
        <p v-if="loading && messages.length === 0" class="chat-empty muted">กำลังโหลด...</p>
        <p v-else-if="messages.length === 0" class="chat-empty muted">{{ emptyHint }}</p>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="chat-bubble-row"
          :class="msg.sender_role === 'customer' ? 'mine' : 'theirs'"
        >
          <div class="chat-bubble" :class="{ 'chat-bubble--image': msg.image_url }">
            <ChatImage
              v-if="msg.image_url"
              :filename="msg.image_url"
              @open="openLightbox"
            />
            <p v-if="msg.body" class="chat-body">{{ msg.body }}</p>
            <time class="chat-time">{{ formatTime(msg.created_at) }}</time>
          </div>
        </div>
        <div ref="bottomAnchorRef" class="chat-scroll-anchor" aria-hidden="true" />
      </div>

      <Transition name="chat-jump">
        <button
          v-if="!isPinnedToBottom && messages.length"
          type="button"
          class="chat-jump-btn"
          :class="{ 'chat-jump-btn--new': hasNewBelow }"
          @click="jumpToBottom(true)"
        >
          <i class="ti ti-arrow-down" aria-hidden="true"></i>
          {{ hasNewBelow ? 'ข้อความใหม่' : 'ล่าสุด' }}
        </button>
      </Transition>

      <form class="chat-compose" @submit.prevent="sendMessage">
        <input
          ref="imageInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="chat-file-input"
          multiple
          @change="onImageSelected"
        />
        <button
          type="button"
          class="chat-icon-btn chat-attach-btn"
          aria-label="แนบรูป"
          :title="`แนบรูป (สูงสุด ${MAX_CHAT_IMAGES} รูป)`"
          :disabled="composeBusy"
          @click="pickImage"
        >
          <i class="ti ti-photo" aria-hidden="true"></i>
        </button>
        <textarea
          v-model="draft"
          rows="2"
          class="chat-input"
          placeholder="พิมพ์ข้อความ..."
          maxlength="2000"
          :disabled="composeBusy"
          @keydown="onKeydown"
        />
        <button type="submit" class="btn primary chat-send chat-send--label" :disabled="!canSend">
          {{ sending || uploading ? '...' : 'ส่ง' }}
        </button>
      </form>
    </template>

    <Teleport to="body">
      <div
        v-if="lightboxSrc"
        class="chat-lightbox"
        role="dialog"
        aria-label="ดูรูปเต็มจอ"
        @click.self="closeLightbox"
      >
        <button type="button" class="chat-lightbox-close" aria-label="ปิด" @click="closeLightbox">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
        <img :src="lightboxSrc" alt="รูปเต็มจอ" class="chat-lightbox-img" @click.stop />
      </div>
    </Teleport>

    <BottomNav active="chat" />
  </div>
</template>

<style scoped>
/* A fixed viewport-height shell keeps the document itself unscrollable, so the
   message list is the only thing that moves and the compose bar never drifts
   under the bottom nav. */
.chat-page {
  position: relative;
  height: 100dvh;
  max-width: 430px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: var(--page-nav-padding-bottom);
  background: var(--color-bg);
  box-sizing: border-box;
}

.chat-page--admin {
  max-width: 900px;
}

@media (min-width: 900px) {
  .chat-page,
  .chat-page--admin {
    max-width: min(var(--page-wide-max), 100%);
    padding-left: var(--sidebar-width);
    padding-bottom: 0;
  }

  .chat-jump-btn {
    bottom: 88px;
  }
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
  color: var(--color-on-primary);
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
  border-radius: var(--radius-pill);
  background: var(--color-error);
  color: var(--color-on-primary);
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
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.chat-thread-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.chat-icon-btn {
  position: relative;
  flex-shrink: 0;
  width: var(--touch-min);
  height: var(--touch-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
}

.chat-icon-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.chat-icon-btn:active {
  transform: scale(0.96);
}

.chat-delete-btn {
  margin-left: auto;
  color: var(--color-error);
  border-color: rgba(196, 92, 92, 0.35);
}

.chat-file-input {
  display: none;
}

.chat-attach-btn {
  flex-shrink: 0;
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
  border-radius: var(--radius-pill);
  background: var(--color-error);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
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
  flex-shrink: 0;
}

.chat-upload-progress {
  margin: 6px 16px 0;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
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
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
  min-width: 0;
}

.chat-header-brand {
  flex: 0 1 38%;
  min-width: 0;
  max-width: 38%;
}

@media (display-mode: standalone) {
  .chat-header {
    padding-top: calc(16px + env(safe-area-inset-top, 0px));
  }

  .chat-thread-head,
  .chat-sidebar-head {
    padding-top: calc(12px + env(safe-area-inset-top, 0px));
  }
}

.chat-header-text {
  flex: 1 1 0;
  min-width: 0;
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
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.chat-jump-btn {
  position: absolute;
  left: 50%;
  bottom: calc(var(--page-nav-padding-bottom) + 72px);
  transform: translateX(-50%);
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow-md, 0 4px 14px rgba(45, 36, 36, 0.16));
}

.chat-jump-btn--new {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary, #fff);
}

.chat-jump-enter-active,
.chat-jump-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.chat-jump-enter-from,
.chat-jump-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

.chat-scroll-anchor {
  flex-shrink: 0;
  width: 100%;
  height: 1px;
  overflow: hidden;
  pointer-events: none;
}

.chat-empty {
  text-align: center;
  margin: auto;
  font-size: 14px;
}

.chat-bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.chat-bubble-row.mine {
  justify-content: flex-end;
  flex-direction: row-reverse;
}

.chat-bubble-row.theirs {
  justify-content: flex-start;
}

.chat-msg-delete {
  flex: 0 0 auto;
  align-self: center;
  width: 26px;
  height: 26px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface-elevated);
  color: var(--color-text-muted, #64748b);
  font-size: 13px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chat-bubble-row:hover .chat-msg-delete,
.chat-msg-delete:focus-visible {
  opacity: 1;
}

.chat-msg-delete:hover {
  color: var(--color-danger, #dc2626);
  border-color: var(--color-danger, #dc2626);
}

.chat-msg-delete:disabled {
  opacity: 0.4;
  cursor: default;
}

@media (hover: none) {
  .chat-msg-delete {
    opacity: 0.55;
  }
}

.chat-bubble {
  max-width: 82%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.chat-bubble-row.mine .chat-bubble {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
  border-bottom-right-radius: var(--radius-sm);
}

.chat-bubble-row.theirs .chat-bubble {
  border-bottom-left-radius: var(--radius-sm);
}

.chat-bubble-row.mine .chat-time {
  color: color-mix(in srgb, var(--color-on-primary) 72%, transparent);
}

.chat-bubble--image {
  padding: 6px;
}

.chat-bubble--image .chat-body {
  margin-top: 6px;
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
  gap: var(--space-2);
  align-items: flex-end;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-elevated) 94%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  min-width: 0;
  width: 0;
  resize: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-family: inherit;
  font-size: 16px;
  line-height: 1.4;
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  box-sizing: border-box;
  -webkit-text-size-adjust: 100%;
  min-height: var(--touch-min);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.chat-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
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

.chat-lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.chat-lightbox-close {
  position: absolute;
  top: max(12px, env(safe-area-inset-top, 0));
  right: 12px;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chat-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

/* ── Mobile: drawer sidebar ── */
@media (max-width: 640px) {
  .chat-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: var(--bottom-nav-total);
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

.chat-conv--system {
  background: rgba(100, 116, 139, 0.06);
}

.chat-avatar--system {
  background: linear-gradient(145deg, #64748b, #475569);
  font-size: 16px;
}

.chat-bubble-row.system-notify {
  justify-content: flex-start;
}

.chat-bubble--system {
  background: rgba(100, 116, 139, 0.1);
  border: 1px solid rgba(100, 116, 139, 0.18);
  max-width: min(100%, 420px);
}

.chat-bubble--system .chat-body {
  white-space: pre-wrap;
}

.chat-related-link {
  display: inline-flex;
  margin-top: 8px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.chat-related-link:hover {
  filter: brightness(1.05);
}
</style>

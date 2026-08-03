<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  filename: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['open'])

const src = ref('')
const failed = ref(false)
let objectUrl = ''

const blobUrlCache = new Map()

function chatImageRequestUrl(filename) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  return `${baseURL}/api/chat/images/${encodeURIComponent(filename)}`
}

function chatImageRequestHeaders() {
  const headers = {}
  const token = localStorage.getItem('token')
  const shopSlug = localStorage.getItem('shopSlug')
  if (token) headers.Authorization = `Bearer ${token}`
  if (shopSlug) headers['X-Shop-Slug'] = shopSlug
  return headers
}

async function loadImage() {
  failed.value = false
  src.value = ''

  const cached = blobUrlCache.get(props.filename)
  if (cached) {
    objectUrl = cached
    src.value = cached
    return
  }

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }

  try {
    const response = await fetch(chatImageRequestUrl(props.filename), {
      headers: chatImageRequestHeaders(),
      cache: 'default',
    })
    if (!response.ok) throw new Error('load failed')

    const blob = await response.blob()
    objectUrl = URL.createObjectURL(blob)
    blobUrlCache.set(props.filename, objectUrl)
    src.value = objectUrl
  } catch {
    failed.value = true
  }
}

onMounted(loadImage)
watch(() => props.filename, loadImage)

onUnmounted(() => {
  if (objectUrl && blobUrlCache.get(props.filename) !== objectUrl) {
    URL.revokeObjectURL(objectUrl)
  }
})

function openViewer() {
  if (src.value) emit('open', src.value)
}
</script>

<template>
  <button type="button" class="chat-image-btn" @click="openViewer">
    <img v-if="src" :src="src" alt="รูปในแชท" class="chat-image-thumb" loading="lazy" />
    <span v-else-if="failed" class="chat-image-failed">โหลดรูปไม่สำเร็จ (หมดอายุแล้ว)</span>
    <span v-else class="chat-image-loading">กำลังโหลดรูป...</span>
  </button>
</template>

<style scoped>
.chat-image-btn {
  display: block;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  max-width: 100%;
}

.chat-image-thumb {
  display: block;
  max-width: min(220px, 100%);
  max-height: 220px;
  border-radius: 10px;
  object-fit: cover;
}

.chat-image-loading,
.chat-image-failed {
  display: inline-block;
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 8px 0;
}
</style>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import api from '../api/axios'

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

async function loadImage() {
  failed.value = false
  src.value = ''
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
  try {
    const { data } = await api.get(`/api/chat/images/${encodeURIComponent(props.filename)}`, {
      responseType: 'blob',
    })
    objectUrl = URL.createObjectURL(data)
    src.value = objectUrl
  } catch {
    failed.value = true
  }
}

onMounted(loadImage)
watch(() => props.filename, loadImage)

onUnmounted(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})

function openViewer() {
  if (src.value) emit('open', src.value)
}
</script>

<template>
  <button type="button" class="chat-image-btn" @click="openViewer">
    <img v-if="src" :src="src" alt="รูปในแชท" class="chat-image-thumb" loading="lazy" />
    <span v-else-if="failed" class="chat-image-failed">โหลดรูปไม่สำเร็จ</span>
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

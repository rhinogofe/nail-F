<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  autoplay: { type: Number, default: 5000 },
  /** จำนวนที่ยังไม่ต้องวน ถ้าแสดงครบในจอ (เช่น 3 = บนคอมมี 3 รายการไม่ต้องเลื่อน) */
  minLoop: { type: Number, default: 0 },
})

const track = ref(null)
const active = ref(false)
const hover = ref(false)
const focused = ref(false)
let stride = 0
let settleTimer
let playTimer
let touching = false
let holdUntil = 0
let ro

const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches

/** 3 ชุด: [สำเนา][ตัวจริง][สำเนา] — เลื่อนเกินขอบแล้วกระโดดกลับชุดกลาง ให้วนได้ไม่สิ้นสุด */
const slides = computed(() => {
  const list = props.items.map((item, index) => ({ item, index, clone: false, key: 'r' + index }))
  if (!active.value) return list
  const copy = tag => props.items.map((item, index) => ({ item, index, clone: true, key: tag + index }))
  return [...copy('a'), ...list, ...copy('c')]
})

function measure() {
  const el = track.value
  const first = el?.children[0]
  if (!first) return 0
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0
  stride = first.offsetWidth + gap
  return stride ? Math.round((el.clientWidth + gap) / stride) : 0
}

function setWidth() {
  return stride * props.items.length
}

function jumpToMiddle() {
  const el = track.value
  if (el && active.value) el.scrollLeft = setWidth()
}

function settle() {
  const el = track.value
  if (!el || !active.value || touching) return
  const w = setWidth()
  if (!w) return
  if (el.scrollLeft < w - stride / 2) el.scrollLeft += w
  else if (el.scrollLeft >= w * 2 - stride / 2) el.scrollLeft -= w
}

function onScroll() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(settle, 140)
}

async function refresh() {
  const was = active.value
  active.value = false
  await nextTick()
  const perView = measure()
  const n = props.items.length
  active.value = n > 1 && n >= perView && (n > props.minLoop || perView < n)
  if (active.value) {
    await nextTick()
    measure()
    jumpToMiddle()
  } else if (track.value) {
    track.value.scrollLeft = 0
  }
  if (was !== active.value) restartPlay()
}

function go(dir) {
  const el = track.value
  if (!el || !active.value) return
  settle()
  el.scrollBy({ left: dir * stride, behavior: reduceMotion ? 'auto' : 'smooth' })
}

function userGo(dir) {
  holdUntil = Date.now() + 8000
  go(dir)
}

function restartPlay() {
  clearInterval(playTimer)
  if (!active.value || reduceMotion || !props.autoplay) return
  playTimer = setInterval(() => {
    if (hover.value || focused.value || touching || document.hidden || Date.now() < holdUntil) return
    go(1)
  }, props.autoplay)
}

function onTouchStart() {
  touching = true
  holdUntil = Date.now() + 8000
}
function onTouchEnd() {
  touching = false
  onScroll()
}

watch(() => props.items.length, () => refresh())

onMounted(() => {
  refresh()
  if (typeof ResizeObserver === 'function') {
    let w = track.value?.clientWidth || 0
    ro = new ResizeObserver(() => {
      const next = track.value?.clientWidth || 0
      if (next !== w) { w = next; refresh() }
    })
    ro.observe(track.value)
  }
})
onUnmounted(() => {
  clearTimeout(settleTimer)
  clearInterval(playTimer)
  ro?.disconnect()
})
</script>

<template>
  <div
    class="loop"
    role="region"
    aria-roledescription="carousel"
    :aria-label="label || undefined"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @focusin="focused = true"
    @focusout="focused = false"
  >
    <div class="head">
      <slot name="head" />
      <div v-if="active" class="loop-nav">
        <button type="button" class="loop-btn" aria-label="ก่อนหน้า" @click="userGo(-1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button type="button" class="loop-btn" aria-label="ถัดไป" @click="userGo(1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
    <slot name="intro" />
    <div
      ref="track"
      class="loop-track"
      :class="{ on: active }"
      @scroll.passive="onScroll"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
    >
      <div
        v-for="s in slides"
        :key="s.key"
        class="loop-slide"
        :aria-hidden="s.clone || undefined"
        :inert="s.clone || undefined"
      >
        <slot :item="s.item" :index="s.index" />
      </div>
    </div>
  </div>
</template>

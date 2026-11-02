<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  autoplay: { type: Number, default: 5000 },
  /** จำนวนที่ยังไม่ต้องวน ถ้าแสดงครบในจอ (เช่น 3 = บนคอมมี 3 รายการไม่ต้องเลื่อน) */
  minLoop: { type: Number, default: 0 },
})

const viewport = ref(null)
const track = ref(null)
const active = ref(false)
const hover = ref(false)
const focused = ref(false)
const dragging = ref(false)
const stride = ref(0)
const perView = ref(1)
/** การ์ดแรกที่เห็นตอนหยุดนิ่ง (นับรวมสำเนา) — ใช้ซ่อนการ์ดนอกจอจาก screen reader */
const restIndex = ref(0)

let target = null
let settleTimer
let playTimer
let holdUntil = 0
let ro
let drag = null
let touching = false
let suppressClick = false

const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches
const mod = (k, n) => ((k % n) + n) % n
const n = computed(() => props.items.length)
/**
 * ใช้การเลื่อนแนวนอนของเบราว์เซอร์เอง (iOS Safari ปัดลื่นที่สุดแบบนี้) แล้วต่อสำเนาไว้หลายชุด
 * พอหยุดเลื่อนจะกระโดดกลับชุดกลางแบบมองไม่เห็น — ต้องปัดต่อเนื่องเกินครึ่งหนึ่งของสำเนาทั้งหมดถึงจะชนขอบ
 */
const copies = computed(() => {
  let c = Math.max(5, Math.ceil(100 / Math.max(1, n.value)))
  if (c % 2 === 0) c++
  return c
})
const middleStart = computed(() => Math.floor(copies.value / 2) * n.value)

const slides = computed(() => {
  if (!active.value) return props.items.map((item, index) => ({ item, index, key: 'r' + index, hidden: false }))
  const out = []
  const total = copies.value * n.value
  for (let k = 0; k < total; k++) {
    out.push({ item: props.items[k % n.value], index: k % n.value, key: 'k' + k, hidden: k < restIndex.value || k >= restIndex.value + perView.value })
  }
  return out
})

function measure() {
  const el = track.value
  const first = el?.children[0]
  if (!el || !first || !viewport.value) return
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0
  stride.value = first.getBoundingClientRect().width + gap
  perView.value = stride.value ? Math.max(1, Math.round((viewport.value.clientWidth + gap) / stride.value)) : 1
}

const currentIndex = () => (stride.value && viewport.value ? Math.round(viewport.value.scrollLeft / stride.value) : 0)

function jumpTo(k) {
  const el = viewport.value
  if (!el) return
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = k * stride.value
  el.style.scrollBehavior = ''
}

async function refresh() {
  clearTimeout(settleTimer)
  target = null
  active.value = false
  await nextTick()
  measure()
  active.value = n.value > 1 && n.value >= perView.value && (n.value > props.minLoop || perView.value < n.value)
  if (active.value) {
    await nextTick()
    measure()
    restIndex.value = middleStart.value
    jumpTo(middleStart.value)
  } else if (viewport.value) {
    viewport.value.scrollLeft = 0
  }
  restartPlay()
}

/** เรียกตอนเลื่อนหยุดแล้ว: ย้ายไปการ์ดเดียวกันในชุดกลาง (ภาพเหมือนเดิมทุกพิกเซล) */
function settle() {
  if (!active.value || touching || drag || !stride.value) return
  const k = currentIndex()
  const home = middleStart.value + mod(k - middleStart.value, n.value)
  if (home !== k) jumpTo(home)
  restIndex.value = home
  target = null
}

function onScroll() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(settle, 160)
}

function scrollToIndex(k) {
  const el = viewport.value
  if (!el) return
  target = k
  el.scrollTo({ left: k * stride.value, behavior: reduceMotion ? 'auto' : 'smooth' })
}

function go(dir) {
  if (!active.value || !stride.value) return
  if (target == null) settle()
  scrollToIndex((target ?? currentIndex()) + dir)
}

function userGo(dir) {
  holdUntil = Date.now() + 8000
  go(dir)
}

function onKeydown(e) {
  if (!active.value || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
  if (e.key === 'ArrowRight') { e.preventDefault(); userGo(1) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); userGo(-1) }
}

function onTouchStart() {
  touching = true
  target = null
  holdUntil = Date.now() + 8000
}
function onTouchEnd() {
  touching = false
  onScroll()
}

function onPointerDown(e) {
  if (!active.value || e.pointerType !== 'mouse' || e.button !== 0) return
  target = null
  holdUntil = Date.now() + 8000
  drag = { id: e.pointerId, x: e.clientX, left: viewport.value.scrollLeft, moved: false, samples: [[performance.now(), e.clientX]] }
}
function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  if (!drag.moved) {
    if (Math.abs(dx) < 6) return
    drag.moved = true
    dragging.value = true
    viewport.value.setPointerCapture?.(e.pointerId)
  }
  viewport.value.scrollLeft = drag.left - dx
  drag.samples.push([performance.now(), e.clientX])
  if (drag.samples.length > 6) drag.samples.shift()
}
async function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.id) return
  const d = drag
  drag = null
  if (!d.moved) return
  suppressClick = true
  setTimeout(() => { suppressClick = false }, 0)
  const [[t0, x0]] = d.samples
  const [t1, x1] = d.samples[d.samples.length - 1]
  const velocity = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0
  const flick = Math.max(-perView.value, Math.min(perView.value, (-velocity * 180) / stride.value))
  const start = Math.round(d.left / stride.value)
  const now = viewport.value.scrollLeft / stride.value
  let to = Math.round(now + flick)
  if (to === start && Math.abs(now - start) > 0.15) to = start + Math.sign(now - start)
  dragging.value = false
  await nextTick()
  scrollToIndex(to)
}

function onClickCapture(e) {
  if (suppressClick) { e.preventDefault(); e.stopPropagation() }
}

function restartPlay() {
  clearInterval(playTimer)
  if (!active.value || reduceMotion || !props.autoplay) return
  playTimer = setInterval(() => {
    if (hover.value || focused.value || touching || drag || document.hidden || Date.now() < holdUntil) return
    go(1)
  }, props.autoplay)
}

watch(() => props.items.length, () => refresh())

onMounted(() => {
  refresh()
  viewport.value?.addEventListener('scrollend', settle)
  if (typeof ResizeObserver === 'function') {
    let w = viewport.value?.clientWidth || 0
    ro = new ResizeObserver(() => {
      const next = viewport.value?.clientWidth || 0
      if (next !== w) { w = next; refresh() }
    })
    ro.observe(viewport.value)
  }
})
onUnmounted(() => {
  clearTimeout(settleTimer)
  clearInterval(playTimer)
  viewport.value?.removeEventListener('scrollend', settle)
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
    @keydown="onKeydown"
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
      ref="viewport"
      class="loop-viewport"
      :class="{ on: active, dragging }"
      @scroll.passive="onScroll"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onClickCapture"
      @dragstart.prevent
    >
      <div ref="track" class="loop-track">
        <div
          v-for="s in slides"
          :key="s.key"
          class="loop-slide"
          :aria-hidden="s.hidden || undefined"
          :inert="s.hidden || undefined"
        >
          <slot :item="s.item" :index="s.index" />
        </div>
      </div>
    </div>
  </div>
</template>

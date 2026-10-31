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
/** ตำแหน่งเป็นหน่วย «การ์ด» ไม่มีขอบเขต — การ์ดที่ตำแหน่ง k คือ items[k mod n] จึงวนเป็นวงกลมได้ทั้งสองทาง */
const pos = ref(0)
const stride = ref(0)
const perView = ref(1)

let anim = null
let target = null
let playTimer
let holdUntil = 0
let ro
let wheelTimer
let drag = null
let suppressClick = false

const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches
const mod = (k, n) => ((k % n) + n) % n

const windowStart = computed(() => Math.floor(pos.value) - 1)
const slides = computed(() => {
  const n = props.items.length
  if (!active.value) return props.items.map((item, index) => ({ item, index, key: 'r' + index, hidden: false }))
  const count = Math.max(perView.value + 2, n) + 1
  const first = Math.round(pos.value)
  const out = []
  for (let k = windowStart.value; k < windowStart.value + count; k++) {
    const index = mod(k, n)
    out.push({ item: props.items[index], index, key: 'k' + k, hidden: k < first || k >= first + perView.value })
  }
  return out
})
const trackStyle = computed(() => (active.value
  ? { transform: `translate3d(${-(pos.value - windowStart.value) * stride.value}px,0,0)` }
  : null))

function measure() {
  const el = track.value
  const first = el?.children[0]
  if (!el || !first || !viewport.value) return
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0
  stride.value = first.getBoundingClientRect().width + gap
  perView.value = stride.value ? Math.max(1, Math.round((viewport.value.clientWidth + gap) / stride.value)) : 1
}

async function refresh() {
  stopAnim()
  active.value = false
  pos.value = 0
  await nextTick()
  measure()
  const n = props.items.length
  active.value = n > 1 && n >= perView.value && (n > props.minLoop || perView.value < n)
  if (active.value) {
    await nextTick()
    measure()
  }
  restartPlay()
}

function stopAnim() {
  if (anim) cancelAnimationFrame(anim)
  anim = null
  target = null
}

function animateTo(to) {
  stopAnim()
  if (reduceMotion) { pos.value = to; return }
  target = to
  const from = pos.value
  const dist = Math.abs(to - from)
  if (dist < 0.001) { pos.value = to; target = null; return }
  const duration = Math.min(650, 260 + dist * 140)
  const t0 = performance.now()
  const step = now => {
    const t = Math.min(1, (now - t0) / duration)
    pos.value = from + (to - from) * (1 - (1 - t) ** 3)
    if (t < 1) anim = requestAnimationFrame(step)
    else { anim = null; target = null; pos.value = to }
  }
  anim = requestAnimationFrame(step)
}

function go(dir) {
  if (!active.value) return
  animateTo((target ?? Math.round(pos.value)) + dir)
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

function onPointerDown(e) {
  if (!active.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  stopAnim()
  holdUntil = Date.now() + 8000
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pos: pos.value, moved: false, samples: [[e.timeStamp, e.clientX]] }
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.id || !stride.value) return
  const dx = e.clientX - drag.x
  if (!drag.moved) {
    if (Math.abs(dx) < 6) return
    if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return }
    drag.moved = true
    dragging.value = true
    track.value?.setPointerCapture?.(e.pointerId)
  }
  pos.value = drag.pos - dx / stride.value
  drag.samples.push([e.timeStamp, e.clientX])
  if (drag.samples.length > 6) drag.samples.shift()
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.id) return
  const d = drag
  drag = null
  if (!d.moved) return
  dragging.value = false
  suppressClick = true
  setTimeout(() => { suppressClick = false }, 0)
  const [[t0, x0]] = d.samples
  const [t1, x1] = d.samples[d.samples.length - 1]
  const velocity = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0
  const flick = Math.max(-perView.value, Math.min(perView.value, (-velocity * 180) / stride.value))
  const start = Math.round(d.pos)
  let to = Math.round(pos.value + flick)
  if (to === start && Math.abs(pos.value - d.pos) > 0.15) to = start + Math.sign(pos.value - d.pos)
  animateTo(to)
}

function onClickCapture(e) {
  if (suppressClick) { e.preventDefault(); e.stopPropagation() }
}

function onWheel(e) {
  if (!active.value || !stride.value) return
  const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
  if (Math.abs(dx) <= Math.abs(e.shiftKey ? 0 : e.deltaY)) return
  e.preventDefault()
  stopAnim()
  holdUntil = Date.now() + 8000
  pos.value += (e.deltaMode === 1 ? dx * 16 : dx) / stride.value
  clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => animateTo(Math.round(pos.value)), 140)
}

function restartPlay() {
  clearInterval(playTimer)
  if (!active.value || reduceMotion || !props.autoplay) return
  playTimer = setInterval(() => {
    if (hover.value || focused.value || drag || document.hidden || Date.now() < holdUntil) return
    go(1)
  }, props.autoplay)
}

watch(() => props.items.length, () => refresh())

onMounted(() => {
  refresh()
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
  stopAnim()
  clearInterval(playTimer)
  clearTimeout(wheelTimer)
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
    <div ref="viewport" class="loop-viewport">
      <div
        ref="track"
        class="loop-track"
        :class="{ on: active, dragging }"
        :style="trackStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
        @click.capture="onClickCapture"
        @dragstart.prevent
      >
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

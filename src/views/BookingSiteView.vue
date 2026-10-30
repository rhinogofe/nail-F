<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useShopRoute } from '../composables/useShopRoute'
import { getPublicContent, bookingLink, img } from '../bookingSite/api.js'
import { applyTheme, clearTheme } from '../bookingSite/theme.js'
import { defaultNav, isSectionVisible, navHref, pageSectionOrder } from '../bookingSite/sections.js'
import { hasShopMapUrl, resolveShopMapEmbedUrl } from '../utils/shopMapEmbed'
import LoopCarousel from '../bookingSite/LoopCarousel.vue'
import '../bookingSite/style.css'

const { shopSlug } = useShopRoute()
const rootEl = ref(null)
const c = ref(null)
const cur = ref(0)
const menuOpen = ref(false)
const loadError = ref('')
const paused = ref(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches)
let timer
let prevTitle = ''

const toLocalYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayYmd = computed(() => toLocalYmd(new Date()))
const day = ref(toLocalYmd(new Date()))

const h = computed(() => c.value.hero[cur.value] || c.value.hero[0])
const tg = computed(() => (c.value.site.newTab ? '_blank' : '_self'))
const showHeroBooking = computed(() => h.value?.showBooking !== false)
const heroBtnHref = computed(() => {
  const link = (h.value?.link || '').trim()
  return link || book()
})
const heroBtnLabel = computed(() => (h.value?.button || '').trim())
const bg = u => (u ? { background: `url("${img(u)}") center/cover` } : null)
const showImg = o => o?.showImage !== false
const itemBg = o => (showImg(o) && o?.image ? bg(o.image) : null)
const promoBoxStyle = p => {
  const s = { ...itemBg(p) }
  const t = (p?.titleColor || '').trim()
  const x = (p?.textColor || '').trim()
  if (t) s['--promo-title'] = t
  if (x) s['--promo-text'] = x
  return s
}
const roomCardStyle = r => {
  const s = {}
  const t = (r?.titleColor || '').trim()
  const x = (r?.textColor || '').trim()
  const l = (r?.linkColor || '').trim()
  if (t) s['--room-title'] = t
  if (x) s['--room-text'] = x
  if (l) s['--room-link'] = l
  return Object.keys(s).length ? s : null
}
const book = link => bookingLink(link || c.value.site.bookingUrl)

const trim = v => String(v || '').trim()
const shopAddress = computed(() => [trim(c.value?.site?.address), trim(c.value?.location?.addressDetail)].filter(Boolean).join('\n'))
const shopPhone = computed(() => trim(c.value?.site?.phone))
const shopEmail = computed(() => trim(c.value?.site?.email))
const ownMapUrl = computed(() => {
  const u = trim(c.value?.about?.mapUrl)
  return hasShopMapUrl(u) ? u : ''
})
const mapUrl = computed(() => {
  if (ownMapUrl.value) return ownMapUrl.value
  const u = trim(c.value?.location?.mapUrl)
  return hasShopMapUrl(u) ? u : ''
})
const mapEmbed = computed(() => (ownMapUrl.value
  ? resolveShopMapEmbedUrl(ownMapUrl.value, trim(c.value.about.mapEmbedUrl))
  : resolveShopMapEmbedUrl(mapUrl.value, trim(c.value?.location?.embedUrl))))
const aboutMedia = computed(() => {
  if (!c.value?.about) return null
  if (c.value.about.showMap !== false && mapEmbed.value) return 'map'
  if (showImg(c.value.about)) return 'image'
  return null
})
function search() {
  const date = (day.value || '').trim()
  const u = bookingLink(c.value.site.bookingUrl, date ? { date } : {})
  if (c.value.site.newTab) window.open(u, '_blank', 'noopener')
  else location.href = u
}

const menuItems = computed(() => {
  if (!c.value) return []
  const list = c.value.nav?.length ? c.value.nav : defaultNav
  return list.filter(n => n.show !== false && n.label?.trim() && isSectionVisible(c.value, n.section, showImg))
})
const pageSections = computed(() => (c.value ? pageSectionOrder(c.value.nav) : []))

function play() {
  clearInterval(timer)
  if (!paused.value && c.value?.hero?.length) {
    timer = setInterval(() => (cur.value = (cur.value + 1) % c.value.hero.length), 6000)
  }
}
const toggle = () => { paused.value = !paused.value; play() }
const pick = i => { cur.value = i; paused.value = true; play() }

function onMenuClick(section) {
  menuOpen.value = false
  if (section !== 'book') return
}

function scrollToHash() {
  const id = decodeURIComponent(String(location.hash || '').replace(/^#/, ''))
  if (!id) return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function paint() {
  if (rootEl.value && c.value) applyTheme(c.value.theme, rootEl.value)
}

watch(rootEl, () => paint())
watch(
  () => c.value?.theme,
  () => paint(),
  { deep: true },
)

onMounted(async () => {
  prevTitle = document.title
  try {
    c.value = await getPublicContent(shopSlug.value)
    document.title = c.value.site.name || document.title
    await nextTick()
    paint()
    play()
    await nextTick()
    scrollToHash()
  } catch (err) {
    loadError.value = err?.response?.data?.error || err?.message || 'โหลดเว็บไซต์ไม่สำเร็จ'
  }
})
onUnmounted(() => {
  clearInterval(timer)
  clearTheme(rootEl.value || document.documentElement)
  if (prevTitle) document.title = prevTitle
})
</script>

<template>
  <div v-if="loadError" class="booking-site-status">
    <p class="err" role="alert">{{ loadError }}</p>
  </div>
  <div v-else-if="!c" class="booking-site-status">กำลังโหลดเว็บไซต์...</div>
  <div v-else class="booking-site" ref="rootEl">
    <header class="hero" :class="{ 'no-overlay': c.theme?.heroOverlay === false }" id="top">
      <a class="logo" href="#top">{{ c.site.logoText }}<small v-if="c.site.logoSub">{{ c.site.logoSub }}</small></a>
      <button type="button" class="menu-toggle" :aria-expanded="menuOpen" aria-controls="booking-site-menu" @click="menuOpen = !menuOpen">{{ menuOpen ? '×' : '☰' }}</button>
      <nav id="booking-site-menu" class="menu" :class="{ open: menuOpen }" aria-label="เมนูหลัก">
        <a
          v-for="(n, i) in menuItems"
          :key="i"
          :href="n.section === 'book' ? book() : navHref(n.section)"
          :target="n.section === 'book' ? tg : undefined"
          :rel="n.section === 'book' ? 'noopener' : undefined"
          :class="{ bk: n.section === 'book' }"
          @click="onMenuClick(n.section)"
        >{{ n.label }}</a>
      </nav>

      <div v-for="(s, i) in c.hero" :key="i" class="slide" :class="['g' + (i % 4), { on: i === cur }]" :style="itemBg(s)"></div>

      <div class="copy">
        <h1>{{ h.title }}</h1>
        <p>{{ h.text }}</p>
        <a v-if="heroBtnLabel" class="btn" :href="heroBtnHref" :target="tg" rel="noopener">{{ heroBtnLabel }}</a>
      </div>

      <div class="barwrap">
        <form v-if="showHeroBooking" class="bar" @submit.prevent="search">
          <div>
            <label for="hero-date">เลือกวัน</label>
            <input id="hero-date" type="date" v-model="day" :min="todayYmd" required>
          </div>
          <button class="go" type="submit">{{ c.site.bookingLabel || 'จองคิว' }}</button>
        </form>
        <button class="pause" type="button" :class="{ off: paused }" :aria-label="paused ? 'เล่นสไลด์' : 'หยุดสไลด์'" @click="toggle"></button>
      </div>

      <div class="tabs" role="tablist">
        <button v-for="(s, i) in c.hero" :key="i" type="button" class="tab" role="tab" :aria-selected="i === cur" @click="pick(i)">{{ s.tab }}</button>
      </div>
      <div class="scroll"><span>เลื่อนลงเพื่อดูเพิ่มเติม</span></div>
    </header>

    <template v-for="sec in pageSections" :key="sec">
      <section v-if="sec === 'about' && isSectionVisible(c, 'about', showImg)" id="about" class="about place" :class="{ solo: !aboutMedia, 'img-first': c.about?.imageFirst }">
        <div class="about-copy">
          <h2>{{ c.about.title || 'ที่อยู่ร้าน' }}</h2>
          <p v-if="c.about.text" class="lead">{{ c.about.text }}</p>
          <dl class="place-info">
            <div v-if="shopAddress"><dt>ที่อยู่</dt><dd>{{ shopAddress }}</dd></div>
            <div v-if="shopPhone"><dt>โทร</dt><dd><a :href="'tel:' + shopPhone.replace(/[^\d+]/g, '')">{{ shopPhone }}</a></dd></div>
            <div v-if="shopEmail"><dt>อีเมล</dt><dd><a :href="'mailto:' + shopEmail">{{ shopEmail }}</a></dd></div>
          </dl>
          <div class="place-actions">
            <a v-if="mapUrl" class="btn" :href="mapUrl" target="_blank" rel="noopener">{{ c.location?.openMapsLabel || 'เปิดใน Google Maps' }}</a>
            <a class="link" :href="book()" :target="tg" rel="noopener">{{ c.site.bookingLabel || 'จองคิว' }}</a>
          </div>
        </div>
        <div v-if="aboutMedia === 'map'" class="place-map">
          <iframe :src="mapEmbed" :title="'แผนที่ ' + (c.site.name || 'ร้าน')" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
        </div>
        <div v-else-if="aboutMedia === 'image'" class="img" :style="bg(c.about.image)"></div>
      </section>

      <section v-else-if="sec === 'rooms' && isSectionVisible(c, 'rooms', showImg)" id="rooms">
        <LoopCarousel :items="c.rooms" :min-loop="3" :label="c.roomsHeading || 'บริการ'">
          <template #head><h2>{{ c.roomsHeading || 'บริการ' }}</h2></template>
          <template #default="{ item: r, index: i }">
            <article class="card" :style="roomCardStyle(r)">
              <div v-if="showImg(r)" class="img" :class="'g' + (i % 4)" :style="bg(r.image)"></div>
              <h3>{{ r.name }}</h3><p>{{ r.detail }}</p>
              <a class="link" :href="book(r.link)" :target="tg" rel="noopener">จองเลย</a>
            </article>
          </template>
        </LoopCarousel>
      </section>

      <section v-else-if="sec === 'promo' && isSectionVisible(c, 'promo', showImg)" id="promo">
        <div class="head"><h2>{{ c.promosHeading || 'โปรโมชั่น' }}</h2></div>
        <div class="promo">
          <article class="pbox" v-for="(p, i) in c.promos" :key="i" :class="'g' + (i % 4)" :style="promoBoxStyle(p)">
            <h3>{{ p.title }}</h3><p>{{ p.text }}</p>
            <a class="btn" :href="book(p.link)" :target="tg" rel="noopener">จองโปรโมชั่นนี้</a>
          </article>
        </div>
      </section>

      <section v-else-if="sec === 'dining' && isSectionVisible(c, 'dining', showImg)" id="dining" class="about" :class="{ solo: !showImg(c.dining), 'img-first': c.dining?.imageFirst !== false }">
        <div class="about-copy"><h2>{{ c.dining.title }}</h2><p class="lead">{{ c.dining.text }}</p></div>
        <div v-if="showImg(c.dining)" class="img w" :style="bg(c.dining.image)"></div>
      </section>

      <section v-else-if="sec === 'news' && isSectionVisible(c, 'news', showImg)" id="news">
        <LoopCarousel :items="c.news" :label="c.newsHeading || 'รีวิว'">
          <template #head><h2>{{ c.newsHeading || 'รีวิว' }}</h2></template>
          <template #intro><div v-if="c.newsShowImage !== false" class="news-banner img" :style="bg(c.newsImage)"></div></template>
          <template #default="{ item: n, index: i }">
            <article class="review">
              <div v-if="showImg(n)" class="news-thumb img" :class="'g' + (i % 4)" :style="bg(n.image)"></div>
              <time>{{ n.date }}</time>
              <h3>{{ n.title }}</h3>
            </article>
          </template>
        </LoopCarousel>
      </section>
    </template>

    <footer id="contact">
      <div><b>{{ c.site.name }}</b>{{ c.site.address }}<br>{{ c.site.phone }} · {{ c.site.email }}</div>
      <div><b>เมนู</b>บริการ<br>รีวิว<br>โปรโมชั่น<br>ที่อยู่ร้าน</div>
      <div><b>จองคิว</b><a class="link" :href="book()" :target="tg" rel="noopener">ไปที่หน้าจอง</a></div>
    </footer>
  </div>
</template>

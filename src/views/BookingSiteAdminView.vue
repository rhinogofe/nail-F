<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useShopRoute } from '../composables/useShopRoute'
import { getContent, saveContent, upload, listImages, img } from '../bookingSite/api.js'
import { defaultTheme, sizePlaceholders, normalizeThemeSizes, applyTheme } from '../bookingSite/theme.js'
import { THEME_PRESETS, FONT_STACKS, matchingPresetId, applyPresetTheme, defaultPreset } from '../bookingSite/themePresets.js'
import { defaultNav, navSectionOptions } from '../bookingSite/sections.js'
import { loadAllFonts } from '../bookingSite/fonts.js'
import { SERVICE_ICONS, MORE_SERVICE_ICONS, isMoreIcon, serviceIcon } from '../bookingSite/serviceIcons.js'
import '../bookingSite/style.css'

const { shopSlug, shopPath } = useShopRoute()
const c = ref(null)
const tab = ref('site')
const msg = ref('')
const loadError = ref('')
const busy = ref(false)

const S = {
  site: { label: 'ตั้งค่าทั่วไป & ลิงก์จอง', fields: [['name', 'ชื่อเว็บไซต์'], ['logoText', 'ข้อความโลโก้'], ['logoSub', 'ข้อความใต้โลโก้'], ['bookingUrl', 'ลิงก์เว็บจอง (ลิงก์ฐาน)', 'url'], ['bookingLabel', 'ข้อความบนปุ่มค้นหา'], ['newTab', 'เปิดเว็บจองในแท็บใหม่', 'bool'], ['address', 'ที่อยู่', 'area'], ['phone', 'เบอร์โทร'], ['email', 'อีเมล']] },
  nav: { label: 'เมนูหัวเว็บ', list: true, hint: 'ลำดับ ↑↓ = ลำดับส่วนบนหน้าเว็บ และเมนูหัว — แสดงเฉพาะรายการที่เปิดและมีเนื้อหา', fields: [['section', 'ลิงก์ไปส่วน', 'select'], ['label', 'ชื่อในเมนู'], ['show', 'แสดงในเมนู', 'bool']] },
  theme: {
    label: 'ธีมสี',
    hint: 'พื้นขาว: แนะนำ mute โทนเทา (#6b6560) — ขนาดตัวอักษรใส่ px / rem / clamp(...) ว่าง = ค่าเริ่มต้นใน placeholder',
    groups: [
      {
        id: 'presets',
        shortTitle: 'ธีมสำเร็จรูป',
        title: 'ธีมสำเร็จรูป',
        hint: 'กดใช้ธีมนี้แล้วระบบบันทึกให้ทันที — หน้าเว็บจริงเปลี่ยนตามเลย ไม่ต้องกดบันทึกซ้ำ',
        fields: []
      },
      {
        id: 'fonts',
        shortTitle: 'ฟอนต์',
        title: 'ฟอนต์ทั้งเว็บ',
        hint: 'กดเลือกฟอนต์ด้านล่างเพื่อใช้ทั้งเว็บ (หัวข้อและเนื้อหา) หรือปรับแยกได้ในช่องด้านล่างสุด — กดบันทึกทั้งหมดเพื่อใช้บนหน้าเว็บ · ฟอนต์ที่เขียน «อังกฤษ» ไม่มีตัวไทย ตัวไทยจะใช้ฟอนต์สำรองแทน',
        fields: [['serif', 'ฟอนต์หัวข้อ (ชื่อร้าน หัวข้อใหญ่ หัวข้อแต่ละส่วน)', 'font'], ['sans', 'ฟอนต์เนื้อหา (ข้อความ เมนู ปุ่ม)', 'font']]
      },
      {
        id: 'colors-base',
        shortTitle: 'สีหลัก',
        title: 'สีหลักทั้งไซต์',
        fields: [['bg', 'พื้นหลังหลัก', 'color'], ['ink', 'ตัวอักษร', 'color'], ['mute', 'ตัวอักษรรอง', 'color'], ['gold', 'accent (ไฮไลต์ / โฟกัส)', 'color']]
      },
      {
        id: 'colors-rooms',
        shortTitle: 'สีบริการ',
        title: 'สีข้อความบริการ',
        hint: 'สีบนการ์ดบริการ — ว่าง = ใช้สีหลัก/สีรองของไซต์ · แต่ละรายการในแท็บบริการทับค่านี้ได้',
        fields: [
          ['roomTitle', 'ชื่อบริการ (ว่าง = สีตัวอักษร)', 'color'],
          ['roomText', 'รายละเอียด (ว่าง = สีตัวอักษรรอง)', 'color'],
          ['roomLink', 'ลิงก์จองเลย (ว่าง = สีตัวอักษร)', 'color']
        ]
      },
      {
        id: 'colors-layout',
        shortTitle: 'Layout & รูป',
        title: 'สี layout & รูป',
        hint: 'ใช้เมื่อเปิด layout อัตโนมัติ — ว่าง = ระบบคำนวณให้',
        fields: [['surface', 'พื้นสลับส่วน', 'color'], ['line', 'เส้นแบ่งส่วน', 'color'], ['border', 'กรอบรูป / การ์ด', 'color'], ['phFrom', 'placeholder รูป (เข้ม)', 'color'], ['phTo', 'placeholder รูป (อ่อน)', 'color'], ['radius', 'ความโค้งการ์ด / ปุ่ม', 'size']]
      },
      {
        id: 'size-site',
        shortTitle: 'ขนาดไซต์',
        title: 'ขนาดตัวอักษร — เนื้อหาทั้งไซต์',
        fields: [['bodySize', 'ตัวอักษรพื้นฐาน', 'size'], ['h2Size', 'หัวข้อส่วน (h2)', 'size']]
      },
      {
        id: 'size-hero',
        shortTitle: 'ขนาด Hero',
        title: 'ขนาดตัวอักษร — Hero',
        hint: 'ใส่ px / rem / clamp(...) — พิมพ์แค่ตัวเลข (เช่น 18) ระบบเติม px ให้อัตโนมัติ',
        fields: [['heroLogoSize', 'โลโก้', 'size'], ['heroTitleSize', 'หัวข้อใหญ่', 'size'], ['heroLeadSize', 'ข้อความใต้หัวข้อ', 'size'], ['heroMenuSize', 'เมนูหัว', 'size'], ['heroBtnSize', 'ปุ่ม / ปุ่มแถบจอง', 'size'], ['heroBarLabelSize', 'ป้ายแถบจอง', 'size'], ['heroBarInputSize', 'ช่องแถบจอง', 'size']]
      },
      {
        id: 'hero-tabs',
        shortTitle: 'แท็บ Hero',
        title: 'Hero — แท็บสไลด์ & เลื่อนลง',
        hint: 'เส้นขีดบนแท็บที่เลือกและเส้นข้างข้อความเลื่อนลง ใช้สี accent ในหมวด «สี Hero»',
        fields: [['heroTabText', 'สีชื่อแท็บ (ว่าง = ใช้ข้อความหลัก Hero)', 'color'], ['heroTabsBorder', 'เส้นคั่นเหนือแท็บ (ว่าง = สีเส้นแบ่งธีม)', 'color'], ['heroTabSize', 'ขนาดชื่อแท็บ', 'size'], ['heroScrollText', 'สีข้อความเลื่อนลง (ว่าง = ใช้ข้อความหลัก Hero)', 'color'], ['heroScrollSize', 'ขนาดข้อความเลื่อนลง', 'size']]
      },
      {
        id: 'colors-hero',
        shortTitle: 'สี Hero',
        title: 'สี Hero — ข้อความ & ปุ่ม',
        hint: 'สีที่เลือกจะใช้ตามนั้นเสมอ — ถ้าแต่ละสไลด์ใช้รูปต่างกัน ตั้งสีแยกต่อสไลด์ได้ในแท็บ Hero (สไลด์หน้าแรก)',
        fields: [['heroTitle', 'หัวข้อใหญ่ (ว่าง = ใช้สีข้อความหลัก)', 'color'], ['heroLead', 'ข้อความรองใต้หัวข้อ (ว่าง = ใช้สีข้อความรอง)', 'color'], ['heroText', 'ข้อความหลัก — โลโก้ เมนู แท็บ (ว่าง = ใช้สีตัวอักษร)', 'color'], ['heroMute', 'ข้อความรอง — ใต้โลโก้ (ว่าง = ใช้ mute)', 'color'], ['heroAccent', 'accent / เส้นแท็บที่เลือก & เลื่อนลง', 'color'], ['heroBtnBg', 'ปุ่มใต้หัวข้อ (พื้น)', 'color'], ['heroBtnText', 'ปุ่มใต้หัวข้อ (ตัวอักษร)', 'color']]
      },
      {
        id: 'colors-hero-bar',
        shortTitle: 'แถบจอง',
        title: 'สี Hero — แถบจอง',
        fields: [['heroBarBg', 'พื้นช่อง (rgba ได้)', 'color'], ['heroBarBorder', 'ขอบช่อง', 'color'], ['heroBarText', 'ตัวอักษรในช่อง', 'color'], ['heroBarBtnBg', 'ปุ่มค้นหา (พื้น)', 'color'], ['heroBarBtnText', 'ปุ่มค้นหา (ตัวอักษร)', 'color']]
      },
      {
        id: 'options',
        shortTitle: 'ตัวเลือก',
        title: 'ตัวเลือก layout & Hero',
        fields: [['lightEnhance', 'layout อัตโนมัติเมื่อพื้นขาว', 'bool'], ['darkEnhance', 'layout อัตโนมัติเมื่อพื้นเข้ม', 'bool'], ['heroOverlay', 'เงา / ไล่สีทับรูป Hero', 'bool']]
      }
    ]
  },
  hero: { label: 'Hero (สไลด์หน้าแรก)', list: true, fields: [['tab', 'ชื่อแท็บด้านล่าง'], ['title', 'หัวข้อใหญ่'], ['titleColor', 'สีหัวข้อใหญ่ (ว่าง = ตามธีม)', 'color'], ['text', 'ข้อความ', 'area'], ['textColor', 'สีข้อความรอง (ว่าง = ตามธีม)', 'color'], ['button', 'ข้อความบนปุ่ม (ว่าง = ไม่แสดงปุ่ม)'], ['link', 'ลิงก์ปุ่ม (ว่าง = ใช้ลิงก์จองหลัก)', 'url'], ['showBooking', 'แสดงแถบเลือกวันและจองคิว', 'bool'], ['showImage', 'แสดงรูปพื้นหลัง', 'bool'], ['image', 'รูปพื้นหลัง', 'image']] },
  about: { label: 'ที่อยู่ร้าน', hint: 'ส่วนนี้อยู่ท้ายหน้าเว็บ — ที่อยู่ เบอร์โทร อีเมล ดึงจากแท็บ «ตั้งค่าทั่วไป» · ลิงก์ Google Maps: เปิด Google Maps → แชร์ → คัดลอกลิงก์ แล้ววางด้านล่าง กดบันทึกแล้วระบบสร้างแผนที่ให้', fields: [['title', 'หัวข้อ'], ['text', 'ข้อความสั้น (เช่น วิธีเดินทาง ที่จอดรถ)', 'area'], ['mapUrl', 'ลิงก์ Google Maps (ว่าง = ใช้ลิงก์จากแอดมินร้าน ถ้ามี)', 'url'], ['showMap', 'แสดงแผนที่ Google Maps', 'bool'], ['showImage', 'แสดงรูป (ใช้เมื่อไม่มีแผนที่)', 'bool'], ['imageFirst', 'แผนที่ / รูปอยู่ด้านซ้าย (ปิด = ข้อความซ้าย)', 'bool'], ['image', 'รูป', 'image']] },
  rooms: { label: 'บริการ', list: true, prefixRoot: [['roomsHeading', 'หัวข้อด้านบนส่วนนี้ (h2)']], fields: [['name', 'ชื่อรายการ'], ['type', 'รหัสโฟลเดอร์รูป (a-z 0-9 - _ เช่น classic)'], ['detail', 'รายละเอียดสั้น'], ['icon', 'ไอคอน (แสดงเมื่อไม่มีรูป — อัตโนมัติ = เลือกจากชื่อบริการ)', 'icon'], ['titleColor', 'สีชื่อบริการ (ว่าง = ตามธีม)', 'color'], ['textColor', 'สีรายละเอียด (ว่าง = ตามธีม)', 'color'], ['linkColor', 'สีลิงก์จองเลย (ว่าง = ตามธีม)', 'color'], ['showImage', 'ใช้รูปแทนไอคอน (ถ้าอัปโหลดรูปไว้)', 'bool'], ['image', 'รูป', 'image'], ['link', 'ลิงก์ปุ่มจองของรายการนี้ (ว่าง = ใช้ลิงก์หลัก)', 'url']] },
  promos: { label: 'โปรโมชั่น', list: true, prefixRoot: [['promosHeading', 'หัวข้อด้านบนส่วนนี้ (h2)']], fields: [['title', 'หัวข้อ'], ['text', 'รายละเอียด', 'area'], ['titleColor', 'สีหัวข้อบนรูป (ว่าง = ตามธีม)', 'color'], ['textColor', 'สีรายละเอียดบนรูป (ว่าง = ตามธีม)', 'color'], ['showImage', 'แสดงรูป', 'bool'], ['image', 'รูป', 'image'], ['link', 'ลิงก์ปุ่มจอง (ว่าง = ใช้ลิงก์หลัก)', 'url']] },
  dining: { label: 'บรรยากาศ / สิ่งอำนวยความสะดวก', fields: [['title', 'หัวข้อ'], ['text', 'ข้อความ', 'area'], ['showImage', 'แสดงรูป', 'bool'], ['imageFirst', 'รูปอยู่ด้านซ้าย (ปิด = ข้อความซ้าย รูปขวา)', 'bool'], ['image', 'รูป', 'image']] },
  news: { label: 'รีวิว', list: true, prefixRoot: [['newsHeading', 'หัวข้อด้านบน (เช่น รีวิว)'], ['newsShowImage', 'แสดงรูปใต้หัวข้อ', 'bool'], ['newsImage', 'รูปใต้หัวข้อ', 'image']], fields: [['date', 'วันที่'], ['title', 'หัวข้อรีวิว'], ['showImage', 'แสดงรูป', 'bool'], ['image', 'รูป', 'image']] }
}

const sec = computed(() => S[tab.value])
const items = computed(() => (c.value ? (sec.value.list ? c.value[tab.value] : [c.value[tab.value]]) : []))
const themeTab = ref('presets')
const livePreviewEl = ref(null)
const dirty = ref(false)
const activePresetId = computed(() => matchingPresetId(c.value?.theme))
const themeSections = computed(() => (c.value?.theme && S.theme.groups ? S.theme.groups : []))
const activeThemeGroup = computed(() => themeSections.value.find(g => g.id === themeTab.value) || themeSections.value[0] || null)
const publicSitePath = computed(() => shopPath('/booking-site'))
const shopAdminPath = computed(() => shopPath('/admin'))
const colorPlaceholder = key => {
  if (key === 'surface' || key === 'line') return 'ว่าง = อัตโนมัติ'
  if (key === 'border') return 'ว่าง = ใช้สีเส้นแบ่ง'
  if (key === 'heroText' || key === 'heroMute') return 'ว่าง = ใช้สีหลัก'
  if (key === 'heroTitle' || key === 'heroLead') return 'ว่าง = ใช้สีข้อความ Hero'
  if (key === 'heroTabText' || key === 'heroScrollText') return 'ว่าง = ใช้ข้อความหลัก Hero'
  if (key === 'heroTabsBorder') return 'ว่าง = สีเส้นแบ่งธีม'
  if (key === 'heroBarBg') return 'rgba(0,0,0,.35)'
  if (key === 'titleColor' || key === 'textColor' || key === 'linkColor') return 'ว่าง = ตามธีม'
  if (key === 'roomTitle' || key === 'roomLink') return 'ว่าง = ใช้สีตัวอักษร'
  if (key === 'roomText') return 'ว่าง = ใช้สีตัวอักษรรอง'
  return '#070605'
}
const blank = () => Object.fromEntries(sec.value.fields.map(f => {
  if (f[2] === 'bool') return [f[0], true]
  if (f[2] === 'color') return [f[0], defaultTheme[f[0]] ?? '']
  if (f[2] === 'select') return [f[0], 'rooms']
  return [f[0], '']
}))
const themeInk = () => c.value?.theme?.ink || defaultTheme.ink
const themeMute = () => c.value?.theme?.mute || defaultTheme.mute
const hexColor = (v, key) => {
  if (/^#[0-9a-fA-F]{6}$/.test(v || '')) return v
  if (key === 'surface') return '#f6f4f0'
  if (key === 'line' || key === 'border') return '#dddddd'
  if (key === 'heroText') return themeInk()
  if (key === 'heroMute') return themeMute()
  const heroTitleHex = () => [c.value?.theme?.heroTitle, c.value?.theme?.heroText].map(x => (x || '').trim()).find(x => /^#[0-9a-fA-F]{6}$/.test(x)) || themeInk()
  const heroLeadHex = () => [c.value?.theme?.heroLead, c.value?.theme?.heroMute].map(x => (x || '').trim()).find(x => /^#[0-9a-fA-F]{6}$/.test(x)) || themeMute()
  if (key === 'heroTitle') return heroTitleHex()
  if (key === 'heroLead') return heroLeadHex()
  if (key === 'heroTabText' || key === 'heroScrollText') return themeInk()
  if (key === 'heroTabsBorder') return '#dddddd'
  if (key === 'heroBarBg') return '#333333'
  if (key === 'roomTitle' || key === 'roomLink') return themeInk()
  if (key === 'roomText') return themeMute()
  if (key === 'titleColor') {
    if (tab.value === 'rooms') return (c.value?.theme?.roomTitle || '').trim() || themeInk()
    if (tab.value === 'hero') return heroTitleHex()
    return '#111111'
  }
  if (key === 'textColor') {
    if (tab.value === 'rooms') return (c.value?.theme?.roomText || '').trim() || themeMute()
    if (tab.value === 'hero') return heroLeadHex()
    return '#e6ddd0'
  }
  if (key === 'linkColor') return (c.value?.theme?.roomLink || '').trim() || themeInk()
  return defaultTheme[key] || '#000000'
}
const moreIcons = ref({})
const iconQuery = ref({})
const moreOpen = (o, i) => moreIcons.value[i] ?? isMoreIcon(o.icon)
const toggleMore = (o, i) => { moreIcons.value = { ...moreIcons.value, [i]: !moreOpen(o, i) } }
const filteredMoreIcons = i => {
  const q = String(iconQuery.value[i] || '').trim().toLowerCase()
  return q ? [...SERVICE_ICONS, ...MORE_SERVICE_ICONS].filter(([id, name]) => name.toLowerCase().includes(q) || id.includes(q)) : MORE_SERVICE_ICONS
}
watch(tab, () => { moreIcons.value = {}; iconQuery.value = {} })
const add = () => c.value[tab.value].push(blank())
const del = i => confirm('ลบรายการนี้?') && c.value[tab.value].splice(i, 1)
const move = (i, d) => { const a = c.value[tab.value], j = i + d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]] }

const folderOf = o => (tab.value === 'rooms' ? (o.type || '').trim().toLowerCase() : tab.value)
const okFolder = s => /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(s)
const gal = ref({ key: '', files: [] })
async function openGal(o, k, i) {
  const fo = folderOf(o)
  if (!okFolder(fo)) { msg.value = 'กรอกรหัสโฟลเดอร์รูปก่อน (a-z 0-9 - _)'; return }
  try { gal.value = { key: tab.value + i + k, files: (await listImages(fo)).files } } catch (e) { msg.value = e.message } }
const choose = (o, k, u) => { o[k] = u; gal.value.key = '' }
async function pick(o, k, e) {
  const f = e.target.files[0]; if (!f) return
  const fo = folderOf(o)
  if (!okFolder(fo)) { msg.value = 'กรอกรหัสโฟลเดอร์รูปก่อน (a-z 0-9 - _)'; e.target.value = ''; return }
  msg.value = 'กำลังอัปโหลดรูป...'
  try { o[k] = (await upload(f, fo)).url; msg.value = 'อัปโหลดแล้ว อย่าลืมกดบันทึก' } catch (err) { msg.value = err.message }
  e.target.value = ''
}
const adminEl = ref(null)
function paintLivePreview() {
  if (livePreviewEl.value && c.value?.theme) applyTheme(c.value.theme, livePreviewEl.value, { documentToo: false })
}
function paintAdmin() {
  if (adminEl.value && c.value?.theme) applyTheme(c.value.theme, adminEl.value, { documentToo: false })
}
watch(adminEl, paintAdmin)
watch(() => c.value?.theme, paintAdmin, { deep: true })

watch(themeTab, id => { if (id === 'fonts') loadAllFonts() }, { immediate: true })
watch([livePreviewEl, themeTab], () => {
  if (themeTab.value === 'presets') paintLivePreview()
})
watch(
  () => c.value?.theme,
  () => { if (themeTab.value === 'presets') paintLivePreview() },
  { deep: true },
)

const cardStatus = ref({ key: '', text: '', ok: true })
let cardStatusTimer
async function saveCard(i) {
  const ok = await save()
  cardStatus.value = { key: tab.value + i, text: ok ? 'บันทึกแล้ว' : msg.value, ok }
  clearTimeout(cardStatusTimer)
  if (ok) cardStatusTimer = setTimeout(() => { cardStatus.value = { key: '', text: '', ok: true } }, 4000)
}
async function save() {
  busy.value = true
  try {
    if (c.value.theme) c.value.theme = normalizeThemeSizes(c.value.theme)
    const res = await saveContent(c.value)
    const savedAbout = res?.content?.about
    if (savedAbout && c.value.about) {
      c.value.about.mapEmbedUrl = savedAbout.mapEmbedUrl || ''
      c.value.about.mapEmbedFor = savedAbout.mapEmbedFor || ''
    }
    dirty.value = false
    msg.value = savedAbout?.mapUrl && !savedAbout.mapEmbedUrl
      ? 'บันทึกแล้ว — แต่อ่านลิงก์ Google Maps ไม่ได้ ลองคัดลอกลิงก์แชร์ใหม่'
      : 'บันทึกแล้ว — เปิดดูหน้าเว็บเพื่อเห็นธีมใหม่'
    busy.value = false
    return true
  } catch (e) {
    msg.value = e?.response?.data?.error || e.message || 'บันทึกไม่สำเร็จ'
    busy.value = false
    return false
  }
}
const SAVE_NOW_NOTE = '\nระบบจะบันทึกให้ทันที (รวมถึงการแก้ไขอื่นที่ยังไม่ได้บันทึก)'
const presetSaving = ref('')
const presetError = ref({ id: '', text: '' })
async function applyThemeAndSave(theme, doneText, id) {
  c.value.theme = theme
  dirty.value = true
  presetSaving.value = id
  presetError.value = { id: '', text: '' }
  nextTick(paintLivePreview)
  const ok = await save()
  presetSaving.value = ''
  if (ok) {
    msg.value = `${doneText} — บันทึกแล้ว หน้าเว็บเปลี่ยนตามทันที`
  } else {
    presetError.value = { id, text: `บันทึกไม่สำเร็จ: ${msg.value}` }
    msg.value = `${doneText} แต่บันทึกไม่สำเร็จ: ${msg.value} — ลองกดบันทึกทั้งหมดอีกครั้ง`
  }
}
function resetTheme() {
  if (!confirm('รีเซ็ตกลับเป็นธีมเริ่มต้น Rose Blush? ค่าที่ตั้งเองจะถูกเขียนทับ' + SAVE_NOW_NOTE)) return
  const preset = defaultPreset()
  applyThemeAndSave(applyPresetTheme(preset), 'รีเซ็ตกลับเป็นธีมเริ่มต้นแล้ว', preset.id)
}
function usePreset(preset) {
  if (!confirm(`ใช้ธีม ${preset.nameTh}? ค่าสีที่ตั้งเองจะถูกเขียนทับ` + SAVE_NOW_NOTE)) return
  applyThemeAndSave(applyPresetTheme(preset), `ใช้ธีม ${preset.nameTh} แล้ว`, preset.id)
}
function presetMock(preset) {
  const t = preset.theme
  return {
    background: t.bg,
    color: t.ink,
    borderColor: t.border || t.line || t.gold,
    borderRadius: t.radius || '0px',
    fontFamily: t.sans,
  }
}

onMounted(async () => {
  try {
    c.value = await getContent()
    if (!c.value.theme) c.value.theme = { ...defaultTheme }
    if (!c.value.nav?.length) c.value.nav = defaultNav.map(x => ({ ...x }))
    dirty.value = false
    await nextTick()
    paintLivePreview()
  } catch (err) {
    loadError.value = err?.response?.data?.error || err?.message || 'โหลดเนื้อหาเว็บไซต์ไม่สำเร็จ'
  }
})
</script>

<template>
  <div v-if="loadError" class="booking-site-status">
    <p class="err" role="alert">{{ loadError }}</p>
  </div>
  <div v-else-if="!c" class="booking-site-status">กำลังโหลดแอดมินเว็บไซต์...</div>
  <div class="booking-site adm" ref="adminEl" v-else>
    <aside>
      <b>เว็บไซต์ · {{ shopSlug }}</b>
      <button v-for="(s, k) in S" :key="k" type="button" :class="{ on: tab === k }" @click="tab = k">{{ s.label }}</button>
      <a :href="publicSitePath" target="_blank" rel="noopener">ดูหน้าเว็บ</a>
      <a :href="shopAdminPath">กลับแอดมินร้าน</a>
    </aside>
    <main>
      <header>
        <h1>{{ sec.label }}</h1>
        <div>
          <span class="msg" role="status">{{ msg }}</span>
          <button v-if="tab === 'theme'" type="button" class="reset-theme" :disabled="busy" @click="resetTheme">รีเซ็ตกลับเป็นธีมเริ่มต้น</button>
          <button class="save" type="button" :disabled="busy" @click="save">บันทึกทั้งหมด</button>
        </div>
      </header>
      <p v-if="sec.hint" class="adm-hint">{{ sec.hint }}</p>

      <template v-if="tab === 'theme'">
        <nav class="theme-tabs" role="tablist" aria-label="ส่วนธีม">
          <button
            v-for="g in themeSections"
            :key="g.id"
            type="button"
            role="tab"
            class="theme-tab"
            :class="{ on: themeTab === g.id }"
            :aria-selected="themeTab === g.id"
            @click="themeTab = g.id"
          >{{ g.shortTitle || g.title }}</button>
        </nav>
        <section v-if="activeThemeGroup?.id === 'presets'" class="box theme-group" role="tabpanel" aria-labelledby="theme-tab-presets">
          <h2 class="theme-group-title" id="theme-tab-presets">{{ activeThemeGroup.title }}</h2>
          <p class="theme-group-hint">{{ activeThemeGroup.hint }}</p>
          <div class="theme-live" ref="livePreviewEl" aria-label="ตัวอย่างธีมบนหน้าเว็บ">
            <div class="theme-live-hero">
              <b>เล็บสวยแบบจองคิวได้</b>
              <p>ตัวอย่างหน้าแรกตามธีมที่ใช้อยู่</p>
              <span class="btn">จองคิว</span>
            </div>
          </div>
          <p v-if="dirty" class="preset-using">ยังไม่ได้บันทึก — หน้าเว็บยังเป็นธีมเก่าจนกว่าจะกดบันทึกทั้งหมด</p>
          <p v-if="!activePresetId" class="preset-using">ปรับแต่งเอง — ค่าปัจจุบันไม่ตรงกับธีมสำเร็จรูป</p>
          <div class="preset-grid">
            <article
              v-for="preset in THEME_PRESETS"
              :key="preset.id"
              class="preset-card"
              :class="{ on: activePresetId === preset.id }"
            >
              <div class="preset-swatches" aria-hidden="true">
                <span v-for="(s, i) in preset.swatches" :key="i" :style="{ background: s }"></span>
              </div>
              <h3>{{ preset.name }} <small>{{ preset.nameTh }}</small></h3>
              <p>{{ preset.blurb }}</p>
              <div class="preset-mock" :style="presetMock(preset)">
                <b :style="{ color: preset.theme.roomTitle, fontFamily: preset.theme.serif }">ทาสีเจลมือ</b>
                <em :style="{ color: preset.theme.roomText }">ทำความสะอาดเล็บ · 60 นาที</em>
                <span :style="{ background: preset.theme.heroBtnBg, color: preset.theme.heroBtnText, borderRadius: preset.theme.radius }">จองเลย</span>
              </div>
              <small v-if="activePresetId === preset.id" class="preset-status">กำลังใช้ธีมนี้</small>
              <small v-if="presetError.id === preset.id" class="preset-error" role="alert">{{ presetError.text }}</small>
              <button type="button" :disabled="busy" @click="usePreset(preset)">{{ presetSaving === preset.id ? 'กำลังบันทึก...' : 'ใช้ธีมนี้' }}</button>
            </article>
          </div>
        </section>
        <section v-else-if="activeThemeGroup" class="box theme-group" role="tabpanel" :aria-labelledby="'theme-tab-' + activeThemeGroup.id">
          <h2 class="theme-group-title" :id="'theme-tab-' + activeThemeGroup.id">{{ activeThemeGroup.title }}</h2>
          <p v-if="activeThemeGroup.hint" class="theme-group-hint">{{ activeThemeGroup.hint }}</p>
          <template v-if="activeThemeGroup.id === 'fonts'">
            <div class="font-preview" aria-label="ตัวอย่างฟอนต์">
              <b>เล็บสวยแบบจองคิวได้ · Nail Studio</b>
              <p>ทาสีเจล เติมเล็บ และสปา จองคิวล่วงหน้าได้ ไม่ต้องรอที่ร้าน 0123456789</p>
            </div>
            <div class="font-grid" role="radiogroup" aria-label="ฟอนต์ทั้งเว็บ">
              <button
                v-for="f in FONT_STACKS"
                :key="f.id"
                type="button"
                role="radio"
                class="font-card"
                :class="{ on: c.theme.serif === f.value && c.theme.sans === f.value, part: (c.theme.serif === f.value) !== (c.theme.sans === f.value) }"
                :aria-checked="c.theme.serif === f.value && c.theme.sans === f.value"
                :style="{ fontFamily: f.value }"
                @click="c.theme.serif = f.value; c.theme.sans = f.value"
              >
                <span class="font-sample">ร้านเล็บสวย Aa</span>
                <small>{{ f.label }}</small>
              </button>
            </div>
            <p class="theme-group-hint">ปรับแยกหัวข้อกับเนื้อหา</p>
          </template>
          <label v-for="f in activeThemeGroup.fields" :key="f[0]" :class="{ chk: f[2] === 'bool' }">
            {{ f[1] }}
            <input v-if="f[2] === 'bool' && f[0] === 'darkEnhance'" type="checkbox" :checked="c.theme[f[0]] === true" @change="c.theme[f[0]] = $event.target.checked">
            <input v-else-if="f[2] === 'bool' && (f[0] === 'heroOverlay' || f[0] === 'lightEnhance')" type="checkbox" :checked="c.theme[f[0]] !== false" @change="c.theme[f[0]] = $event.target.checked">
            <span v-else-if="f[2] === 'color'" class="color-pick">
              <input type="color" :value="hexColor(c.theme[f[0]], f[0])" @input="c.theme[f[0]] = $event.target.value">
              <input v-model="c.theme[f[0]]" :placeholder="colorPlaceholder(f[0])">
            </span>
            <select v-else-if="f[2] === 'font'" v-model="c.theme[f[0]]">
              <option v-for="opt in FONT_STACKS" :key="opt.id" :value="opt.value">{{ opt.label }}</option>
            </select>
            <input v-else-if="f[2] === 'size'" v-model="c.theme[f[0]]" type="text" :placeholder="sizePlaceholders[f[0]] || 'ว่าง = ค่าเริ่มต้น'">
          </label>
        </section>
      </template>

      <template v-else>
        <section v-if="sec.prefixRoot?.length" class="box">
          <label v-for="f in sec.prefixRoot" :key="f[0]" :class="{ chk: f[2] === 'bool' }">
            {{ f[1] }}
            <textarea v-if="f[2] === 'area'" v-model="c[f[0]]" rows="4"></textarea>
            <input v-else-if="f[2] === 'bool' && (f[0] === 'showImage' || f[0].endsWith('ShowImage'))" type="checkbox" :checked="c[f[0]] !== false" @change="c[f[0]] = $event.target.checked">
            <input v-else-if="f[2] === 'bool'" type="checkbox" v-model="c[f[0]]">
            <span v-else-if="f[2] === 'image'" class="img">
              <img v-if="c[f[0]]" :src="img(c[f[0]])" alt="">
              <small class="hint">โฟลเดอร์รูป: {{ shopSlug }}/{{ tab }}</small>
              <input type="file" accept="image/*" @change="pick(c, f[0], $event)">
              <input v-model="c[f[0]]" placeholder="หรือวางลิงก์รูป (ว่าง = ใช้สีพื้นหลังตัวอย่าง)">
              <button type="button" @click="openGal(c, f[0], 'root')">เลือกจากรูปที่มีในโฟลเดอร์นี้</button>
              <span v-if="gal.key === tab + 'root' + f[0]" class="gal"><em v-if="!gal.files.length">ยังไม่มีรูปในโฟลเดอร์นี้</em><img v-for="u in gal.files" :key="u" :src="img(u)" alt="" @click="choose(c, f[0], u)"></span>
            </span>
            <input v-else v-model="c[f[0]]" :type="f[2] === 'url' ? 'url' : 'text'">
          </label>
        </section>

        <section v-for="(o, i) in items" :key="i" class="box">
          <div v-if="sec.list" class="row">
            <b>รายการที่ {{ i + 1 }}</b>
            <span><button type="button" @click="move(i, -1)" aria-label="เลื่อนขึ้น">↑</button><button type="button" @click="move(i, 1)" aria-label="เลื่อนลง">↓</button><button type="button" @click="del(i)">ลบ</button></span>
          </div>
          <component :is="f[2] === 'icon' ? 'div' : 'label'" v-for="f in sec.fields" :key="f[0]" :class="{ chk: f[2] === 'bool', 'icon-field': f[2] === 'icon' }">
            {{ f[1] }}
            <template v-if="f[2] === 'icon'">
            <span class="icon-pick" role="radiogroup" :aria-label="f[1]">
              <button type="button" role="radio" class="auto" :aria-checked="!o[f[0]]" :class="{ on: !o[f[0]] }" @click="o[f[0]] = ''">
                <i class="ti" :class="'ti-' + serviceIcon({ ...o, icon: '' }, i)" aria-hidden="true"></i><small>อัตโนมัติ</small>
              </button>
              <button v-for="[id, name] in SERVICE_ICONS" :key="id" type="button" role="radio" :aria-checked="o[f[0]] === id" :class="{ on: o[f[0]] === id }" :title="name" :aria-label="name" @click="o[f[0]] = id">
                <i class="ti" :class="'ti-' + id" aria-hidden="true"></i>
              </button>
              <button type="button" class="more" :class="{ on: !moreOpen(o, i) && isMoreIcon(o[f[0]]) }" :aria-expanded="moreOpen(o, i)" :aria-controls="'icon-more-' + i" @click="toggleMore(o, i)">
                <i class="ti" :class="moreOpen(o, i) ? 'ti-chevron-up' : 'ti-dots'" aria-hidden="true"></i><small>{{ moreOpen(o, i) ? 'ซ่อน' : `อื่นๆ (${MORE_SERVICE_ICONS.length})` }}</small>
              </button>
            </span>
            <span v-if="moreOpen(o, i)" :id="'icon-more-' + i" class="icon-more">
              <input v-model="iconQuery[i]" type="search" placeholder="ค้นหาไอคอน เช่น ดอกไม้ นวด ส่วนลด" aria-label="ค้นหาไอคอน">
              <span class="icon-pick" role="radiogroup" aria-label="ไอคอนเพิ่มเติม">
                <button v-for="[id, name] in filteredMoreIcons(i)" :key="id" type="button" role="radio" :aria-checked="o[f[0]] === id" :class="{ on: o[f[0]] === id }" :title="name" :aria-label="name" @click="o[f[0]] = id">
                  <i class="ti" :class="'ti-' + id" aria-hidden="true"></i>
                </button>
                <em v-if="!filteredMoreIcons(i).length" class="hint">ไม่พบไอคอนที่ค้นหา</em>
              </span>
            </span>
            </template>
            <textarea v-else-if="f[2] === 'area'" v-model="o[f[0]]" rows="4"></textarea>
            <input v-else-if="f[2] === 'bool' && f[0] === 'imageFirst'" type="checkbox" :checked="tab === 'dining' ? o[f[0]] !== false : !!o[f[0]]" @change="o[f[0]] = $event.target.checked">
            <input v-else-if="f[2] === 'bool' && (f[0] === 'showImage' || f[0] === 'showMap' || f[0] === 'showBooking' || f[0] === 'heroOverlay' || f[0] === 'lightEnhance' || f[0] === 'darkEnhance')" type="checkbox" :checked="o[f[0]] !== false" @change="o[f[0]] = $event.target.checked">
            <input v-else-if="f[2] === 'bool'" type="checkbox" v-model="o[f[0]]">
            <span v-else-if="f[2] === 'image'" class="img">
              <img v-if="o[f[0]]" :src="img(o[f[0]])" alt="">
              <small class="hint">โฟลเดอร์รูป: {{ shopSlug }}/{{ folderOf(o) || '(กรอกรหัสโฟลเดอร์ก่อน)' }}</small>
              <input type="file" accept="image/*" @change="pick(o, f[0], $event)">
              <input v-model="o[f[0]]" placeholder="หรือวางลิงก์รูป (ว่าง = ใช้สีพื้นหลังตัวอย่าง)">
              <button type="button" @click="openGal(o, f[0], i)">เลือกจากรูปที่มีในโฟลเดอร์นี้</button>
              <span v-if="gal.key === tab + i + f[0]" class="gal"><em v-if="!gal.files.length">ยังไม่มีรูปในโฟลเดอร์นี้</em><img v-for="u in gal.files" :key="u" :src="img(u)" alt="" @click="choose(o, f[0], u)"></span>
            </span>
            <select v-else-if="f[2] === 'select'" v-model="o[f[0]]">
              <option v-for="opt in navSectionOptions" :key="opt[0]" :value="opt[0]">{{ opt[1] }}</option>
            </select>
            <span v-else-if="f[2] === 'color'" class="color-pick">
              <input type="color" :value="hexColor(o[f[0]], f[0])" @input="o[f[0]] = $event.target.value">
              <input v-model="o[f[0]]" :placeholder="colorPlaceholder(f[0])">
            </span>
            <input v-else-if="f[2] === 'size'" v-model="o[f[0]]" type="text" :placeholder="sizePlaceholders[f[0]] || 'ว่าง = ค่าเริ่มต้น'">
            <input v-else v-model="o[f[0]]" :type="f[2] === 'url' ? 'url' : 'text'">
          </component>
          <div v-if="sec.list" class="card-save">
            <span v-if="cardStatus.key === tab + i" class="msg" :class="{ err: !cardStatus.ok }" role="status">{{ cardStatus.text }}</span>
            <button type="button" class="save" :disabled="busy" @click="saveCard(i)">{{ busy ? 'กำลังบันทึก...' : 'บันทึก' }}</button>
          </div>
        </section>
        <button v-if="sec.list" class="add" type="button" @click="add">+ เพิ่มรายการ</button>
      </template>
    </main>
  </div>
</template>

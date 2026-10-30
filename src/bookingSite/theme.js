const VARS = {
  bg: '--bg',
  ink: '--ink',
  mute: '--mute',
  gold: '--gold',
  phFrom: '--ph-from',
  phTo: '--ph-to'
}

const HERO_CSS = {
  heroText: '--hero-text',
  heroMute: '--hero-mute',
  heroAccent: '--hero-accent',
  heroBtnBg: '--hero-btn-bg',
  heroBtnText: '--hero-btn-text',
  heroBarBg: '--hero-bar-bg',
  heroBarBorder: '--hero-bar-border',
  heroBarText: '--hero-bar-text',
  heroBarBtnBg: '--hero-bar-btn-bg',
  heroBarBtnText: '--hero-bar-btn-text'
}

const HERO_OPTIONAL_CSS = {
  heroTabText: '--hero-tab-text',
  heroTabsBorder: '--hero-tabs-border',
  heroScrollText: '--hero-scroll-text'
}

const ROOM_CSS = {
  roomTitle: '--room-title',
  roomText: '--room-text',
  roomLink: '--room-link'
}

const FACE_CSS = {
  serif: '--serif',
  sans: '--sans'
}

const SIZE_CSS = {
  bodySize: '--body-size',
  h2Size: '--h2-size',
  heroLogoSize: '--hero-logo-size',
  heroTitleSize: '--hero-title-size',
  heroLeadSize: '--hero-lead-size',
  heroMenuSize: '--hero-menu-size',
  heroTabSize: '--hero-tab-size',
  heroBtnSize: '--hero-btn-size',
  heroBarLabelSize: '--hero-bar-label-size',
  heroBarInputSize: '--hero-bar-input-size',
  heroScrollSize: '--hero-scroll-size',
  radius: '--radius'
}

export const defaultTheme = {
  bg: '#fbf4f1',
  ink: '#3a2428',
  mute: '#7a4e56',
  gold: '#c45c78',
  phFrom: '#e8b8c0',
  phTo: '#f3d9d4',
  heroText: '#3a2428',
  heroMute: '#7a4e56',
  heroAccent: '#c45c78',
  heroBtnBg: '#9b3354',
  heroBtnText: '#fff8f6',
  heroBarBg: 'rgba(255,248,246,.88)',
  heroBarBorder: '#ead3d0',
  heroBarText: '#3a2428',
  heroBarBtnBg: '#9b3354',
  heroBarBtnText: '#fff8f6',
  heroTabText: '',
  heroTabsBorder: '',
  heroScrollText: '',
  bodySize: '',
  h2Size: '',
  heroLogoSize: '',
  heroTitleSize: '',
  heroLeadSize: '',
  heroMenuSize: '',
  heroTabSize: '',
  heroBtnSize: '13px',
  heroBarLabelSize: '',
  heroBarInputSize: '',
  heroScrollSize: '',
  roomTitle: '#3a2428',
  roomText: '#7a4e56',
  roomLink: '#a33d5c',
  serif: '"Cormorant Garamond","Georgia",serif',
  sans: '"Noto Sans Thai","Helvetica Neue",Arial,sans-serif',
  radius: '16px',
  heroOverlay: true,
  lightEnhance: true,
  darkEnhance: false,
  surface: '#fff8f6',
  line: '#ead3d0',
  border: '#ead3d0'
}

/** ค่าเช่น 14 → 14px (CSS ไม่รับตัวเลขล้วๆ) */
export function normalizeSize(raw) {
  const v = (raw || '').trim()
  if (!v) return ''
  if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`
  return v
}

export function normalizeThemeSizes(theme) {
  if (!theme) return theme
  const t = { ...theme }
  for (const k in SIZE_CSS) {
    const n = normalizeSize(t[k])
    if (n) t[k] = n
  }
  return t
}

function luminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  if (l1 == null || l2 == null) return 0
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

function readableOn(bg, preferred, lightFallback, darkFallback) {
  const light = (luminance(bg) || 0) > 0.55
  const fallback = light ? lightFallback : darkFallback
  if (preferred && contrastRatio(preferred, bg) >= 4.5) return preferred
  return fallback
}

function roomColor(t, key) {
  const v = (t[key] || '').trim()
  const preferred = v || (key === 'roomText' ? t.mute : t.ink)
  if (key === 'roomText') return readableOn(t.bg, preferred, '#5c4f4a', '#cfc4b6')
  if (key === 'roomLink') return readableOn(t.bg, preferred, '#8a3d2a', '#d8b98a')
  return readableOn(t.bg, preferred, '#1a1614', '#f4efe8')
}

function heroColor(t, key) {
  const v = (t[key] || '').trim()
  if (key === 'heroText') return readableOn(t.bg, v || t.ink, '#1a1614', '#f4efe8')
  if (key === 'heroMute') return readableOn(t.bg, v || t.mute, '#5c4f4a', '#cfc4b6')
  if (v) return v
  return defaultTheme[key]
}

function parseHex(hex) {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return null
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
}

export function isLightBg(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return false
  const [r, g, b] = rgb.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55
}

function rgb255(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return '7,6,5'
  return rgb.map(c => Math.round(c * 255)).join(',')
}

function heroVeil(t, light) {
  if (light) {
    const rgb = rgb255(t.bg)
    return `linear-gradient(90deg,rgba(${rgb},.86),transparent 64%),linear-gradient(0deg,${t.bg} 0,transparent 42%)`
  }
  return 'linear-gradient(90deg,rgba(0,0,0,.55),transparent 60%),linear-gradient(0deg,var(--bg) 0,transparent 35%)'
}

function paintTheme(root, t, withClasses) {
  for (const k in VARS) root.style.setProperty(VARS[k], t[k])

  const light = isLightBg(t.bg)
  const lightEnh = light && t.lightEnhance !== false
  const darkEnh = !light && t.darkEnhance === true
  if (withClasses) {
    root.classList.toggle('theme-light', lightEnh)
    root.classList.toggle('theme-dark-enhance', darkEnh)
    root.classList.toggle('theme-dark', !light)
  }

  let line = (t.line || '').trim()
  let surface = (t.surface || '').trim()
  let shadow = 'none'
  if (!line) {
    if (lightEnh) line = 'rgba(0,0,0,.12)'
    else if (darkEnh) line = 'rgba(255,255,255,.18)'
    else line = light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.35)'
  }
  if (!surface) {
    if (lightEnh) surface = '#f6f4f0'
    else if (darkEnh) surface = 'rgba(255,255,255,.04)'
    else surface = 'transparent'
  }
  if (lightEnh) shadow = '0 10px 40px rgba(0,0,0,.08)'
  else if (darkEnh) shadow = '0 12px 36px rgba(0,0,0,.5)'

  const border = (t.border || '').trim() || line
  root.style.setProperty('--line', line)
  root.style.setProperty('--border', border)
  root.style.setProperty('--surface', surface)
  root.style.setProperty('--shadow', shadow)
  root.style.setProperty('--hero-veil', heroVeil(t, light))
  for (const k in HERO_CSS) root.style.setProperty(HERO_CSS[k], heroColor(t, k))
  for (const k in ROOM_CSS) root.style.setProperty(ROOM_CSS[k], roomColor(t, k))
  for (const k in HERO_OPTIONAL_CSS) {
    const v = (t[k] || '').trim()
    if (v) root.style.setProperty(HERO_OPTIONAL_CSS[k], v)
    else root.style.removeProperty(HERO_OPTIONAL_CSS[k])
  }
  for (const k in SIZE_CSS) {
    const v = normalizeSize(t[k])
    if (v) root.style.setProperty(SIZE_CSS[k], v)
    else root.style.removeProperty(SIZE_CSS[k])
  }
  for (const k in FACE_CSS) {
    const v = (t[k] || '').trim()
    if (v) root.style.setProperty(FACE_CSS[k], v)
    else root.style.removeProperty(FACE_CSS[k])
  }
  root.style.colorScheme = light ? 'light' : 'dark'
}

function unpaintTheme(root) {
  for (const k in VARS) root.style.removeProperty(VARS[k])
  root.classList.remove('theme-light', 'theme-dark', 'theme-dark-enhance')
  root.style.removeProperty('--line')
  root.style.removeProperty('--border')
  root.style.removeProperty('--surface')
  root.style.removeProperty('--shadow')
  root.style.removeProperty('--hero-veil')
  for (const k in HERO_CSS) root.style.removeProperty(HERO_CSS[k])
  for (const k in ROOM_CSS) root.style.removeProperty(ROOM_CSS[k])
  for (const k in HERO_OPTIONAL_CSS) root.style.removeProperty(HERO_OPTIONAL_CSS[k])
  for (const k in SIZE_CSS) root.style.removeProperty(SIZE_CSS[k])
  for (const k in FACE_CSS) root.style.removeProperty(FACE_CSS[k])
  root.style.removeProperty('color-scheme')
}

function documentRoot() {
  return typeof document !== 'undefined' ? document.documentElement : null
}

export function applyTheme(theme, rootEl, opts = {}) {
  const docEl = documentRoot()
  const root = rootEl || docEl
  if (!root) return
  const t = { ...defaultTheme, ...(theme || {}) }
  paintTheme(root, t, true)
  const documentToo = opts.documentToo !== false
  if (documentToo && docEl && root !== docEl) paintTheme(docEl, t, false)
}

export function clearTheme(rootEl) {
  const docEl = documentRoot()
  const root = rootEl || docEl
  if (!root) return
  unpaintTheme(root)
  if (docEl && root !== docEl) unpaintTheme(docEl)
}

export const sizePlaceholders = {
  bodySize: '16px',
  h2Size: 'clamp(30px, 4vw, 52px)',
  heroLogoSize: '22px',
  heroTitleSize: 'clamp(40px, 6.2vw, 76px)',
  heroLeadSize: '18px',
  heroMenuSize: '13px',
  heroTabSize: '12px',
  heroBtnSize: '11px',
  heroBarLabelSize: '11px',
  heroBarInputSize: '15px',
  heroScrollSize: '10px',
  radius: '0px'
}

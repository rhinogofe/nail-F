import { defaultTheme } from './theme.js'
import { FONT_STACKS } from './fonts.js'

export { FONT_STACKS }

export const DEFAULT_PRESET_ID = 'rose-blush'

export const MATCH_KEYS = [
  'bg', 'ink', 'mute', 'gold', 'phFrom', 'phTo',
  'heroAccent', 'heroBtnBg', 'heroBtnText',
  'heroBarBtnBg', 'heroBarBtnText',
  'roomTitle', 'roomText', 'roomLink',
  'serif', 'sans', 'radius',
  'lightEnhance', 'darkEnhance', 'heroOverlay',
]

function pack(partial) {
  return { ...defaultTheme, ...partial }
}

export const THEME_PRESETS = [
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    nameTh: 'หรูมืด',
    blurb: 'ดำ–น้ำตาลทอง บรรยากาศไนท์สตูดิโอ',
    swatches: ['#070605', '#f4efe8', '#b9afa2', '#d8b98a', '#6a4a2b'],
    theme: pack({
      bg: '#070605',
      ink: '#f4efe8',
      mute: '#b9afa2',
      gold: '#d8b98a',
      phFrom: '#2a1d12',
      phTo: '#6a4a2b',
      surface: '',
      line: '',
      border: '',
      roomTitle: '#f4efe8',
      roomText: '#cfc4b6',
      roomLink: '#d8b98a',
      heroText: '#f4efe8',
      heroMute: '#cfc4b6',
      heroAccent: '#d8b98a',
      heroBtnBg: '#d8b98a',
      heroBtnText: '#1a120c',
      heroBarBg: 'rgba(0,0,0,.45)',
      heroBarBorder: '#d8b98a',
      heroBarText: '#f4efe8',
      heroBarBtnBg: '#d8b98a',
      heroBarBtnText: '#1a120c',
      heroBtnSize: '13px',
      serif: FONT_STACKS.find(f => f.id === 'bodoni').value,
      sans: FONT_STACKS.find(f => f.id === 'noto').value,
      radius: '0px',
      heroOverlay: true,
      lightEnhance: true,
      darkEnhance: false,
    }),
  },
  {
    id: 'rose-blush',
    name: 'Rose Blush',
    nameTh: 'ชมพูพาสเทล',
    blurb: 'ครีมอ่อน–ชมพู หวาน น่ารัก ร้านเล็บสาวๆ',
    swatches: ['#fbf4f1', '#3a2428', '#7a4e56', '#c45c78', '#f3d9d4'],
    theme: pack({
      bg: '#fbf4f1',
      ink: '#3a2428',
      mute: '#7a4e56',
      gold: '#c45c78',
      phFrom: '#e8b8c0',
      phTo: '#f3d9d4',
      surface: '#fff8f6',
      line: '#ead3d0',
      border: '#ead3d0',
      roomTitle: '#3a2428',
      roomText: '#7a4e56',
      roomLink: '#a33d5c',
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
      heroBtnSize: '13px',
      serif: FONT_STACKS.find(f => f.id === 'cormorant').value,
      sans: FONT_STACKS.find(f => f.id === 'noto').value,
      radius: '16px',
      heroOverlay: true,
      lightEnhance: true,
      darkEnhance: false,
    }),
  },
  {
    id: 'nude-minimal',
    name: 'Nude Minimal',
    nameTh: 'มินิมอลสะอาด',
    blurb: 'ขาว–เบจ–น้ำตาลอ่อน เน้นพื้นที่ว่าง',
    swatches: ['#f6f3ee', '#2b2723', '#6b635a', '#9c8b74', '#e8dfd2'],
    theme: pack({
      bg: '#f6f3ee',
      ink: '#2b2723',
      mute: '#6b635a',
      gold: '#9c8b74',
      phFrom: '#d4c6b0',
      phTo: '#e8dfd2',
      surface: '#fffcf8',
      line: '#ddd4c8',
      border: '#ddd4c8',
      roomTitle: '#2b2723',
      roomText: '#6b635a',
      roomLink: '#6b5340',
      heroText: '#2b2723',
      heroMute: '#6b635a',
      heroAccent: '#9c8b74',
      heroBtnBg: '#2b2723',
      heroBtnText: '#f6f3ee',
      heroBarBg: 'rgba(255,252,248,.88)',
      heroBarBorder: '#ddd4c8',
      heroBarText: '#2b2723',
      heroBarBtnBg: '#2b2723',
      heroBarBtnText: '#f6f3ee',
      heroBtnSize: '13px',
      serif: FONT_STACKS.find(f => f.id === 'sarabun').value,
      sans: FONT_STACKS.find(f => f.id === 'sarabun').value,
      radius: '2px',
      heroOverlay: true,
      lightEnhance: true,
      darkEnhance: false,
    }),
  },
  {
    id: 'lavender-dream',
    name: 'Lavender Dream',
    nameTh: 'ลาเวนเดอร์',
    blurb: 'ม่วงอ่อนโยน ทันสมัย นุ่มนวล',
    swatches: ['#f4eef8', '#2c2140', '#64567a', '#6b3fa0', '#e8dcf4'],
    theme: pack({
      bg: '#f4eef8',
      ink: '#2c2140',
      mute: '#64567a',
      gold: '#6b3fa0',
      phFrom: '#c4b0dc',
      phTo: '#e8dcf4',
      surface: '#fbfafd',
      line: '#ddd0ea',
      border: '#ddd0ea',
      roomTitle: '#2c2140',
      roomText: '#64567a',
      roomLink: '#5b3490',
      heroText: '#2c2140',
      heroMute: '#64567a',
      heroAccent: '#6b3fa0',
      heroBtnBg: '#6b3fa0',
      heroBtnText: '#fbfafd',
      heroBarBg: 'rgba(251,250,253,.88)',
      heroBarBorder: '#ddd0ea',
      heroBarText: '#2c2140',
      heroBarBtnBg: '#6b3fa0',
      heroBarBtnText: '#fbfafd',
      heroBtnSize: '13px',
      serif: FONT_STACKS.find(f => f.id === 'kanit').value,
      sans: FONT_STACKS.find(f => f.id === 'noto').value,
      radius: '12px',
      heroOverlay: true,
      lightEnhance: true,
      darkEnhance: false,
    }),
  },
  {
    id: 'emerald-spa',
    name: 'Emerald Spa',
    nameTh: 'สปามรกต',
    blurb: 'เขียวมรกตเข้ม + ทองครีม ผ่อนคลาย พรีเมียม',
    swatches: ['#0b1410', '#e8f1eb', '#a3bdb0', '#c9b07a', '#2f6b55'],
    theme: pack({
      bg: '#0b1410',
      ink: '#e8f1eb',
      mute: '#a3bdb0',
      gold: '#c9b07a',
      phFrom: '#143028',
      phTo: '#2f6b55',
      surface: '',
      line: '',
      border: '',
      roomTitle: '#e8f1eb',
      roomText: '#a3bdb0',
      roomLink: '#d4c08a',
      heroText: '#e8f1eb',
      heroMute: '#c5d6cc',
      heroAccent: '#c9b07a',
      heroBtnBg: '#c9b07a',
      heroBtnText: '#0b1410',
      heroBarBg: 'rgba(11,20,16,.50)',
      heroBarBorder: '#c9b07a',
      heroBarText: '#e8f1eb',
      heroBarBtnBg: '#c9b07a',
      heroBarBtnText: '#0b1410',
      heroBtnSize: '13px',
      serif: FONT_STACKS.find(f => f.id === 'mitr').value,
      sans: FONT_STACKS.find(f => f.id === 'noto').value,
      radius: '8px',
      heroOverlay: true,
      lightEnhance: true,
      darkEnhance: false,
    }),
  },
]

function norm(v) {
  if (v === true || v === false) return v
  return String(v ?? '').trim().toLowerCase()
}

export function defaultPreset() {
  return THEME_PRESETS.find(p => p.id === DEFAULT_PRESET_ID) || THEME_PRESETS[0]
}

export function matchingPresetId(theme) {
  if (!theme) return null
  for (const preset of THEME_PRESETS) {
    const same = MATCH_KEYS.every(k => norm(theme[k]) === norm(preset.theme[k]))
    if (same) return preset.id
  }
  return null
}

export function applyPresetTheme(preset) {
  return { ...defaultTheme, ...(preset?.theme || {}) }
}

export function relativeLuminance(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return null
  const rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = rgb.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

export function contrastRatio(a, b) {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  if (l1 == null || l2 == null) return 0
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

export function readableOn(bg, preferred, lightFallback, darkFallback) {
  const light = relativeLuminance(bg) > 0.55
  const fallback = light ? lightFallback : darkFallback
  if (preferred && contrastRatio(preferred, bg) >= 4.5) return preferred
  if (fallback && contrastRatio(fallback, bg) >= 4.5) return fallback
  return light ? '#1a1614' : '#f4efe8'
}

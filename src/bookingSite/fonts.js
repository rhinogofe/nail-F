/** ฟอนต์จาก Google Fonts — value ต้องคงเดิมสำหรับรายการเก่า เพราะธีมที่บันทึกไว้และ matchingPresetId เทียบด้วยสตริงนี้ */
export const FONT_STACKS = [
  { id: 'noto', label: 'Noto Sans Thai (อ่านง่าย)', value: '"Noto Sans Thai","Helvetica Neue",Arial,sans-serif', family: 'Noto Sans Thai', google: 'Noto+Sans+Thai:wght@300;400;500;600' },
  { id: 'kanit', label: 'Kanit (ทันสมัย)', value: '"Kanit","Noto Sans Thai",sans-serif', family: 'Kanit', google: 'Kanit:wght@300;400;500;600' },
  { id: 'prompt', label: 'Prompt (สะอาด)', value: '"Prompt","Noto Sans Thai",sans-serif', family: 'Prompt', google: 'Prompt:wght@300;400;500;600' },
  { id: 'sarabun', label: 'Sarabun (มินิมอล)', value: '"Sarabun","Noto Sans Thai",sans-serif', family: 'Sarabun', google: 'Sarabun:wght@300;400;500;600' },
  { id: 'mitr', label: 'Mitr (สปา)', value: '"Mitr","Noto Sans Thai",sans-serif', family: 'Mitr', google: 'Mitr:wght@300;400;500;600' },
  { id: 'ibm', label: 'IBM Plex Sans Thai (มืออาชีพ)', value: '"IBM Plex Sans Thai","Noto Sans Thai",sans-serif', family: 'IBM Plex Sans Thai', google: 'IBM+Plex+Sans+Thai:wght@300;400;500;600' },
  { id: 'anuphan', label: 'Anuphan (โมเดิร์น)', value: '"Anuphan","Noto Sans Thai",sans-serif', family: 'Anuphan', google: 'Anuphan:wght@300;400;500;600' },
  { id: 'bai', label: 'Bai Jamjuree (เรียบเท่)', value: '"Bai Jamjuree","Noto Sans Thai",sans-serif', family: 'Bai Jamjuree', google: 'Bai+Jamjuree:wght@300;400;500;600' },
  { id: 'niramit', label: 'Niramit (นุ่มนวล)', value: '"Niramit","Noto Sans Thai",sans-serif', family: 'Niramit', google: 'Niramit:wght@300;400;500;600' },
  { id: 'athiti', label: 'Athiti (ผอมสวย)', value: '"Athiti","Noto Sans Thai",sans-serif', family: 'Athiti', google: 'Athiti:wght@300;400;500;600' },
  { id: 'k2d', label: 'K2D (กลมมน)', value: '"K2D","Noto Sans Thai",sans-serif', family: 'K2D', google: 'K2D:wght@300;400;500;600' },
  { id: 'chakra', label: 'Chakra Petch (เหลี่ยมเท่)', value: '"Chakra Petch","Noto Sans Thai",sans-serif', family: 'Chakra Petch', google: 'Chakra+Petch:wght@300;400;500;600' },
  { id: 'mali', label: 'Mali (น่ารัก)', value: '"Mali","Noto Sans Thai",sans-serif', family: 'Mali', google: 'Mali:wght@300;400;500;600' },
  { id: 'itim', label: 'Itim (ลายมือน่ารัก)', value: '"Itim","Noto Sans Thai",sans-serif', family: 'Itim', google: 'Itim' },
  { id: 'sriracha', label: 'Sriracha (ลายมือ)', value: '"Sriracha","Noto Sans Thai",sans-serif', family: 'Sriracha', google: 'Sriracha' },
  { id: 'charm', label: 'Charm (ตัวเขียนหรู)', value: '"Charm","Noto Serif Thai",serif', family: 'Charm', google: 'Charm:wght@400;700' },
  { id: 'pridi', label: 'Pridi (มีหัว คลาสสิก)', value: '"Pridi","Noto Serif Thai",serif', family: 'Pridi', google: 'Pridi:wght@300;400;500;600' },
  { id: 'trirong', label: 'Trirong (มีหัว หรูหรา)', value: '"Trirong","Noto Serif Thai",serif', family: 'Trirong', google: 'Trirong:wght@300;400;500;600' },
  { id: 'noto-serif', label: 'Noto Serif Thai (มีหัว อ่านง่าย)', value: '"Noto Serif Thai","Georgia",serif', family: 'Noto Serif Thai', google: 'Noto+Serif+Thai:wght@300;400;500;600' },
  { id: 'cormorant', label: 'Cormorant Garamond (หวาน · อังกฤษ)', value: '"Cormorant Garamond","Georgia",serif', family: 'Cormorant Garamond', google: 'Cormorant+Garamond:wght@300;400;500;600' },
  { id: 'bodoni', label: 'Bodoni Moda (หรู · อังกฤษ)', value: '"Bodoni Moda","Didot","Times New Roman",serif', family: 'Bodoni Moda', google: 'Bodoni+Moda:wght@400;500;600' },
  { id: 'playfair', label: 'Playfair Display (แฟชั่น · อังกฤษ)', value: '"Playfair Display","Georgia",serif', family: 'Playfair Display', google: 'Playfair+Display:wght@400;500;600' }
]

const byFamily = new Map(FONT_STACKS.map(f => [f.family.toLowerCase(), f]))

function familiesIn(stack) {
  return String(stack || '')
    .split(',')
    .map(s => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean)
}

function injectFont(font) {
  if (typeof document === 'undefined') return
  const id = 'bs-font-' + font.id
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
}

/** โหลดฟอนต์ที่ใช้ในชุด font-family ที่ให้มา (รวมฟอนต์ไทยสำรองในสแตก) */
export function loadFonts(stacks) {
  for (const stack of stacks) {
    for (const name of familiesIn(stack)) {
      const font = byFamily.get(name)
      if (font) injectFont(font)
    }
  }
}

export function loadAllFonts() {
  FONT_STACKS.forEach(injectFont)
}

export const SERVICE_ICONS = [
  ['palette', 'ทาสี / เจล'],
  ['brush', 'เพ้นท์ลาย'],
  ['sparkles', 'กากเพชร / วิบวับ'],
  ['diamond', 'ติดเพชร / อะไหล่'],
  ['hand-stop', 'ดูแลมือ'],
  ['droplet', 'สปา / บำรุง'],
  ['massage', 'นวด'],
  ['leaf', 'ธรรมชาติ / ออร์แกนิก'],
  ['flower', 'ลายดอกไม้'],
  ['wand', 'ทรีทเมนต์ / ลิฟติ้ง'],
  ['eye', 'ขนตา'],
  ['mood-smile', 'คิ้ว / ใบหน้า'],
  ['scissors', 'ตัด / ตกแต่ง'],
  ['crown', 'พรีเมียม'],
  ['heart', 'ยอดนิยม'],
  ['gift', 'แพ็กเกจ / ของขวัญ']
]

export const MORE_SERVICE_ICONS = [
  ['paint', 'ทาสีพื้น'],
  ['color-swatch', 'เฉดสี'],
  ['color-picker', 'เลือกสี'],
  ['bottle', 'ขวดสีเล็บ'],
  ['spray', 'สเปรย์'],
  ['highlight', 'ไฮไลต์ / เคลือบ'],
  ['pencil', 'ดินสอ / เขียนคิ้ว'],
  ['ruler', 'วัดทรง / ต่อความยาว'],
  ['sparkle', 'ประกาย'],
  ['sparkles-2', 'วิบวับ'],
  ['diamonds', 'เพชรหลายเม็ด'],
  ['star', 'ดาว'],
  ['stars', 'ดาวหลายดวง'],
  ['circle-dot', 'ลายจุด'],
  ['hexagon', 'ลายเรขาคณิต'],
  ['rainbow', 'สีรุ้ง'],
  ['butterfly', 'ผีเสื้อ'],
  ['cherry', 'เชอร์รี่'],
  ['lemon', 'ผลไม้'],
  ['clover', 'ใบโคลเวอร์'],
  ['plant', 'ต้นไม้'],
  ['seeding', 'ต้นอ่อน'],
  ['leaf-2', 'ใบไม้'],
  ['paw', 'ลายสัตว์'],
  ['cat', 'แมว'],
  ['sun', 'ฤดูร้อน'],
  ['moon-stars', 'กลางคืน'],
  ['snowflake', 'หิมะ / เย็นสบาย'],
  ['cloud', 'ก้อนเมฆ'],
  ['hand-finger', 'ปลายนิ้ว'],
  ['hand-love-you', 'มือสวย'],
  ['hand-two-fingers', 'มือ'],
  ['hand-sanitizer', 'ทำความสะอาด'],
  ['wash-hand', 'ล้างมือ'],
  ['shoe', 'เท้า'],
  ['bath', 'แช่ / อ่างน้ำ'],
  ['droplets', 'น้ำมัน / เซรั่ม'],
  ['droplet-heart', 'บำรุงล้ำลึก'],
  ['perfume', 'น้ำหอม / อโรมา'],
  ['candle', 'เทียนหอม'],
  ['temperature', 'อุ่น / ประคบร้อน'],
  ['feather', 'อ่อนโยน'],
  ['yoga', 'ผ่อนคลาย'],
  ['stretching', 'ยืดเหยียด'],
  ['bed', 'เตียงนวด'],
  ['armchair', 'ที่นั่งสบาย'],
  ['cup', 'เครื่องดื่ม'],
  ['coffee', 'กาแฟ'],
  ['music', 'ดนตรี'],
  ['eye-heart', 'ขนตาสวย'],
  ['mood-heart', 'ยิ้มหวาน'],
  ['woman', 'ผู้หญิง'],
  ['man', 'ผู้ชาย'],
  ['mood-kid', 'เด็ก'],
  ['users', 'คู่ / กลุ่ม'],
  ['hearts', 'คู่รัก'],
  ['heart-handshake', 'ดูแลใส่ใจ'],
  ['shield-check', 'ปลอดภัย'],
  ['first-aid-kit', 'ดูแล / รักษา'],
  ['flame', 'ฮิต / มาแรง'],
  ['bolt', 'รวดเร็ว'],
  ['clock', 'ตามเวลา'],
  ['calendar', 'นัดล่วงหน้า'],
  ['infinity', 'ไม่จำกัด'],
  ['award', 'รางวัล'],
  ['medal', 'เหรียญ'],
  ['rosette', 'การันตี'],
  ['trophy', 'ถ้วยรางวัล'],
  ['tag', 'ราคาพิเศษ'],
  ['discount', 'ส่วนลด'],
  ['gift-card', 'บัตรของขวัญ'],
  ['cake', 'วันเกิด'],
  ['balloon', 'ฉลอง'],
  ['confetti', 'ปาร์ตี้'],
  ['camera', 'ถ่ายรูปผลงาน']
]

const KNOWN = new Set([...SERVICE_ICONS, ...MORE_SERVICE_ICONS].map(([id]) => id))
export const isMoreIcon = id => MORE_SERVICE_ICONS.some(([x]) => x === id)

const GUESS = [
  [/เพ้นท์|ลาย|art|paint/i, 'brush'],
  [/เพชร|อะไหล่|ประดับ|diamond|gem/i, 'diamond'],
  [/นวด|massage/i, 'massage'],
  [/สปา|บำรุง|spa/i, 'droplet'],
  [/ขนตา|lash/i, 'eye'],
  [/คิ้ว|brow/i, 'mood-smile'],
  [/ตัด|ผม|hair|cut/i, 'scissors'],
  [/ลิฟ|ทรีทเมนต์|lift|treat/i, 'wand'],
  [/เจล|ทาสี|สีเล็บ|gel|polish|colou?r/i, 'palette'],
  [/มือ|hand|manicure/i, 'hand-stop']
]

const FALLBACK = ['palette', 'sparkles', 'droplet', 'brush', 'diamond', 'flower']

/** ไอคอนที่ตั้งไว้ (ต้องอยู่ในชุดที่อนุญาต) หรือเดาจากชื่อ/รายละเอียดบริการ */
export function serviceIcon(room, index = 0) {
  const own = String(room?.icon || '').trim()
  if (KNOWN.has(own)) return own
  const text = `${room?.name || ''} ${room?.detail || ''}`
  for (const [re, icon] of GUESS) if (re.test(text)) return icon
  return FALLBACK[index % FALLBACK.length]
}

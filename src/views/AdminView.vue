<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import Swal from 'sweetalert2'

const router = useRouter()
const auth = useAuthStore()

function todayYmd() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
function todayYm() {
  return todayYmd().slice(0, 7)
}

const date = ref(todayYmd())
const status = ref('')
const bookings = ref([])
const blockMonth = ref(todayYm())
const blocks = ref([])
const blockDate = ref(todayYmd())
const blockType = ref('partial')
const blockStart = ref(10)
const blockEnd = ref(15)
const blockNote = ref('')
const bulkBlockType = ref('partial')
const bulkBlockStart = ref(10)
const bulkBlockEnd = ref(15)
const bulkBlockNote = ref('')
const bulkStartDate = ref(todayYmd())
const bulkDays = ref(7)
const depositAmount = ref(300)
const useCouponCode = ref('')
const nailOptions = ref([])
const optionForm = ref({
  id: null,
  option_name: '',
  description: '',
  price: 0,
  duration_min: 60,
  is_active: true,
  show_from_date: '',
  show_to_date: '',
})
const loading = ref(false)
const message = ref('')
const errorMessage = ref('')

const filtered = computed(() => bookings.value)

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = {}
    if (date.value) params.date = date.value
    if (status.value) params.status = status.value
    const { data } = await api.get('/api/admin/bookings', { params })
    bookings.value = data
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

async function loadBlocks() {
  try {
    const { data } = await api.get('/api/admin/blocks', { params: { month: blockMonth.value } })
    blocks.value = data
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดรายการปิดวันเวลาไม่สำเร็จ'
  }
}

async function loadDepositSetting() {
  try {
    const { data } = await api.get('/api/admin/settings/deposit')
    depositAmount.value = Number(data?.deposit_amount || 300)
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดค่ายอดมัดจำไม่สำเร็จ'
  }
}

async function saveDepositSetting() {
  const ok = await Swal.fire({
    title: 'ยืนยันบันทึกยอดมัดจำ',
    text: `ตั้งยอดมัดจำเป็น ${depositAmount.value} บาท ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const payload = { deposit_amount: Number(depositAmount.value) }
    const { data } = await api.patch('/api/admin/settings/deposit', payload)
    depositAmount.value = Number(data?.deposit_amount || depositAmount.value)
    message.value = 'บันทึกยอดมัดจำแล้ว'
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกยอดมัดจำไม่สำเร็จ'
  }
}

function formatYmdLocal(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function formatDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    return formatYmdLocal(new Date(value))
  }
  return formatYmdLocal(new Date(value))
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return formatYmdLocal(dt)
}

const bulkEndDate = computed(() => addDaysIso(bulkStartDate.value, bulkDays.value - 1))

const bulkPreviewText = computed(() => {
  if (bulkBlockType.value === 'full_day') {
    return `ปิดทั้งวัน ${bulkDays.value} วัน (${bulkStartDate.value} → ${bulkEndDate.value})`
  }
  return `ปิดเวลา ${bulkBlockStart.value}:00–${bulkBlockEnd.value}:00 ต่อเนื่อง ${bulkDays.value} วัน (${bulkStartDate.value} → ${bulkEndDate.value})`
})

async function createBulkBlocks() {
  const isFullDay = bulkBlockType.value === 'full_day'
  if (!isFullDay) {
    const start = Number(bulkBlockStart.value)
    const end = Number(bulkBlockEnd.value)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errorMessage.value = 'ช่วงเวลาปิดไม่ถูกต้อง (ชั่วโมงสิ้นสุดต้องมากกว่าเวลาเริ่ม)'
      return
    }
  }
  const rangeText = isFullDay
    ? `ปิดทั้งวัน ${bulkDays.value} วัน (${bulkStartDate.value} ถึง ${bulkEndDate.value})`
    : `ปิดเวลา ${bulkBlockStart.value}:00-${bulkBlockEnd.value}:00 จำนวน ${bulkDays.value} วัน (${bulkStartDate.value} ถึง ${bulkEndDate.value})`

  const ok = await Swal.fire({
    title: 'ยืนยันปิดล่วงหน้า',
    text: rangeText,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      start_date: bulkStartDate.value,
      days: Number(bulkDays.value),
      is_full_day: isFullDay,
      note: bulkBlockNote.value || null,
    }
    if (!isFullDay) {
      payload.start_hour = Number(bulkBlockStart.value)
      payload.end_hour = Number(bulkBlockEnd.value)
    }
    const { data } = await api.post('/api/admin/blocks/bulk', payload)
    message.value = data?.message || `ปิดรับคิวแล้ว ${data?.created || 0} วัน`
    blockMonth.value = bulkStartDate.value.slice(0, 7)
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ปิดล่วงหน้าไม่สำเร็จ'
  }
}

async function createBlock() {
  if (blockType.value !== 'full_day') {
    const start = Number(blockStart.value)
    const end = Number(blockEnd.value)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errorMessage.value = 'ช่วงเวลาปิดไม่ถูกต้อง (ชั่วโมงสิ้นสุดต้องมากกว่าเวลาเริ่ม)'
      return
    }
  }

  const ok = await Swal.fire({
    title: 'ยืนยันเพิ่มรายการปิด',
    text: 'ต้องการเพิ่มรายการปิดวัน/เวลาใช่ไหม',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      block_date: blockDate.value,
      is_full_day: blockType.value === 'full_day',
      note: blockNote.value || null,
    }
    if (blockType.value !== 'full_day') {
      payload.start_hour = Number(blockStart.value)
      payload.end_hour = Number(blockEnd.value)
    }
    await api.post('/api/admin/blocks', payload)
    message.value = 'เพิ่มช่วงเวลาปิดรับคิวแล้ว'
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'เพิ่มช่วงเวลาปิดรับคิวไม่สำเร็จ'
  }
}

async function removeBlock(id) {
  const ok = await Swal.fire({
    title: 'ยืนยันลบรายการ',
    text: 'ลบรายการปิดวัน/เวลานี้ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/blocks/${id}`)
    message.value = 'ลบรายการปิดวันเวลาแล้ว'
    await loadBlocks()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ลบรายการไม่สำเร็จ'
  }
}

async function markDone(id) {
  const ok = await Swal.fire({
    title: 'ยืนยันทำคิวเสร็จ',
    text: 'ต้องการปิดคิวนี้และให้แต้ม +10 ใช่ไหม',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/complete`)
    message.value = data?.message || 'อัปเดตสำเร็จ'
    await Promise.all([loadBookings(), auth.fetchMe().catch(() => null)])
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'อัปเดตไม่สำเร็จ'
  }
}

async function confirmPayment(id) {
  const ok = await Swal.fire({
    title: 'ยืนยันชำระเงิน',
    text: 'ลูกค้าโอนเงินแล้วใช่ไหม',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/confirm-payment`)
    message.value = data?.message || 'ยืนยันชำระเงินสำเร็จ'
    await loadBookings()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ยืนยันชำระเงินไม่สำเร็จ'
  }
}

async function useCoupon() {
  message.value = ''
  errorMessage.value = ''
  const code = String(useCouponCode.value || '').trim().toUpperCase()
  if (!code) {
    errorMessage.value = 'กรุณากรอกรหัสคูปอง'
    return
  }

  const ok = await Swal.fire({
    title: 'ยืนยันใช้คูปอง',
    text: `ใช้คูปองรหัส ${code} ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันใช้',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  try {
    const { data } = await api.patch('/api/admin/coupons/use', { coupon_code: code })
    message.value = data?.message || 'ใช้คูปองเรียบร้อยแล้ว'
    useCouponCode.value = ''
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ใช้คูปองไม่สำเร็จ'
  }
}

async function cancelUnpaid(id) {
  const ok = await Swal.fire({
    title: 'ยืนยันยกเลิกคิว',
    text: 'ลูกค้าไม่ชำระเงิน ต้องการยกเลิกคิวนี้ใช่ไหม',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/cancel-unpaid`)
    message.value = data?.message || 'ยกเลิกคิวที่ยังไม่ชำระเงินแล้ว'
    await loadBookings()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ยกเลิกคิวไม่สำเร็จ'
  }
}

async function cancelPaid(id) {
  const ok = await Swal.fire({
    title: 'ยืนยันยกเลิกคิวชำระแล้ว',
    html: 'ใช้กรณีลูกค้าขอเลื่อนวัน/ยกเลิกคิว<br>ช่วงเวลานี้จะว่างให้จองใหม่ได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    const { data } = await api.patch(`/api/admin/bookings/${id}/cancel-paid`)
    message.value = data?.message || 'ยกเลิกคิวชำระแล้วแล้ว'
    await loadBookings()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'ยกเลิกคิวไม่สำเร็จ'
  }
}

function resetOptionForm() {
  optionForm.value = {
    id: null,
    option_name: '',
    description: '',
    price: 0,
    duration_min: 60,
    is_active: true,
    show_from_date: '',
    show_to_date: '',
  }
}

function optionShowRangeText(item) {
  const from = formatDateKey(item.show_from_date)
  const to = formatDateKey(item.show_to_date)
  if (!from && !to) return 'แสดงทุกวัน'
  if (from && to) return `แสดง ${from} ถึง ${to}`
  if (from) return `แสดงตั้งแต่ ${from}`
  return `แสดงถึง ${to}`
}

async function loadNailOptions() {
  try {
    const { data } = await api.get('/api/admin/nailoptions')
    nailOptions.value = data
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'โหลดรายการบริการไม่สำเร็จ'
  }
}

function startEditOption(item) {
  optionForm.value = {
    id: item.id,
    option_name: item.option_name,
    description: item.description || '',
    price: Number(item.price),
    duration_min: Number(item.duration_min),
    is_active: Boolean(item.is_active),
    show_from_date: formatDateKey(item.show_from_date) || '',
    show_to_date: formatDateKey(item.show_to_date) || '',
  }
}

async function saveNailOption() {
  const name = String(optionForm.value.option_name || '').trim()
  if (!name) {
    errorMessage.value = 'กรุณากรอกชื่อบริการ'
    return
  }

  const isEdit = Boolean(optionForm.value.id)
  const ok = await Swal.fire({
    title: isEdit ? 'ยืนยันแก้ไขบริการ' : 'ยืนยันเพิ่มบริการ',
    text: `${isEdit ? 'แก้ไข' : 'เพิ่ม'} "${name}" ใช่ไหม`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  const showFrom = String(optionForm.value.show_from_date || '').trim()
  const showTo = String(optionForm.value.show_to_date || '').trim()
  if (showFrom && showTo && showFrom > showTo) {
    errorMessage.value = 'วันเริ่มแสดงต้องไม่เกินวันสิ้นสุดแสดง'
    return
  }

  const payload = {
    option_name: name,
    description: String(optionForm.value.description || '').trim() || null,
    price: Number(optionForm.value.price),
    duration_min: Number(optionForm.value.duration_min),
    is_active: Boolean(optionForm.value.is_active),
    show_from_date: showFrom || null,
    show_to_date: showTo || null,
  }

  try {
    if (isEdit) {
      await api.patch(`/api/admin/nailoptions/${optionForm.value.id}`, payload)
      message.value = 'แก้ไขบริการแล้ว'
    } else {
      await api.post('/api/admin/nailoptions', payload)
      message.value = 'เพิ่มบริการแล้ว'
    }
    resetOptionForm()
    await loadNailOptions()
  } catch (error) {
    errorMessage.value = error?.response?.data?.error || 'บันทึกบริการไม่สำเร็จ'
  }
}

async function removeNailOption(item) {
  const ok = await Swal.fire({
    title: 'ยืนยันลบบริการ',
    text: `ลบ "${item.option_name}" ใช่ไหม`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  if (!ok.isConfirmed) return

  message.value = ''
  errorMessage.value = ''
  try {
    await api.delete(`/api/admin/nailoptions/${item.id}`)
    message.value = 'ลบบริการแล้ว'
    if (optionForm.value.id === item.id) resetOptionForm()
    await loadNailOptions()
  } catch (error) {
    const msg = error?.response?.data?.error || 'ลบบริการไม่สำเร็จ'
    errorMessage.value = msg
    await Swal.fire({ title: 'ลบไม่สำเร็จ', text: msg, icon: 'error' })
  }
}

function statusLabel(s) {
  const map = {
    awaiting_payment: 'รอชำระเงิน',
    pending: 'ชำระแล้ว / รอให้บริการ',
    done: 'ทำเสร็จแล้ว',
    cancelled: 'ยกเลิกแล้ว',
  }
  return map[s] || s
}

function backToBooking() {
  router.push('/bookings')
}

onMounted(loadBookings)
onMounted(loadBlocks)
onMounted(loadDepositSetting)
onMounted(loadNailOptions)
</script>

<template>
  <main class="page">
    <header class="topbar card">
      <div>
        <h2>แอดมิน - จัดการคิว</h2>
        <p class="muted">เข้าสู่ระบบโดย {{ auth.user?.name || '-' }}</p>
      </div>
      <button class="btn" @click="backToBooking">กลับหน้าจอง</button>
    </header>

    <section class="card admin-section">
      <div class="admin-filter-row">
        <label class="admin-filter-item">
          วันที่
          <input v-model="date" type="date" @change="loadBookings" class="admin-input" />
        </label>
        <label class="admin-filter-item">
          สถานะ
          <select v-model="status" @change="loadBookings" class="admin-input">
            <option value="">ทั้งหมด</option>
            <option value="awaiting_payment">รอชำระเงิน</option>
            <option value="pending">ชำระแล้ว / รอให้บริการ</option>
            <option value="done">ทำเสร็จแล้ว</option>
            <option value="cancelled">ยกเลิกแล้ว</option>
          </select>
        </label>
      </div>

      <p v-if="message" class="success">{{ message }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="loading" class="muted">กำลังโหลด...</p>

      <div v-for="item in filtered" :key="item.id" class="admin-item">
        <div>
          <strong>{{ formatDateKey(item.booking_date) }} {{ item.start_hour }}:00 - {{ item.end_hour ?? (Number(item.start_hour) + 2) }}:00</strong>
          <p class="muted">{{ item.user_name }} ({{ item.user_email }})</p>
          <p class="muted">สถานะ: {{ statusLabel(item.status) }}</p>
          <p class="muted">
            บริการ:
            {{
              item.nail_options?.length
                ? item.nail_options.map((opt) => opt.option_name).join(', ')
                : '-'
            }}
          </p>
        </div>
        <div class="row">
          <button
            v-if="item.status === 'awaiting_payment'"
            class="btn"
            @click="confirmPayment(item.id)"
          >
            ยืนยันชำระเงิน
          </button>
          <button
            v-if="item.status === 'awaiting_payment'"
            class="btn danger"
            @click="cancelUnpaid(item.id)"
          >
            ยกเลิกคิวไม่ชำระ
          </button>
          <button
            v-if="item.status === 'pending'"
            class="btn primary"
            @click="markDone(item.id)"
          >
            ทำเสร็จ +10 แต้ม
          </button>
          <button
            v-if="item.status === 'pending'"
            class="btn danger"
            @click="cancelPaid(item.id)"
          >
            ยกเลิกคิว (เลื่อนวัน)
          </button>
        </div>
      </div>
    </section>

    <section class="card admin-section">
      <h3>จัดการบริการ (Nailoption)</h3>
      <div class="admin-form-grid admin-option-grid">
        <label>
          ชื่อบริการ *
          <input v-model="optionForm.option_name" type="text" class="admin-input" placeholder="เช่น ทาสีเจลมือ" />
        </label>
        <label>
          รายละเอียด
          <input v-model="optionForm.description" type="text" class="admin-input" placeholder="คำอธิบายสั้นๆ" />
        </label>
        <label>
          ราคา (บาท)
          <input v-model.number="optionForm.price" type="number" min="0" step="1" class="admin-input" />
        </label>
        <label>
          ระยะเวลา (นาที)
          <input v-model.number="optionForm.duration_min" type="number" min="1" step="1" class="admin-input" />
        </label>
        <label>
          แสดงตั้งแต่วันที่
          <input v-model="optionForm.show_from_date" type="date" class="admin-input" />
        </label>
        <label>
          แสดงถึงวันที่
          <input v-model="optionForm.show_to_date" type="date" class="admin-input" />
        </label>
      </div>
      <p class="muted" style="margin: 0 0 10px">ว่างทั้งสองช่อง = แสดงทุกวัน (เช่น เกษตร) · กรอกช่วงวันเมื่อเปิดเฉพาะช่วง (เช่น จุฬา 28–29 มิ.ย.)</p>
      <div class="admin-form-row">
        <label class="admin-checkbox">
          <input v-model="optionForm.is_active" type="checkbox" />
          แสดงให้ลูกค้าเลือกจอง
        </label>
        <button class="btn primary admin-action-btn" @click="saveNailOption">
          {{ optionForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ' }}
        </button>
        <button v-if="optionForm.id" class="btn admin-action-btn" @click="resetOptionForm">ยกเลิกแก้ไข</button>
      </div>

      <div v-if="nailOptions.length === 0" class="muted" style="margin-top: 10px">ยังไม่มีรายการบริการ</div>
      <div v-for="item in nailOptions" :key="item.id" class="admin-item">
        <div>
          <strong>{{ item.option_name }}</strong>
          <span :class="item.is_active ? 'badge-active' : 'badge-inactive'">
            {{ item.is_active ? 'เปิดใช้งาน' : 'ปิด' }}
          </span>
          <p class="muted">{{ item.description || '-' }}</p>
          <p class="muted">ราคา {{ Number(item.price) }} บาท · {{ item.duration_min }} นาที</p>
          <p class="muted">{{ optionShowRangeText(item) }}</p>
        </div>
        <div class="row">
          <button class="btn" @click="startEditOption(item)">แก้ไข</button>
          <button class="btn danger" @click="removeNailOption(item)">ลบ</button>
        </div>
      </div>
    </section>

    <section class="card admin-section">
      <h3>ตั้งค่ายอดมัดจำ</h3>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          ยอดมัดจำ (บาท)
          <input v-model.number="depositAmount" type="number" min="1" step="1" class="admin-input" />
        </label>
        <button class="btn primary admin-action-btn" @click="saveDepositSetting">บันทึกยอดมัดจำ</button>
      </div>
      <p class="muted">ค่านี้จะถูกนำไปแสดงในหน้าชำระของลูกค้าทันที</p>
    </section>

    <section class="card admin-section">
      <h3>ใช้คูปองลูกค้า</h3>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          รหัสคูปอง (10 หลัก)
          <input v-model="useCouponCode" type="text" maxlength="10" placeholder="กรอกรหัสคูปอง" class="admin-input" />
        </label>
        <button class="btn primary admin-action-btn" @click="useCoupon">ยืนยันใช้คูปอง</button>
      </div>
    </section>

    <section class="card admin-section">
      <h3>ปิดวัน / ปิดช่วงเวลา</h3>
      <div class="admin-form-row">
        <label>
          เดือนที่ดู
          <input v-model="blockMonth" type="month" @change="loadBlocks" class="admin-input" />
        </label>
      </div>

      <div class="bulk-block-box">
        <h4>ปิดล่วงหน้า 7 / 15 / 30 วัน (ทั้งวัน หรือ บางช่วงเวลา)</h4>
        <div class="admin-form-grid admin-bulk-settings">
          <label>
            ประเภท
            <select v-model="bulkBlockType" class="admin-input">
              <option value="partial">ปิดบางช่วงเวลา</option>
              <option value="full_day">ปิดทั้งวัน</option>
            </select>
          </label>
          <label v-if="bulkBlockType === 'partial'">
            เริ่ม (ชม.)
            <input v-model="bulkBlockStart" type="number" min="0" max="23" class="admin-input" />
          </label>
          <label v-if="bulkBlockType === 'partial'">
            ถึง (ชม.)
            <input v-model="bulkBlockEnd" type="number" min="1" max="24" class="admin-input" />
          </label>
        </div>
        <div class="admin-form-grid admin-bulk-grid">
          <label>
            เริ่มจากวันที่
            <input v-model="bulkStartDate" type="date" class="admin-input" />
          </label>
          <label>
            จำนวนวัน
            <input v-model.number="bulkDays" type="number" min="1" max="90" class="admin-input" />
          </label>
        </div>
        <div class="admin-form-row">
          <label class="admin-label-grow">
            หมายเหตุ
            <input v-model="bulkBlockNote" type="text" placeholder="เช่น พนักงานไม่พอ / ร้านปิดปรับปรุง" class="admin-input" />
          </label>
        </div>
        <p class="bulk-preview">{{ bulkPreviewText }}</p>
        <div class="bulk-preset-row">
          <button type="button" class="btn" :class="{ primary: bulkDays === 7 }" @click="bulkDays = 7">7 วัน</button>
          <button type="button" class="btn" :class="{ primary: bulkDays === 15 }" @click="bulkDays = 15">15 วัน</button>
          <button type="button" class="btn" :class="{ primary: bulkDays === 30 }" @click="bulkDays = 30">30 วัน</button>
          <button type="button" class="btn primary admin-action-btn" @click="createBulkBlocks">
            ยืนยันปิดล่วงหน้า
          </button>
        </div>
      </div>

      <h4 class="admin-subtitle">ปิดทีละวัน</h4>
      <div class="admin-form-grid">
        <label>
          วันที่
          <input v-model="blockDate" type="date" class="admin-input" />
        </label>
        <label>
          ประเภท
          <select v-model="blockType" class="admin-input">
            <option value="partial">ปิดบางช่วงเวลา</option>
            <option value="full_day">ปิดทั้งวัน</option>
          </select>
        </label>
        <label v-if="blockType === 'partial'">
          เริ่ม
          <input v-model="blockStart" type="number" min="0" max="23" class="admin-input" />
        </label>
        <label v-if="blockType === 'partial'">
          ถึง
          <input v-model="blockEnd" type="number" min="1" max="24" class="admin-input" />
        </label>
      </div>
      <div class="admin-form-row">
        <label class="admin-label-grow">
          หมายเหตุ
          <input v-model="blockNote" type="text" placeholder="เช่น พนักงานไม่พอ / ร้านปิดปรับปรุง" class="admin-input" />
        </label>
        <button class="btn admin-action-btn" @click="createBlock">เพิ่มรายการปิด</button>
      </div>

      <div v-if="blocks.length === 0" class="muted" style="margin-top: 10px">ยังไม่มีรายการปิดในเดือนนี้</div>
      <div v-for="item in blocks" :key="item.id" class="admin-item">
        <div>
          <strong>{{ formatDateKey(item.block_date) }}</strong>
          <p class="muted">
            {{
              item.is_full_day
                ? 'ปิดทั้งวัน'
                : `ปิดเวลา ${item.start_hour}:00 - ${item.end_hour}:00`
            }}
          </p>
          <p v-if="item.note" class="muted">{{ item.note }}</p>
        </div>
        <button class="btn danger" @click="removeBlock(item.id)">ลบ</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.admin-section {
  border-radius: 14px;
  padding: 18px;
}

.admin-form-row {
  display: flex;
  gap: 12px;
  align-items: end;
  margin-bottom: 10px;
}

.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.admin-filter-row {
  display: grid;
  grid-template-columns: 220px 220px;
  gap: 12px;
  margin-bottom: 10px;
}

.admin-filter-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 8px 10px;
}

.admin-label-grow {
  flex: 1;
}

.admin-input {
  width: 100%;
  margin-top: 4px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 8px 10px;
}

.admin-action-btn {
  min-width: 120px;
  font-weight: 600;
}

.admin-option-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.bulk-block-box {
  margin: 12px 0 16px;
  padding: 14px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
}

.bulk-block-box h4,
.admin-subtitle {
  margin: 0 0 8px;
  font-size: 15px;
}

.bulk-preview {
  margin: 8px 0 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 14px;
  font-weight: 600;
}

.admin-bulk-settings {
  grid-template-columns: repeat(3, minmax(100px, 1fr));
  margin-bottom: 10px;
}

.bulk-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.admin-bulk-grid {
  grid-template-columns: repeat(2, minmax(140px, 1fr));
}

.admin-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.badge-active,
.badge-inactive {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.badge-active {
  background: #dcfce7;
  color: #166534;
}

.badge-inactive {
  background: #fee2e2;
  color: #991b1b;
}

@media (max-width: 820px) {
  .admin-filter-row {
    grid-template-columns: 1fr;
  }

  .admin-option-grid {
    grid-template-columns: 1fr;
  }

  .admin-bulk-grid,
  .admin-bulk-settings {
    grid-template-columns: 1fr;
  }

  .bulk-preset-row .btn {
    flex: 1 1 calc(50% - 8px);
  }

  .admin-form-row {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-action-btn {
    width: 100%;
  }
}
</style>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import Swal from 'sweetalert2'

const router = useRouter()
const auth = useAuthStore()

const date = ref(new Date().toISOString().slice(0, 10))
const status = ref('')
const bookings = ref([])
const blockMonth = ref(new Date().toISOString().slice(0, 7))
const blocks = ref([])
const blockDate = ref(new Date().toISOString().slice(0, 10))
const blockType = ref('partial')
const blockStart = ref(10)
const blockEnd = ref(15)
const blockNote = ref('')
const depositAmount = ref(300)
const useCouponCode = ref('')
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

async function createBlock() {
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

function backToBooking() {
  router.push('/bookings')
}

onMounted(loadBookings)
onMounted(loadBlocks)
onMounted(loadDepositSetting)
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
            <option value="awaiting_payment">awaiting_payment</option>
            <option value="pending">pending</option>
            <option value="done">done</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
      </div>

      <p v-if="message" class="success">{{ message }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="loading" class="muted">กำลังโหลด...</p>

      <div v-for="item in filtered" :key="item.id" class="admin-item">
        <div>
          <strong>{{ item.booking_date?.slice(0, 10) }} {{ item.start_hour }}:00 - {{ item.end_hour }}:00</strong>
          <p class="muted">{{ item.user_name }} ({{ item.user_email }})</p>
          <p class="muted">สถานะ: {{ item.status }}</p>
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
          <strong>{{ item.block_date?.slice(0, 10) }}</strong>
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

@media (max-width: 820px) {
  .admin-filter-row {
    grid-template-columns: 1fr;
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

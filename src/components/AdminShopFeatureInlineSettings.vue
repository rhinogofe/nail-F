<script setup>
import { computed, ref, watch } from 'vue'
import { shopAdminApi } from '../api/adminShopApi'
import AdminSwitch from './AdminSwitch.vue'
import {
  resolveInlineEditor,
  uiFieldsForEditor,
  uiValueToInput,
  uiInputToStored,
} from '../utils/featureInlineSettings'

const props = defineProps({
  shopSlug: { type: String, default: '' },
  setup: { type: Object, default: null },
  childKey: { type: String, default: '' },
  label: { type: String, default: '' },
  active: { type: Boolean, default: true },
})

const emit = defineEmits(['saved', 'error'])

const loading = ref(false)
const saving = ref(false)
const localMessage = ref('')
const localError = ref('')

const editor = computed(() => resolveInlineEditor(props.setup, props.childKey))
const uiFields = computed(() => uiFieldsForEditor(editor.value))

const depositAmount = ref(300)
const coupon = ref({ discount_percent: 20, required_points: 100, completion_points: 10 })
const line = ref({ enabled: false, push_to_id: '', can_edit_enabled: false })
const chatNotify = ref({
  new_booking_enabled: true,
  upcoming_admin_enabled: true,
  upcoming_customer_enabled: true,
  cancel_admin_enabled: true,
  cancel_customer_enabled: true,
  paid_admin_enabled: true,
  paid_customer_enabled: true,
  slip_admin_enabled: true,
  upcoming_minutes: 30,
})
const unpaid = ref({ enabled: true, expire_hours: 24 })
const shopHours = ref({ open_hour: 9, last_booking_hour: 18 })
const advanceDays = ref(30)
const slotDisplay = ref({
  slot_hours: 2,
  display_mode: 'normal',
  enabled: false,
  past_close_enabled: false,
  min_gap_enabled: false,
  min_gap_minutes: 60,
})
const uiForm = ref({})
const clips = ref([])
const clipForm = ref({ tiktok_url: '', title: '', is_active: true })
const locations = ref([])
const locationForm = ref({ name: '', color: '#C4847A', description: '', map_url: '' })
const useCouponCode = ref('')
const serviceOptions = ref([])
const serviceCategories = ref([])
const serviceForm = ref({
  id: '',
  option_name: '',
  description: '',
  price: 0,
  duration_min: 60,
  is_active: true,
  is_required: false,
  category_id: '',
})

function resetServiceForm() {
  serviceForm.value = {
    id: '',
    option_name: '',
    description: '',
    price: 0,
    duration_min: 60,
    is_active: true,
    is_required: false,
    category_id: '',
  }
}

function startEditService(item) {
  serviceForm.value = {
    id: item.id,
    option_name: item.option_name || '',
    description: item.description || '',
    price: Number(item.price) || 0,
    duration_min: Number(item.duration_min) || 0,
    is_active: item.is_active !== false,
    is_required: Boolean(item.is_required),
    category_id: item.category_id || '',
  }
}

function serviceDateHint(item) {
  const from = item.show_from_date ? String(item.show_from_date).slice(0, 10) : ''
  const to = item.show_to_date ? String(item.show_to_date).slice(0, 10) : ''
  if (from && to) return from === to ? `วัน ${from}` : `${from} – ${to}`
  if (from) return `ตั้งแต่ ${from}`
  if (to) return `ถึง ${to}`
  return 'ทุกวัน'
}

async function loadServices() {
  const [optionsRes, categoriesRes] = await Promise.all([
    shopAdminApi.get(props.shopSlug, '/api/admin/nailoptions'),
    shopAdminApi.get(props.shopSlug, '/api/admin/service-categories'),
  ])
  serviceOptions.value = optionsRes.data || []
  serviceCategories.value = categoriesRes.data || []
  resetServiceForm()
}

async function saveService() {
  const name = String(serviceForm.value.option_name || '').trim()
  if (!name) {
    localError.value = 'กรุณากรอกชื่อบริการ'
    return
  }
  saving.value = true
  localError.value = ''
  try {
    const payload = {
      option_name: name,
      description: String(serviceForm.value.description || '').trim() || null,
      price: Number(serviceForm.value.price),
      duration_min: Number(serviceForm.value.duration_min),
      is_active: Boolean(serviceForm.value.is_active),
      is_required: Boolean(serviceForm.value.is_required),
      category_id: serviceForm.value.category_id || null,
    }
    if (serviceForm.value.id) {
      await shopAdminApi.patch(
        props.shopSlug,
        `/api/admin/nailoptions/${serviceForm.value.id}`,
        payload
      )
      localMessage.value = 'แก้ไขบริการแล้ว'
    } else {
      await shopAdminApi.post(props.shopSlug, '/api/admin/nailoptions', payload)
      localMessage.value = 'เพิ่มบริการแล้ว'
    }
    await loadServices()
    emit('saved', name)
  } catch (err) {
    localError.value = err.response?.data?.error || 'บันทึกบริการไม่สำเร็จ'
    emit('error', localError.value)
  } finally {
    saving.value = false
  }
}

async function removeService(item) {
  saving.value = true
  localError.value = ''
  try {
    await shopAdminApi.delete(props.shopSlug, `/api/admin/nailoptions/${item.id}`)
    if (serviceForm.value.id === item.id) resetServiceForm()
    await loadServices()
    localMessage.value = 'ลบบริการแล้ว'
  } catch (err) {
    localError.value = err.response?.data?.error || 'ลบบริการไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

async function loadEditor() {
  if (!props.shopSlug || !props.active || editor.value.kind === 'none') return
  loading.value = true
  localError.value = ''
  localMessage.value = ''
  try {
    const kind = editor.value.kind
    if (kind === 'deposit') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/deposit')
      depositAmount.value = Number(data?.deposit_amount) || 300
    } else if (kind === 'coupon') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/coupon')
      coupon.value = {
        discount_percent: Number(data?.discount_percent) || 20,
        required_points: Number(data?.required_points) || 100,
        completion_points: Number(data?.completion_points ?? 10),
      }
    } else if (kind === 'line') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/line-push')
      line.value = {
        enabled: Boolean(data?.enabled),
        push_to_id: data?.push_to_id || '',
        can_edit_enabled: Boolean(data?.can_edit_enabled),
      }
    } else if (kind === 'chat-notify') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/chat-notify')
      chatNotify.value = {
        new_booking_enabled: data?.new_booking_enabled !== false,
        upcoming_admin_enabled: data?.upcoming_admin_enabled !== false,
        upcoming_customer_enabled: data?.upcoming_customer_enabled !== false,
        cancel_admin_enabled: data?.cancel_admin_enabled !== false,
        cancel_customer_enabled: data?.cancel_customer_enabled !== false,
        paid_admin_enabled: data?.paid_admin_enabled !== false,
        paid_customer_enabled: data?.paid_customer_enabled !== false,
        slip_admin_enabled: data?.slip_admin_enabled !== false,
        upcoming_minutes: Number(data?.upcoming_minutes) || 30,
      }
    } else if (kind === 'unpaid') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/unpaid-auto-cancel')
      unpaid.value = {
        enabled: data?.enabled !== false,
        expire_hours: Number(data?.expire_hours) || 24,
      }
    } else if (kind === 'shop-hours') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/shop-hours')
      shopHours.value = {
        open_hour: Number(data?.open_hour) || 9,
        last_booking_hour: Number(data?.last_booking_hour) || 18,
      }
    } else if (kind === 'advance-days') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/advance-days')
      advanceDays.value = Number(data?.advance_days) || 30
    } else if (kind === 'slot-display') {
      const [displayRes, slotRes, extendRes, minGapRes] = await Promise.all([
        shopAdminApi.get(props.shopSlug, '/api/admin/settings/booking-display'),
        shopAdminApi.get(props.shopSlug, '/api/admin/settings/booking-slot-hours'),
        shopAdminApi.get(props.shopSlug, '/api/admin/settings/extend-booking-by-services'),
        shopAdminApi.get(props.shopSlug, '/api/admin/settings/booking-min-gap'),
      ])
      slotDisplay.value = {
        display_mode: displayRes.data?.display_mode === 'slots_2h' ? 'slots_2h' : 'normal',
        slot_hours: Number(slotRes.data?.slot_hours) || 2,
        enabled: Boolean(extendRes.data?.enabled),
        past_close_enabled: Boolean(extendRes.data?.past_close_enabled),
        min_gap_enabled: Boolean(minGapRes.data?.enabled),
        min_gap_minutes: Number(minGapRes.data?.minutes) || 60,
      }
    } else if (kind === 'ui-fields' || kind === 'ui-section') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/settings/ui')
      const next = {}
      for (const field of uiFields.value) {
        next[field.key] = uiValueToInput(data?.[field.key], field)
      }
      uiForm.value = next
    } else if (kind === 'reviews') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/showcase-clips')
      clips.value = data || []
      clipForm.value = { tiktok_url: '', title: '', is_active: true }
    } else if (kind === 'service-locations') {
      const { data } = await shopAdminApi.get(props.shopSlug, '/api/admin/service-locations')
      locations.value = data || []
      locationForm.value = { name: '', color: '#C4847A', description: '', map_url: '' }
    } else if (kind === 'services') {
      await loadServices()
    }
  } catch (err) {
    localError.value = err.response?.data?.error || err.message || 'โหลดไม่สำเร็จ'
    emit('error', localError.value)
  } finally {
    loading.value = false
  }
}

async function saveEditor() {
  if (!props.shopSlug) return
  saving.value = true
  localError.value = ''
  localMessage.value = ''
  try {
    const kind = editor.value.kind
    if (kind === 'deposit') {
      const { data } = await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/deposit', {
        deposit_amount: Number(depositAmount.value),
      })
      depositAmount.value = Number(data?.deposit_amount) || depositAmount.value
    } else if (kind === 'coupon') {
      await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/coupon', {
        discount_percent: Number(coupon.value.discount_percent),
        required_points: Number(coupon.value.required_points),
        completion_points: Number(coupon.value.completion_points),
      })
    } else if (kind === 'line') {
      await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/line-push', {
        enabled: line.value.enabled,
        push_to_id: line.value.push_to_id,
      })
    } else if (kind === 'chat-notify') {
      await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/chat-notify', {
        new_booking_enabled: chatNotify.value.new_booking_enabled,
        upcoming_admin_enabled: chatNotify.value.upcoming_admin_enabled,
        upcoming_customer_enabled: chatNotify.value.upcoming_customer_enabled,
        cancel_admin_enabled: chatNotify.value.cancel_admin_enabled,
        cancel_customer_enabled: chatNotify.value.cancel_customer_enabled,
        paid_admin_enabled: chatNotify.value.paid_admin_enabled,
        paid_customer_enabled: chatNotify.value.paid_customer_enabled,
        slip_admin_enabled: chatNotify.value.slip_admin_enabled,
        upcoming_minutes: Number(chatNotify.value.upcoming_minutes),
      })
    } else if (kind === 'unpaid') {
      await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/unpaid-auto-cancel', {
        enabled: unpaid.value.enabled,
        expire_hours: Number(unpaid.value.expire_hours),
      })
    } else if (kind === 'shop-hours') {
      await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/shop-hours', {
        open_hour: Number(shopHours.value.open_hour),
        last_booking_hour: Number(shopHours.value.last_booking_hour),
      })
    } else if (kind === 'advance-days') {
      await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/advance-days', {
        advance_days: Number(advanceDays.value),
      })
    } else if (kind === 'slot-display') {
      await Promise.all([
        shopAdminApi.patch(props.shopSlug, '/api/admin/settings/booking-display', {
          display_mode: slotDisplay.value.display_mode,
        }),
        shopAdminApi.patch(props.shopSlug, '/api/admin/settings/booking-slot-hours', {
          slot_hours: Number(slotDisplay.value.slot_hours),
        }),
        shopAdminApi.patch(props.shopSlug, '/api/admin/settings/extend-booking-by-services', {
          enabled: slotDisplay.value.enabled,
          past_close_enabled: slotDisplay.value.past_close_enabled,
        }),
        shopAdminApi.patch(props.shopSlug, '/api/admin/settings/booking-min-gap', {
          enabled: slotDisplay.value.min_gap_enabled,
          minutes: Number(slotDisplay.value.min_gap_minutes) || 60,
        }),
      ])
    } else if (kind === 'ui-fields' || kind === 'ui-section') {
      const payload = {}
      for (const field of uiFields.value) {
        payload[field.key] = uiInputToStored(uiForm.value[field.key], field)
      }
      await shopAdminApi.patch(props.shopSlug, '/api/admin/settings/ui', payload)
    } else {
      return
    }
    localMessage.value = 'บันทึกแล้ว'
    emit('saved', props.label)
  } catch (err) {
    localError.value = err.response?.data?.error || err.message || 'บันทึกไม่สำเร็จ'
    emit('error', localError.value)
  } finally {
    saving.value = false
  }
}

async function addClip() {
  const tiktok_url = String(clipForm.value.tiktok_url || '').trim()
  if (!tiktok_url) {
    localError.value = 'กรุณาวางลิงก์ TikTok หรือ Instagram'
    return
  }
  saving.value = true
  localError.value = ''
  try {
    await shopAdminApi.post(props.shopSlug, '/api/admin/showcase-clips', {
      tiktok_url,
      title: String(clipForm.value.title || '').trim(),
      is_active: Boolean(clipForm.value.is_active),
    })
    clipForm.value = { tiktok_url: '', title: '', is_active: true }
    await loadEditor()
    localMessage.value = 'เพิ่มคลิปแล้ว'
  } catch (err) {
    localError.value = err.response?.data?.error || 'เพิ่มคลิปไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

async function removeClip(item) {
  saving.value = true
  try {
    await shopAdminApi.delete(props.shopSlug, `/api/admin/showcase-clips/${item.id}`)
    await loadEditor()
    localMessage.value = 'ลบคลิปแล้ว'
  } catch (err) {
    localError.value = err.response?.data?.error || 'ลบไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

async function addLocation() {
  const name = String(locationForm.value.name || '').trim()
  if (!name) {
    localError.value = 'กรุณาระบุชื่อสถานที่'
    return
  }
  saving.value = true
  localError.value = ''
  try {
    await shopAdminApi.post(props.shopSlug, '/api/admin/service-locations', {
      name,
      color: locationForm.value.color || '#C4847A',
      description: String(locationForm.value.description || '').trim(),
      map_url: String(locationForm.value.map_url || '').trim(),
    })
    locationForm.value = { name: '', color: '#C4847A', description: '', map_url: '' }
    await loadEditor()
    localMessage.value = 'เพิ่มสถานที่แล้ว'
  } catch (err) {
    localError.value = err.response?.data?.error || 'เพิ่มไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

async function removeLocation(item) {
  saving.value = true
  try {
    await shopAdminApi.delete(props.shopSlug, `/api/admin/service-locations/${item.id}`)
    await loadEditor()
    localMessage.value = 'ลบสถานที่แล้ว'
  } catch (err) {
    localError.value = err.response?.data?.error || 'ลบไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

async function redeemCoupon() {
  const code = String(useCouponCode.value || '').trim().toUpperCase()
  if (!code) {
    localError.value = 'กรุณากรอกรหัสคูปอง'
    return
  }
  saving.value = true
  localError.value = ''
  try {
    const { data } = await shopAdminApi.patch(props.shopSlug, '/api/admin/coupons/use', {
      coupon_code: code,
    })
    useCouponCode.value = ''
    localMessage.value = data?.message || 'ใช้คูปองสำเร็จ'
  } catch (err) {
    localError.value = err.response?.data?.error || 'ใช้คูปองไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

const showSaveButton = computed(() =>
  !['none', 'note', 'reviews', 'service-locations', 'use-coupon', 'services'].includes(editor.value.kind)
)

watch(
  () => [props.shopSlug, props.setup, props.childKey, props.active],
  () => {
    if (props.active && props.shopSlug && props.setup) loadEditor()
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div v-if="shopSlug && setup" class="inline-settings">
    <header class="inline-settings-head">
      <h5 class="inline-settings-title">
        ตั้งค่า: {{ label || 'รายการ' }}
        <span class="muted inline-settings-branch">/{{ shopSlug }}</span>
      </h5>
    </header>

    <p v-if="localMessage" class="inline-settings-msg inline-settings-msg--ok">{{ localMessage }}</p>
    <p v-if="localError" class="inline-settings-msg inline-settings-msg--err">{{ localError }}</p>
    <div v-if="loading" class="state-card">
      <i class="ti ti-loader-2 state-card-icon" aria-hidden="true"></i>
      <span class="state-card-title">กำลังโหลด</span>
    </div>

    <div v-else-if="editor.kind === 'note'" class="inline-settings-note muted">
      {{ editor.note }}
    </div>

    <div v-else-if="editor.kind === 'deposit'" class="inline-settings-form admin-form-grid">
      <label>
        ยอดมัดจำ (บาท)
        <input v-model.number="depositAmount" type="number" min="1" class="admin-input" />
      </label>
    </div>

    <div v-else-if="editor.kind === 'coupon'" class="inline-settings-form admin-form-grid">
      <label>
        ส่วนลด (%)
        <input v-model.number="coupon.discount_percent" type="number" min="1" max="100" class="admin-input" />
      </label>
      <label>
        แต้มที่ใช้แลก
        <input v-model.number="coupon.required_points" type="number" min="1" class="admin-input" />
      </label>
      <label>
        แต้มเมื่อทำเสร็จ
        <input v-model.number="coupon.completion_points" type="number" min="0" class="admin-input" />
      </label>
    </div>

    <div v-else-if="editor.kind === 'line'" class="inline-settings-form">
      <AdminSwitch
        v-if="line.can_edit_enabled"
        v-model="line.enabled"
        label="เปิดแจ้งเตือน LINE"
      />
      <div class="admin-form-grid">
        <label style="grid-column:1/-1">
          User / Group ID
          <input v-model="line.push_to_id" type="text" class="admin-input" placeholder="Uxxxxxxxx หรือ Cxxxxxxxx" />
        </label>
      </div>
    </div>

    <div v-else-if="editor.kind === 'chat-notify'" class="inline-settings-form">
      <div class="admin-switch-group">
        <h5 class="admin-switch-group-title">แจ้งแอดมิน</h5>
        <div class="admin-switch-stack">
          <AdminSwitch v-model="chatNotify.new_booking_enabled" label="มีคิวจองใหม่" />
          <AdminSwitch v-model="chatNotify.upcoming_admin_enabled" label="ก่อนถึงคิว" />
          <AdminSwitch v-model="chatNotify.cancel_admin_enabled" label="คิวถูกยกเลิก" />
          <AdminSwitch v-model="chatNotify.paid_admin_enabled" label="ชำระเงินแล้ว" />
          <AdminSwitch v-model="chatNotify.slip_admin_enabled" label="มีสลิป" />
        </div>
      </div>
      <div class="admin-switch-group">
        <h5 class="admin-switch-group-title">แจ้งลูกค้า</h5>
        <div class="admin-switch-stack">
          <AdminSwitch v-model="chatNotify.upcoming_customer_enabled" label="ก่อนถึงคิว" />
          <AdminSwitch v-model="chatNotify.cancel_customer_enabled" label="คิวถูกยกเลิก" />
          <AdminSwitch v-model="chatNotify.paid_customer_enabled" label="ชำระเงินแล้ว" />
        </div>
      </div>
      <label class="inline-settings-minutes">
        แจ้งก่อนถึงคิว (นาที)
        <input v-model.number="chatNotify.upcoming_minutes" type="number" min="1" max="120" class="admin-input" />
      </label>
    </div>

    <div v-else-if="editor.kind === 'unpaid'" class="inline-settings-form">
      <AdminSwitch v-model="unpaid.enabled" label="ยกเลิกคิวรอชำระอัตโนมัติ" />
      <label>
        หมดเวลาหลัง (ชม.)
        <input v-model.number="unpaid.expire_hours" type="number" min="1" max="168" class="admin-input" />
      </label>
    </div>

    <div v-else-if="editor.kind === 'shop-hours'" class="inline-settings-form admin-form-grid">
      <label>
        เปิดร้าน (ชม.)
        <input v-model.number="shopHours.open_hour" type="number" min="0" max="23" class="admin-input" />
      </label>
      <label>
        รับจองถึง (ชม.)
        <input v-model.number="shopHours.last_booking_hour" type="number" min="0" max="23" class="admin-input" />
      </label>
    </div>

    <div v-else-if="editor.kind === 'advance-days'" class="inline-settings-form">
      <label>
        จองล่วงหน้าได้ (วัน)
        <input v-model.number="advanceDays" type="number" min="1" max="365" class="admin-input" />
      </label>
    </div>

    <div v-else-if="editor.kind === 'slot-display'" class="inline-settings-form">
      <div class="admin-form-grid">
        <label>
          ความยาวคิว (ชม.)
          <select v-model.number="slotDisplay.slot_hours" class="admin-input">
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
          </select>
        </label>
        <label>
          แสดงผล
          <select v-model="slotDisplay.display_mode" class="admin-input">
            <option value="normal">ปกติ</option>
            <option value="slots_2h">ช่อง 2 ชม.</option>
          </select>
        </label>
      </div>
      <AdminSwitch v-model="slotDisplay.enabled" label="ขยายเวลาตามระยะบริการ" />
      <AdminSwitch v-model="slotDisplay.past_close_enabled" label="ขยายเกินเวลาปิดได้" />
      <AdminSwitch v-model="slotDisplay.min_gap_enabled" label="เปิดจองช่องว่างระหว่างคิว" />
      <label v-if="slotDisplay.min_gap_enabled">
        ช่องว่างขั้นต่ำ (นาที)
        <input v-model.number="slotDisplay.min_gap_minutes" type="number" min="15" max="120" step="15" class="admin-input" />
      </label>
    </div>

    <div v-else-if="editor.kind === 'ui-fields' || editor.kind === 'ui-section'" class="inline-settings-form admin-form-grid">
      <template v-for="field in uiFields" :key="field.key">
        <AdminSwitch
          v-if="field.type === 'toggle'"
          v-model="uiForm[field.key]"
          :label="field.label"
          :hint="field.hint"
          style="grid-column:1/-1"
        />
        <label
          v-else
          :style="field.multiline ? 'grid-column:1/-1' : ''"
        >
          {{ field.label }}
          <input
            v-if="field.type === 'color'"
            v-model="uiForm[field.key]"
            type="color"
            class="admin-input admin-input-color"
          />
          <textarea
            v-else-if="field.multiline"
            v-model="uiForm[field.key]"
            class="admin-input"
            :rows="field.rows || 3"
            :placeholder="field.placeholder || ''"
          />
          <input
            v-else
            v-model="uiForm[field.key]"
            type="text"
            class="admin-input"
            :placeholder="field.placeholder || ''"
          />
          <span v-if="field.hint" class="muted inline-settings-hint">{{ field.hint }}</span>
        </label>
      </template>
    </div>

    <div v-else-if="editor.kind === 'reviews'" class="inline-settings-form">
      <div class="admin-form-grid">
        <label style="grid-column:1/-1">
          ลิงก์ TikTok / Instagram
          <input v-model="clipForm.tiktok_url" type="url" class="admin-input" placeholder="https://..." />
        </label>
        <label>
          ชื่อ (ไม่บังคับ)
          <input v-model="clipForm.title" type="text" class="admin-input" />
        </label>
        <AdminSwitch v-model="clipForm.is_active" label="แสดง" compact />
      </div>
      <button type="button" class="btn primary" :disabled="saving" @click="addClip">เพิ่มคลิป</button>
      <ul v-if="clips.length" class="inline-settings-list">
        <li v-for="item in clips" :key="item.id" class="inline-settings-list-row">
          <span>{{ item.title || item.tiktok_url }}</span>
          <button type="button" class="btn danger" :disabled="saving" @click="removeClip(item)">ลบ</button>
        </li>
      </ul>
      <p v-else class="muted">ยังไม่มีคลิปในสาขานี้</p>
    </div>

    <div v-else-if="editor.kind === 'service-locations'" class="inline-settings-form">
      <div class="admin-form-grid">
        <label>
          ชื่อสถานที่
          <input v-model="locationForm.name" type="text" class="admin-input" />
        </label>
        <label>
          สี
          <input v-model="locationForm.color" type="color" class="admin-input admin-input-color" />
        </label>
        <label style="grid-column:1/-1">
          รายละเอียด
          <input v-model="locationForm.description" type="text" class="admin-input" />
        </label>
        <label style="grid-column:1/-1">
          ลิงก์แผนที่
          <input v-model="locationForm.map_url" type="url" class="admin-input" placeholder="https://..." />
        </label>
      </div>
      <button type="button" class="btn primary" :disabled="saving" @click="addLocation">เพิ่มสถานที่</button>
      <ul v-if="locations.length" class="inline-settings-list">
        <li v-for="item in locations" :key="item.id" class="inline-settings-list-row">
          <span><span class="inline-settings-dot" :style="{ background: item.color }"></span>{{ item.name }}</span>
          <button type="button" class="btn danger" :disabled="saving" @click="removeLocation(item)">ลบ</button>
        </li>
      </ul>
    </div>

    <div v-else-if="editor.kind === 'use-coupon'" class="inline-settings-form">
      <label>
        รหัสคูปองลูกค้า
        <input v-model="useCouponCode" type="text" class="admin-input" placeholder="กรอกรหัสคูปอง" />
      </label>
      <button type="button" class="btn primary" :disabled="saving" @click="redeemCoupon">ยืนยันใช้คูปอง</button>
    </div>

    <div v-else-if="editor.kind === 'services'" class="inline-settings-form">
      <p class="muted inline-settings-hint" style="margin:0">
        บริการของสาขา <strong>/{{ shopSlug }}</strong> — เพิ่ม/แก้ไขได้ในหน้านี้ (บริการรายวันใช้แท็บบริการของสาขา)
      </p>
      <div class="admin-form-grid">
        <label style="grid-column:1/-1">
          ชื่อบริการ
          <input v-model="serviceForm.option_name" type="text" class="admin-input" placeholder="เช่น ทำเล็บเจล" />
        </label>
        <label>
          ราคา (บาท)
          <input v-model.number="serviceForm.price" type="number" min="0" class="admin-input" />
        </label>
        <label>
          ระยะเวลา (นาที)
          <input v-model.number="serviceForm.duration_min" type="number" min="0" class="admin-input" />
        </label>
        <label style="grid-column:1/-1">
          หมวดหมู่
          <select v-model="serviceForm.category_id" class="admin-input">
            <option value="">— ไม่ระบุ —</option>
            <option v-for="cat in serviceCategories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </label>
        <label style="grid-column:1/-1">
          รายละเอียด (ไม่บังคับ)
          <input v-model="serviceForm.description" type="text" class="admin-input" />
        </label>
        <AdminSwitch v-model="serviceForm.is_active" label="เปิดแสดง" />
        <AdminSwitch v-model="serviceForm.is_required" label="บังคับเลือก" />
      </div>
      <div class="inline-settings-actions inline-settings-actions--row">
        <button type="button" class="btn primary" :disabled="saving" @click="saveService">
          {{ serviceForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ' }}
        </button>
        <button
          v-if="serviceForm.id"
          type="button"
          class="btn ghost"
          :disabled="saving"
          @click="resetServiceForm"
        >
          ยกเลิกแก้ไข
        </button>
      </div>

      <ul v-if="serviceOptions.length" class="inline-settings-list inline-settings-list--services">
        <li v-for="item in serviceOptions" :key="item.id" class="inline-settings-list-row inline-settings-service-row">
          <div class="inline-settings-service-info">
            <strong>{{ item.option_name }}</strong>
            <span class="muted inline-settings-service-meta">
              {{ Number(item.price) }} บาท · {{ Number(item.duration_min) }} นาที
              <template v-if="item.category_name"> · {{ item.category_name }}</template>
              · {{ serviceDateHint(item) }}
            </span>
            <span v-if="!item.is_active" class="shop-inactive-badge">ปิด</span>
            <span v-if="item.is_required" class="inline-settings-required-badge">บังคับ</span>
          </div>
          <div class="inline-settings-service-actions">
            <button type="button" class="btn ghost" :disabled="saving" @click="startEditService(item)">แก้ไข</button>
            <button type="button" class="btn danger" :disabled="saving" @click="removeService(item)">ลบ</button>
          </div>
        </li>
      </ul>
      <p v-else class="muted">ยังไม่มีบริการในสาขานี้</p>
    </div>

    <div v-if="showSaveButton" class="inline-settings-actions">
      <button type="button" class="btn primary" :disabled="saving || loading" @click="saveEditor">
        {{ saving ? 'กำลังบันทึก...' : 'บันทึก' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.inline-settings {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--color-border);
}

.inline-settings-head {
  margin-bottom: 10px;
}

.inline-settings-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.inline-settings-branch {
  font-size: 12px;
  font-weight: 500;
}

.inline-settings-msg {
  margin: 0 0 8px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.inline-settings-msg--ok {
  background: color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent);
}

.inline-settings-msg--err {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
}

.inline-settings-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inline-settings-minutes {
  margin-top: 4px;
}

.inline-settings-hint {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}

.inline-settings-actions {
  margin-top: 12px;
}

.inline-settings-actions--row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inline-settings-list--services {
  margin-top: 16px;
}

.inline-settings-service-row {
  align-items: flex-start;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
}

@media (min-width: 520px) {
  .inline-settings-service-row {
    flex-direction: row;
    align-items: center;
  }
}

.inline-settings-service-info {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.inline-settings-service-meta {
  font-size: 12px;
  width: 100%;
}

.inline-settings-service-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.inline-settings-required-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary-dark);
}

.inline-settings-note {
  font-size: 13px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
}

.inline-settings-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}

.inline-settings-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.inline-settings-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.admin-input-color {
  padding: 2px;
  height: 40px;
}
</style>

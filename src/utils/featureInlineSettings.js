import { UI_FIELD_GROUPS } from '../constants/uiSettingsFields.js'

const UI_FIELD_META = Object.fromEntries(
  UI_FIELD_GROUPS.flatMap((group) =>
    group.fields.map((field) => [field.key, { ...field, groupTitle: group.title }])
  )
)

/** @returns {{ kind: string, fieldKeys?: string[], uiSectionTitle?: string, note?: string }} */
export function resolveInlineEditor(setup, childKey = '') {
  if (!setup) return { kind: 'none' }

  if (setup.settingsSection === 'deposit') return { kind: 'deposit' }
  if (setup.settingsSection === 'coupon') return { kind: 'coupon' }
  if (setup.settingsSection === 'line') return { kind: 'line' }
  if (setup.settingsSection === 'chat-notify') return { kind: 'chat-notify' }
  if (setup.settingsSection === 'unpaid') return { kind: 'unpaid' }
  if (setup.settingsSection === 'locations') return { kind: 'service-locations' }
  if (setup.settingsSection === 'use-coupon') return { kind: 'use-coupon' }

  if (setup.blocksSection === 'shop-hours') return { kind: 'shop-hours' }
  if (setup.blocksSection === 'advance') return { kind: 'advance-days' }
  if (setup.blocksSection === 'slot-display') return { kind: 'slot-display' }
  if (setup.blocksSection === 'day-hours') {
    return { kind: 'note', note: 'ตั้งเวลาเฉพาะวันใช้ปฏิทินในแท็บเวลา — ฟอร์มย่อนี้ยังไม่รองรับ' }
  }
  if (setup.blocksSection === 'bulk' || setup.blocksSection === 'calendar') {
    return { kind: 'note', note: 'ปิดวัน/ปิดหลายวันใช้ปฏิทิน — ฟอร์มย่อนี้ยังไม่รองรับ' }
  }

  if (setup.tab === 'reviews') return { kind: 'reviews' }
  if (setup.tab === 'services') return { kind: 'services' }
  if (setup.tab === 'bookings' || setup.tab === 'revenue') {
    return { kind: 'note', note: 'ข้อมูลในแท็บนี้มีหลายรายการ — ใช้เมนูแอดมินของสาขาเพื่อจัดการเต็มรูปแบบ' }
  }
  if (setup.tab === 'users' || setup.tab === 'renewal' || setup.tab === 'manual') {
    return { kind: 'note', note: 'หัวข้อนี้ยังไม่มีฟอร์มย่อในหน้านี้' }
  }

  if (setup.uiSectionTitle) {
    return { kind: 'ui-section', uiSectionTitle: setup.uiSectionTitle }
  }

  return { kind: 'note', note: 'ยังไม่มีฟอร์มตั้งค่าในหน้านี้' }
}

export function uiFieldsForEditor(editor) {
  if (editor.kind === 'ui-fields' && editor.fieldKeys?.length) {
    return editor.fieldKeys
      .map((key) => UI_FIELD_META[key])
      .filter(Boolean)
  }
  if (editor.kind === 'ui-section' && editor.uiSectionTitle) {
    const group = UI_FIELD_GROUPS.find((g) => g.title === editor.uiSectionTitle)
    return group?.fields?.filter((f) => !f.hideInAdmin) || []
  }
  return []
}

export function uiValueToInput(value, field) {
  if (field?.type === 'toggle') {
    return value === '1' || value === 1 || value === true
  }
  return value ?? ''
}

export function uiInputToStored(value, field) {
  if (field?.type === 'toggle') {
    return value ? '1' : '0'
  }
  return String(value ?? '')
}

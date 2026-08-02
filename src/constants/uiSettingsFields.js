export function formatUiText(template, vars = {}) {
  if (!template) return ''
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (vars[key] == null) return ''
    return String(vars[key])
  })
}

export const UI_FIELD_GROUPS = [
  {
    title: 'แบรนด์ & รูปภาพ',
    hint: 'URL รูปต้องเป็นลิงก์ไฟล์โดยตรง (ลงท้าย .jpg/.png หรือ i.ibb.co/...) — อย่าใช้ลิงก์หน้า ibb.co',
    fields: [
      { key: 'ui_brand_main', label: 'ชื่อแบรนด์ (ส่วนหลัก)', placeholder: 'Nail' },
      { key: 'ui_brand_accent', label: 'ชื่อแบรนด์ (ส่วนเน้น)', placeholder: 'Thuean' },
      { key: 'ui_tagline', label: 'คำโปรย', placeholder: 'จองคิวง่าย · สะสมแต้ม' },
      { key: 'ui_page_title', label: 'ชื่อแท็บเบราว์เซอร์', placeholder: 'Nail Thuean' },
      { key: 'ui_logo_url', label: 'URL โลโก้', placeholder: 'https://i.ibb.co/xxx/logo.png' },
      { key: 'ui_hero_image_url', label: 'URL ภาพปก Login', placeholder: 'https://i.ibb.co/xxx/hero.jpg' },
    ],
  },
  {
    title: 'ชำระเงิน & LINE',
    hint: 'ใช้ {bookingId} {date} {start} {end} {amount} {hours} ในข้อความ LINE ได้',
    fields: [
      { key: 'ui_payment_page_title', label: 'หัวข้อหน้าชำระเงิน' },
      { key: 'ui_line_chat_url', label: 'ลิงก์ LINE (เปิดแชท)' },
      { key: 'ui_bank_name', label: 'ชื่อธนาคาร' },
      { key: 'ui_bank_account_name', label: 'ชื่อบัญชี' },
      { key: 'ui_bank_account_no', label: 'เลขบัญชี' },
      { key: 'ui_promptpay_id', label: 'PromptPay / เบอร์โทร' },
      { key: 'ui_thai_qr_label', label: 'ข้อความใต้ QR' },
      { key: 'ui_line_button_label', label: 'ปุ่มส่งสลิป LINE' },
      {
        key: 'ui_line_message_template',
        label: 'ข้อความ LINE (template)',
        multiline: true,
        rows: 5,
      },
      { key: 'ui_payment_notice_off', label: 'แจ้งเตือนชำระ (ปิดตัวจับเวลา)', multiline: true, rows: 2 },
      {
        key: 'ui_payment_notice_timer',
        label: 'แจ้งเตือนชำระ (มีตัวจับเวลา — ใช้ {hours})',
        multiline: true,
        rows: 2,
      },
      { key: 'ui_payment_hint', label: 'คำแนะนำหลังส่งสลิป', multiline: true, rows: 2 },
      { key: 'ui_payment_expired', label: 'คิวหมดเวลาชำระ' },
      { key: 'ui_payment_not_awaiting', label: 'คิวไม่รอชำระแล้ว' },
      { key: 'ui_qr_not_configured', label: 'ยังไม่ตั้ง PromptPay' },
      { key: 'ui_qr_generate_failed', label: 'สร้าง QR ไม่สำเร็จ' },
      { key: 'ui_copy_account_hint', label: 'คำใบ้คัดลอกเลขบัญชี' },
      { key: 'ui_copy_success', label: 'คัดลอกสำเร็จ' },
    ],
  },
  {
    title: 'ข้อความจองคิว',
    fields: [
      { key: 'ui_booking_success_title', label: 'จองสำเร็จ — หัวข้อ' },
      { key: 'ui_booking_success_text', label: 'จองสำเร็จ — ข้อความ', multiline: true, rows: 2 },
      { key: 'ui_booking_success_btn', label: 'จองสำเร็จ — ปุ่ม' },
      { key: 'ui_booking_fail_title', label: 'จองไม่สำเร็จ — หัวข้อ' },
      { key: 'ui_cancel_confirm_title', label: 'ยืนยันยกเลิก — หัวข้อ' },
      { key: 'ui_cancel_confirm_text', label: 'ยืนยันยกเลิก — ข้อความ' },
      { key: 'ui_cancel_success_title', label: 'ยกเลิกสำเร็จ — หัวข้อ' },
      { key: 'ui_cancel_fail_title', label: 'ยกเลิกไม่สำเร็จ — หัวข้อ' },
      { key: 'ui_points_banner', label: 'แบนเนอร์แต้ม', multiline: true, rows: 2 },
      { key: 'ui_closed_day_error', label: 'ร้านปิดทั้งวัน' },
      { key: 'ui_no_services_today', label: 'ไม่มีบริการวันนี้' },
      { key: 'ui_date_nav_hint', label: 'คำใบ้เลื่อนดูวัน' },
      { key: 'ui_no_open_days', label: 'ไม่มีวันเปิดรับคิว' },
      { key: 'ui_slot_taken_error', label: 'เวลาถูกจองแล้ว' },
    ],
  },
  {
    title: 'หน้าอื่นๆ',
    fields: [
      { key: 'ui_profile_title', label: 'หัวข้อหน้าบัญชี' },
      { key: 'ui_profile_subtitle', label: 'คำบรรยายหน้าบัญชี' },
      { key: 'ui_reviews_title', label: 'หัวข้อหน้ารีวิว' },
      { key: 'ui_reviews_subtitle', label: 'คำบรรยายหน้ารีวิว' },
      { key: 'ui_reviews_empty', label: 'ไม่มีคลิปรีวิว' },
      { key: 'ui_reviews_empty_hint', label: 'คำใบ้ไม่มีคลิป' },
      { key: 'ui_shop_picker_title', label: 'หัวข้อเลือกร้าน' },
      { key: 'ui_shop_picker_subtitle', label: 'คำบรรยายเลือกร้าน' },
    ],
  },
  {
    title: 'สีธีม',
    hint: 'สีหลักของแอป (hex เช่น #C4847A)',
    fields: [
      { key: 'ui_color_primary', label: 'สีหลัก', type: 'color' },
      { key: 'ui_color_primary_dark', label: 'สีหลักเข้ม', type: 'color' },
      { key: 'ui_color_primary_light', label: 'สีหลักอ่อน', type: 'color' },
    ],
  },
]

import { ref } from 'vue'
import Swal from 'sweetalert2'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'

export function useCoupons() {
  const auth = useAuthStore()
  const myCoupons = ref([])

  async function loadMyCoupons() {
    try {
      const { data } = await api.get('/api/coupons/my')
      myCoupons.value = (data || []).filter((c) => !c.is_used)
    } catch {
      myCoupons.value = []
    }
  }

  async function redeemCoupon() {
    const result = await Swal.fire({
      title: 'แลกคูปองลด 20%',
      text: 'ใช้ 100 แต้มเพื่อแลกคูปอง 1 ใบ ใช่หรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'แลกคูปอง',
      cancelButtonText: 'ยกเลิก',
    })
    if (!result.isConfirmed) return
    try {
      const { data } = await api.post('/api/coupons/redeem')
      await auth.fetchMe()
      await loadMyCoupons()
      await Swal.fire({
        title: 'แลกคูปองสำเร็จ',
        html: `รหัสคูปองของคุณ:<br><strong style="font-size:22px">${data?.coupon?.coupon_code || '-'}</strong>`,
        icon: 'success',
      })
    } catch (error) {
      await Swal.fire({
        title: 'แลกคูปองไม่สำเร็จ',
        text: error?.response?.data?.error || 'เกิดข้อผิดพลาด',
        icon: 'error',
      })
    }
  }

  async function showMyCoupons() {
    await loadMyCoupons()
    const html = myCoupons.value.length
      ? myCoupons.value.map((c) =>
          `<div style="padding:8px 0;border-bottom:1px solid #eee;text-align:left">
            <strong>${c.coupon_code}</strong><br/>ส่วนลด ${c.discount_percent}%
          </div>`).join('')
      : '<p>ยังไม่มีคูปอง</p>'
    await Swal.fire({
      title: 'คูปองของฉัน',
      html: `<div style="max-height:240px;overflow:auto">${html}</div>`,
      confirmButtonText: 'ปิด',
    })
  }

  return {
    myCoupons,
    loadMyCoupons,
    redeemCoupon,
    showMyCoupons,
  }
}

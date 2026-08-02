import { ref, computed } from 'vue'
import Swal from 'sweetalert2'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'

const DEFAULT_COUPON = {
  discountPercent: 20,
  requiredPoints: 100,
}

export function useCoupons() {
  const auth = useAuthStore()
  const myCoupons = ref([])
  const couponSettings = ref({ ...DEFAULT_COUPON })
  const settingsLoaded = ref(false)

  const canRedeem = computed(
    () => Number(auth.user?.total_points ?? 0) >= couponSettings.value.requiredPoints
  )

  async function loadCouponSettings() {
    try {
      const { data } = await api.get('/api/coupons/settings')
      couponSettings.value = {
        discountPercent: Number(data?.discount_percent) || DEFAULT_COUPON.discountPercent,
        requiredPoints: Number(data?.required_points) || DEFAULT_COUPON.requiredPoints,
      }
      settingsLoaded.value = true
    } catch {
      couponSettings.value = { ...DEFAULT_COUPON }
    }
  }

  async function loadMyCoupons() {
    try {
      const { data } = await api.get('/api/coupons/my')
      myCoupons.value = (data || []).filter((c) => !c.is_used)
    } catch {
      myCoupons.value = []
    }
  }

  async function ensureCouponSettings() {
    if (!settingsLoaded.value) await loadCouponSettings()
  }

  async function redeemCoupon() {
    await ensureCouponSettings()
    const { discountPercent, requiredPoints } = couponSettings.value
    const result = await Swal.fire({
      title: `แลกคูปองลด ${discountPercent}%`,
      text: `ใช้ ${requiredPoints.toLocaleString('th-TH')} แต้มเพื่อแลกคูปอง 1 ใบ ใช่หรือไม่?`,
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
      const pct = data?.coupon?.discount_percent ?? discountPercent
      await Swal.fire({
        title: 'แลกคูปองสำเร็จ',
        html: `รหัสคูปองของคุณ:<br><strong style="font-size:22px">${data?.coupon?.coupon_code || '-'}</strong><br><span style="color:#64748b">ส่วนลด ${pct}%</span>`,
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
    couponSettings,
    canRedeem,
    loadCouponSettings,
    loadMyCoupons,
    redeemCoupon,
    showMyCoupons,
  }
}

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useShopStore } from '../stores/shop'
import { useUiSettingsStore } from '../stores/uiSettings'

import ShopPickerView from '../views/ShopPickerView.vue'
import LoginView from '../views/LoginView.vue'
import BookingView from '../views/BookingView.vue'
import ProfileView from '../views/ProfileView.vue'
import ReviewsView from '../views/ReviewsView.vue'
import AdminView from '../views/AdminView.vue'
import PaymentView from '../views/PaymentView.vue'
import ChatView from '../views/ChatView.vue'
import { dismissBlockingOverlays, scheduleOverlayCleanup } from '../utils/dismissBlockingOverlays'
import { releaseAllBodyScrollLocks } from '../utils/bodyScrollLock'

const shopChildren = [
  { path: 'login', component: LoginView, meta: { guest: true } },
  { path: 'register-shop', component: () => import('../views/RegisterShopView.vue'), meta: { registerShop: true } },
  { path: 'bookings', component: BookingView, meta: { requiresAuth: true } },
  { path: 'reviews', component: ReviewsView, meta: { requiresAuth: true } },
  { path: 'chat', component: ChatView, meta: { requiresAuth: true } },
  { path: 'profile', component: ProfileView, meta: { requiresAuth: true } },
  { path: 'payment/:bookingId', component: PaymentView, meta: { requiresAuth: true } },
  { path: 'admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: 'auth/callback', component: LoginView, meta: { guest: true } },
  { path: '', redirect: (to) => ({ path: `/${to.params.shopSlug}/bookings` }) },
]

const router = createRouter({
  history: createWebHistory(),
  // iOS PWA restores stale scroll offsets on back navigation, which leaves the
  // sticky header pushed off-screen and swallows taps until the user scrolls.
  scrollBehavior() {
    return { left: 0, top: 0 }
  },
  routes: [
    { path: '/', component: ShopPickerView },
    {
      path: '/:shopSlug',
      children: shopChildren,
    },
    // Legacy redirects
    { path: '/login', redirect: '/default/login' },
    { path: '/bookings', redirect: '/default/bookings' },
    { path: '/reviews', redirect: '/default/reviews' },
    { path: '/chat', redirect: '/default/chat' },
    { path: '/profile', redirect: '/default/profile' },
    { path: '/admin', redirect: '/default/admin' },
    { path: '/auth/callback', redirect: '/default/auth/callback' },
    { path: '/register-shop', redirect: '/default/register-shop' },
    { path: '/payment/:bookingId', redirect: (to) => `/default/payment/${to.params.bookingId}` },
  ],
})

function shopPath(shopSlug, suffix) {
  return `/${shopSlug}${suffix}`
}

router.beforeEach(async (to) => {
  releaseAllBodyScrollLocks()
  dismissBlockingOverlays()
  const auth = useAuthStore()
  const shopStore = useShopStore()
  const uiStore = useUiSettingsStore()
  const shopSlug = to.params.shopSlug

  if (shopSlug) {
    if (shopStore.slug !== shopSlug || !shopStore.shop) {
      try {
        await shopStore.loadShop(shopSlug)
      } catch {
        return '/'
      }
    }
    if (!uiStore.loadedForSlug || uiStore.loadedForSlug !== shopSlug) {
      await uiStore.fetch(shopStore.shopName).catch(() => null)
    }

    if (shopStore.shop?.usage_expired) {
      const isAdminPath = to.path.endsWith('/admin')
      if (!isAdminPath) {
        if (auth.token && !auth.user) {
          await auth.fetchMe().catch(() => null)
        }
        const canAdmin = auth.canAccessShopAdmin(shopSlug)
        if (!canAdmin && !to.meta.guest && !to.meta.registerShop) {
          shopStore.error = 'สาขานี้หมดระยะเวลาใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ'
          return shopPath(shopSlug, '/login')
        }
      }
    }
  }

  if (auth.token && !auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      if (shopSlug) return shopPath(shopSlug, '/login')
      return '/'
    }
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    if (shopSlug) return shopPath(shopSlug, '/login')
    return '/'
  }
  if (to.meta.requiresAdmin && !auth.canAccessShopAdmin(shopSlug)) {
    if (shopSlug) return shopPath(shopSlug, '/bookings')
    return '/'
  }
  if (to.meta.guest && auth.isLoggedIn && !to.meta.registerShop) {
    if (shopSlug) return shopPath(shopSlug, '/bookings')
    return '/'
  }

  return true
})

router.afterEach(() => {
  releaseAllBodyScrollLocks()
  dismissBlockingOverlays()
  scheduleOverlayCleanup()
  window.scrollTo(0, 0)
})

export default router

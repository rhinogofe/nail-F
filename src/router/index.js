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

const shopChildren = [
  { path: 'login', component: LoginView, meta: { guest: true } },
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
    { path: '/payment/:bookingId', redirect: (to) => `/default/payment/${to.params.bookingId}` },
  ],
})

function shopPath(shopSlug, suffix) {
  return `/${shopSlug}${suffix}`
}

router.beforeEach(async (to) => {
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
      await uiStore.fetch().catch(() => null)
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
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    if (shopSlug) return shopPath(shopSlug, '/bookings')
    return '/'
  }
  if (to.meta.requiresAdmin && auth.isAdmin && shopSlug && !auth.canAccessShopAdmin(shopSlug)) {
    const redirectSlug = auth.primaryAdminShopSlug
    if (redirectSlug && redirectSlug !== shopSlug) {
      return shopPath(redirectSlug, '/admin')
    }
    if (shopSlug) return shopPath(shopSlug, '/bookings')
    return '/'
  }
  if (to.meta.guest && auth.isLoggedIn) {
    if (shopSlug) return shopPath(shopSlug, '/bookings')
    return '/'
  }

  return true
})

export default router

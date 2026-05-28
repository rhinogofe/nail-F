import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import LoginView from '../views/LoginView.vue'
import BookingView from '../views/BookingView.vue'
import AdminView from '../views/AdminView.vue'
import PaymentView from '../views/PaymentView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/bookings' },
    { path: '/login', component: LoginView, meta: { guest: true } },
    { path: '/bookings', component: BookingView, meta: { requiresAuth: true } },
    { path: '/payment/:bookingId', component: PaymentView, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/auth/callback', component: LoginView, meta: { guest: true } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.token && !auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      return '/login'
    }
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
  if (to.meta.requiresAdmin && !auth.isAdmin) return '/bookings'
  if (to.meta.guest && auth.isLoggedIn) return '/bookings'

  return true
})

export default router

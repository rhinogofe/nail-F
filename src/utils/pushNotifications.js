import api from '../api/axios'
import { getFirebaseVapidKey, getFirebaseWebConfig, isFirebaseConfigured } from '../utils/firebaseConfig'

const SW_PATH = '/firebase-messaging-sw.js'
const TOKEN_STORAGE_KEY = 'fcmToken'
export const PUSH_DEVICE_STATUS_EVENT = 'push-device-status-changed'
export const FCM_PUSH_RECEIVED_EVENT = 'fcm-push-received'

let messagingInstance = null
let firebaseMessagingModule = null

async function loadFirebaseMessagingModule() {
  if (firebaseMessagingModule) return firebaseMessagingModule
  const [appMod, messagingMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ])
  firebaseMessagingModule = { ...appMod, ...messagingMod }
  return firebaseMessagingModule
}

function canUseBrowserPush() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
}

async function waitForServiceWorkerRegistration() {
  let registration = await navigator.serviceWorker.getRegistration('/')
  if (registration?.active) return registration

  registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
  if (registration.installing) {
    await new Promise((resolve) => {
      registration.installing.addEventListener('statechange', (event) => {
        if (event.target.state === 'activated') resolve()
      })
    })
  } else if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  } else if (!registration.active) {
    await new Promise((resolve) => {
      const worker = registration.installing || registration.waiting
      if (!worker) {
        resolve()
        return
      }
      worker.addEventListener('statechange', (event) => {
        if (event.target.state === 'activated') resolve()
      })
    })
  }
  await registration.update().catch(() => {})
  return registration
}

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance
  if (!isFirebaseConfigured()) return null

  const { initializeApp, getApps, getMessaging, isSupported } = await loadFirebaseMessagingModule()
  if (!(await isSupported())) return null

  const apps = getApps()
  const app = apps.length ? apps[0] : initializeApp(getFirebaseWebConfig())
  messagingInstance = getMessaging(app)
  return messagingInstance
}

function notifyPushDeviceStatusChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PUSH_DEVICE_STATUS_EVENT))
}

export async function detectPushSupport() {
  if (!canUseBrowserPush()) {
    return { supported: false, reason: 'browser' }
  }
  if (!isFirebaseConfigured()) {
    return { supported: false, reason: 'config' }
  }
  const { isSupported } = await loadFirebaseMessagingModule()
  if (!(await isSupported())) {
    return { supported: false, reason: 'unsupported' }
  }
  return { supported: true, reason: null }
}

export async function fetchPushStatus() {
  const support = await detectPushSupport()
  if (!support.supported) {
    return { configured: isFirebaseConfigured(), enabled: false, ...support }
  }

  if (Notification.permission !== 'granted' && getStoredFcmToken()) {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    notifyPushDeviceStatusChanged()
  }

  try {
    const localToken = getStoredFcmToken()
    const { data } = await api.get('/api/push/status', {
      params: localToken ? { token: localToken } : {},
    })
    const deviceEnabled = Boolean(localToken) && Boolean(data?.enabled)
    return {
      configured: Boolean(data?.configured),
      enabled: deviceEnabled,
      supported: true,
      reason: null,
      is_super_admin: Boolean(data?.is_super_admin),
      receive_all_shop_push: Boolean(data?.receive_all_shop_push),
    }
  } catch {
    return {
      configured: isFirebaseConfigured(),
      enabled: false,
      supported: true,
      reason: null,
      is_super_admin: false,
      receive_all_shop_push: false,
    }
  }
}

export async function updateReceiveAllShopPush(enabled) {
  const { data } = await api.patch('/api/push/preferences', {
    receive_all_shop_push: Boolean(enabled),
  })
  return data
}

export function getStoredFcmToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function isPushEnabledOnDevice() {
  return Boolean(getStoredFcmToken())
}

function buildNotificationTag(payload) {
  const messageId = payload?.data?.messageId || payload?.data?.message_id || ''
  const bookingId = payload?.data?.bookingId || payload?.data?.booking_id || ''
  if (messageId) return `nail-msg-${messageId}`
  if (bookingId) return `nail-booking-${bookingId}`
  return `nail-push-${Date.now()}`
}

async function syncTokenWithBackend(token, enabled) {
  await api.post('/api/push/token', { token, enabled })
}

// FCM rotates tokens (SW update, long idle, browser upgrade) and the backend
// hard-deletes tokens FCM reports as unregistered. Without a re-sync the device
// stays silent until the user toggles push off/on, so re-register on every
// app start and whenever the app comes back to the foreground.
const RESYNC_THROTTLE_MS = 15 * 60 * 1000
let lastResyncAt = 0
let resyncInFlight = null
let autoSyncAttached = false

export async function resyncPushToken({ force = false } = {}) {
  if (!canUseBrowserPush()) return null

  const stored = getStoredFcmToken()
  if (!stored) return null

  if (Notification.permission !== 'granted') {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    stopPushNotificationListener()
    notifyPushDeviceStatusChanged()
    return null
  }

  const now = Date.now()
  if (!force && now - lastResyncAt < RESYNC_THROTTLE_MS) return stored
  if (resyncInFlight) return resyncInFlight

  resyncInFlight = (async () => {
    try {
      await waitForServiceWorkerRegistration()
      const messaging = await getMessagingInstance()
      if (!messaging) return null

      const { getToken } = await loadFirebaseMessagingModule()
      const token = await getToken(messaging, { vapidKey: getFirebaseVapidKey() })
      if (!token) return null

      if (token !== getStoredFcmToken()) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token)
        notifyPushDeviceStatusChanged()
      }
      await syncTokenWithBackend(token, true)
      lastResyncAt = Date.now()
      return token
    } catch {
      return null
    } finally {
      resyncInFlight = null
    }
  })()

  return resyncInFlight
}

function attachPushTokenAutoSync() {
  if (autoSyncAttached || typeof window === 'undefined') return
  autoSyncAttached = true

  const onResume = () => {
    if (document.visibilityState !== 'visible') return
    void resyncPushToken()
  }
  document.addEventListener('visibilitychange', onResume)
  window.addEventListener('focus', onResume)
}

export async function enableBrowserPush() {
  const support = await detectPushSupport()
  if (!support.supported) {
    throw new Error('อุปกรณ์นี้ยังไม่รองรับการแจ้งเตือนนอกแอป')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('ไม่ได้รับอนุญาตแจ้งเตือน — เปิดได้ใน Settings ของเบราว์เซอร์')
  }

  await waitForServiceWorkerRegistration()
  const messaging = await getMessagingInstance()
  if (!messaging) {
    throw new Error('ตั้งค่า Firebase ไม่ครบ')
  }

  const { getToken } = await loadFirebaseMessagingModule()
  const token = await getToken(messaging, { vapidKey: getFirebaseVapidKey() })
  if (!token) {
    throw new Error('ขอ token แจ้งเตือนไม่สำเร็จ')
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  await syncTokenWithBackend(token, true)
  lastResyncAt = Date.now()
  notifyPushDeviceStatusChanged()
  await startPushNotificationListener()
  attachPushTokenAutoSync()
  return token
}

export async function disableBrowserPush() {
  const token = getStoredFcmToken()
  stopPushNotificationListener()
  lastResyncAt = 0
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  notifyPushDeviceStatusChanged()
  try {
    await api.post('/api/push/disable', token ? { token } : {})
  } catch {
    /* keep local off even if network fails */
  }
}

// A notification for the exact conversation the user is currently reading is
// pure noise, so skip it there — everywhere else the notification still fires.
function isAlreadyViewing(url, payload) {
  if (typeof window === 'undefined' || document.visibilityState !== 'visible') return false
  try {
    const target = new URL(url, window.location.origin)
    if (target.pathname !== window.location.pathname) return false
    const pushTarget = payload?.data?.target || ''
    if (pushTarget === 'customer') {
      return target.pathname.endsWith('/chat')
    }
    const targetUser = target.searchParams.get('userId') || ''
    const currentUser = new URLSearchParams(window.location.search).get('userId') || ''
    return targetUser === currentUser
  } catch {
    return false
  }
}

export async function showOsNotificationFromPayload(payload) {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return

  const title = payload?.notification?.title || payload?.data?.title || 'แจ้งเตือน'
  const body = payload?.notification?.body || payload?.data?.body || ''
  const url = payload?.data?.url || payload?.fcmOptions?.link || '/'

  if (isAlreadyViewing(url, payload)) return
  const options = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: buildNotificationTag(payload),
    renotify: false,
    data: { url },
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, options)
    return
  } catch {
    /* fall through */
  }

  try {
    new Notification(title, options)
  } catch {
    /* ignore */
  }
}

let foregroundUnsubscribe = null

export function stopPushNotificationListener() {
  foregroundUnsubscribe?.()
  foregroundUnsubscribe = null
}

export async function startPushNotificationListener() {
  stopPushNotificationListener()

  if (!canUseBrowserPush() || Notification.permission !== 'granted') {
    return () => {}
  }

  await waitForServiceWorkerRegistration()
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}

  const { onMessage } = await loadFirebaseMessagingModule()
  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    window.dispatchEvent(new CustomEvent(FCM_PUSH_RECEIVED_EVENT, { detail: payload }))
    void showOsNotificationFromPayload(payload)
  })

  return () => {
    stopPushNotificationListener()
  }
}


export async function ensurePushTokenRegistered() {
  if (!canUseBrowserPush()) return null
  if (Notification.permission !== 'granted') {
    if (getStoredFcmToken()) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      notifyPushDeviceStatusChanged()
    }
    return null
  }
  if (!getStoredFcmToken()) return null

  await resyncPushToken({ force: true })
  await startPushNotificationListener()
  attachPushTokenAutoSync()
  return getStoredFcmToken()
}

export function initPushNotificationsWhenReady() {
  if (!canUseBrowserPush() || !getStoredFcmToken()) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const run = () => {
      initPushNotificationsWhenReadyImpl()
        .then(resolve)
        .catch(() => resolve(null))
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2500 })
    } else {
      setTimeout(run, 800)
    }
  })
}

async function initPushNotificationsWhenReadyImpl() {
  await waitForServiceWorkerRegistration()
  await ensurePushTokenRegistered()
  return () => {
    stopPushNotificationListener()
  }
}

export async function ensurePushServiceWorker() {
  if (!canUseBrowserPush() || !getStoredFcmToken()) return null
  try {
    return await waitForServiceWorkerRegistration()
  } catch {
    return null
  }
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export function getPushHelpText(status) {
  if (status.reason === 'config') {
    return 'ระบบ push ยังไม่ได้ตั้งค่า'
  }
  if (status.reason === 'browser') {
    return 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน'
  }
  if (status.reason === 'unsupported') {
    return 'อุปกรณ์นี้ยังไม่รองรับ Web Push'
  }
  if (isIosDevice() && !isStandalonePwa()) {
    return 'iPhone: กด Share → เพิ่มลงหน้าจอหลัก แล้วเปิดจากไอคอนแอป'
  }
  if (isIosDevice()) {
    return 'iPhone: แจ้งที่หน้าจอล็อก/ศูนย์แจ้งเตือน — ลองปิดแอปหรือล็อกหน้าจอก่อนทดสอบ'
  }
  return 'แจ้งที่หน้าจอล็อก/ศูนย์แจ้งเตือนเมื่อมีข้อความหรือการจองใหม่'
}

import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import api from '../api/axios'
import { getFirebaseVapidKey, getFirebaseWebConfig, isFirebaseConfigured } from '../utils/firebaseConfig'

const SW_PATH = '/firebase-messaging-sw.js'
const TOKEN_STORAGE_KEY = 'fcmToken'

let messagingInstance = null

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
  return registration
}

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance
  if (!isFirebaseConfigured()) return null
  if (!(await isSupported())) return null

  const apps = getApps()
  const app = apps.length ? apps[0] : initializeApp(getFirebaseWebConfig())
  messagingInstance = getMessaging(app)
  return messagingInstance
}

export async function detectPushSupport() {
  if (!canUseBrowserPush()) {
    return { supported: false, reason: 'browser' }
  }
  if (!isFirebaseConfigured()) {
    return { supported: false, reason: 'config' }
  }
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
    }
  } catch {
    return { configured: isFirebaseConfigured(), enabled: false, supported: true, reason: null }
  }
}

export function getStoredFcmToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

async function syncTokenWithBackend(token, enabled) {
  await api.post('/api/push/token', { token, enabled })
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

  const token = await getToken(messaging, { vapidKey: getFirebaseVapidKey() })
  if (!token) {
    throw new Error('ขอ token แจ้งเตือนไม่สำเร็จ')
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  await syncTokenWithBackend(token, true)
  await startPushNotificationListener()
  return token
}

export async function disableBrowserPush() {
  const token = getStoredFcmToken()
  stopPushNotificationListener()
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  try {
    await api.post('/api/push/disable', token ? { token } : {})
  } catch {
    /* keep local off even if network fails */
  }
}

export async function showOsNotificationFromPayload(payload) {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return

  const title = payload?.notification?.title || payload?.data?.title || 'แจ้งเตือน'
  const body = payload?.notification?.body || payload?.data?.body || ''
  const url = payload?.data?.url || payload?.fcmOptions?.link || '/'
  const messageId = payload?.data?.messageId || payload?.data?.message_id || ''
  const options = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: messageId ? `nail-msg-${messageId}` : `nail-push-${Date.now()}`,
    renotify: true,
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

  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    showOsNotificationFromPayload(payload)
  })

  return () => {
    stopPushNotificationListener()
  }
}

export function showOsNotificationForChatItem({
  title,
  body,
  url,
  messageId,
}) {
  return showOsNotificationFromPayload({
    notification: { title, body },
    data: {
      title,
      body,
      url,
      messageId: messageId ? String(messageId) : '',
    },
  })
}

export async function initPushNotificationsWhenReady() {
  if (!canUseBrowserPush() || Notification.permission !== 'granted') return null
  if (!getStoredFcmToken()) return null
  await waitForServiceWorkerRegistration()
  return startPushNotificationListener()
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
  return 'แจ้งทั้งในเว็บและมุมจอ แม้เปิดแอปอยู่'
}

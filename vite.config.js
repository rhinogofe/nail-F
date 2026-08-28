import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_APP_NAME,
  buildShopManifest,
  manifestResponseHeaders,
  parseManifestSlug,
} from './shared/shopManifestBuilder.js'

function buildFirebaseServiceWorkerSource(env) {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
  }

  return `importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();
const iconUrl = self.location.origin + '/favicon.svg';

function buildNotificationOptions(payload) {
  const title = payload.notification?.title || payload.data?.title || 'แจ้งเตือน';
  const body = payload.notification?.body || payload.data?.body || '';
  const url = payload.data?.url || payload.fcmOptions?.link || '/';
  const messageId = payload.data?.messageId || payload.data?.message_id || '';
  const bookingId = payload.data?.bookingId || payload.data?.booking_id || '';
  const tag = messageId
    ? 'nail-msg-' + messageId
    : bookingId
      ? 'nail-booking-' + bookingId
      : 'nail-push-' + Date.now();
  return {
    title,
    options: {
      body,
      icon: iconUrl,
      badge: iconUrl,
      tag,
      renotify: false,
      data: { url },
    },
  };
}

messaging.onBackgroundMessage((payload) => {
  // Avoid double notifications when the browser already surfaced one.
  if (payload.notification?.title) return;
  const built = buildNotificationOptions(payload);
  return self.registration.showNotification(built.title, built.options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || '/';
  const targetUrl = raw.startsWith('http')
    ? raw
    : self.location.origin + (raw.startsWith('/') ? raw : '/' + raw);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
            return undefined;
          });
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
`
}

function appVersionPlugin() {
  let buildId = 'dev'

  return {
    name: 'app-version',
    config(_, { command }) {
      if (command === 'build') {
        buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      }
      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(buildId),
        },
      }
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(`${JSON.stringify({ buildId: 'dev' })}\n`)
      })
    },
    closeBundle() {
      writeFileSync(
        resolve(process.cwd(), 'dist/version.json'),
        `${JSON.stringify({ buildId })}\n`,
      )
    },
  }
}

function firebaseMessagingSwPlugin() {
  let swSource = ''

  return {
    name: 'firebase-messaging-sw',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')
      swSource = buildFirebaseServiceWorkerSource(env)
    },
    configureServer(server) {
      server.middlewares.use('/firebase-messaging-sw.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.end(swSource)
      })
    },
    closeBundle() {
      writeFileSync(resolve(process.cwd(), 'dist/firebase-messaging-sw.js'), swSource)
    },
  }
}

function shopManifestDevPlugin() {
  let apiBase = 'http://localhost:3000'

  return {
    name: 'shop-manifest-dev',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')
      apiBase = env.VITE_API_BASE_URL || apiBase
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const slug = parseManifestSlug(req.url?.split('?')[0] || '')
        if (!slug) return next()

        let shopName = DEFAULT_APP_NAME
        try {
          const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/shops/${encodeURIComponent(slug)}`)
          if (response.ok) {
            const shop = await response.json()
            const name = String(shop?.name || '').trim()
            if (name) shopName = name
          }
        } catch {
          /* use fallback shop name */
        }

        const headers = manifestResponseHeaders()
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value)
        }
        res.end(`${JSON.stringify(buildShopManifest(slug, shopName), null, 2)}\n`)
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), appVersionPlugin(), firebaseMessagingSwPlugin(), shopManifestDevPlugin()],
})

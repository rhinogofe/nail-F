import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  return {
    title,
    options: {
      body,
      icon: iconUrl,
      badge: iconUrl,
      tag: messageId ? 'nail-msg-' + messageId : 'nail-push-' + Date.now(),
      renotify: false,
      data: { url },
    },
  };
}

messaging.onBackgroundMessage((payload) => {
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

export default defineConfig({
  plugins: [vue(), firebaseMessagingSwPlugin()],
})

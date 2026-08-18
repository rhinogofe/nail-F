export function getFirebaseWebConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

export function getFirebaseVapidKey() {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
}

export function isFirebaseConfigured() {
  const config = getFirebaseWebConfig()
  return Boolean(
    config.apiKey
    && config.projectId
    && config.messagingSenderId
    && config.appId
    && getFirebaseVapidKey()
  )
}

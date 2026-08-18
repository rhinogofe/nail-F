import { createApp } from 'vue'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import { dismissBlockingOverlays, scheduleOverlayCleanup } from './utils/dismissBlockingOverlays'

const app = createApp(App)

app.use(createPinia())
app.use(router)

if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', () => {
    dismissBlockingOverlays()
    scheduleOverlayCleanup()
  })
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      dismissBlockingOverlays()
      scheduleOverlayCleanup()
    }
  })
}

app.mount('#app')

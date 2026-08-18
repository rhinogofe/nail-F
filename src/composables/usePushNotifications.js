import { onMounted, ref } from 'vue'
import {
  disableBrowserPush,
  enableBrowserPush,
  fetchPushStatus,
  getPushHelpText,
} from '../utils/pushNotifications'

export function usePushNotifications() {
  const enabled = ref(false)
  const configured = ref(false)
  const supported = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const helpText = ref('')

  async function refreshStatus() {
    const status = await fetchPushStatus()
    configured.value = Boolean(status.configured)
    supported.value = Boolean(status.supported)
    enabled.value = Boolean(status.enabled)
    helpText.value = getPushHelpText(status)
    return status
  }

  async function turnOn() {
    loading.value = true
    errorMessage.value = ''
    try {
      await enableBrowserPush()
      enabled.value = true
      await refreshStatus()
    } catch (err) {
      enabled.value = false
      errorMessage.value = err?.message || 'เปิดแจ้งเตือนไม่สำเร็จ'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function turnOff() {
    loading.value = true
    errorMessage.value = ''
    enabled.value = false
    try {
      await disableBrowserPush()
    } catch (err) {
      errorMessage.value = err?.message || 'ปิดแจ้งเตือนไม่สำเร็จ'
    } finally {
      loading.value = false
    }
  }

  async function toggle(nextValue) {
    if (loading.value) return
    if (nextValue) {
      await turnOn()
    } else {
      await turnOff()
    }
  }

  onMounted(async () => {
    await refreshStatus()
  })

  return {
    enabled,
    configured,
    supported,
    loading,
    errorMessage,
    helpText,
    refreshStatus,
    toggle,
    turnOn,
    turnOff,
  }
}

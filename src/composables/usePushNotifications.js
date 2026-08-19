import { computed, onMounted, ref } from 'vue'
import {
  disableBrowserPush,
  enableBrowserPush,
  fetchPushStatus,
  getPushHelpText,
  isIosDevice,
  isStandalonePwa,
  updateReceiveAllShopPush,
} from '../utils/pushNotifications'

export function usePushNotifications() {
  const enabled = ref(false)
  const configured = ref(false)
  const supported = ref(false)
  const isSuperAdmin = ref(false)
  const receiveAllShopPush = ref(false)
  const loading = ref(false)
  const prefsLoading = ref(false)
  const errorMessage = ref('')
  const helpText = ref('')

  // iOS only allows web push from an app installed on the Home Screen.
  const needsIosInstall = computed(() => isIosDevice() && !isStandalonePwa())

  async function refreshStatus() {
    const status = await fetchPushStatus()
    configured.value = Boolean(status.configured)
    supported.value = Boolean(status.supported)
    enabled.value = Boolean(status.enabled)
    isSuperAdmin.value = Boolean(status.is_super_admin)
    receiveAllShopPush.value = Boolean(status.receive_all_shop_push)
    helpText.value = getPushHelpText(status)
    return status
  }

  async function toggleReceiveAllShopPush(nextValue) {
    prefsLoading.value = true
    errorMessage.value = ''
    try {
      const data = await updateReceiveAllShopPush(nextValue)
      receiveAllShopPush.value = Boolean(data?.receive_all_shop_push)
    } catch (err) {
      errorMessage.value = err?.response?.data?.error || 'บันทึกการตั้งค่าไม่สำเร็จ'
      throw err
    } finally {
      prefsLoading.value = false
    }
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
    isSuperAdmin,
    receiveAllShopPush,
    loading,
    prefsLoading,
    errorMessage,
    helpText,
    needsIosInstall,
    refreshStatus,
    toggle,
    turnOn,
    turnOff,
    toggleReceiveAllShopPush,
  }
}

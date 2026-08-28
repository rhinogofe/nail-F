import { useShopRealtime } from './useShopRealtime'

export function useAdminBookingRealtime({ enabled, onChange }) {
  return useShopRealtime({
    enabled,
    auth: true,
    onChange: () => onChange?.(),
  })
}

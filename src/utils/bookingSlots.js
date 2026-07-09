export function toHourLabel(hour) {
  return `${hour}:00`
}

export function slotTimeLabel(hour, isSlots2hMode) {
  if (isSlots2hMode) return `${toHourLabel(hour)} – ${toHourLabel(hour + 2)}`
  return toHourLabel(hour)
}

export function normalizeShopOpenHour(value) {
  const hour = Number(value)
  if (Number.isInteger(hour) && hour >= 1 && hour <= 20) return hour
  return 9
}

export function normalizeShopLastBookingHour(value, openHour = 9) {
  const open = normalizeShopOpenHour(openHour)
  const hour = Number(value)
  if (Number.isInteger(hour) && hour >= open + 2 && hour <= 22) return hour
  return Math.max(open + 2, 18)
}

function parseExtraWindow(extra) {
  if (extra?.start_hour == null || extra?.end_hour == null) return null
  const start = Number(extra.start_hour)
  const end = Number(extra.end_hour)
  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end > 24
    || end - start < 2
  ) {
    return null
  }
  return { start, end }
}

function isHourBlocked(hour, blocks) {
  return (blocks || []).some((b) => {
    if (b.is_full_day) return true
    if (b.start_hour == null || b.end_hour == null) return false
    const start = Number(b.start_hour)
    const end = Number(b.end_hour)
    if (!Number.isInteger(start) || !Number.isInteger(end)) return false
    return hour >= start && hour < end
  })
}

function normalizeStartHour(value) {
  if (value == null || value === '') return null
  const hour = Number(value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 22) return null
  return hour
}

function isAllowedBookableHour(hour, openHour, lastBookingHour, extras) {
  const inNormal = hour >= openHour && hour <= lastBookingHour
  if (inNormal) return true
  return isWithinExtraHours(hour, extras)
}

function activeBookings(bookings, excludeBookingId) {
  return (bookings || []).filter(
    (b) =>
      b.status !== 'cancelled'
      && String(b.id) !== String(excludeBookingId ?? '')
      && normalizeStartHour(b.start_hour) != null
  )
}

function hasBookingOverlap(hour, bookings, excludeBookingId) {
  const slotEnd = hour + 2
  return activeBookings(bookings, excludeBookingId).some((b) => {
    const start = normalizeStartHour(b.start_hour)
    if (start == null) return false
    const end = Number(b.end_hour ?? start + 2)
    return start < slotEnd && end > hour
  })
}

function isSlotRangeBlockedForBooking(hour, blocks) {
  for (let h = hour; h < hour + 2; h += 1) {
    if (isHourBlocked(h, blocks)) return true
  }
  return false
}

export function isWithinExtraHours(hour, extras) {
  return (extras || []).some((extra) => {
    const win = parseExtraWindow(extra)
    return win != null && hour >= win.start && hour + 2 <= win.end
  })
}

function addExtraSlotStarts(starts, { openHour, lastBookingHour, extras, blocks, isSlots2hMode }) {
  for (const extra of extras || []) {
    const win = parseExtraWindow(extra)
    if (!win) continue
    let h = win.start
    while (h + 2 <= win.end) {
      const outsideNormal = h < openHour || h > lastBookingHour
      if (outsideNormal && !isSlotRangeBlockedForBooking(h, blocks)) {
        starts.add(h)
        h += isSlots2hMode ? 2 : 1
      } else {
        h += 1
      }
    }
  }
}

function buildSlots2h({ openHour, lastBookingHour, extras, blocks, bookings, excludeBookingId }) {
  const starts = new Set()
  let h = openHour
  while (h <= lastBookingHour) {
    if (!isSlotRangeBlockedForBooking(h, blocks)) {
      starts.add(h)
      h += 2
    } else {
      h += 1
    }
  }
  for (const b of activeBookings(bookings, excludeBookingId)) {
    const start = normalizeStartHour(b.start_hour)
    if (start != null && start >= openHour && start <= lastBookingHour) starts.add(start)
  }
  addExtraSlotStarts(starts, {
    openHour,
    lastBookingHour,
    extras,
    blocks,
    isSlots2hMode: true,
  })
  for (const b of activeBookings(bookings, excludeBookingId)) {
    const start = normalizeStartHour(b.start_hour)
    if (start != null && isWithinExtraHours(start, extras)) starts.add(start)
  }
  return [...starts].sort((a, b) => a - b)
}

export function buildAllSlots({
  openHour,
  lastBookingHour,
  extras = [],
  blocks = [],
  bookings = [],
  displayMode = 'normal',
  excludeBookingId = null,
}) {
  const normalizedOpen = normalizeShopOpenHour(openHour)
  const normalizedLast = normalizeShopLastBookingHour(lastBookingHour, normalizedOpen)
  const slotParams = {
    openHour: normalizedOpen,
    lastBookingHour: normalizedLast,
    extras,
    blocks,
    bookings,
    excludeBookingId,
  }

  if (displayMode === 'slots_2h') {
    return buildSlots2h(slotParams)
  }

  const result = []
  const seen = new Set()
  for (let h = normalizedOpen; h <= normalizedLast; h += 1) {
    result.push(h)
    seen.add(h)
  }
  for (const extra of extras) {
    const win = parseExtraWindow(extra)
    if (!win) continue
    for (let h = win.start; h + 2 <= win.end; h += 1) {
      if (!seen.has(h)) {
        result.push(h)
        seen.add(h)
      }
    }
  }
  return result.sort((a, b) => a - b)
}

export function buildVisibleSlots(params) {
  const slots = buildAllSlots(params)
  if (params.displayMode === 'slots_2h') return slots
  return slots.filter((h) => !isHourBlocked(h, params.blocks))
}

export function canBookSlot(hour, params) {
  const openHour = normalizeShopOpenHour(params.openHour)
  const lastBookingHour = normalizeShopLastBookingHour(params.lastBookingHour, openHour)
  const { extras, blocks, bookings, excludeBookingId } = params
  if (!Number.isInteger(hour) || hour < 0 || hour > 22) return false
  if (hour < openHour && !isWithinExtraHours(hour, extras)) return false
  if (!isAllowedBookableHour(hour, openHour, lastBookingHour, extras)) return false
  if (hasBookingOverlap(hour, bookings, excludeBookingId)) return false
  if (isSlotRangeBlockedForBooking(hour, blocks)) return false
  return true
}

export function buildBookableSlotHours(params) {
  const normalized = {
    ...params,
    openHour: normalizeShopOpenHour(params.openHour),
    lastBookingHour: normalizeShopLastBookingHour(params.lastBookingHour, params.openHour),
  }
  return buildVisibleSlots(normalized).filter((h) => canBookSlot(h, normalized))
}

export function buildBookingHourSelectOptions(params, { includeHour = null } = {}) {
  let hours = buildBookableSlotHours(params)
  if (includeHour != null && includeHour !== '') {
    const current = Number(includeHour)
    if (Number.isFinite(current) && !hours.includes(current)) {
      hours = [...hours, current].sort((a, b) => a - b)
    }
  }
  const isSlots2h = params.displayMode === 'slots_2h'
  return hours.map((hour) => ({
    hour,
    label: slotTimeLabel(hour, isSlots2h),
  }))
}

export const MIN_SLOT_HOURS = 1
export const MAX_SLOT_HOURS = 4
export const DEFAULT_SLOT_HOURS = 2

export function normalizeBookingSlotHours(value) {
  const n = Number(value)
  if (Number.isInteger(n) && n >= MIN_SLOT_HOURS && n <= MAX_SLOT_HOURS) return n
  return DEFAULT_SLOT_HOURS
}

export function bookingEndHour(startHour, slotHours = DEFAULT_SLOT_HOURS) {
  return Number(startHour) + normalizeBookingSlotHours(slotHours)
}

export function toHourLabel(hour) {
  return `${hour}:00`
}

export function slotTimeLabel(hour, isSlotsBlockMode, slotHours = DEFAULT_SLOT_HOURS) {
  const slot = normalizeBookingSlotHours(slotHours)
  if (isSlotsBlockMode) return `${toHourLabel(hour)} – ${toHourLabel(hour + slot)}`
  return `${toHourLabel(hour)} – ${toHourLabel(hour + slot)}`
}

export function normalizeShopOpenHour(value) {
  const hour = Number(value)
  if (Number.isInteger(hour) && hour >= 1 && hour <= 20) return hour
  return 9
}

export function normalizeShopLastBookingHour(value, openHour = 9, slotHours = DEFAULT_SLOT_HOURS) {
  const open = normalizeShopOpenHour(openHour)
  const slot = normalizeBookingSlotHours(slotHours)
  const hour = Number(value)
  if (Number.isInteger(hour) && hour >= open + slot && hour <= 22) return hour
  return Math.max(open + slot, 18)
}

function parseExtraWindow(extra, slotHours) {
  if (extra?.start_hour == null || extra?.end_hour == null) return null
  const start = Number(extra.start_hour)
  const end = Number(extra.end_hour)
  const slot = normalizeBookingSlotHours(slotHours)
  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end > 24
    || end - start < slot
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

function hasBookingOverlap(hour, bookings, excludeBookingId, slotHours) {
  const slot = normalizeBookingSlotHours(slotHours)
  const slotEnd = hour + slot
  return activeBookings(bookings, excludeBookingId).some((b) => {
    const start = normalizeStartHour(b.start_hour)
    if (start == null) return false
    const end = Number(b.end_hour ?? start + slot)
    return start < slotEnd && end > hour
  })
}

function isSlotRangeBlockedForBooking(hour, blocks, slotHours) {
  const slot = normalizeBookingSlotHours(slotHours)
  for (let h = hour; h < hour + slot; h += 1) {
    if (isHourBlocked(h, blocks)) return true
  }
  return false
}

export function isWithinExtraHours(hour, extras, slotHours = DEFAULT_SLOT_HOURS) {
  const slot = normalizeBookingSlotHours(slotHours)
  return (extras || []).some((extra) => {
    const win = parseExtraWindow(extra, slot)
    return win != null && hour >= win.start && hour + slot <= win.end
  })
}

function addExtraSlotStarts(starts, { openHour, lastBookingHour, extras, blocks, isSlotsBlockMode, slotHours }) {
  const slot = normalizeBookingSlotHours(slotHours)
  for (const extra of extras || []) {
    const win = parseExtraWindow(extra, slot)
    if (!win) continue
    let h = win.start
    while (h + slot <= win.end) {
      const outsideNormal = h < openHour || h > lastBookingHour
      if (outsideNormal && !isSlotRangeBlockedForBooking(h, blocks, slot)) {
        starts.add(h)
        h += isSlotsBlockMode ? slot : 1
      } else {
        h += 1
      }
    }
  }
}

function buildSlotsBlock({ openHour, lastBookingHour, extras, blocks, bookings, excludeBookingId, slotHours }) {
  const slot = normalizeBookingSlotHours(slotHours)
  const starts = new Set()
  let h = openHour
  while (h <= lastBookingHour) {
    if (!isSlotRangeBlockedForBooking(h, blocks, slot)) {
      starts.add(h)
      h += slot
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
    isSlotsBlockMode: true,
    slotHours: slot,
  })
  for (const b of activeBookings(bookings, excludeBookingId)) {
    const start = normalizeStartHour(b.start_hour)
    if (start != null && isWithinExtraHours(start, extras, slot)) starts.add(start)
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
  slotHours = DEFAULT_SLOT_HOURS,
  excludeBookingId = null,
}) {
  const slot = normalizeBookingSlotHours(slotHours)
  const normalizedOpen = normalizeShopOpenHour(openHour)
  const normalizedLast = normalizeShopLastBookingHour(lastBookingHour, normalizedOpen, slot)
  const slotParams = {
    openHour: normalizedOpen,
    lastBookingHour: normalizedLast,
    extras,
    blocks,
    bookings,
    excludeBookingId,
    slotHours: slot,
  }

  if (displayMode === 'slots_2h') {
    return buildSlotsBlock(slotParams)
  }

  const result = []
  const seen = new Set()
  for (let h = normalizedOpen; h <= normalizedLast; h += 1) {
    result.push(h)
    seen.add(h)
  }
  for (const extra of extras) {
    const win = parseExtraWindow(extra, slot)
    if (!win) continue
    for (let h = win.start; h + slot <= win.end; h += 1) {
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
  const slot = normalizeBookingSlotHours(params.slotHours)
  const openHour = normalizeShopOpenHour(params.openHour)
  const lastBookingHour = normalizeShopLastBookingHour(params.lastBookingHour, openHour, slot)
  const { extras, blocks, bookings, excludeBookingId } = params
  if (!Number.isInteger(hour) || hour < 0 || hour > 22) return false
  if (hour < openHour && !isWithinExtraHours(hour, extras, slot)) return false
  if (!isAllowedBookableHour(hour, openHour, lastBookingHour, extras)) return false
  if (hasBookingOverlap(hour, bookings, excludeBookingId, slot)) return false
  if (isSlotRangeBlockedForBooking(hour, blocks, slot)) return false
  return true
}

export function buildBookableSlotHours(params) {
  const slot = normalizeBookingSlotHours(params.slotHours)
  const normalized = {
    ...params,
    slotHours: slot,
    openHour: normalizeShopOpenHour(params.openHour),
    lastBookingHour: normalizeShopLastBookingHour(params.lastBookingHour, params.openHour, slot),
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
  const isSlotsBlockMode = params.displayMode === 'slots_2h'
  const slot = normalizeBookingSlotHours(params.slotHours)
  return hours.map((hour) => ({
    hour,
    label: slotTimeLabel(hour, isSlotsBlockMode, slot),
  }))
}

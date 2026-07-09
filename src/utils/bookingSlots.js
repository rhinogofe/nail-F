export function toHourLabel(hour) {
  return `${hour}:00`
}

export function slotTimeLabel(hour, isSlots2hMode) {
  if (isSlots2hMode) return `${toHourLabel(hour)} – ${toHourLabel(hour + 2)}`
  return toHourLabel(hour)
}

function isHourBlocked(hour, blocks) {
  return (blocks || []).some((b) => {
    if (b.is_full_day) return true
    return hour >= Number(b.start_hour) && hour < Number(b.end_hour)
  })
}

function normalizeStartHour(value) {
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
  return (extras || []).some(
    (e) => hour >= Number(e.start_hour) && hour + 2 <= Number(e.end_hour)
  )
}

function addExtraSlotStarts(starts, { openHour, lastBookingHour, extras, blocks, isSlots2hMode }) {
  for (const extra of extras || []) {
    let h = Number(extra.start_hour)
    const winEnd = Number(extra.end_hour)
    if (!Number.isInteger(h) || !Number.isInteger(winEnd) || winEnd - h < 2) continue
    while (h + 2 <= winEnd) {
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
  if (displayMode === 'slots_2h') {
    return buildSlots2h({
      openHour,
      lastBookingHour,
      extras,
      blocks,
      bookings,
      excludeBookingId,
    })
  }

  const result = []
  const seen = new Set()
  for (let h = openHour; h <= lastBookingHour; h += 1) {
    result.push(h)
    seen.add(h)
  }
  for (const extra of extras) {
    const winStart = Number(extra.start_hour)
    const winEnd = Number(extra.end_hour)
    if (!Number.isInteger(winStart) || !Number.isInteger(winEnd) || winEnd - winStart < 2) continue
    for (let h = winStart; h + 2 <= winEnd; h += 1) {
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
  const { openHour, lastBookingHour, extras, blocks, bookings, excludeBookingId } = params
  if (!Number.isInteger(hour) || hour < 0 || hour > 22) return false
  if (!isAllowedBookableHour(hour, openHour, lastBookingHour, extras)) return false
  if (hasBookingOverlap(hour, bookings, excludeBookingId)) return false
  if (isSlotRangeBlockedForBooking(hour, blocks)) return false
  return true
}

export function buildBookableSlotHours(params) {
  return buildVisibleSlots(params).filter((h) => canBookSlot(h, params))
}

export function buildBookingHourSelectOptions(params, { includeHour = null } = {}) {
  let hours = buildBookableSlotHours(params)
  const current = Number(includeHour)
  if (Number.isFinite(current) && !hours.includes(current)) {
    hours = [...hours, current].sort((a, b) => a - b)
  }
  const isSlots2h = params.displayMode === 'slots_2h'
  return hours.map((hour) => ({
    hour,
    label: slotTimeLabel(hour, isSlots2h),
  }))
}

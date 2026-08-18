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

export function toMinutesFromHm(hour, minute = 0) {
  return Number(hour) * 60 + Number(minute)
}

export function formatHmLabel(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function makeBookingSlot(startHour, startMinute, endHour, endMinute) {
  return {
    startHour: Number(startHour),
    startMinute: Number(startMinute ?? 0),
    endHour: Number(endHour),
    endMinute: Number(endMinute ?? 0),
  }
}

export function hourToSlot(hour, slotHours = DEFAULT_SLOT_HOURS) {
  const slot = normalizeBookingSlotHours(slotHours)
  return makeBookingSlot(hour, 0, hour + slot, 0)
}

export function slotStartMinutes(slot) {
  return toMinutesFromHm(slot.startHour, slot.startMinute ?? 0)
}

export function slotEndMinutes(slot) {
  return toMinutesFromHm(slot.endHour, slot.endMinute ?? 0)
}

export function slotKey(slot) {
  return `${slot.startHour}:${slot.startMinute ?? 0}-${slot.endHour}:${slot.endMinute ?? 0}`
}

export function slotLabel(slot) {
  return `${formatHmLabel(slot.startHour, slot.startMinute)} – ${formatHmLabel(slot.endHour, slot.endMinute)}`
}

export function formatSlotDuration(slot, fallbackSlotHours = DEFAULT_SLOT_HOURS) {
  if (!slot) return `${normalizeBookingSlotHours(fallbackSlotHours)} ชั่วโมง`
  const minutes = slotEndMinutes(slot) - slotStartMinutes(slot)
  if (minutes <= 0) return `${normalizeBookingSlotHours(fallbackSlotHours)} ชั่วโมง`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours && mins) return `${hours} ชั่วโมง ${mins} นาที`
  if (hours) return `${hours} ชั่วโมง`
  return `${mins} นาที`
}

export function sumOptionDurationMinutes(options, optionIds) {
  const ids = new Set((optionIds || []).map(String))
  return (options || [])
    .filter((opt) => ids.has(String(opt.id)))
    .reduce((sum, opt) => sum + Math.max(0, Number(opt.duration_min) || 0), 0)
}

export function formatDurationMinutes(minutes) {
  const mins = Math.max(0, Number(minutes) || 0)
  if (!mins) return '0 นาที'
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours && rem) return `${hours} ชม. ${rem} น.`
  if (hours) return `${hours} ชม.`
  return `${rem} น.`
}

export const MIN_GAP_SLOT_MINUTES = 60

export function getOfferedSlotMinutes(baseSlot, slotHours = DEFAULT_SLOT_HOURS) {
  const startM = slotStartMinutes(baseSlot)
  const endM = slotEndMinutes(baseSlot)
  if (endM > startM) return endM - startM
  return normalizeBookingSlotHours(slotHours) * 60
}

export function applyServiceDurationToSlot(baseSlot, totalServiceMinutes, slotHours = DEFAULT_SLOT_HOURS) {
  if (!baseSlot) return null
  const minMinutes = getOfferedSlotMinutes(baseSlot, slotHours)
  const serviceMinutes = Math.max(0, Number(totalServiceMinutes) || 0)
  const effectiveMinutes = Math.max(minMinutes, serviceMinutes)
  const startM = slotStartMinutes(baseSlot)
  const endM = startM + effectiveMinutes
  if (endM > 24 * 60) return null
  const endHour = Math.floor(endM / 60)
  const endMinute = endM % 60
  if (endHour > 23 || (endHour === 23 && endMinute > 59)) return null
  return makeBookingSlot(baseSlot.startHour, baseSlot.startMinute ?? 0, endHour, endMinute)
}

function mergeOccupiedIntervals(intervals) {
  const sorted = [...intervals]
    .filter((i) => i.endM > i.startM)
    .sort((a, b) => a.startM - b.startM)
  const merged = []
  for (const interval of sorted) {
    const last = merged[merged.length - 1]
    if (!last || interval.startM > last.endM) {
      merged.push({ ...interval })
    } else if (interval.endM > last.endM) {
      last.endM = interval.endM
    }
  }
  return merged
}

function dynamicBlockIntervals(blocks) {
  const result = []
  for (const block of blocks || []) {
    if (block.is_full_day) return [{ startM: 0, endM: 24 * 60, fullDay: true }]
    if (block.start_hour == null || block.end_hour == null) continue
    result.push({
      startM: Number(block.start_hour) * 60,
      endM: Number(block.end_hour) * 60,
    })
  }
  return result
}

function dynamicBookingIntervals(bookings, slotHours, excludeBookingId) {
  return (bookings || [])
    .filter((b) => b.status !== 'cancelled' && String(b.id) !== String(excludeBookingId ?? ''))
    .map((b) => {
      const slot = bookingRowToSlot(b, slotHours)
      return { startM: slotStartMinutes(slot), endM: slotEndMinutes(slot) }
    })
}

function makeDynamicSlot(startM, endM, baseDurationMinutes) {
  const hour = Math.floor(startM / 60)
  const minute = startM % 60
  const endHour = Math.floor(endM / 60)
  const endMinute = endM % 60
  return makeBookingSlot(hour, minute, endHour, endMinute)
}

export function buildDynamicBookableSlots({
  slotHours = DEFAULT_SLOT_HOURS,
  bookings = [],
  blocks = [],
  dayWindows = [],
  openHour = 9,
  lastBookingHour = 18,
  excludeBookingId = null,
  minGapMinutes = MIN_GAP_SLOT_MINUTES,
}) {
  const slot = normalizeBookingSlotHours(slotHours)
  const slotLenM = slot * 60
  const maxEndM = getMaxEndMinutesForDay({
    dayWindows,
    openHour,
    lastBookingHour,
    slotHours: slot,
  })
  const timelineStartM = dayWindows?.length
    ? Math.min(...normalizeDayWindows(dayWindows).map((w) => toMinutesFromHm(w.start_hour, w.start_minute)))
    : normalizeShopOpenHour(openHour) * 60

  const occupied = mergeOccupiedIntervals([
    ...dynamicBookingIntervals(bookings, slot, excludeBookingId),
    ...dynamicBlockIntervals(blocks),
  ])
  if (occupied.some((o) => o.fullDay)) return []

  const result = []
  let cursor = timelineStartM

  while (cursor < maxEndM) {
    const inside = occupied.find((o) => cursor >= o.startM && cursor < o.endM)
    if (inside) {
      cursor = inside.endM
      continue
    }

    const nextStart = occupied
      .filter((o) => o.startM > cursor)
      .reduce((min, o) => Math.min(min, o.startM), maxEndM)

    const space = nextStart - cursor
    if (space >= slotLenM) {
      result.push(makeDynamicSlot(cursor, cursor + slotLenM))
      cursor += slotLenM
    } else if (space >= minGapMinutes) {
      result.push(makeDynamicSlot(cursor, cursor + space))
      cursor += space
    } else {
      cursor = nextStart
    }
  }

  return result
}

export function buildDynamicTimelineSlots(params) {
  const slot = normalizeBookingSlotHours(params.slotHours)
  const booked = (params.bookings || [])
    .filter((b) => b.status !== 'cancelled' && String(b.id) !== String(params.excludeBookingId ?? ''))
    .map((b) => bookingRowToSlot(b, slot))
  const available = buildDynamicBookableSlots(params)
  return {
    booked,
    available,
    all: [...booked, ...available].sort((a, b) => slotStartMinutes(a) - slotStartMinutes(b)),
  }
}

export function isDynamicSlotAvailable(slot, params) {
  const { available } = buildDynamicTimelineSlots(params)
  return available.some((s) => slotKey(s) === slotKey(slot))
}

export function getMaxEndMinutesForDay({ dayWindows = [], openHour = 9, lastBookingHour = 18, slotHours = DEFAULT_SLOT_HOURS }) {
  const windows = normalizeDayWindows(dayWindows)
  if (windows.length) {
    return Math.max(...windows.map((w) => toMinutesFromHm(w.end_hour, w.end_minute)))
  }
  const slot = normalizeBookingSlotHours(slotHours)
  const open = normalizeShopOpenHour(openHour)
  const last = normalizeShopLastBookingHour(lastBookingHour, open, slot)
  return toMinutesFromHm(last + slot, 0)
}

export function getExtendedSlotBlockReason(baseSlot, extendedSlot, params = {}) {
  if (!baseSlot || !extendedSlot) return null
  if (slotStartMinutes(extendedSlot) !== slotStartMinutes(baseSlot)) return null
  if (slotKey(baseSlot) === slotKey(extendedSlot)) return null

  const {
    blocks = [],
    bookings = [],
    excludeBookingId = null,
    dayWindows = [],
    openHour = 9,
    lastBookingHour = 18,
    slotHours = DEFAULT_SLOT_HOURS,
    allowPastClose = false,
  } = params

  if (isSlotBlockedByMinutes(extendedSlot, blocks)) return 'blocked'
  if (hasBookingOverlapForSlot(extendedSlot, bookings, excludeBookingId)) return 'next_booking'

  const maxEnd = getMaxEndMinutesForDay({ dayWindows, openHour, lastBookingHour, slotHours })
  if (!allowPastClose && slotEndMinutes(extendedSlot) > maxEnd) return 'closing_time'

  return null
}

export function canBookExtendedSlot(baseSlot, extendedSlot, params = {}) {
  if (!baseSlot || !extendedSlot) return false
  if (slotStartMinutes(extendedSlot) !== slotStartMinutes(baseSlot)) return false
  if (slotKey(baseSlot) === slotKey(extendedSlot)) return true
  return getExtendedSlotBlockReason(baseSlot, extendedSlot, params) === null
}

export function computeEffectiveBookingSlot(baseSlot, options, optionIds, slotHours, extendEnabled = true) {
  if (!baseSlot) return null
  if (!extendEnabled) return baseSlot
  const totalMinutes = sumOptionDurationMinutes(options, optionIds)
  return applyServiceDurationToSlot(baseSlot, totalMinutes, slotHours) || baseSlot
}

export function bookingRowToSlot(booking, slotHours = DEFAULT_SLOT_HOURS) {
  const slot = normalizeBookingSlotHours(slotHours)
  const startHour = Number(booking.start_hour)
  const startMinute = Number(booking.start_minute ?? 0)
  const endHour = booking.end_hour != null ? Number(booking.end_hour) : startHour + slot
  const endMinute = Number(booking.end_minute ?? 0)
  return makeBookingSlot(startHour, startMinute, endHour, endMinute)
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

function isSlotBlockedByMinutes(slot, blocks) {
  const startM = slotStartMinutes(slot)
  const endM = slotEndMinutes(slot)
  return (blocks || []).some((b) => {
    if (b.is_full_day) return true
    if (b.start_hour == null || b.end_hour == null) return false
    const blockStart = Number(b.start_hour) * 60
    const blockEnd = Number(b.end_hour) * 60
    return rangesOverlap(startM, endM, blockStart, blockEnd)
  })
}

function hasBookingOverlapForSlot(slot, bookings, excludeBookingId) {
  const startM = slotStartMinutes(slot)
  const endM = slotEndMinutes(slot)
  return (bookings || []).some((b) => {
    if (b.status === 'cancelled') return false
    if (String(b.id) === String(excludeBookingId ?? '')) return false
    const existing = bookingRowToSlot(b)
    return rangesOverlap(startM, endM, slotStartMinutes(existing), slotEndMinutes(existing))
  })
}

/** 1 รายการที่ตั้งในแอดมิน = 1 คิวจอง (แสดงเวลา ชม:นาที ตรงตามที่ตั้ง) */
export function buildDayWindowSlots({ dayWindows, blocks = [] }) {
  const windows = normalizeDayWindows(dayWindows)
  return windows
    .map((window) => makeBookingSlot(
      window.start_hour,
      window.start_minute,
      window.end_hour,
      window.end_minute,
    ))
    .filter((slot) => !isSlotBlockedByMinutes(slot, blocks))
    .sort((a, b) => slotStartMinutes(a) - slotStartMinutes(b))
}

export function canBookDayWindowSlot(slot, { blocks = [], bookings = [], excludeBookingId = null }) {
  if (isSlotBlockedByMinutes(slot, blocks)) return false
  if (hasBookingOverlapForSlot(slot, bookings, excludeBookingId)) return false
  return true
}

export function getUsedHoursForDayWindows(dayWindows) {
  const used = new Set()
  for (const window of dayWindows || []) {
    const startM = toMinutesFromHm(window.start_hour, window.start_minute ?? 0)
    const endM = toMinutesFromHm(window.end_hour, window.end_minute ?? 0)
    for (let h = 0; h <= 23; h += 1) {
      const hStart = h * 60
      const hEnd = (h + 1) * 60
      if (hStart < endM && hEnd > startM) used.add(h)
    }
  }
  return used
}

function dayWindowOccupiedIntervals(dayWindows) {
  return normalizeDayWindows(dayWindows)
    .map((window) => ({
      startM: toMinutesFromHm(window.start_hour, window.start_minute),
      endM: toMinutesFromHm(window.end_hour, window.end_minute),
    }))
    .filter((i) => i.endM > i.startM)
    .sort((a, b) => a.startM - b.startM)
}

function isMinuteInsideOccupied(minute, intervals) {
  return intervals.some((i) => minute >= i.startM && minute < i.endM)
}

const MAX_DAY_END_MINUTE = 23 * 60 + 59

export function maxEndMinutesForDayHourStart(startM, dayWindows) {
  const start = Number(startM)
  const intervals = dayWindowOccupiedIntervals(dayWindows)
  const next = intervals.find((i) => i.startM > start)
  return next ? next.startM : MAX_DAY_END_MINUTE
}

/** When editing, allow extending end into the next touching slot (cascade) up to just before that slot's end. */
export function maxEndMinutesForDayHourEdit(startM, dayWindowsExceptEditing, { editingId, originalEndM, allWindows }) {
  const baseMax = maxEndMinutesForDayHourStart(startM, dayWindowsExceptEditing)
  if (editingId == null || originalEndM == null) return baseMax

  const sorted = normalizeDayWindows(allWindows || dayWindowsExceptEditing)
    .slice()
    .sort(
      (a, b) =>
        toMinutesFromHm(a.start_hour, a.start_minute)
        - toMinutesFromHm(b.start_hour, b.start_minute),
    )

  const idx = sorted.findIndex((w) => String(w.id) === String(editingId))
  if (idx < 0) return baseMax

  const next = sorted[idx + 1]
  if (!next) return baseMax

  const nextStartM = toMinutesFromHm(next.start_hour, next.start_minute ?? 0)
  const nextEndM = toMinutesFromHm(next.end_hour, next.end_minute ?? 0)
  if (nextStartM === originalEndM && nextEndM > originalEndM) {
    return Math.min(nextEndM - 1, MAX_DAY_END_MINUTE)
  }

  return baseMax
}

export function availableStartMinutesForHour(hour, dayWindows) {
  const intervals = dayWindowOccupiedIntervals(dayWindows)
  const result = []
  const hourStart = Number(hour) * 60
  for (let m = 0; m <= 59; m += 1) {
    const startM = hourStart + m
    if (startM >= MAX_DAY_END_MINUTE) break
    if (!isMinuteInsideOccupied(startM, intervals)) {
      result.push(m)
    }
  }
  return result
}

export function availableStartHoursForDay(dayWindows) {
  const hours = []
  for (let h = 0; h <= 23; h += 1) {
    if (availableStartMinutesForHour(h, dayWindows).length) hours.push(h)
  }
  return hours
}

function normalizeDayWindow(window) {
  if (!window) return null
  const start_hour = Number(window.start_hour)
  const start_minute = Number(window.start_minute ?? 0)
  const end_hour = Number(window.end_hour)
  const end_minute = Number(window.end_minute ?? 0)
  if (
    !Number.isInteger(start_hour)
    || !Number.isInteger(end_hour)
    || !Number.isInteger(start_minute)
    || !Number.isInteger(end_minute)
  ) {
    return null
  }
  return { ...window, start_hour, start_minute, end_hour, end_minute }
}

export function normalizeDayWindows(dayWindows) {
  return (dayWindows || []).map(normalizeDayWindow).filter(Boolean)
}

function isHourWithinDayWindows(hour, slotHours, dayWindows) {
  const slot = normalizeBookingSlotHours(slotHours)
  const slotStartM = hour * 60
  const slotEndM = slotStartM + slot * 60
  return normalizeDayWindows(dayWindows).some((window) => {
    const startM = toMinutesFromHm(window.start_hour, window.start_minute)
    const endM = toMinutesFromHm(window.end_hour, window.end_minute)
    return slotStartM >= startM && slotEndM <= endM
  })
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

function isAllowedBookableHour(hour, openHour, lastBookingHour, extras, dayWindows, slotHours) {
  if (dayWindows?.length) {
    return isHourWithinDayWindows(hour, slotHours, dayWindows)
  }
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
  dayWindows = [],
  blocks = [],
  bookings = [],
  displayMode = 'slots_2h',
  slotHours = DEFAULT_SLOT_HOURS,
  excludeBookingId = null,
}) {
  const slot = normalizeBookingSlotHours(slotHours)
  const windows = normalizeDayWindows(dayWindows)
  if (windows.length) {
    return buildDayWindowSlots({ dayWindows: windows, blocks }).map((s) => s.startHour)
  }

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
  const windows = normalizeDayWindows(params.dayWindows)
  if (!Number.isInteger(hour) || hour < 0 || hour > 22) return false
  if (windows.length) {
    if (!isHourWithinDayWindows(hour, slot, windows)) return false
  } else {
    if (hour < openHour && !isWithinExtraHours(hour, extras, slot)) return false
    if (!isAllowedBookableHour(hour, openHour, lastBookingHour, extras, windows, slot)) return false
  }
  if (hasBookingOverlap(hour, bookings, excludeBookingId, slot)) return false
  if (isSlotRangeBlockedForBooking(hour, blocks, slot)) return false
  return true
}

export function parseSlotKey(key) {
  const m = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(String(key ?? ''))
  if (!m) return null
  return makeBookingSlot(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]))
}

export function buildBookableDayWindowSlots(params) {
  const windows = normalizeDayWindows(params.dayWindows)
  if (!windows.length) return []
  return buildDayWindowSlots({ dayWindows: windows, blocks: params.blocks || [] })
    .filter((slot) => canBookDayWindowSlot(slot, {
      blocks: params.blocks,
      bookings: params.bookings,
      excludeBookingId: params.excludeBookingId,
    }))
    .sort((a, b) => slotStartMinutes(a) - slotStartMinutes(b))
}

export function buildBookingSlotSelectOptions(params, { excludeSlotKey = null, includeSlotKey = null } = {}) {
  const windows = normalizeDayWindows(params.dayWindows)
  const slot = normalizeBookingSlotHours(params.slotHours)
  const isSlotsBlockMode = params.displayMode === 'slots_2h'

  if (params.extendByServices) {
    let slots = buildDynamicBookableSlots(params)
    if (excludeSlotKey) {
      slots = slots.filter((s) => slotKey(s) !== excludeSlotKey)
    }
    const options = slots.map((s) => ({
      key: slotKey(s),
      hour: s.startHour,
      startMinute: s.startMinute,
      endHour: s.endHour,
      endMinute: s.endMinute,
      slot: s,
      label: slotLabel(s),
    }))
    if (includeSlotKey && !options.some((o) => o.key === includeSlotKey)) {
      const parsed = parseSlotKey(includeSlotKey)
      if (parsed) {
        options.push({
          key: includeSlotKey,
          hour: parsed.startHour,
          startMinute: parsed.startMinute,
          endHour: parsed.endHour,
          endMinute: parsed.endMinute,
          slot: parsed,
          label: slotLabel(parsed),
        })
        options.sort((a, b) => slotStartMinutes(a.slot) - slotStartMinutes(b.slot))
      }
    }
    return options
  }

  if (windows.length) {
    let slots = buildBookableDayWindowSlots(params)
    if (excludeSlotKey) {
      slots = slots.filter((s) => slotKey(s) !== excludeSlotKey)
    }
    const options = slots.map((s) => ({
      key: slotKey(s),
      hour: s.startHour,
      startMinute: s.startMinute,
      endHour: s.endHour,
      endMinute: s.endMinute,
      slot: s,
      label: slotLabel(s),
    }))
    if (includeSlotKey && !options.some((o) => o.key === includeSlotKey)) {
      const parsed = parseSlotKey(includeSlotKey)
      if (parsed) {
        options.push({
          key: includeSlotKey,
          hour: parsed.startHour,
          startMinute: parsed.startMinute,
          endHour: parsed.endHour,
          endMinute: parsed.endMinute,
          slot: parsed,
          label: slotLabel(parsed),
        })
        options.sort((a, b) => slotStartMinutes(a.slot) - slotStartMinutes(b.slot))
      }
    }
    return options
  }

  let hours = buildBookableSlotHours({
    ...params,
    slotHours: slot,
    openHour: normalizeShopOpenHour(params.openHour),
    lastBookingHour: normalizeShopLastBookingHour(params.lastBookingHour, params.openHour, slot),
  })
  if (includeSlotKey != null && includeSlotKey !== '') {
    const parsed = parseSlotKey(includeSlotKey)
    const currentHour = parsed?.startHour ?? Number(includeSlotKey)
    if (Number.isFinite(currentHour) && !hours.includes(currentHour)) {
      hours = [...hours, currentHour].sort((a, b) => a - b)
    }
  }
  return hours.map((hour) => {
    const s = hourToSlot(hour, slot)
    return {
      key: slotKey(s),
      hour,
      startMinute: 0,
      endHour: s.endHour,
      endMinute: 0,
      slot: s,
      label: slotTimeLabel(hour, isSlotsBlockMode, slot),
    }
  })
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

export function buildBookingHourSelectOptions(params, options = {}) {
  return buildBookingSlotSelectOptions(params, options)
}

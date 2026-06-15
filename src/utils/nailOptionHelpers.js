export function formatOptionDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '' : formatYmd(d)
  }
  return formatYmd(new Date(value))
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function optionVisibleOnDate(item, iso) {
  const from = formatOptionDateKey(item.show_from_date)
  const to = formatOptionDateKey(item.show_to_date)
  if (!from && !to) return true
  if (from && to) return iso >= from && iso <= to
  if (from) return iso >= from
  return iso <= to
}

export function optionBookableOnDate(item, iso) {
  if (item.is_active === false) return false
  return optionVisibleOnDate(item, iso)
}

export function isValidHexColor(color) {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)
}

export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function colorForDate(options, iso) {
  const visible = (options || []).filter((item) => {
    if (item.is_active === false) return false
    if (!isValidHexColor(item.color)) return false
    return optionVisibleOnDate(item, iso)
  })
  if (!visible.length) return null

  const sorted = [...visible].sort((a, b) => {
    const aFrom = formatOptionDateKey(a.show_from_date)
    const aTo = formatOptionDateKey(a.show_to_date)
    const bFrom = formatOptionDateKey(b.show_from_date)
    const bTo = formatOptionDateKey(b.show_to_date)
    const aExact = aFrom === iso && aTo === iso
    const bExact = bFrom === iso && bTo === iso
    if (aExact !== bExact) return aExact ? -1 : 1
    return String(a.option_name || '').localeCompare(String(b.option_name || ''), 'th')
  })
  return sorted[0].color
}

export function dayTintStyle(color, { selected = false } = {}) {
  if (!isValidHexColor(color)) return {}
  if (selected) {
    return {
      background: color,
      borderColor: color,
      color: '#fff',
    }
  }
  return {
    background: hexToRgba(color, 0.14),
    borderColor: color,
  }
}

export function normalizeOptionColor(value) {
  const color = String(value || '').trim()
  return isValidHexColor(color) ? color : null
}

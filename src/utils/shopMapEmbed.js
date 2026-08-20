export function hasShopMapUrl(value) {
  return /^https?:\/\//i.test(String(value ?? '').trim())
}

export function isGoogleMapsEmbedUrl(value) {
  const url = String(value ?? '').trim()
  if (!hasShopMapUrl(url)) return false
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    return (
      (host === 'google.com' || host.endsWith('.google.com'))
      && u.pathname.startsWith('/maps/embed')
    )
  } catch {
    return false
  }
}

function extractPbParam(url) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''

  if (isGoogleMapsEmbedUrl(raw)) {
    try {
      return new URL(raw).searchParams.get('pb') || ''
    } catch {
      return ''
    }
  }

  try {
    const u = new URL(raw)
    const pb = u.searchParams.get('pb')
    if (pb) return pb
  } catch {
    // fall through
  }

  const match = raw.match(/[?&]pb=([^&]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function buildEmbedFromPb(pb) {
  const value = String(pb ?? '').trim()
  if (!value) return ''
  return `https://www.google.com/maps/embed?pb=${encodeURIComponent(value)}`
}

export function resolveShopMapEmbedUrl(mapUrl, embedUrl) {
  const embed = String(embedUrl ?? '').trim()
  if (isGoogleMapsEmbedUrl(embed)) return embed

  const embedPb = extractPbParam(embed)
  if (embedPb) return buildEmbedFromPb(embedPb)

  const map = String(mapUrl ?? '').trim()
  if (!hasShopMapUrl(map)) return ''
  if (isGoogleMapsEmbedUrl(map)) return map

  const mapPb = extractPbParam(map)
  if (mapPb) return buildEmbedFromPb(mapPb)

  // ลิงก์แชร์ทั่วไป (maps/place, goo.gl, output=embed) มักถูก Google บล็อกใน iframe
  return ''
}

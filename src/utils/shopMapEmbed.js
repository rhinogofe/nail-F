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

function parseCoordinatePair(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  return { lat: match[1], lng: match[2] }
}

function parseGoogleMapsLocation(url) {
  const raw = String(url ?? '').trim()
  if (!raw) return null

  const pinMatch = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (pinMatch) {
    return { lat: pinMatch[1], lng: pinMatch[2] }
  }

  const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (atMatch) {
    return { lat: atMatch[1], lng: atMatch[2] }
  }

  try {
    const u = new URL(raw)
    const searchPathMatch = u.pathname.match(/\/maps\/search\/(-?\d+(?:\.\d+)?),\+?(-?\d+(?:\.\d+)?)/)
    if (searchPathMatch) {
      return { lat: searchPathMatch[1], lng: searchPathMatch[2] }
    }
    const q = u.searchParams.get('q') || u.searchParams.get('query')
    if (q) {
      const coords = parseCoordinatePair(q)
      if (coords) return coords
      return { query: q }
    }

    const ll = u.searchParams.get('ll')
    if (ll) {
      const coords = parseCoordinatePair(ll)
      if (coords) return coords
    }

    const placeId = u.searchParams.get('place_id')
    if (placeId) return { placeId }
  } catch {
    // fall through
  }

  const placeMatch = raw.match(/(ChIJ[\w-]+)/)
  if (placeMatch) return { placeId: placeMatch[1] }

  return null
}

function buildEmbedFromLocation(location) {
  if (!location) return ''

  if (location.lat && location.lng) {
    const q = `${location.lat},${location.lng}`
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&hl=th&z=16&output=embed`
  }
  if (location.query) {
    return `https://www.google.com/maps?q=${encodeURIComponent(location.query)}&hl=th&z=16&output=embed`
  }
  if (location.placeId) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`place_id:${location.placeId}`)}&hl=th&z=16&output=embed`
  }

  return ''
}

export function resolveShopMapEmbedUrl(mapUrl, embedUrl) {
  const map = String(mapUrl ?? '').trim()
  if (hasShopMapUrl(map)) {
    if (isGoogleMapsEmbedUrl(map)) return map

    const mapPb = extractPbParam(map)
    if (mapPb) return buildEmbedFromPb(mapPb)

    const fromMap = buildEmbedFromLocation(parseGoogleMapsLocation(map))
    if (fromMap) return fromMap
  }

  const embed = String(embedUrl ?? '').trim()
  if (isGoogleMapsEmbedUrl(embed)) return embed

  const embedPb = extractPbParam(embed)
  if (embedPb) return buildEmbedFromPb(embedPb)

  return ''
}

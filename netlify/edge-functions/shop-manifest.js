import {
  DEFAULT_APP_NAME,
  buildShopManifest,
  manifestResponseHeaders,
  parseManifestSlug,
} from '../../shared/shopManifestBuilder.js'

async function fetchShopName(slug, apiBase) {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/shops/${encodeURIComponent(slug)}`)
    if (!res.ok) return DEFAULT_APP_NAME
    const shop = await res.json()
    const name = String(shop?.name || '').trim()
    return name || DEFAULT_APP_NAME
  } catch {
    return DEFAULT_APP_NAME
  }
}

export default async (request) => {
  const slug = parseManifestSlug(new URL(request.url).pathname)
  if (!slug) {
    return new Response('Not found', { status: 404 })
  }

  const apiBase =
    Deno.env.get('API_BASE_URL') ||
    Deno.env.get('VITE_API_BASE_URL') ||
    'https://nail-b.onrender.com'

  const shopName = await fetchShopName(slug, apiBase)
  const manifest = buildShopManifest(slug, shopName)

  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: manifestResponseHeaders(),
  })
}

export const config = {
  path: '/manifest/*',
}

import {
  DEFAULT_APP_NAME,
  buildShopManifest,
  manifestResponseHeaders,
  parseManifestSlug,
} from '../../shared/shopManifestBuilder.js'

async function fetchShopBranding(slug, apiBase) {
  try {
    const res = await fetch(
      `${apiBase.replace(/\/$/, '')}/api/shops/${encodeURIComponent(slug)}/branding`,
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
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

  const branding = await fetchShopBranding(slug, apiBase)
  const shopName = branding?.name || DEFAULT_APP_NAME
  const manifest = buildShopManifest(slug, shopName, {
    apiBase: apiBase.replace(/\/$/, ''),
    iconVersion: branding?.icon_version ?? '0',
  })

  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: manifestResponseHeaders(),
  })
}

export const config = {
  path: '/manifest/*',
}

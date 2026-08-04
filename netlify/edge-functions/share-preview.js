const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Line\/|line-poker|Applebot/i

const SLUG_PATH_RE = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(bookings|login|reviews|profile|chat|admin|register-shop)(?:\/|$)/

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function injectShareMeta(html, meta, pageUrl) {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const url = escapeHtml(meta.url || pageUrl)
  const tags = [
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${url}">`,
  ]
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}">`)
  }

  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  next = next.replace(/<meta[^>]+(?:name="description"|property="og:[^"]+")[^>]*>\s*/gi, '')
  next = next.replace(/<\/title>/i, `</title>\n    ${tags.join('\n    ')}`)
  return next
}

export default async (request, context) => {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_UA.test(ua)) return context.next()

  const { pathname } = new URL(request.url)
  const match = pathname.match(SLUG_PATH_RE)
  if (!match) return context.next()

  const slug = match[1]
  const apiBase =
    Deno.env.get('API_BASE_URL') ||
    Deno.env.get('VITE_API_BASE_URL') ||
    'https://nail-b.onrender.com'

  try {
    const previewRes = await fetch(`${apiBase.replace(/\/$/, '')}/api/shops/${slug}/share-preview`)
    if (!previewRes.ok) return context.next()
    const meta = await previewRes.json()

    const htmlRes = await fetch(new URL('/index.html', request.url))
    if (!htmlRes.ok) return context.next()
    const html = injectShareMeta(await htmlRes.text(), meta, request.url)

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    })
  } catch {
    return context.next()
  }
}

export const config = {
  path: '/*',
}

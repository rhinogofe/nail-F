import {
  appShellCacheControl,
  buildShopAppShellHtml,
  isBotUserAgent,
  shouldProcessAppShell,
} from './lib/htmlInject.js'

export default async (request, context) => {
  if (!shouldProcessAppShell(request)) {
    return context.next()
  }

  const ua = request.headers.get('user-agent') || ''
  const isBot = isBotUserAgent(ua)

  try {
    const html = await buildShopAppShellHtml(request, { isBot })
    if (!html) return context.next()

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': appShellCacheControl(isBot),
        pragma: 'no-cache',
      },
    })
  } catch {
    return context.next()
  }
}

export const config = {
  path: '/*',
}

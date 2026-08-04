function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function applyPageMeta({ title, description, image, url } = {}) {
  if (title) document.title = title
  if (description) upsertMeta('name', 'description', description)
  if (title) upsertMeta('property', 'og:title', title)
  if (description) upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:type', 'website')
  if (url) upsertMeta('property', 'og:url', url)
  if (image) upsertMeta('property', 'og:image', image)
}

export function normalizeBookingOptionsResponse(data) {
  if (Array.isArray(data)) {
    return { categories: [], options: data, locations: [] }
  }
  return {
    categories: data?.categories || [],
    options: data?.options || [],
    locations: data?.locations || [],
  }
}

export function resolveLocationMapUrl(requiredOptionNames, serviceLocations) {
  const names = Array.isArray(requiredOptionNames) ? requiredOptionNames : [requiredOptionNames]
  for (const name of names) {
    const trimmed = String(name || '').trim()
    if (!trimmed) continue
    const loc = (serviceLocations || []).find((item) => item.name === trimmed && item.map_url)
    const url = String(loc?.map_url || '').trim()
    if (url) return url
  }
  return ''
}

export const UNCategorized_CATEGORY_ID = '__none__'

export function buildBookableCategories(categories, options) {
  const selectable = options.filter((opt) => !opt.is_required)
  const buckets = new Map()

  for (const cat of categories) {
    const count = selectable.filter((opt) => opt.category_id === cat.id).length
    if (count > 0) buckets.set(cat.id, { ...cat, count })
  }

  const uncategorizedCount = selectable.filter((opt) => !opt.category_id).length
  if (uncategorizedCount > 0) {
    buckets.set(UNCategorized_CATEGORY_ID, {
      id: UNCategorized_CATEGORY_ID,
      name: 'อื่นๆ',
      description: '',
      sort_order: 9999,
      count: uncategorizedCount,
    })
  }

  return [...buckets.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export function optionsForCategory(options, categoryId) {
  return options.filter((opt) => {
    if (opt.is_required) return false
    if (categoryId === UNCategorized_CATEGORY_ID) return !opt.category_id
    return opt.category_id === categoryId
  })
}

export function formatUiText(template, vars = {}) {
  if (!template) return ''
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (vars[key] == null) return ''
    return String(vars[key])
  })
}

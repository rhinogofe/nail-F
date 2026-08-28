import { resolveInlineEditor } from './featureInlineSettings.js'

/** Expected load/save APIs per editor kind (for audit). */
export const EDITOR_API_SPEC = {
  deposit: {
    load: ['GET /api/admin/settings/deposit'],
    save: ['PATCH /api/admin/settings/deposit'],
  },
  coupon: {
    load: ['GET /api/admin/settings/coupon'],
    save: ['PATCH /api/admin/settings/coupon'],
  },
  line: {
    load: ['GET /api/admin/settings/line-push'],
    save: ['PATCH /api/admin/settings/line-push'],
    partial: ['channel_access_token', 'channel_secret', 'use_own_bot', 'test push'],
  },
  'chat-notify': {
    load: ['GET /api/admin/settings/chat-notify'],
    save: ['PATCH /api/admin/settings/chat-notify'],
    partial: ['upcoming_minutes'],
  },
  unpaid: {
    load: ['GET /api/admin/settings/unpaid-auto-cancel'],
    save: ['PATCH /api/admin/settings/unpaid-auto-cancel'],
  },
  'shop-hours': {
    load: ['GET /api/admin/settings/shop-hours'],
    save: ['PATCH /api/admin/settings/shop-hours'],
  },
  'advance-days': {
    load: ['GET /api/admin/settings/advance-days'],
    save: ['PATCH /api/admin/settings/advance-days'],
  },
  'slot-display': {
    load: [
      'GET /api/admin/settings/booking-display',
      'GET /api/admin/settings/booking-slot-hours',
      'GET /api/admin/settings/extend-booking-by-services',
    ],
    save: [
      'PATCH /api/admin/settings/booking-display',
      'PATCH /api/admin/settings/booking-slot-hours',
      'PATCH /api/admin/settings/extend-booking-by-services',
    ],
  },
  'ui-fields': {
    load: ['GET /api/admin/settings/ui'],
    save: ['PATCH /api/admin/settings/ui'],
    partial: ['uploadKind fields (logo, hero, kshop_qr) — URL text only'],
  },
  'ui-section': {
    load: ['GET /api/admin/settings/ui'],
    save: ['PATCH /api/admin/settings/ui'],
    partial: ['uploadKind fields (logo, hero, kshop_qr) — URL text only'],
  },
  reviews: {
    load: ['GET /api/admin/showcase-clips'],
    save: ['POST /api/admin/showcase-clips', 'DELETE /api/admin/showcase-clips/:id'],
  },
  'service-locations': {
    load: ['GET /api/admin/service-locations'],
    save: ['POST /api/admin/service-locations', 'DELETE /api/admin/service-locations/:id'],
  },
  'use-coupon': {
    load: [],
    save: ['PATCH /api/admin/coupons/use'],
  },
  services: {
    load: ['GET /api/admin/nailoptions', 'GET /api/admin/service-categories'],
    save: ['POST/PATCH/DELETE /api/admin/nailoptions'],
    partial: ['per-day service dates — edit in branch admin tab'],
  },
  note: { load: [], save: [] },
  none: { load: [], save: [] },
}

const FULL_KINDS = new Set(
  Object.keys(EDITOR_API_SPEC).filter((k) => k !== 'note' && k !== 'none' && !EDITOR_API_SPEC[k].partial)
)

function flattenCatalogPaths(catalog) {
  const paths = []
  for (const group of catalog || []) {
    for (const item of group.items || []) {
      paths.push({
        groupKey: group.key,
        groupLabel: group.label,
        itemKey: item.key,
        itemLabel: item.label,
        childKey: '',
        setup: item.setup,
        configOnly: Boolean(item.configOnly),
        configNote: item.configNote || '',
      })
      for (const child of item.children || []) {
        paths.push({
          groupKey: group.key,
          groupLabel: group.label,
          itemKey: item.key,
          itemLabel: item.label,
          childKey: child.key,
          childLabel: child.label,
          setup: child.setup,
          configOnly: false,
          configNote: '',
        })
      }
    }
  }
  return paths
}

/** @returns {{ paths: object[], summary: object }} */
export function auditFeatureInlineCoverage(catalog) {
  const paths = flattenCatalogPaths(catalog)
  const rows = paths.map((p) => {
    if (p.configNote) {
      return {
        ...p,
        pathLabel: p.itemLabel,
        editorKind: 'config-note',
        note: p.configNote,
        status: 'config-note',
        partialFields: [],
        loadApis: [],
        saveApis: [],
      }
    }
    if (!p.setup) {
      return {
        ...p,
        pathLabel: p.childKey ? `${p.itemLabel} › ${p.childLabel || p.childKey}` : p.itemLabel,
        editorKind: 'toggle-only',
        note: 'เปิด/ปิดเท่านั้น',
        status: 'toggle-only',
        partialFields: [],
        loadApis: [],
        saveApis: [],
      }
    }
    const editor = resolveInlineEditor(p.setup, p.childKey)
    const spec = EDITOR_API_SPEC[editor.kind] || {}
    const status =
      editor.kind === 'note' || editor.kind === 'none'
        ? 'missing'
        : spec.partial?.length
          ? 'partial'
          : 'full'
    return {
      ...p,
      pathLabel: p.childKey
        ? `${p.itemLabel} › ${p.childLabel || p.childKey}`
        : p.itemLabel,
      editorKind: editor.kind,
      note: editor.note || '',
      status,
      partialFields: spec.partial || [],
      loadApis: spec.load || [],
      saveApis: spec.save || [],
    }
  })

  const summary = {
    total: rows.length,
    full: rows.filter((r) => r.status === 'full').length,
    partial: rows.filter((r) => r.status === 'partial').length,
    missing: rows.filter((r) => r.status === 'missing').length,
    configNote: rows.filter((r) => r.status === 'config-note').length,
    toggleOnly: rows.filter((r) => r.status === 'toggle-only').length,
    configOnly: rows.filter((r) => r.configOnly).length,
  }

  return { paths: rows, summary }
}

export function formatCoverageReport(result) {
  const { paths, summary } = result
  const lines = [
    `สรุป: ครบ ${summary.full}/${summary.total} · บางส่วน ${summary.partial} · ยังไม่มี ${summary.missing} · เปิด/ปิดอย่างเดียว ${summary.toggleOnly} · อ้างอิงตั้งค่า ${summary.configNote}`,
    '',
  ]

  const byStatus = { missing: [], partial: [], full: [], 'config-note': [], 'toggle-only': [] }
  for (const row of paths) {
    byStatus[row.status]?.push(row)
  }

  if (byStatus['toggle-only'].length) {
    lines.push('## เปิด/ปิดอย่างเดียว (ไม่มีตั้งค่าซ้ำ)')
    for (const r of byStatus['toggle-only']) {
      lines.push(`- [${r.groupLabel}] ${r.pathLabel}`)
    }
    lines.push('')
  }

  if (byStatus.missing.length) {
    lines.push('## ยังไม่มีฟอร์ม inline')
    for (const r of byStatus.missing) {
      lines.push(`- [${r.groupLabel}] ${r.pathLabel} → ${r.note || r.editorKind}`)
    }
    lines.push('')
  }

  if (byStatus['config-note'].length) {
    lines.push('## เปิด/ปิดเท่านั้น — ตั้งค่าในกลุ่มอื่น')
    for (const r of byStatus['config-note']) {
      lines.push(`- [${r.groupLabel}] ${r.pathLabel} → ${r.note}`)
    }
    lines.push('')
  }

  if (byStatus.partial.length) {
    lines.push('## ดึง/บันทึกได้บางส่วน')
    for (const r of byStatus.partial) {
      const gaps = r.partialFields.join(', ')
      lines.push(`- [${r.groupLabel}] ${r.pathLabel} (${r.editorKind}) — ขาด: ${gaps}`)
    }
    lines.push('')
  }

  lines.push('## ครบแล้ว')
  for (const r of byStatus.full) {
    lines.push(`- [${r.groupLabel}] ${r.pathLabel} (${r.editorKind})`)
  }

  return lines.join('\n')
}

export { FULL_KINDS }

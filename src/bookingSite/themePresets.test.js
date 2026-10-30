import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultTheme } from './theme.js'
import { THEME_PRESETS, matchingPresetId, applyPresetTheme, contrastRatio, DEFAULT_PRESET_ID } from './themePresets.js'

test('product default theme is Rose Blush', () => {
  assert.equal(DEFAULT_PRESET_ID, 'rose-blush')
  assert.equal(matchingPresetId(defaultTheme), 'rose-blush')
})

test('five named presets exist and keep unique palettes', () => {
  assert.equal(THEME_PRESETS.length, 5)
  const ids = THEME_PRESETS.map(p => p.id)
  assert.deepEqual(ids, ['midnight-gold', 'rose-blush', 'nude-minimal', 'lavender-dream', 'emerald-spa'])
  const bgs = new Set(THEME_PRESETS.map(p => p.theme.bg))
  assert.equal(bgs.size, 5)
})

test('body and service text meet WCAG AA 4.5:1 on page background', () => {
  for (const preset of THEME_PRESETS) {
    const t = preset.theme
    const pairs = [
      ['ink', t.ink],
      ['mute', t.mute],
      ['roomTitle', t.roomTitle],
      ['roomText', t.roomText],
      ['roomLink', t.roomLink],
    ]
    for (const [name, fg] of pairs) {
      const ratio = contrastRatio(fg, t.bg)
      assert.ok(ratio >= 4.5, `${preset.id} ${name} on bg = ${ratio.toFixed(2)}`)
    }
    const btn = contrastRatio(t.heroBtnText, t.heroBtnBg)
    assert.ok(btn >= 4.5, `${preset.id} hero button = ${btn.toFixed(2)}`)
    const barBtn = contrastRatio(t.heroBarBtnText, t.heroBarBtnBg)
    assert.ok(barBtn >= 4.5, `${preset.id} bar button = ${barBtn.toFixed(2)}`)
    const hero = contrastRatio(t.heroText, t.bg)
    assert.ok(hero >= 4.5, `${preset.id} hero text on bg = ${hero.toFixed(2)}`)
  }
})

test('apply and match round-trip', () => {
  const rose = THEME_PRESETS.find(p => p.id === 'rose-blush')
  const applied = applyPresetTheme(rose)
  assert.equal(matchingPresetId(applied), 'rose-blush')
  applied.mute = '#000000'
  assert.equal(matchingPresetId(applied), null)
})

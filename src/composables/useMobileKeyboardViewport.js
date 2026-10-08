import { nextTick, onUnmounted, ref } from 'vue'

/** ปรับความสูงหน้า + padding ตามคีย์บอร์ด (LINE / Safari in-app) */
export function useMobileKeyboardViewport() {
  const pageRef = ref(null)
  const keyboardOpen = ref(false)
  let teardown = null

  function scrollFieldIntoView(event) {
    const el = event?.target
    if (!el || typeof el.scrollIntoView !== 'function') return
    if (!el.matches?.('input, textarea, select')) return
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    }, 320)
  }

  function bindPageEl(pageEl) {
    const vv = window.visualViewport
    if (!vv || !pageEl) return () => {}

    const apply = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      keyboardOpen.value = gap > 72
      pageEl.style.setProperty('--page-vv-height', `${Math.round(vv.height)}px`)
      pageEl.style.setProperty('--page-keyboard-gap', `${Math.round(gap)}px`)
    }

    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      pageEl.style.removeProperty('--page-vv-height')
      pageEl.style.removeProperty('--page-keyboard-gap')
    }
  }

  async function mountViewportBindings() {
    await nextTick()
    teardown?.()
    teardown = bindPageEl(pageRef.value)
  }

  onUnmounted(() => {
    teardown?.()
    teardown = null
  })

  return {
    pageRef,
    keyboardOpen,
    scrollFieldIntoView,
    mountViewportBindings,
  }
}

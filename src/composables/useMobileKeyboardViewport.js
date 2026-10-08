import { nextTick, onUnmounted, ref } from 'vue'

const ROOT_KEYBOARD_CLASS = 'mobile-keyboard-layout'

export function isInAppBrowser() {
  const ua = navigator.userAgent || ''
  return /Line\//i.test(ua)
    || /FBAN|FBAV/i.test(ua)
    || /Instagram/i.test(ua)
    || /MicroMessenger/i.test(ua)
}

function clearRootKeyboardLayout() {
  const root = document.documentElement
  root.classList.remove(ROOT_KEYBOARD_CLASS)
  root.style.removeProperty('--mobile-vv-top')
  root.style.removeProperty('--mobile-vv-height')
  root.style.removeProperty('--mobile-keyboard-inset')
}

/** ปรับความสูง root (#app) + padding ตามคีย์บอร์ด (LINE / Safari in-app) */
export function useMobileKeyboardViewport() {
  const pageRef = ref(null)
  const keyboardOpen = ref(false)
  let teardown = null

  function scrollFieldIntoView(event) {
    if (isInAppBrowser()) return
    const el = event?.target
    if (!el || typeof el.scrollIntoView !== 'function') return
    if (!el.matches?.('input, textarea, select')) return
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }, 280)
  }

  function bindPageEl(pageEl) {
    const vv = window.visualViewport
    if (!pageEl) return () => {}

    const apply = () => {
      if (!vv) {
        keyboardOpen.value = false
        clearRootKeyboardLayout()
        return
      }

      const shrink = window.innerHeight - vv.height
      const open = shrink > 72 || vv.height < window.innerHeight * 0.78
      keyboardOpen.value = open

      const inset = Math.max(0, Math.round(shrink))
      pageEl.style.setProperty('--page-keyboard-gap', `${inset}px`)

      const root = document.documentElement
      if (open) {
        root.classList.add(ROOT_KEYBOARD_CLASS)
        root.style.setProperty('--mobile-vv-top', `${Math.round(vv.offsetTop)}px`)
        root.style.setProperty('--mobile-vv-height', `${Math.round(vv.height)}px`)
        root.style.setProperty('--mobile-keyboard-inset', `${inset}px`)
      } else {
        clearRootKeyboardLayout()
      }
    }

    const onFocusIn = (event) => {
      if (!event.target?.matches?.('input, textarea, select')) return
      keyboardOpen.value = true
      window.setTimeout(apply, 50)
      window.setTimeout(apply, 320)
    }

    const onFocusOut = () => {
      window.setTimeout(apply, 120)
    }

    apply()
    pageEl.addEventListener('focusin', onFocusIn)
    pageEl.addEventListener('focusout', onFocusOut)
    if (vv) {
      vv.addEventListener('resize', apply)
      vv.addEventListener('scroll', apply)
    }
    return () => {
      pageEl.removeEventListener('focusin', onFocusIn)
      pageEl.removeEventListener('focusout', onFocusOut)
      if (vv) {
        vv.removeEventListener('resize', apply)
        vv.removeEventListener('scroll', apply)
      }
      pageEl.style.removeProperty('--page-keyboard-gap')
      clearRootKeyboardLayout()
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
    clearRootKeyboardLayout()
  })

  return {
    pageRef,
    keyboardOpen,
    scrollFieldIntoView,
    mountViewportBindings,
  }
}

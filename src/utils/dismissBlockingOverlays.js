import Swal from 'sweetalert2'

let overlayCleanupTimers = []

export function dismissBlockingOverlays() {
  if (typeof document === 'undefined') return

  if (Swal.isVisible()) {
    Swal.close()
  }

  document.body.classList.remove('swal2-shown', 'swal2-height-auto')
  document.body.style.removeProperty('padding-right')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('pointer-events')
  document.documentElement.style.removeProperty('overflow')
  document.documentElement.style.removeProperty('pointer-events')

  document.querySelectorAll('.swal2-container').forEach((el) => el.remove())
}

export function scheduleOverlayCleanup(delaysMs = [0, 80, 200, 500, 1000]) {
  overlayCleanupTimers.forEach((timer) => clearTimeout(timer))
  overlayCleanupTimers = delaysMs.map((delay) => setTimeout(() => {
    dismissBlockingOverlays()
  }, delay))
}

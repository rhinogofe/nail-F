import Swal from 'sweetalert2'

export function dismissBlockingOverlays() {
  if (typeof document === 'undefined') return

  if (Swal.isVisible()) {
    Swal.close()
  }

  document.body.classList.remove('swal2-shown', 'swal2-height-auto')
  document.body.style.removeProperty('padding-right')
  document.body.style.removeProperty('overflow')
  document.documentElement.style.removeProperty('overflow')

  document.querySelectorAll('.swal2-container').forEach((el) => el.remove())
}

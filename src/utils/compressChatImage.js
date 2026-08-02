/**
 * Resize and compress an image file for chat upload (max ~2MB server limit).
 */
export function compressChatImage(file, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('เลือกไฟล์รูปภาพเท่านั้น'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'))
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, 1))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('ไม่สามารถประมวลผลรูปได้'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('บีบอัดรูปไม่สำเร็จ'))
              return
            }
            const blobReader = new FileReader()
            blobReader.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'))
            blobReader.onload = () => {
              const dataUrl = blobReader.result
              const base64 = String(dataUrl).split(',')[1] || ''
              resolve({ base64, mime: 'image/jpeg' })
            }
            blobReader.readAsDataURL(blob)
          },
          'image/jpeg',
          quality
        )
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

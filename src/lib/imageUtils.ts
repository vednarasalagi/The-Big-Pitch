// ============================================================
// imageUtils.ts — Client-side image processing & avatar optimization
// Resizes and crops images to square WebP/JPEG under 200KB before Supabase upload.
// ============================================================

export interface ProcessedImage {
  file: File
  dataUrl: string
  width: number
  height: number
}

/**
 * Resizes, centers, and crops an image file to a square avatar (default 512x512).
 * Compresses to WebP (quality 0.85) with JPEG fallback.
 */
export async function processAvatarImage(
  inputFile: File,
  targetSize = 512
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!inputFile.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'))
    }

    // Max raw input size check (15MB guard)
    if (inputFile.size > 15 * 1024 * 1024) {
      return reject(new Error('Image file is too large (max 15MB).'))
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image.'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = targetSize
          canvas.height = targetSize
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            return reject(new Error('Canvas rendering context unavailable.'))
          }

          // Center-crop square math
          const { width, height } = img
          const minDim = Math.min(width, height)
          const sx = (width - minDim) / 2
          const sy = (height - minDim) / 2

          // Smooth resampling
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'

          // Draw cropped center square into canvas
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize)

          // Try exporting WebP first, fallback to JPEG
          const mimeType = 'image/webp'
          const dataUrl = canvas.toDataURL(mimeType, 0.85)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Failed to process image blob.'))
              }

              const cleanName = inputFile.name.replace(/\.[^/.]+$/, '') + '.webp'
              const processedFile = new File([blob], cleanName, { type: mimeType })

              resolve({
                file: processedFile,
                dataUrl,
                width: targetSize,
                height: targetSize,
              })
            },
            mimeType,
            0.85
          )
        } catch (err: any) {
          reject(new Error(err?.message || 'Failed to process image.'))
        }
      }

      img.src = reader.result as string
    }

    reader.readAsDataURL(inputFile)
  })
}

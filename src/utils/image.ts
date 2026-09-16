/**
 * Client-side image helpers for the org logo.
 *
 * The project has no Firebase Storage bucket wired up, so the logo lives inline
 * on the organization document as a data URL. Firestore caps a document at 1 MB,
 * and the org doc is fetched on every app boot — so we downscale hard before
 * storing: a logo never needs to be bigger than the ~35 mm box it occupies on an
 * A4 PDF header.
 */

/** Longest edge of the stored logo, in pixels — ample for print at 300 dpi. */
const MAX_LOGO_EDGE = 480

/** Reject anything that would bloat the org doc before we even decode it. */
export const MAX_LOGO_UPLOAD_BYTES = 5 * 1024 * 1024

/** Encoded size ceiling after downscaling — keeps the org doc small. */
const MAX_ENCODED_BYTES = 200 * 1024

export class ImageError extends Error {}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new ImageError('Could not read that file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImageError('That file is not a readable image'))
    img.src = src
  })
}

/**
 * Downscale an uploaded logo to a data URL suitable for Firestore and jsPDF.
 *
 * PNG is kept (logos need transparency); everything else is re-encoded as JPEG.
 * If a transparent PNG still comes out too large, it is flattened onto white and
 * re-encoded as JPEG rather than rejected.
 */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Please choose an image file (PNG or JPG)')
  }
  if (file.size > MAX_LOGO_UPLOAD_BYTES) {
    throw new ImageError('That image is larger than 5 MB — please choose a smaller one')
  }

  const img = await loadImage(await readAsDataUrl(file))
  const scale = Math.min(1, MAX_LOGO_EDGE / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  function encode(type: 'image/png' | 'image/jpeg', quality?: number): string {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageError('Your browser could not process that image')
    if (type === 'image/jpeg') {
      // JPEG has no alpha — flatten onto white so transparency doesn't go black
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL(type, quality)
  }

  const isPng = file.type === 'image/png'
  let dataUrl = isPng ? encode('image/png') : encode('image/jpeg', 0.9)

  // Still heavy? Fall back to progressively cheaper JPEG.
  for (const quality of [0.8, 0.65, 0.5]) {
    if (dataUrlBytes(dataUrl) <= MAX_ENCODED_BYTES) break
    dataUrl = encode('image/jpeg', quality)
  }
  if (dataUrlBytes(dataUrl) > MAX_ENCODED_BYTES) {
    throw new ImageError('That image is too detailed to store — please use a simpler logo')
  }

  return dataUrl
}

/** Approximate decoded byte length of a data URL's base64 payload. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

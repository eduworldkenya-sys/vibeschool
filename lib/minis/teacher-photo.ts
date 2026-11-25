import sharp from 'sharp'

const formats = {
  jpg: { mime: 'image/jpeg', format: 'jpeg' },
  png: { mime: 'image/png', format: 'png' },
  webp: { mime: 'image/webp', format: 'webp' },
} as const

/** Decode the immutable cover bytes and reject oversized, malformed or animated images. */
export async function validTeacherMiniPhoto(photo: Blob, extension: string): Promise<boolean> {
  const expected = Object.hasOwn(formats, extension) ? formats[extension as keyof typeof formats] : null
  if (!expected || photo.type !== expected.mime || photo.size < 100 || photo.size > 5 * 1024 * 1024) return false
  try {
    const image = sharp(Buffer.from(await photo.arrayBuffer()), { limitInputPixels: 16_000_000, failOn: 'warning' })
    const { format, width, height, pages, exif, iptc, xmp } = await image.metadata()
    if (format !== expected.format || !width || !height || (pages ?? 1) !== 1 || exif || iptc || xmp) return false
    await image.resize({ width: 32, height: 32, fit: 'inside' }).toBuffer()
    return true
  } catch {
    return false
  }
}

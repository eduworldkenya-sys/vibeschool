/** Create a real 4:3 crop, not a CSS-only preview. Input stays on the device. */
export async function prepareMiniPhoto(source: File, rotation: number, zoom: number): Promise<File> {
  if (!['image/jpeg','image/png','image/webp'].includes(source.type) ||
      source.size > 5 * 1024 * 1024 || source.size < 100) {
    throw new Error('Choose a JPG, PNG or WebP image under 5 MB.')
  }
  if (![0,90,180,270].includes(rotation) || !Number.isFinite(zoom) || zoom < 1 || zoom > 2) {
    throw new Error('Invalid photo adjustments.')
  }
  const bitmap = await createImageBitmap(source)
  try {
    const width = 1200
    const height = 900
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Photo editing is unavailable on this device.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0,0,width,height)
    const turned = rotation % 180 !== 0
    const rotatedWidth = turned ? bitmap.height : bitmap.width
    const rotatedHeight = turned ? bitmap.width : bitmap.height
    const fit = Math.max(width / rotatedWidth, height / rotatedHeight) * zoom
    ctx.translate(width/2,height/2)
    ctx.rotate(rotation * Math.PI / 180)
    ctx.scale(fit,fit)
    ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2)
    const blob = await new Promise<Blob>((resolve,reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Unable to process image.')),'image/jpeg',0.86)
    })
    if (blob.size > 5*1024*1024) throw new Error('Edited photo is too large.')
    return new File([blob], 'mini-cover.jpg', { type:'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

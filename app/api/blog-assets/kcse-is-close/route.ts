import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

const assetDir = join(process.cwd(), 'app', 'api', 'blog-assets', 'kcse-is-close')
const base64 = [
  readFileSync(join(assetDir, 'chunk1.txt'), 'utf8'),
  readFileSync(join(assetDir, 'chunk2.txt'), 'utf8'),
  readFileSync(join(assetDir, 'chunk3.txt'), 'utf8'),
  readFileSync(join(assetDir, 'chunk4.txt'), 'utf8'),
  readFileSync(join(assetDir, 'chunk5.txt'), 'utf8'),
  readFileSync(join(assetDir, 'chunk6.txt'), 'utf8'),
].join('')
const image = Buffer.from(base64, 'base64')

export async function GET() {
  return new Response(image, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(image.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

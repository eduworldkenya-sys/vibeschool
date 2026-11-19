import { renderVibeMe } from '@/lib/vibeme'
export function GET(_request: Request, { params }: { params: { code: string } }) {
  const code = params.code.endsWith('.svg') ? params.code.slice(0,-4) : ''
  const svg = renderVibeMe(code)
  if (!svg) return new Response('Invalid avatar', { status: 404 })
  return new Response(svg, { headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
  } })
}

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const variants = {
  '192': { size: 192, maskable: false },
  '512': { size: 512, maskable: false },
  'maskable-512': { size: 512, maskable: true },
} as const

type Variant = keyof typeof variants

export async function GET(
  request: Request,
  { params }: { params: Promise<{ variant: string }> }
) {
  const { variant } = await params
  if (!(variant in variants)) {
    return new Response('Not found', { status: 404 })
  }

  const { size, maskable } = variants[variant as Variant]
  const padding = maskable ? Math.round(size * 0.16) : Math.round(size * 0.08)
  const logoUrl = new URL('/icons/vibeschool-logo.png', request.url).toString()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070B1F',
          padding,
          boxSizing: 'border-box',
        }}
      >
        <img
          src={logoUrl}
          alt=""
          width={size - padding * 2}
          height={size - padding * 2}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    }
  )
}

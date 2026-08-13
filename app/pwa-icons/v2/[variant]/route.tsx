import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const variants = {
  '192': { size: 192, maskable: false },
  '512': { size: 512, maskable: false },
  'maskable-512': { size: 512, maskable: true },
} as const

type Variant = keyof typeof variants

export async function GET(
  _request: Request,
  { params }: { params: { variant: string } }
) {
  if (!(params.variant in variants)) {
    return new Response('Not found', { status: 404 })
  }

  const { size, maskable } = variants[params.variant as Variant]
  const inset = maskable ? 52 : 0
  const inner = size - inset * 2

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
        }}
      >
        <svg
          width={inner}
          height={inner}
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="left" x1="120" y1="95" x2="310" y2="405" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B5CFF" />
              <stop offset="0.48" stopColor="#7C3AED" />
              <stop offset="1" stopColor="#FF1493" />
            </linearGradient>
            <linearGradient id="right" x1="360" y1="80" x2="245" y2="400" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFC629" />
              <stop offset="0.52" stopColor="#FF6B35" />
              <stop offset="1" stopColor="#F72585" />
            </linearGradient>
            <linearGradient id="dot" x1="235" y1="130" x2="290" y2="205" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFC629" />
              <stop offset="1" stopColor="#FF4D6D" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="112" fill="#070B1F" />
          <path d="M126 119C112 98 125 78 149 84C194 95 220 124 241 165L301 283C314 309 321 327 347 289L413 139C424 114 447 99 468 104C487 109 492 127 482 148L391 342C369 389 341 420 298 427C249 435 214 407 190 362L91 175C75 145 86 113 108 111C114 111 120 114 126 119Z" fill="url(#left)" />
          <path d="M293 390C320 391 343 366 360 332L432 174C443 149 458 127 478 122C489 119 495 128 490 141L399 346C373 405 337 435 287 430C268 428 250 421 235 410C252 419 273 421 293 390Z" fill="url(#right)" />
          <circle cx="272" cy="151" r="39" fill="url(#dot)" />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }
  )
}

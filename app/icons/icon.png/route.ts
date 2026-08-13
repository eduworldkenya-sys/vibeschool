import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const sizeParam = new URL(request.url).searchParams.get('size')
  const size = sizeParam === '192' ? 192 : 512

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#05050F',
          borderRadius: size * 0.22,
          color: '#F5A623',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: size * 0.45,
            lineHeight: 1,
            fontWeight: 700,
            fontFamily: 'Georgia',
          }}
        >
          V
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: size * 0.035,
            fontSize: size * 0.13,
            lineHeight: 1,
            letterSpacing: size * 0.01,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'Georgia',
          }}
        >
          VIBE
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}

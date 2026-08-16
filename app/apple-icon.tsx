import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          padding: 18,
          boxSizing: 'border-box',
        }}
      >
        <img
          src="https://www.vibeschool.co.ke/icons/vibeschool-logo.png"
          alt=""
          width="144"
          height="144"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    ),
    size
  )
}

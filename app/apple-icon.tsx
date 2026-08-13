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
        }}
      >
        <svg width="148" height="148" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="apple-left" x1="120" y1="110" x2="275" y2="390" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#8B3DFF" />
              <stop offset="0.52" stopColor="#B516E8" />
              <stop offset="1" stopColor="#F2128C" />
            </linearGradient>
            <linearGradient id="apple-right" x1="395" y1="105" x2="265" y2="390" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FFC92F" />
              <stop offset="0.48" stopColor="#FF7044" />
              <stop offset="1" stopColor="#F2128C" />
            </linearGradient>
            <linearGradient id="apple-dot" x1="230" y1="105" x2="285" y2="160" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFC92F" />
              <stop offset="1" stopColor="#FF4B55" />
            </linearGradient>
          </defs>
          <path d="M128 132 C113 106 132 86 156 103 L273 325 C281 340 294 340 303 325" fill="none" stroke="url(#apple-left)" strokeWidth="70" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M385 122 L301 327 C291 351 272 363 250 351" fill="none" stroke="url(#apple-right)" strokeWidth="70" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M421 164 L336 349 C326 371 313 385 295 392" fill="none" stroke="#6F3CFF" strokeWidth="28" strokeLinecap="round" />
          <circle cx="260" cy="126" r="33" fill="url(#apple-dot)" />
        </svg>
      </div>
    ),
    size
  )
}

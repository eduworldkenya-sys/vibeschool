import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Someone sent you a private Success Card — tap to open'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', alignItems: 'center', background: 'linear-gradient(130deg,#080D19,#182B49 58%,#080D19)', color: '#F6E8C2', padding: '68px 78px', fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: 48, top: 90, width: 425, height: 425, borderRadius: '50%', background: 'radial-gradient(circle,rgba(214,174,84,.27),rgba(214,174,84,0) 68%)', display: 'flex' }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch', width: 690, zIndex: 1 }}>
        <div style={{ fontFamily: 'Arial, sans-serif', letterSpacing: 4, fontSize: 22, color: '#D9B65F' }}>VIBESCHOOL · SUCCESS WISHES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 62, fontWeight: 700, letterSpacing: -2, lineHeight: 1.12 }}>Someone sent you<br/>a Success Card.</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 28, color: '#E1DDCF' }}>A special message is waiting for you.</div>
        </div>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 24, color: '#DCB85F', letterSpacing: 1 }}>TAP TO OPEN YOUR SURPRISE</div>
      </div>
      <div style={{ position: 'absolute', right: 85, top: 192, display: 'flex', width: 362, height: 240, background: 'linear-gradient(150deg,#E3C479,#AE823A)', borderRadius: 12, boxShadow: '0 28px 65px rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-8deg)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120, background: '#D1A856', clipPath: 'polygon(0 0,100% 0,50% 96%)', display: 'flex' }} />
        <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#172640', border: '3px solid #F5DA9A', alignItems: 'center', justifyContent: 'center', display: 'flex', zIndex: 1, fontSize: 36, color: '#F5DA9A' }}>✦</div>
      </div>
    </div>,
    size
  )
}

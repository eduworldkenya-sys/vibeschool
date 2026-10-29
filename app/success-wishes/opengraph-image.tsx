import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Success Wishes by VibeSchool — Wish students good luck and success'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: 'linear-gradient(140deg, #080F21 0%, #142847 60%, #091225 100%)', color: '#F6E8C2', padding: '68px 78px', fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -180, right: -130, width: 690, height: 690, borderRadius: '50%', border: '2px solid rgba(214,174,84,.18)', display: 'flex' }} />
      <div style={{ position: 'absolute', top: -85, right: -30, width: 500, height: 500, borderRadius: '50%', border: '2px solid rgba(214,174,84,.12)', display: 'flex' }} />
      <div style={{ position: 'absolute', top: 85, right: 135, width: 330, height: 250, transform: 'rotate(-10deg)', borderRadius: 12, background: 'linear-gradient(155deg, #E9CB81, #A77C2F)', boxShadow: '0 32px 70px rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 294, height: 216, border: '2px solid rgba(255,239,192,.85)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 56, color: '#17233B' }}>✦</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 760, zIndex: 1 }}>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 22, letterSpacing: 4, color: '#D9B65F' }}>VIBESCHOOL · SUCCESS WISHES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
          <div style={{ fontSize: 65, fontWeight: 700, lineHeight: 1.13, letterSpacing: -2 }}>Wish students<br/>good luck &amp; success.</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 29, color: '#E6DFD1' }}>Send a personalised Success Card.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: 'Arial, sans-serif', fontSize: 25 }}>
          <span style={{ background: '#D6AD55', color: '#111D30', borderRadius: 8, padding: '14px 23px', fontWeight: 700 }}>KSh 50</span>
          <span style={{ color: '#DBC58D' }}>vibeschool.co.ke</span>
        </div>
      </div>
    </div>,
    size
  )
}

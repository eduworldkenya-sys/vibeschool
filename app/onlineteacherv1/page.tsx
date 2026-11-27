import Link from 'next/link'
import { Video, ArrowRight, ArrowLeft } from 'lucide-react'

export default function OnlineTeacherV1() {
  const enabled = process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED === 'true'
  return (
    <main style={{minHeight:'100dvh',background:'#f5f7f6',color:'#172b22',fontFamily:'var(--font-jakarta),system-ui,sans-serif'}}>
      <header style={{background:'#fff',borderBottom:'1px solid #dfe5e1',padding:'16px clamp(16px,4vw,40px)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div><strong style={{fontSize:22,letterSpacing:'-1px',color:'#164b37'}}>VibeSchool.</strong><div style={{fontSize:11,letterSpacing:'1.2px',color:'#53665b'}}>ONLINE TEACHER</div></div>
        <Link href="/teacher/pulse" style={{display:'inline-flex',alignItems:'center',gap:6,color:'#164b37',fontSize:13}}><ArrowLeft size={16} aria-hidden="true"/> Teacher workspace</Link>
      </header>
      <section style={{maxWidth:960,margin:'0 auto',padding:'clamp(20px,5vw,48px) 16px'}}>
        <h1 style={{fontSize:'clamp(24px,4vw,32px)',letterSpacing:'-.8px',margin:'0 0 20px'}}>Online teaching</h1>
        <section aria-labelledby="live-heading" style={{background:'#153c2e',color:'#fff',borderRadius:12,padding:'clamp(20px,4vw,36px)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
          <div><Video size={30} aria-hidden="true"/><h2 id="live-heading" style={{margin:'12px 0 6px',fontSize:24}}>Ready to teach?</h2><p style={{margin:0,color:'#d3e6dc'}}>Start or resume an online class.</p></div>
          {enabled ? <Link href="/onlineteacherv1/live" style={{display:'inline-flex',alignItems:'center',gap:10,minHeight:48,borderRadius:7,padding:'12px 20px',background:'#fff',color:'#153c2e',fontWeight:700,textDecoration:'none'}}>Go Live <ArrowRight size={18} aria-hidden="true"/></Link>:<p role="status">Live classroom is not enabled.</p>}
        </section>
      </section>
    </main>
  )
}

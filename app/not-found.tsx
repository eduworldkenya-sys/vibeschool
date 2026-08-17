import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export default function NotFound() {
  return <div style={{minHeight:'100dvh',background:'#f8f8f5',color:'#111827',fontFamily:'var(--font-jakarta),Arial,sans-serif'}}>
    <PublicHeader />
    <main id="main-content" style={{maxWidth:900,margin:'0 auto',padding:'96px 20px 120px'}}>
      <p style={{font:'850 11px var(--font-mono),monospace',letterSpacing:'.16em',color:'#725815'}}>404 · PAGE NOT FOUND</p>
      <h1 style={{fontFamily:'var(--font-display),Arial,sans-serif',fontSize:'clamp(44px,7vw,76px)',lineHeight:1.02,letterSpacing:'-.045em',margin:'14px 0 24px'}}>This page is not where we expected it to be.</h1>
      <p style={{maxWidth:690,fontSize:18,lineHeight:1.7,color:'#5d6673'}}>The link may be old, incomplete or unavailable. You can return home, explore Pathways, find learning resources or contact VibeSchool if you expected something important to be here.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:30}}>
        <Link href="/" style={{padding:'13px 18px',borderRadius:10,background:'#111827',color:'#fff',textDecoration:'none',fontWeight:850}}>VibeSchool home</Link>
        <Link href="/pathways" style={{padding:'13px 18px',borderRadius:10,border:'1px solid #d4d7dc',color:'#222a35',textDecoration:'none',fontWeight:850}}>Explore Pathways</Link>
        <Link href="/global" style={{padding:'13px 18px',borderRadius:10,border:'1px solid #d4d7dc',color:'#222a35',textDecoration:'none',fontWeight:850}}>Start learning</Link>
        <Link href="/contact" style={{padding:'13px 18px',borderRadius:10,color:'#725815',textDecoration:'none',fontWeight:850}}>Contact us →</Link>
      </div>
    </main>
    <PublicFooter />
  </div>
}

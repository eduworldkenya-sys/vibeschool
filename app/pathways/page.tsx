import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pathways Kenya',
  description: 'Free Kenyan Senior School pathway guidance. Explore STEM, Social Sciences and Arts & Sports Science, check your direction, and find source-verified school offerings.',
  alternates: { canonical: 'https://www.vibeschool.co.ke/pathways' },
  openGraph: {
    title: 'VibeSchool Pathways Kenya',
    description: 'Understand Senior School pathways, explore your direction and verify school offerings before acting.',
    url: 'https://www.vibeschool.co.ke/pathways',
    siteName: 'VibeSchool',
    type: 'website',
  },
}

const families = [
  { id:'stem', name:'STEM', summary:'Science, technology, engineering and mathematics.' },
  { id:'social-sciences', name:'Social Sciences', summary:'Social, humanities, language and business-oriented directions.' },
  { id:'arts-and-sports-science', name:'Arts & Sports Science', summary:'Arts, creative expression and sports-oriented directions.' },
] as const

export default function PathwaysPage() {
  return <main style={S.root}><div style={S.shell}>
    <header style={S.header}>
      <Link href="/" style={S.brand} aria-label="VibeSchool home"><Image src="/icons/vibeschool-logo.png" alt="VibeSchool" width={38} height={38} style={S.logo}/><span>VibeSchool</span></Link>
      <nav style={S.nav} aria-label="Pathways navigation"><Link href="/pathways/schools" style={S.navLink}>Schools</Link><Link href="/login" style={S.signIn}>Sign in</Link></nav>
    </header>

    <section style={S.hero}>
      <p style={S.kicker}>VIBESCHOOL PATHWAYS · KENYA</p>
      <h1 style={S.title}>Make the next education decision with evidence, not guesswork.</h1>
      <p style={S.lead}>Start free without an account. Understand the three Senior School pathway families, get an early direction check, and only treat a school offering as verified when VibeSchool has source evidence for it.</p>
      <div style={S.actions}><Link href="/pathways/check" style={S.primary}>Check my direction</Link><Link href="/pathways/schools" style={S.secondary}>Find verified schools</Link></div>
      <div style={S.pills}><span style={S.pill}>No login to start</span><span style={S.pill}>No official-placement claim</span><span style={S.pill}>Unverified data stays unverified</span></div>
    </section>

    <section style={S.section} aria-labelledby="families-heading">
      <p style={S.kicker}>KENYA SENIOR SCHOOL</p><h2 id="families-heading" style={S.h2}>Three pathway families</h2>
      <p style={S.note}>These high-level families are represented as source-backed canonical Pathways records. Detailed tracks, subject combinations, careers and school offerings are published separately only when their own evidence is available.</p>
      <div style={S.grid}>{families.map(f => <article id={f.id} key={f.id} style={S.card}><span style={S.cardLabel}>PATHWAY FAMILY</span><h3 style={S.cardTitle}>{f.name}</h3><p style={S.cardBody}>{f.summary}</p><Link href="/pathways/check" style={S.cardLink}>See whether this direction fits →</Link></article>)}</div>
    </section>

    <section style={S.promise}><p style={S.kickerLight}>PATHWAYS PRODUCT CONTRACT</p><h2 style={S.promiseTitle}>Ask → Understand → Verify → Act</h2><p style={S.promiseBody}>Pathways is a decision layer over VibeSchool’s canonical learner, curriculum and school systems. It does not create a second school directory, a second learner identity, or a second authentication authority.</p></section>

    <footer style={S.footer}>VibeSchool guidance is educational guidance, not an official Ministry placement decision. Official facts and VibeSchool interpretation are kept distinct.</footer>
  </div></main>
}

const S: Record<string, CSSProperties> = {
  root:{minHeight:'100vh',background:'#f7f7fb',color:'#101018'},shell:{width:'min(1120px,100%)',margin:'0 auto',padding:'0 18px 56px'},
  header:{minHeight:72,display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #e7e7ef'},brand:{display:'flex',alignItems:'center',gap:9,color:'#0a0a0f',textDecoration:'none',fontWeight:850,fontSize:21},logo:{objectFit:'contain'},nav:{display:'flex',alignItems:'center',gap:10},navLink:{color:'#414155',fontSize:13,fontWeight:750,textDecoration:'none'},signIn:{color:'#242438',fontSize:13,fontWeight:800,textDecoration:'none',border:'1px solid #d7d7e2',borderRadius:999,padding:'9px 14px',background:'#fff'},
  hero:{padding:'72px 0 54px',maxWidth:900},kicker:{margin:'0 0 10px',fontSize:10,fontWeight:900,letterSpacing:'.17em',color:'#725815'},title:{margin:0,maxWidth:900,fontSize:'clamp(40px,7vw,70px)',lineHeight:1.01,letterSpacing:'-.048em'},lead:{maxWidth:780,margin:'24px 0 0',color:'#555568',fontSize:'clamp(16px,2.2vw,20px)',lineHeight:1.6},actions:{display:'flex',flexWrap:'wrap',gap:10,marginTop:25},primary:{padding:'14px 18px',borderRadius:14,background:'#4f46e5',color:'#fff',textDecoration:'none',fontWeight:850,fontSize:14},secondary:{padding:'13px 18px',borderRadius:14,border:'1px solid #d8d9e3',background:'#fff',color:'#3730a3',textDecoration:'none',fontWeight:850,fontSize:14},pills:{display:'flex',flexWrap:'wrap',gap:8,marginTop:24},pill:{border:'1px solid #dedee8',background:'#fff',borderRadius:999,padding:'8px 11px',fontSize:11,fontWeight:750,color:'#555568'},
  section:{padding:'28px 0 64px'},h2:{margin:0,fontSize:'clamp(28px,4vw,38px)',letterSpacing:'-.03em'},note:{maxWidth:760,color:'#666677',fontSize:13,lineHeight:1.65},grid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14,marginTop:20},card:{padding:23,border:'1px solid #dfdfe8',borderRadius:20,background:'#fff'},cardLabel:{fontSize:9,fontWeight:900,letterSpacing:'.15em',color:'#806216'},cardTitle:{fontSize:23,margin:'15px 0 7px'},cardBody:{margin:0,color:'#626272',fontSize:14,lineHeight:1.55},cardLink:{display:'inline-block',marginTop:18,color:'#4f46e5',fontSize:12,fontWeight:850,textDecoration:'none'},
  promise:{borderRadius:24,background:'#0c0c16',color:'#fff',padding:'clamp(28px,6vw,56px)',marginBottom:56},kickerLight:{margin:'0 0 10px',fontSize:10,fontWeight:900,letterSpacing:'.17em',color:'#d5b95c'},promiseTitle:{margin:0,fontSize:'clamp(30px,5vw,48px)',letterSpacing:'-.035em'},promiseBody:{maxWidth:760,color:'#cacada',fontSize:15,lineHeight:1.7},footer:{borderTop:'1px solid #e2e2ea',paddingTop:24,color:'#777786',fontSize:11,lineHeight:1.6}
}

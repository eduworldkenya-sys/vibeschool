import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pathways Kenya | VibeSchool',
  description: 'Free Kenyan education pathway guidance from VibeSchool. Explore pathways, careers, subjects and senior-school decisions with clear next steps.',
  alternates: { canonical: 'https://www.vibeschool.co.ke/pathways' },
}

const pathwayFamilies = [
  { id: 'stem', name: 'STEM', summary: 'Science, technology, engineering and mathematics.' },
  { id: 'social-sciences', name: 'Social Sciences', summary: 'People, society, languages, humanities and business-related directions.' },
  { id: 'arts-and-sports-science', name: 'Arts & Sports Science', summary: 'Creative, performance, visual arts and sports-related directions.' },
] as const

export default function PathwaysPage() {
  return <main style={S.root}><div style={S.shell}>
    <header style={S.header}>
      <Link href="/" aria-label="VibeSchool home" style={S.brand}><img src="/icons/vibeschool-logo.png" alt="VibeSchool" style={S.logo} /></Link>
      <Link href="/" style={S.signIn}>Sign in</Link>
    </header>

    <section style={S.hero}>
      <p style={S.kicker}>VIBESCHOOL PATHWAYS · KENYA</p>
      <h1 style={S.title}>What educational decision do you need help with?</h1>
      <p style={S.lead}>Start with what you know. Get useful guidance before VibeSchool asks you to create an account.</p>
      <div style={S.trustRow}><span style={S.pill}>Free to explore</span><span style={S.pill}>No login to start</span><span style={S.pill}>Evidence before claims</span></div>
      <Link href="/pathways/check" style={S.primary}>Check my direction — free</Link>
    </section>

    <section style={S.section}>
      <p style={S.kicker}>START WHERE YOU ARE</p>
      <h2 style={S.h2}>Choose the easiest starting point</h2>
      <div style={S.grid}>
        <Link href="/pathways/check" style={S.card}><span style={S.cardEyebrow}>START HERE</span><strong style={S.cardTitle}>I am not sure which direction fits me</strong><span style={S.body}>Answer six short questions and get an early indication. No login required.</span><span style={S.cardAction}>Check my direction →</span></Link>
        <Link href="/learn/careers" style={S.card}><span style={S.cardEyebrow}>CAREER</span><strong style={S.cardTitle}>I know what I want to become</strong><span style={S.body}>Start from a career and explore the learning direction behind it.</span><span style={S.cardAction}>Explore careers →</span></Link>
        <Link href="/global" style={S.card}><span style={S.cardEyebrow}>LEARN</span><strong style={S.cardTitle}>I want to explore before deciding</strong><span style={S.body}>Use VibeSchool learning resources while detailed pathway data is being source-verified.</span><span style={S.cardAction}>Explore free →</span></Link>
      </div>
    </section>

    <section style={S.section}>
      <p style={S.kicker}>KENYA SENIOR SCHOOL</p><h2 style={S.h2}>The three main pathway families</h2>
      <p style={S.note}>VibeSchool keeps official pathway facts separate from its own guidance. Detailed subject combinations and school offerings will only be shown as verified when authoritative evidence exists.</p>
      <div style={S.grid}>{pathwayFamilies.map(p => <article id={p.id} key={p.id} style={S.card}><span style={S.cardEyebrow}>PATHWAY FAMILY</span><strong style={S.cardTitle}>{p.name}</strong><span style={S.body}>{p.summary}</span><Link href="/pathways/check" style={S.cardAction}>See what fits me →</Link></article>)}</div>
    </section>

    <section style={S.promise}><p style={S.kicker}>THE PATHWAYS PROMISE</p><h2 style={S.promiseTitle}>Answer first. Sign in later.</h2><p style={S.promiseBody}>The free check provides guidance before account creation. Saving, verified school offerings and account continuation will only be enabled after those contracts are certified against current authentication and School Engine authority.</p></section>

    <footer style={S.footer}>VibeSchool is an independent education platform. Guidance is not an official placement decision.</footer>
  </div></main>
}

const S: Record<string, CSSProperties> = {
  root:{minHeight:'100vh',background:'#f7f7fb',color:'#101018'},shell:{width:'min(1120px,100%)',margin:'0 auto',padding:'0 18px 56px'},header:{minHeight:76,display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #e7e7ef'},brand:{display:'inline-flex',maxWidth:190},logo:{display:'block',width:'100%',height:'auto',maxHeight:58,objectFit:'contain'},signIn:{color:'#242438',fontSize:13,fontWeight:700,textDecoration:'none',border:'1px solid #d7d7e2',borderRadius:999,padding:'9px 14px',background:'#fff'},hero:{padding:'72px 0 46px',maxWidth:850},kicker:{margin:'0 0 10px',fontSize:11,fontWeight:800,letterSpacing:'.16em',color:'#725815'},title:{margin:0,maxWidth:800,fontSize:'clamp(38px,7vw,68px)',lineHeight:1.02,letterSpacing:'-.045em'},lead:{maxWidth:720,margin:'24px 0 0',color:'#555568',fontSize:'clamp(16px,2.2vw,20px)',lineHeight:1.6},trustRow:{display:'flex',flexWrap:'wrap',gap:8,marginTop:24},pill:{border:'1px solid #dedee8',background:'#fff',borderRadius:999,padding:'8px 11px',fontSize:12,fontWeight:700,color:'#47475a'},primary:{display:'inline-block',marginTop:25,padding:'14px 18px',borderRadius:14,background:'#4f46e5',color:'#fff',textDecoration:'none',fontWeight:850,fontSize:14},section:{padding:'32px 0 64px'},h2:{margin:'0 0 20px',fontSize:'clamp(25px,4vw,36px)',letterSpacing:'-.025em'},note:{maxWidth:760,color:'#6a6a7a',lineHeight:1.6,fontSize:13,margin:'-8px 0 20px'},grid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14},card:{minHeight:190,display:'flex',flexDirection:'column',padding:24,border:'1px solid #dfdfe8',borderRadius:20,background:'#fff',color:'#11111a',textDecoration:'none'},cardEyebrow:{fontSize:10,fontWeight:800,letterSpacing:'.15em',color:'#806216'},cardTitle:{marginTop:18,fontSize:22,letterSpacing:'-.02em',lineHeight:1.15},body:{marginTop:10,color:'#626272',fontSize:14,lineHeight:1.55},cardAction:{marginTop:'auto',paddingTop:24,color:'#4f46e5',fontSize:13,fontWeight:800,textDecoration:'none'},promise:{borderRadius:24,background:'#0c0c16',color:'#fff',padding:'clamp(28px,6vw,56px)',marginBottom:64},promiseTitle:{margin:0,fontSize:'clamp(28px,5vw,46px)',letterSpacing:'-.03em'},promiseBody:{margin:'18px 0 0',maxWidth:760,color:'#cacada',lineHeight:1.7,fontSize:16},footer:{borderTop:'1px solid #e2e2ea',paddingTop:24,color:'#777786',fontSize:12,lineHeight:1.6}
}

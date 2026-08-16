import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pathways Kenya | VibeSchool',
  description: 'Free Kenyan education pathway guidance from VibeSchool. Explore pathways, careers, subjects and senior-school decisions with clear next steps.',
  alternates: { canonical: 'https://www.vibeschool.co.ke/pathways' },
}

const pathwayFamilies = [
  { id: 'stem', name: 'STEM', summary: 'Science, technology, engineering and mathematics.', examples: 'Engineering · Medicine · Technology · Data' },
  { id: 'social-sciences', name: 'Social Sciences', summary: 'People, society, languages, humanities and business-related directions.', examples: 'Business · Law · Languages · Public service' },
  { id: 'arts-and-sports-science', name: 'Arts & Sports Science', summary: 'Creative, performance, visual arts and sports-related directions.', examples: 'Design · Media · Performance · Sport' },
] as const

export default function PathwaysPage() {
  return <main style={S.root}><div style={S.shell}>
    <header style={S.header}>
      <Link href="/" aria-label="VibeSchool home" style={S.brand}><img src="/icons/vibeschool-logo.png" alt="VibeSchool" style={S.logo} /></Link>
      <nav aria-label="Primary" style={S.nav}>
        <Link href="/pathways" style={S.navActive}>Pathways</Link>
        <Link href="/global" style={S.navLink}>Learn</Link>
        <Link href="/about" style={S.navLink}>About</Link>
        <Link href="/contact" style={S.navLink}>Contact</Link>
        <Link href="/login/global?redirect=/pathways" style={S.signIn}>Sign in</Link>
      </nav>
    </header>

    <section style={S.hero}>
      <p style={S.kicker}>VIBESCHOOL PATHWAYS · KENYA</p>
      <h1 style={S.title}>Find a direction that makes sense for you.</h1>
      <p style={S.lead}>Not sure what to study in Senior School? Start with six short questions, explore careers and pathways, then use verified school information when it is available.</p>
      <div style={S.trustRow}><span style={S.pill}>Free to explore</span><span style={S.pill}>No login to start</span><span style={S.pill}>Guidance, not placement</span></div>
      <div style={S.heroActions}><Link href="/pathways/check" style={S.primary}>Check my direction</Link><Link href="/learn/careers" style={S.secondary}>Explore careers</Link></div>
      <p style={S.heroNote}>Your first result is only an early signal. VibeSchool does not turn one short check into a permanent label.</p>
    </section>

    <section style={S.section}>
      <p style={S.kicker}>START WHERE YOU ARE</p>
      <h2 style={S.h2}>Three easy ways to begin</h2>
      <div style={S.grid}>
        <Link href="/pathways/check" style={S.cardPrimary}><span style={S.cardEyebrow}>MOST POPULAR</span><strong style={S.cardTitle}>I am not sure which direction fits me</strong><span style={S.body}>Answer six short questions. You will get an early signal and clear next steps without creating an account.</span><span style={S.cardAction}>Check my direction →</span></Link>
        <Link href="/learn/careers" style={S.card}><span style={S.cardEyebrow}>I KNOW THE CAREER</span><strong style={S.cardTitle}>I already know what I want to become</strong><span style={S.body}>Start from a career and explore the learning direction behind it.</span><span style={S.cardAction}>Explore careers →</span></Link>
        <Link href="/global" style={S.card}><span style={S.cardEyebrow}>I WANT TO EXPLORE</span><strong style={S.cardTitle}>I want to learn before deciding</strong><span style={S.body}>Explore VibeSchool learning resources first and come back when you have a clearer sense of your interests.</span><span style={S.cardAction}>Explore learning →</span></Link>
      </div>
    </section>

    <section style={S.section}>
      <p style={S.kicker}>KENYA SENIOR SCHOOL</p><h2 style={S.h2}>Explore the three pathway families</h2>
      <p style={S.note}>Pathway guidance and official facts are kept separate. School or subject-offering claims only appear as verified when VibeSchool has authoritative evidence for them.</p>
      <div style={S.grid}>{pathwayFamilies.map(p => <article id={p.id} key={p.id} style={S.card}><span style={S.cardEyebrow}>PATHWAY FAMILY</span><strong style={S.cardTitle}>{p.name}</strong><span style={S.body}>{p.summary}</span><span style={S.examples}>{p.examples}</span><Link href="/pathways/check" style={S.cardAction}>See whether this fits me →</Link></article>)}</div>
    </section>

    <section style={S.journey}>
      <p style={S.kicker}>WHAT HAPPENS NEXT</p>
      <h2 style={S.h2}>From uncertainty to a useful next step</h2>
      <div style={S.steps}>
        <div style={S.step}><span style={S.stepNumber}>1</span><strong>Check your direction</strong><small>Six short questions give an early signal.</small></div>
        <div style={S.step}><span style={S.stepNumber}>2</span><strong>Explore possibilities</strong><small>Compare pathways, careers and learning options.</small></div>
        <div style={S.step}><span style={S.stepNumber}>3</span><strong>Use verified information</strong><small>School offerings are shown only when evidence supports them.</small></div>
        <div style={S.step}><span style={S.stepNumber}>4</span><strong>Save when you are ready</strong><small>Create or sign in to a learner account only when you want continuity.</small></div>
      </div>
    </section>

    <section style={S.promise}><p style={S.kickerLight}>THE PATHWAYS PROMISE</p><h2 style={S.promiseTitle}>Answer first. Sign in later.</h2><p style={S.promiseBody}>You can get useful guidance before creating an account. If you choose to save a result, VibeSchool uses your existing learner identity and keeps school recommendations limited to information that has been verified.</p><div style={S.promiseActions}><Link href="/pathways/check" style={S.primaryLight}>Start the free check</Link><Link href="/pathways/schools" style={S.secondaryLight}>Explore verified schools</Link></div></section>

    <footer style={S.footer}><div>VibeSchool is an independent education platform. Pathways guidance is not an official placement decision.</div><div style={S.footerLinks}><Link href="/" style={S.footerLink}>Home</Link><Link href="/about" style={S.footerLink}>About</Link><Link href="/contact" style={S.footerLink}>Contact</Link></div></footer>
  </div></main>
}

const S: Record<string, CSSProperties> = {
  root:{minHeight:'100vh',background:'#f7f7fb',color:'#101018'},shell:{width:'min(1120px,100%)',margin:'0 auto',padding:'0 18px 56px'},header:{minHeight:76,display:'flex',alignItems:'center',justifyContent:'space-between',gap:18,borderBottom:'1px solid #e7e7ef'},brand:{display:'inline-flex',maxWidth:190,flexShrink:0},logo:{display:'block',width:'100%',height:'auto',maxHeight:58,objectFit:'contain'},nav:{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:14,flexWrap:'wrap'},navLink:{color:'#555568',fontSize:13,fontWeight:700,textDecoration:'none'},navActive:{color:'#11111a',fontSize:13,fontWeight:850,textDecoration:'none'},signIn:{color:'#242438',fontSize:13,fontWeight:800,textDecoration:'none',border:'1px solid #d7d7e2',borderRadius:999,padding:'9px 14px',background:'#fff'},hero:{padding:'72px 0 46px',maxWidth:900},kicker:{margin:'0 0 10px',fontSize:11,fontWeight:800,letterSpacing:'.16em',color:'#725815'},kickerLight:{margin:'0 0 10px',fontSize:11,fontWeight:800,letterSpacing:'.16em',color:'#d8be69'},title:{margin:0,maxWidth:820,fontSize:'clamp(40px,7vw,72px)',lineHeight:1.01,letterSpacing:'-.048em'},lead:{maxWidth:760,margin:'24px 0 0',color:'#555568',fontSize:'clamp(16px,2.2vw,20px)',lineHeight:1.6},trustRow:{display:'flex',flexWrap:'wrap',gap:8,marginTop:24},pill:{border:'1px solid #dedee8',background:'#fff',borderRadius:999,padding:'8px 11px',fontSize:12,fontWeight:700,color:'#47475a'},heroActions:{display:'flex',flexWrap:'wrap',gap:10,marginTop:25},primary:{display:'inline-block',padding:'14px 18px',borderRadius:14,background:'#4f46e5',color:'#fff',textDecoration:'none',fontWeight:850,fontSize:14},secondary:{display:'inline-block',padding:'14px 18px',borderRadius:14,background:'#fff',border:'1px solid #dcdce6',color:'#232336',textDecoration:'none',fontWeight:850,fontSize:14},heroNote:{maxWidth:700,marginTop:16,fontSize:12,lineHeight:1.55,color:'#777786'},section:{padding:'32px 0 64px'},h2:{margin:'0 0 20px',fontSize:'clamp(25px,4vw,36px)',letterSpacing:'-.025em'},note:{maxWidth:760,color:'#6a6a7a',lineHeight:1.6,fontSize:13,margin:'-8px 0 20px'},grid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14},card:{minHeight:210,display:'flex',flexDirection:'column',padding:24,border:'1px solid #dfdfe8',borderRadius:20,background:'#fff',color:'#11111a',textDecoration:'none'},cardPrimary:{minHeight:210,display:'flex',flexDirection:'column',padding:24,border:'2px solid #4f46e5',borderRadius:20,background:'#fff',color:'#11111a',textDecoration:'none',boxShadow:'0 10px 30px rgba(79,70,229,.08)'},cardEyebrow:{fontSize:10,fontWeight:800,letterSpacing:'.15em',color:'#806216'},cardTitle:{marginTop:18,fontSize:22,letterSpacing:'-.02em',lineHeight:1.15},body:{marginTop:10,color:'#626272',fontSize:14,lineHeight:1.55},examples:{marginTop:14,color:'#343447',fontSize:12,fontWeight:750,lineHeight:1.5},cardAction:{marginTop:'auto',paddingTop:24,color:'#4f46e5',fontSize:13,fontWeight:800,textDecoration:'none'},journey:{padding:'10px 0 64px'},steps:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12},step:{display:'grid',gap:8,padding:20,borderRadius:18,background:'#fff',border:'1px solid #e1e1ea'},stepNumber:{display:'grid',placeItems:'center',width:30,height:30,borderRadius:999,background:'#eef2ff',color:'#4338ca',fontWeight:900,fontSize:12},promise:{borderRadius:24,background:'#0c0c16',color:'#fff',padding:'clamp(28px,6vw,56px)',marginBottom:64},promiseTitle:{margin:0,fontSize:'clamp(28px,5vw,46px)',letterSpacing:'-.03em'},promiseBody:{margin:'18px 0 0',maxWidth:760,color:'#cacada',lineHeight:1.7,fontSize:16},promiseActions:{display:'flex',gap:10,flexWrap:'wrap',marginTop:24},primaryLight:{padding:'13px 16px',borderRadius:13,background:'#fff',color:'#11111a',textDecoration:'none',fontWeight:850,fontSize:13},secondaryLight:{padding:'13px 16px',borderRadius:13,border:'1px solid #37374c',color:'#fff',textDecoration:'none',fontWeight:850,fontSize:13},footer:{borderTop:'1px solid #e2e2ea',paddingTop:24,color:'#777786',fontSize:12,lineHeight:1.6,display:'flex',justifyContent:'space-between',gap:18,flexWrap:'wrap'},footerLinks:{display:'flex',gap:14},footerLink:{color:'#555568',textDecoration:'none',fontWeight:700}
}

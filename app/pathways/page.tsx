import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'Pathways Kenya | VibeSchool',
  description: 'Free Kenyan education pathway guidance from VibeSchool. Explore pathways, careers, subjects and senior-school decisions with clear next steps.',
  alternates: { canonical: 'https://www.vibeschool.co.ke/pathways' },
}

const ICONS:Record<string,string>={
  stem:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-4 10h8M12 8v8',
  social:'M7 18c0-2.2 2.2-4 5-4s5 1.8 5 4M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 6c0-1.6 1.2-3 3-3M19 18c0-1.6-1.2-3-3-3',
  arts:'M4 16c3-1 4-4 4-7 3 1 6 4 8 7 2-2 3-5 4-8M5 19h14',
  compass:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3 5-2 6-6 2 2-6 6-2Z',
  career:'M5 7h14v12H5V7Zm4 0V5h6v2M5 11h14',
  subjects:'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm3 0v16',
  school:'M3 10 12 4l9 6-9 6-9-6Zm4 3v5m10-5v5M5 20h14',
  learn:'M4 5h6a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H4V5Zm16 0h-6a3 3 0 0 0-3 3',
  shield:'M12 3 5 6v5c0 4.6 3 7.5 7 9 4-1.5 7-4.4 7-9V6l-7-3Zm-3 8 2 2 4-4',
}
function Icon({name}:{name:string}){return <svg aria-hidden="true" viewBox="0 0 24 24" style={S.icon}><path d={ICONS[name]??ICONS.compass} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}

const pathwayFamilies = [
  { id: 'stem', icon:'stem', name: 'STEM', summary: 'Science, technology, engineering and mathematics.', examples: 'Build · Calculate · Investigate · Experiment' },
  { id: 'social-sciences', icon:'social', name: 'Social Sciences', summary: 'People, society, languages, humanities and business-related directions.', examples: 'Understand · Communicate · Lead · Analyse' },
  { id: 'arts-and-sports-science', icon:'arts', name: 'Arts & Sports Science', summary: 'Creative, performance, visual arts and sports-related directions.', examples: 'Create · Perform · Design · Compete' },
] as const

const journey=[
  {icon:'compass',title:'Discover yourself',body:'Use the Quick Check as an early signal, not a verdict.'},
  {icon:'stem',title:'Explore pathways',body:'Compare more than one direction when your signals are close.'},
  {icon:'career',title:'Explore careers',body:'See where different interests and pathway choices can lead.'},
  {icon:'subjects',title:'Understand subjects',body:'Connect pathway choices to the subjects and combinations behind them.'},
  {icon:'school',title:'Find verified schools',body:'Separate canonical school identity from verified offering evidence.'},
  {icon:'learn',title:'Start learning',body:'Move from choosing a direction into learning and progress.'},
] as const

export default function PathwaysPage() {
  return <div style={S.root}>
    <PublicHeader product="Pathways" />
    <main id="main-content"><div style={S.shell}>
      <section style={S.hero}>
        <p style={S.kicker}>VIBESCHOOL PATHWAYS · KENYA</p><h1 style={S.title}>Find a direction that makes sense for you.</h1>
        <p style={S.lead}>Not sure what to study in Senior School? Start with six short prompts, understand what your answers suggest, explore careers and subjects, then use verified school information when evidence is available.</p>
        <div style={S.trustRow}><span style={S.pill}>Free to explore</span><span style={S.pill}>No login to start</span><span style={S.pill}>Guidance, not placement</span></div>
        <div style={S.heroActions}><Link href="/pathways/check" style={S.primary}>Check my direction</Link><Link href="/learn/careers" style={S.secondary}>Explore careers</Link></div>
        <p style={S.heroNote}>Your first result is only an early signal. VibeSchool shows uncertainty instead of forcing a pathway when the evidence is weak or close.</p>
      </section>

      <section style={S.section}><p style={S.kicker}>START WHERE YOU ARE</p><h2 style={S.h2}>Three easy ways to begin</h2><div style={S.grid}>
        <Link href="/pathways/check" style={S.cardPrimary}><span style={S.cardIcon}><Icon name="compass"/></span><span style={S.cardEyebrow}>MOST POPULAR</span><strong style={S.cardTitle}>I am not sure which direction fits me</strong><span style={S.body}>Answer six short prompts. You will get an explainable early signal and clear next steps without creating an account.</span><span style={S.cardAction}>Check my direction →</span></Link>
        <Link href="/learn/careers" style={S.card}><span style={S.cardIcon}><Icon name="career"/></span><span style={S.cardEyebrow}>I KNOW THE CAREER</span><strong style={S.cardTitle}>I already know what I want to become</strong><span style={S.body}>Start from a career and explore the learning direction behind it.</span><span style={S.cardAction}>Explore careers →</span></Link>
        <Link href="/global" style={S.card}><span style={S.cardIcon}><Icon name="learn"/></span><span style={S.cardEyebrow}>I WANT TO EXPLORE</span><strong style={S.cardTitle}>I want to learn before deciding</strong><span style={S.body}>Explore learning resources first and come back when your interests are clearer.</span><span style={S.cardAction}>Explore learning →</span></Link>
      </div></section>

      <section style={S.section}><p style={S.kicker}>KENYA SENIOR SCHOOL</p><h2 style={S.h2}>Explore the three pathway families</h2><p style={S.note}>Pathway guidance and official facts are kept separate. School or subject-offering claims only appear as verified when VibeSchool has authoritative evidence for them.</p><div style={S.grid}>{pathwayFamilies.map(p=><article id={p.id} key={p.id} style={S.card}><span style={S.pathwayIcon}><Icon name={p.icon}/></span><span style={S.cardEyebrow}>PATHWAY FAMILY</span><strong style={S.cardTitle}>{p.name}</strong><span style={S.body}>{p.summary}</span><span style={S.examples}>{p.examples}</span><Link href="/pathways/check" style={S.cardAction}>See whether this fits me →</Link></article>)}</div></section>

      <section style={S.journey}><p style={S.kicker}>YOUR PATHWAYS JOURNEY</p><h2 style={S.h2}>Know where you are and what comes next</h2><div style={S.journeyRail}>{journey.map((item,index)=><div key={item.title} style={S.step}><div style={S.stepTop}><span style={S.stepIcon}><Icon name={item.icon}/></span><span style={S.stepNumber}>{index+1}</span></div><strong>{item.title}</strong><small>{item.body}</small></div>)}</div></section>

      <section style={S.trustPanel}><div style={S.trustBlock}><span style={S.trustIcon}><Icon name="compass"/></span><div><strong>VibeSchool guidance</strong><p style={S.trustText}>Based on your answers and learning interests. It can be uncertain, challenged or retaken.</p></div></div><div style={S.trustBlock}><span style={S.trustIcon}><Icon name="shield"/></span><div><strong>Verified education information</strong><p style={S.trustText}>Shown as verified only when an authoritative evidence record supports the claim.</p></div></div></section>

      <section style={S.promise}><p style={S.kickerLight}>THE PATHWAYS PROMISE</p><h2 style={S.promiseTitle}>Answer first. Sign in later.</h2><p style={S.promiseBody}>You can get useful guidance before creating an account. If you choose to save a result, VibeSchool uses your existing learner identity and keeps school-offering claims limited to information backed by verified evidence.</p><div style={S.promiseActions}><Link href="/pathways/check" style={S.primaryLight}>Start the free check</Link><Link href="/pathways/schools" style={S.secondaryLight}>Explore schools</Link></div></section>
    </div></main>
    <PublicFooter />
  </div>
}

const S: Record<string, CSSProperties> = {
  root:{minHeight:'100vh',background:'#f7f7fb',color:'#101018'},shell:{width:'min(1120px,100%)',margin:'0 auto',padding:'0 18px 20px'},hero:{padding:'72px 0 46px',maxWidth:900},kicker:{margin:'0 0 10px',fontSize:11,fontWeight:800,letterSpacing:'.16em',color:'#725815'},kickerLight:{margin:'0 0 10px',fontSize:11,fontWeight:800,letterSpacing:'.16em',color:'#d8be69'},title:{margin:0,maxWidth:820,fontSize:'clamp(40px,7vw,72px)',lineHeight:1.01,letterSpacing:'-.048em'},lead:{maxWidth:760,margin:'24px 0 0',color:'#555568',fontSize:'clamp(16px,2.2vw,20px)',lineHeight:1.6},trustRow:{display:'flex',flexWrap:'wrap',gap:8,marginTop:24},pill:{border:'1px solid #dedee8',background:'#fff',borderRadius:999,padding:'8px 11px',fontSize:12,fontWeight:700,color:'#47475a'},heroActions:{display:'flex',flexWrap:'wrap',gap:10,marginTop:25},primary:{display:'inline-block',padding:'14px 18px',borderRadius:14,background:'#4f46e5',color:'#fff',textDecoration:'none',fontWeight:850,fontSize:14},secondary:{display:'inline-block',padding:'14px 18px',borderRadius:14,background:'#fff',border:'1px solid #dcdce6',color:'#232336',textDecoration:'none',fontWeight:850,fontSize:14},heroNote:{maxWidth:700,marginTop:16,fontSize:12,lineHeight:1.55,color:'#777786'},section:{padding:'32px 0 64px'},h2:{margin:'0 0 20px',fontSize:'clamp(25px,4vw,36px)',letterSpacing:'-.025em'},note:{maxWidth:760,color:'#6a6a7a',lineHeight:1.6,fontSize:13,margin:'-8px 0 20px'},grid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14},card:{minHeight:230,display:'flex',flexDirection:'column',padding:24,border:'1px solid #dfdfe8',borderRadius:20,background:'#fff',color:'#11111a',textDecoration:'none'},cardPrimary:{minHeight:230,display:'flex',flexDirection:'column',padding:24,border:'2px solid #4f46e5',borderRadius:20,background:'#fff',color:'#11111a',textDecoration:'none',boxShadow:'0 10px 30px rgba(79,70,229,.08)'},cardIcon:{display:'grid',placeItems:'center',width:40,height:40,borderRadius:12,background:'#eef2ff',color:'#4338ca',marginBottom:16},pathwayIcon:{display:'grid',placeItems:'center',width:48,height:48,borderRadius:14,background:'#f6f4ff',color:'#4f46e5',marginBottom:16},icon:{width:24,height:24,display:'block'},cardEyebrow:{fontSize:10,fontWeight:800,letterSpacing:'.15em',color:'#806216'},cardTitle:{marginTop:14,fontSize:22,letterSpacing:'-.02em',lineHeight:1.15},body:{marginTop:10,color:'#626272',fontSize:14,lineHeight:1.55},examples:{marginTop:14,color:'#343447',fontSize:12,fontWeight:750,lineHeight:1.5},cardAction:{marginTop:'auto',paddingTop:24,color:'#4f46e5',fontSize:13,fontWeight:800,textDecoration:'none'},journey:{padding:'10px 0 64px'},journeyRail:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:10},step:{display:'grid',gap:9,padding:18,borderRadius:18,background:'#fff',border:'1px solid #e1e1ea'},stepTop:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8},stepIcon:{display:'grid',placeItems:'center',width:36,height:36,borderRadius:11,background:'#eef2ff',color:'#4338ca'},stepNumber:{display:'grid',placeItems:'center',width:26,height:26,borderRadius:999,background:'#f3f4f6',color:'#6b7280',fontWeight:900,fontSize:11},trustPanel:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,margin:'0 0 64px'},trustBlock:{display:'flex',gap:14,alignItems:'flex-start',background:'#fff',border:'1px solid #e1e4eb',borderRadius:18,padding:20},trustIcon:{display:'grid',placeItems:'center',width:42,height:42,borderRadius:13,background:'#eef2ff',color:'#4338ca',flex:'0 0 auto'},trustText:{margin:'6px 0 0',fontSize:13,lineHeight:1.6,color:'#666676'},promise:{borderRadius:24,background:'#0c0c16',color:'#fff',padding:'clamp(28px,6vw,56px)',marginBottom:64},promiseTitle:{margin:0,fontSize:'clamp(28px,5vw,46px)',letterSpacing:'-.03em'},promiseBody:{margin:'18px 0 0',maxWidth:760,color:'#cacada',lineHeight:1.7,fontSize:16},promiseActions:{display:'flex',gap:10,flexWrap:'wrap',marginTop:24},primaryLight:{padding:'13px 16px',borderRadius:13,background:'#fff',color:'#11111a',textDecoration:'none',fontWeight:850,fontSize:13},secondaryLight:{padding:'13px 16px',borderRadius:13,border:'1px solid #37374c',color:'#fff',textDecoration:'none',fontWeight:850,fontSize:13}
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { CareerInterest } from './CareerInterest'

export const metadata: Metadata = {
  title: 'Careers | VibeSchool',
  description: 'Learn about future opportunities to help build VibeSchool for learners, educators, families and schools in Kenya.',
  alternates:{canonical:'/careers'},
}

const areas = [
  ['Education & Curriculum','Teachers, subject specialists, curriculum reviewers and assessment experts.'],
  ['Engineering & Data','Software engineering, data systems, reliability, security and applied AI.'],
  ['Product & Design','Research, product thinking, UX, accessibility and low-bandwidth/mobile experience.'],
  ['Schools & Partnerships','School success, institutional partnerships, onboarding and implementation.'],
  ['Support & Operations','Customer support, trust and safety, operations and quality assurance.'],
  ['Growth & Communication','Community, storytelling, content distribution and responsible growth.'],
] as const

export default function CareersPage(){
  return <div style={{minHeight:'100vh',background:'#f7f7fb',color:'#14141d'}}>
    <PublicHeader product="Careers" />
    <main id="main-content">
      <section style={{width:'min(1060px,100%)',margin:'0 auto',padding:'76px 18px 34px'}}>
        <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.16em',color:'#725815'}}>BUILD WITH VIBESCHOOL</p>
        <h1 style={{margin:'12px 0 0',maxWidth:850,fontSize:'clamp(42px,7vw,72px)',lineHeight:1.01,letterSpacing:'-.048em'}}>Help build education infrastructure people can actually use.</h1>
        <p style={{maxWidth:760,margin:'24px 0 0',fontSize:18,lineHeight:1.7,color:'#5f5f70'}}>VibeSchool is being built for learners, teachers, families and institutions. We are not presenting roles as open when they are not. This page exists so exceptional people can understand the mission and know where future opportunities may emerge.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:26}}><a href="#talent-interest" style={{display:'inline-block',padding:'13px 17px',borderRadius:12,background:'#111827',color:'#fff',textDecoration:'none',fontSize:14,fontWeight:850}}>Express interest</a><Link href="/about" style={{display:'inline-block',padding:'13px 17px',borderRadius:12,border:'1px solid #d9dae3',background:'#fff',color:'#222230',textDecoration:'none',fontSize:14,fontWeight:850}}>Understand VibeSchool</Link></div>
      </section>

      <section style={{width:'min(1060px,100%)',margin:'0 auto',padding:'48px 18px'}}>
        <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.14em',color:'#725815'}}>AREAS OF INTEREST</p>
        <h2 style={{fontSize:'clamp(30px,4vw,42px)',letterSpacing:'-.03em',margin:'10px 0 22px'}}>The kinds of people we expect to need</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:14}}>{areas.map(([title,body])=><article key={title} style={{padding:24,border:'1px solid #dedfe7',borderRadius:20,background:'#fff'}}><h3 style={{fontSize:19,margin:0}}>{title}</h3><p style={{margin:'9px 0 0',color:'#686878',fontSize:14,lineHeight:1.65}}>{body}</p></article>)}</div>
      </section>

      <section style={{width:'min(1060px,calc(100% - 36px))',margin:'28px auto 0',padding:'34px',borderRadius:24,background:'#101018',color:'#fff'}}>
        <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.14em',color:'#d8be69'}}>WHAT MATTERS HERE</p>
        <h2 style={{fontSize:32,margin:'10px 0 0'}}>Mission fit is more important than polished titles.</h2>
        <p style={{maxWidth:760,color:'rgba(255,255,255,.7)',fontSize:15,lineHeight:1.7}}>We value people who can reason from evidence, communicate clearly with ordinary users, respect children and data, understand Kenyan educational context, and turn complicated systems into experiences that feel simple.</p>
        <p style={{maxWidth:760,color:'rgba(255,255,255,.7)',fontSize:15,lineHeight:1.7}}>When genuine vacancies open, they should appear here with responsibilities, working arrangement, selection process and compensation information appropriate to the role. Until then, VibeSchool will not manufacture job listings simply to appear larger than it is.</p>
      </section>

      <CareerInterest />
    </main>
    <PublicFooter />
  </div>
}

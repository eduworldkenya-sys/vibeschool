import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'Trust & Policies | VibeSchool',
  description: 'Understand how VibeSchool handles privacy, safety, acceptable use and the rules that govern the platform.',
  alternates:{canonical:'/legal'},
}

const policies = [
  { href:'/legal/privacy', title:'Privacy', body:'What information VibeSchool uses, why it is used, how learner information is protected, and the rights available to users and families.' },
  { href:'/legal/terms', title:'Terms of Service', body:'The rules that govern access to and use of VibeSchool, including accounts, services, responsibilities and limitations.' },
  { href:'/legal/aup', title:'Acceptable Use', body:'The behaviour expected across VibeSchool and the conduct that can lead to restriction or suspension.' },
] as const

const guidance = [
  { href:'/trust/child-safety', title:'Child safety & safeguarding', body:'Plain-language learner safety, adult authority and safeguarding principles.' },
  { href:'/trust/security', title:'Security & data governance', body:'How identity, authority, data boundaries and auditability are approached.' },
  { href:'/trust/responsible-ai', title:'Responsible AI & automation', body:'How AI assistance is separated from evidence, authority and human responsibility.' },
] as const

export default function LegalHubPage(){
  return <div style={{minHeight:'100vh',background:'#f7f7fb',color:'#15151e'}}>
    <PublicHeader product="Trust" />
    <main id="main-content" style={{width:'min(1040px,100%)',margin:'0 auto',padding:'72px 18px 20px'}}>
      <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.16em',color:'#725815'}}>TRUST AT VIBESCHOOL</p>
      <h1 style={{margin:'12px 0 0',maxWidth:780,fontSize:'clamp(40px,7vw,68px)',lineHeight:1.02,letterSpacing:'-.045em'}}>Clear rules. Plain language. No hidden surprises.</h1>
      <p style={{maxWidth:760,margin:'22px 0 0',fontSize:18,lineHeight:1.7,color:'#5f5f70'}}>VibeSchool serves learners, families, educators and institutions. Formal policies and plain-language guidance are kept connected so people can understand both the rule and the reason behind it.</p>

      <section aria-labelledby="principles" style={{marginTop:48,padding:'28px',border:'1px solid #dedfe7',borderRadius:22,background:'#fff'}}>
        <h2 id="principles" style={{margin:0,fontSize:26}}>What you should be able to expect</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:16,marginTop:22}}>
          {[
            ['Privacy matters','Personal information should only be used for a clear purpose and protected according to the user’s authorised relationship.'],
            ['Children need extra care','Learner-facing services require stronger safety, privacy and authority boundaries than ordinary consumer software.'],
            ['Evidence should be distinguishable','Guidance, verified education information and user-provided information should not be presented as if they are the same thing.'],
            ['Support should be reachable','Users should be able to understand where to ask for help without needing technical language.'],
          ].map(([title,body])=><article key={title}><h3 style={{margin:'0 0 7px',fontSize:16}}>{title}</h3><p style={{margin:0,color:'#666676',lineHeight:1.6,fontSize:14}}>{body}</p></article>)}
        </div>
      </section>

      <section aria-labelledby="guidance" style={{padding:'64px 0 12px'}}>
        <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.14em',color:'#725815'}}>PLAIN-LANGUAGE GUIDANCE</p>
        <h2 id="guidance" style={{fontSize:32,margin:'8px 0 20px'}}>Understand the principles first</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>{guidance.map(item=><Link key={item.href} href={item.href} style={{display:'grid',gap:9,padding:24,border:'1px solid #dedfe7',borderRadius:20,background:'#fff',color:'#161620',textDecoration:'none'}}><strong style={{fontSize:19}}>{item.title}</strong><span style={{color:'#676777',lineHeight:1.6,fontSize:14}}>{item.body}</span><span style={{color:'#725815',fontSize:13,fontWeight:850}}>Read guidance →</span></Link>)}</div>
      </section>

      <section aria-labelledby="policies" style={{padding:'52px 0 20px'}}>
        <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.14em',color:'#725815'}}>FORMAL DOCUMENTS</p>
        <h2 id="policies" style={{fontSize:32,margin:'8px 0 20px'}}>Policies</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>
          {policies.map(policy=><Link key={policy.href} href={policy.href} style={{display:'flex',flexDirection:'column',minHeight:210,padding:24,border:'1px solid #dedfe7',borderRadius:20,background:'#fff',color:'#161620',textDecoration:'none'}}><strong style={{fontSize:21}}>{policy.title}</strong><span style={{marginTop:11,color:'#676777',lineHeight:1.6,fontSize:14}}>{policy.body}</span><span style={{marginTop:'auto',paddingTop:22,color:'#4f46e5',fontSize:13,fontWeight:850}}>Read policy →</span></Link>)}
        </div>
      </section>

      <section style={{margin:'42px 0 0',padding:'28px',borderRadius:22,background:'#11111a',color:'#fff'}}>
        <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.14em',color:'#d8be69'}}>NEED CLARITY?</p>
        <h2 style={{margin:'10px 0 8px',fontSize:28}}>Policies should not stop you from getting help.</h2>
        <p style={{margin:0,maxWidth:700,color:'rgba(255,255,255,.7)',lineHeight:1.65}}>If you have a privacy, safety, account or general question, use the VibeSchool Contact page. For urgent support conversations, WhatsApp is available there too.</p>
        <Link href="/contact" style={{display:'inline-block',marginTop:18,padding:'11px 15px',borderRadius:10,background:'#fff',color:'#11111a',textDecoration:'none',fontSize:13,fontWeight:850}}>Contact VibeSchool</Link>
      </section>
    </main>
    <PublicFooter />
  </div>
}

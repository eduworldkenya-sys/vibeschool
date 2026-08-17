'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackPublicEvent } from '@/lib/publicTelemetry'
import styles from './PublicMarketLeadership.module.css'

type Status = 'Available'|'Validation'|'Planned'

type Capability = {title:string;status:Status;body:string;href?:string}

const capabilities: Capability[] = [
  {title:'Public learning exploration',status:'Available',body:'Learners and families can explore curriculum-organised public learning without entering a private school workspace.',href:'/global'},
  {title:'Senior School Pathways exploration',status:'Available',body:'Public Pathways, tracks, subject choices, careers and school-discovery experiences are available. Evidence and national coverage continue to be strengthened.',href:'/pathways'},
  {title:'Teacher instructional continuity',status:'Validation',body:'Curriculum, schemes, lesson planning and classroom workflow foundations exist; live-school end-to-end operational proof is still being completed.',href:'/teachers'},
  {title:'Evidence → assessment → learner understanding',status:'Validation',body:'The data and product model exist, but production activity is still too limited to present this as mature school-scale proof.'},
  {title:'Family learning summaries',status:'Validation',body:'Authorised family relationships and the intended learning-context model exist, while production summary usage still requires pilot evidence.',href:'/families'},
  {title:'School-wide learning visibility',status:'Validation',body:'Institutional surfaces are implemented, but the full curriculum-to-classroom-to-evidence-to-leadership chain remains a pilot certification target.',href:'/institutions'},
  {title:'Network sponsorship and final commercial packaging',status:'Planned',body:'Commercial models remain under validation. VibeSchool will not publish a final price or sponsorship promise before the economics and operating rules are approved.'},
]

const statusClass: Record<Status,string> = {Available:styles.available,Validation:styles.validation,Planned:styles.planned}

export function CapabilityStatus(){
  useEffect(()=>{trackPublicEvent('public_capability_status_view')},[])
  return <section className={styles.section} aria-labelledby="capability-status-title">
    <div className={styles.intro}><p className={styles.eyebrow}>CAPABILITY STATUS</p><h2 id="capability-status-title">Know what is available, what is being proven and what is still direction.</h2><p><strong>Available</strong> means there is an implemented experience appropriate to inspect now. <strong>Validation</strong> means the capability exists but still needs stronger operational or pilot proof. <strong>Planned</strong> is direction only and should not be bought as a current promise.</p></div>
    <div className={styles.statusGrid}>{capabilities.map(item=><article key={item.title} className={styles.statusCard}><span className={`${styles.badge} ${statusClass[item.status]}`}>{item.status}</span><h3>{item.title}</h3><p>{item.body}</p>{item.href&&<Link href={item.href}>Inspect this area →</Link>}</article>)}</div>
    <p className={styles.note}>Status language is intentionally conservative. It describes public/product readiness, not a security certification, regulatory approval, contractual SLA or claim that every school workflow has completed live pilot validation.</p>
  </section>
}

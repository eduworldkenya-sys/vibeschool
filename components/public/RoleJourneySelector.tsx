'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trackPublicEvent, type PublicEventName } from '@/lib/publicTelemetry'
import styles from './PublicMarketLeadership.module.css'

type RoleKey = 'learner'|'teacher'|'family'|'school'

const roles: Record<RoleKey,{label:string;summary:string;headline:string;chain:string;body:string;href:string;action:string;event:PublicEventName}> = {
  learner:{label:'Learner',summary:'Learn, practise, prove and choose what comes next.',headline:'Your learning should remember where you are going.',chain:'Curriculum → learning → practice → evidence → progress → next step',body:'VibeSchool is designed to help a learner move through learning with context: what the curriculum expects, what to practise, what evidence exists and what deserves attention next.',href:'/global',action:'Start exploring learning',event:'public_role_learner'},
  teacher:{label:'Teacher',summary:'Move from curriculum intent to the next learner action.',headline:'Less rebuilding context. More continuity around the lesson.',chain:'Curriculum → scheme → lesson → teaching → evidence → intervention',body:'The teacher journey keeps planning connected to the real teaching occurrence and the evidence that follows, so professional judgement can start from a clearer picture.',href:'/teachers',action:'See the teacher journey',event:'public_role_teacher'},
  family:{label:'Family',summary:'Understand relevant progress without entering teacher-private work.',headline:'Families need clarity, not another pile of educational jargon.',chain:'Learning context → relevant progress → support need → next action',body:'The family experience is designed around authorised relationship and useful context: what the learner is working on, what may need support and what the family can appropriately do next.',href:'/families',action:'See the family experience',event:'public_role_family'},
  school:{label:'School leader',summary:'Connect curriculum delivery, evidence and intervention.',headline:'Leadership should see learning without chasing disconnected paperwork.',chain:'Curriculum → classroom activity → evidence → progress → support → oversight',body:'The school view is intended to connect institutional responsibility with the educational signal underneath it while preserving the boundaries between leadership, teacher work, learners and families.',href:'/institutions',action:'Explore VibeSchool for schools',event:'public_role_school'},
}

export function RoleJourneySelector(){
  const [role,setRole]=useState<RoleKey>('teacher')
  const selected=roles[role]
  const choose=(next:RoleKey)=>{setRole(next);trackPublicEvent(roles[next].event)}
  return <section className={styles.section} aria-labelledby="role-journey-title">
    <div className={styles.intro}><p className={styles.eyebrow}>START WITH YOUR RESPONSIBILITY</p><h2 id="role-journey-title">The same learning story should look different to the people responsible for it.</h2><p>Choose a role to see the part of VibeSchool that matters most. The underlying educational journey remains connected, but access and action should follow responsibility.</p></div>
    <div className={styles.roleGrid} role="tablist" aria-label="Choose your VibeSchool role">{(Object.keys(roles) as RoleKey[]).map(key=><button key={key} type="button" role="tab" aria-selected={role===key} aria-controls="role-journey-panel" className={styles.roleButton} onClick={()=>choose(key)}><strong>{roles[key].label}</strong><span>{roles[key].summary}</span></button>)}</div>
    <div id="role-journey-panel" role="tabpanel" className={styles.rolePanel}><div><h3>{selected.headline}</h3><p className={styles.chain}>{selected.chain}</p><p>{selected.body}</p></div><div className={styles.roleActions}><Link className={styles.primary} href={selected.href}>{selected.action}</Link><Link className={styles.secondary} href="/product">See the whole system</Link></div></div>
  </section>
}

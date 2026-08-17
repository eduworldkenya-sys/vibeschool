'use client'

import { useState } from 'react'
import { trackPublicEvent } from '@/lib/publicTelemetry'
import styles from './PublicMarketLeadership.module.css'

type Stage = {name:string;input:string;known:string;benefits:string;next:string}

const stages: Stage[] = [
  {name:'Curriculum',input:'Trusted curriculum structure and learning outcomes.',known:'What should be learned and the educational sequence it belongs to.',benefits:'Teachers, learners and school leaders.',next:'A scheme can translate curriculum intent into teachable progression.'},
  {name:'Scheme',input:'Curriculum outcomes, term context and teaching sequence.',known:'What is intended to be taught, when, and in what progression.',benefits:'Teachers and academic leadership.',next:'A lesson can be prepared without losing curriculum position.'},
  {name:'Lesson',input:'Scheme position, learning outcomes and teacher planning context.',known:'The intended learning experience for a specific teaching moment.',benefits:'Teachers and learners.',next:'The planned lesson can be connected to the real teaching occurrence.'},
  {name:'Teaching',input:'Lesson intent, class context and the real classroom occurrence.',known:'What was actually taught or attempted rather than only what was planned.',benefits:'Teachers, learners and school leadership.',next:'Learner activity can create evidence connected to the teaching context.'},
  {name:'Evidence',input:'Practice, work, observation, homework, submission or other appropriate learner evidence.',known:'What the learner has demonstrated and what remains uncertain.',benefits:'Learners and teachers first; authorised school/family views where appropriate.',next:'Assessment and professional judgement can interpret the evidence.'},
  {name:'Assessment',input:'Evidence plus an appropriate assessment definition or teacher judgement.',known:'A more structured picture of learner outcome, performance or misconception.',benefits:'Learners, teachers and authorised school roles.',next:'Patterns can contribute to a cautious view of mastery, strength or gap.'},
  {name:'Understanding',input:'Assessment results, evidence history and relevant learning context.',known:'Where the learner may be strong, developing, stuck or still uncertain.',benefits:'Learners, teachers, and role-authorised supporters.',next:'The responsible person can choose an intervention, explanation, practice or progression.'},
  {name:'Next action',input:'Current understanding, curriculum direction and professional responsibility.',known:'What should happen next and why that action is connected to prior evidence.',benefits:'The learner and every authorised person supporting progress.',next:'The outcome of that action becomes new evidence and the learning loop continues.'},
]

export function ConnectedEducationExplorer(){
  const [active,setActive]=useState(0)
  const stage=stages[active]
  const select=(index:number)=>{setActive(index);trackPublicEvent('public_connected_explorer_interaction')}
  return <section className={`${styles.section} ${styles.dark}`} aria-labelledby="connected-explorer-title">
    <div className={styles.intro}><p className={styles.eyebrow}>CONNECTED EDUCATION EXPLORER</p><h2 id="connected-explorer-title">Follow the educational signal, not a module list.</h2><p>Explore what each stage receives, what it can make clearer, who benefits and how it should connect forward. This explains VibeSchool’s product model; it does not claim that every workflow has completed live-school pilot validation.</p></div>
    <div className={styles.explorer}><div className={styles.stageList} role="tablist" aria-label="Connected education stages">{stages.map((item,index)=><button key={item.name} type="button" role="tab" aria-selected={active===index} aria-controls="connected-stage-panel" className={styles.stageButton} onClick={()=>select(index)}>{String(index+1).padStart(2,'0')} · {item.name}</button>)}</div><div id="connected-stage-panel" role="tabpanel" className={styles.stagePanel}><span className={styles.stageNumber}>STAGE {String(active+1).padStart(2,'0')}</span><h3>{stage.name}</h3><div className={styles.stageFacts}><div className={styles.fact}><span>WHAT ENTERS</span><p>{stage.input}</p></div><div className={styles.fact}><span>WHAT BECOMES CLEARER</span><p>{stage.known}</p></div><div className={styles.fact}><span>WHO BENEFITS</span><p>{stage.benefits}</p></div><div className={styles.fact}><span>WHAT CONNECTS NEXT</span><p>{stage.next}</p></div></div></div></div>
  </section>
}

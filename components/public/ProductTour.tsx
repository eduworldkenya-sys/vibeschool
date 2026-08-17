'use client'

import { useState } from 'react'
import styles from './ProductTour.module.css'

const steps = [
  { label:'Plan', eyebrow:'TEACHER · BEFORE CLASS', title:'Start with what should be learned.', body:'Curriculum context informs the scheme and lesson plan, so planning begins with the learning intention instead of an isolated document.', role:'Teacher workspace', state:'Curriculum → Scheme → Lesson', detail:'A certified Teacher OS capture will show the real planning state here.' },
  { label:'Teach', eyebrow:'TEACHER · IN CLASS', title:'Turn the plan into a teaching occurrence.', body:'The lesson becomes classroom activity. Attendance, teaching context and appropriate evidence can belong to the same educational record.', role:'Classroom activity', state:'Lesson → Teaching → Evidence', detail:'A certified classroom capture will replace this product-state panel.' },
  { label:'Learn', eyebrow:'LEARNER · ACTIVE WORK', title:'Give the learner something meaningful to do.', body:'Resources, homework, practice and learning tasks should connect back to the lesson rather than becoming a separate content feed.', role:'Learner experience', state:'Learning → Practice → Submission', detail:'A safe learner capture will be used only after the journey is certified.' },
  { label:'Assess', eyebrow:'TEACHER · EVIDENCE', title:'Assess what the learner actually demonstrated.', body:'Submissions, evidence and assessment create a stronger basis for understanding than activity counts or completion alone.', role:'Assessment workspace', state:'Evidence → Assessment → Result', detail:'No invented marks or learner records are shown in this public tour.' },
  { label:'Understand', eyebrow:'LEARNER · PROGRESS', title:'Turn results into educational understanding.', body:'Evidence can update progress and mastery context so strengths, gaps and uncertainty are clearer instead of ending at a score.', role:'Progress state', state:'Result → Mastery → Gap', detail:'The final visual will use certified demonstration data, never production learner data.' },
  { label:'Support', eyebrow:'NEXT ACTION · FAMILY', title:'Make the next action useful to the right person.', body:'The learner can receive an appropriate next step while teachers and authorised families receive the context that matches their responsibility.', role:'Connected support', state:'Understanding → Next action → Support', detail:'Role boundaries remain part of the demonstration, not something hidden for marketing.' },
]

export function ProductTour(){
  const [active,setActive]=useState(0)
  const step=steps[active]
  const move=(delta:number)=>setActive(current=>Math.min(steps.length-1,Math.max(0,current+delta)))
  return <section className={styles.section} aria-labelledby="product-tour-title">
    <div className={styles.wrap}>
      <div className={styles.heading}><p>SEE VIBESCHOOL WORK</p><h2 id="product-tour-title">See one lesson become learning.</h2><span>Follow one connected journey from curriculum planning to learner progress and support.</span></div>
      <div className={styles.tabs} role="tablist" aria-label="Product tour steps">{steps.map((item,index)=><button key={item.label} type="button" role="tab" aria-selected={active===index} aria-controls="product-tour-panel" id={`product-tour-tab-${index}`} className={active===index?styles.activeTab:styles.tab} onClick={()=>setActive(index)}><b>{String(index+1).padStart(2,'0')}</b>{item.label}</button>)}</div>
      <div className={styles.stage} id="product-tour-panel" role="tabpanel" aria-labelledby={`product-tour-tab-${active}`}>
        <div className={styles.copy}><p className={styles.eyebrow}>{step.eyebrow}</p><h3>{step.title}</h3><p className={styles.body}>{step.body}</p><div className={styles.flow} aria-label={step.state}>{step.state.split(' → ').map((part,index)=><span key={part}>{part}{index<step.state.split(' → ').length-1&&<b>→</b>}</span>)}</div></div>
        <div className={styles.frame} aria-label={`${step.role} product state`}><div className={styles.frameBar}><span></span><span></span><span></span><strong>VibeSchool</strong></div><div className={styles.frameBody}><div className={styles.side}><i></i><i></i><i></i><i></i></div><div className={styles.screen}><small>PRODUCT STATE · {String(active+1).padStart(2,'0')}</small><h4>{step.role}</h4><div className={styles.stateCard}><span>{step.label}</span><strong>{step.state}</strong></div><div className={styles.lines}><i></i><i></i><i></i></div><p>{step.detail}</p><em>Certified screen pending</em></div></div></div>
      </div>
      <div className={styles.controls}><p><strong>{active+1}</strong> / {steps.length}</p><div><button type="button" onClick={()=>move(-1)} disabled={active===0} aria-label="Previous product tour step">← Previous</button><button type="button" onClick={()=>move(1)} disabled={active===steps.length-1} aria-label="Next product tour step">Next →</button></div></div>
      <p className={styles.disclosure}>V1 deliberately uses labelled product-state panels until each real application screen is certified with safe demonstration data. No customer or production learner data is used.</p>
    </div>
  </section>
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

const questions = [
  ['curriculum','Curriculum visibility','Can school leadership tell which curriculum outcomes were actually taught this week?'],
  ['continuity','Teaching continuity','Can a teacher move from a planned lesson to evidence and the next learner action without rebuilding the story manually?'],
  ['evidence','Evidence','Can teachers identify learners needing more explanation or practice from current learning evidence?'],
  ['family','Family context','Can authorised families understand meaningful progress before the end-of-term report?'],
  ['leadership','Leadership','Can leadership understand learning progress without chasing teachers for separate paperwork and spreadsheets?'],
  ['roles','Role boundaries','Do learners, teachers, families and administrators each receive the information appropriate to their role?'],
  ['pathways','Future direction','Can learner progress and interests connect meaningfully to Senior School Pathways and future choices?'],
  ['connection','System connection','Do curriculum, teaching, assessment and progress operate as one connected educational process?'],
] as const

const choices = [
  {label:'Yes, consistently',value:3},
  {label:'Partly',value:2},
  {label:'Rarely',value:1},
  {label:'Not yet',value:0},
]

export function SchoolReadinessAssessment(){
  const [answers,setAnswers]=useState<Record<string,number>>({})
  const [showResult,setShowResult]=useState(false)
  const answered=Object.keys(answers).length
  const result=useMemo(()=>{
    const raw=Object.values(answers).reduce((a,b)=>a+b,0)
    const score=Math.round(raw/(questions.length*3)*100)
    const band=score>=80?'Connected':score>=55?'Developing':score>=30?'Fragmented':'Early-stage'
    const gaps=questions.filter(([id])=>(answers[id]??3)<=1).map(([,label])=>label)
    return {score,band,gaps}
  },[answers])
  const complete=answered===questions.length

  return <section aria-labelledby="school-readiness-assessment-title" style={{padding:'84px max(18px,calc((100vw - 1120px)/2))',background:'#f0f1f8'}}>
    <div style={{maxWidth:760}}><p style={{fontSize:11,letterSpacing:'.16em',fontWeight:850,color:'#725815'}}>SCHOOL READINESS CHECK</p><h2 id="school-readiness-assessment-title" style={{fontSize:'clamp(32px,4.7vw,52px)',lineHeight:1.06,letterSpacing:'-.04em',margin:'10px 0 16px'}}>How connected is learning in your school?</h2><p style={{color:'#626575',lineHeight:1.7}}>Answer eight operational questions. Your result stays in this browser session and is a self-assessment, not an external audit or certification.</p></div>
    {!showResult ? <div style={{display:'grid',gap:12,marginTop:32}}>{questions.map(([id,label,text],i)=><fieldset key={id} style={{border:'1px solid #dcdde6',borderRadius:18,padding:20,background:'#fff'}}><legend style={{fontWeight:900,padding:'0 8px'}}>{i+1}. {label}</legend><p style={{color:'#555866',lineHeight:1.55}}>{text}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{choices.map(c=><button key={c.value} type="button" aria-pressed={answers[id]===c.value} onClick={()=>setAnswers(a=>({...a,[id]:c.value}))} style={{border:answers[id]===c.value?'2px solid #4f46e5':'1px solid #d7d8e1',background:answers[id]===c.value?'#eeedff':'#fff',borderRadius:999,padding:'10px 14px',fontWeight:800,cursor:'pointer'}}>{c.label}</button>)}</div></fieldset>)}</div> : <div aria-live="polite" style={{marginTop:32,padding:28,borderRadius:22,background:'#11121d',color:'#fff'}}><p style={{fontSize:12,letterSpacing:'.12em',fontWeight:850,color:'#d6bc67'}}>YOUR SELF-ASSESSMENT</p><div style={{fontSize:'clamp(52px,9vw,86px)',fontWeight:900,letterSpacing:'-.06em'}}>{result.score}<span style={{fontSize:22}}>/100</span></div><h3 style={{fontSize:28,margin:'4px 0 12px'}}>{result.band} learning system</h3><p style={{color:'rgba(255,255,255,.72)',lineHeight:1.7}}>{result.gaps.length?`The clearest opportunities in your answers are: ${result.gaps.join(', ')}.`:'Your answers show strong connection across the educational journey. The next question is whether those connections remain reliable at classroom and school scale.'}</p><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}><Link href="/institutions" style={{background:'#fff',color:'#11121d',padding:'12px 16px',borderRadius:12,fontWeight:850,textDecoration:'none'}}>See VibeSchool for schools</Link><button type="button" onClick={()=>{setAnswers({});setShowResult(false)}} style={{background:'transparent',color:'#fff',border:'1px solid rgba(255,255,255,.3)',padding:'12px 16px',borderRadius:12,fontWeight:850}}>Retake</button></div></div>}
    {!showResult&&<div style={{display:'flex',alignItems:'center',gap:14,marginTop:18}}><button type="button" disabled={!complete} onClick={()=>setShowResult(true)} style={{border:0,borderRadius:13,padding:'13px 18px',fontWeight:900,background:complete?'#4f46e5':'#c8cad5',color:'#fff',cursor:complete?'pointer':'not-allowed'}}>See my readiness result</button><span style={{fontSize:13,color:'#666978'}}>{answered}/{questions.length} answered</span></div>}
  </section>
}

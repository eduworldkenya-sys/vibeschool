'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { trackPublicEvent, type PublicEventName } from '@/lib/publicTelemetry'

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

type QuestionId = (typeof questions)[number][0]

const choices = [
  {label:'Yes, consistently',value:3},
  {label:'Partly',value:2},
  {label:'Rarely',value:1},
  {label:'Not yet',value:0},
]

const prescriptions: Record<QuestionId,{firstWorkflow:string;why:string;proof:string}> = {
  curriculum:{firstWorkflow:'Curriculum → scheme → lesson visibility',why:'Start by making one subject and class traceable from intended curriculum position to the lesson actually taught.',proof:'Leadership can answer what should have been taught, what was taught and what needs attention without rebuilding the picture manually.'},
  continuity:{firstWorkflow:'Teach-this-lesson continuity',why:'Start where teachers feel fragmentation most directly: move one lesson from plan to teaching, evidence and next action without duplicate setup.',proof:'A teacher can complete the connected lesson loop with fewer hand-offs and less duplicate entry than the baseline workflow.'},
  evidence:{firstWorkflow:'Lesson evidence → next action',why:'Start with a small evidence routine that helps the teacher identify who needs more explanation, practice or follow-up.',proof:'Usable evidence is captured consistently and produces an explicit next teaching or learner action.'},
  family:{firstWorkflow:'Family progress clarity',why:'Start with one authorised family question and make the answer understandable without exposing the teacher’s private workspace.',proof:'Families can answer how the learner is doing, where support may be needed and what happens next from the agreed evidence.'},
  leadership:{firstWorkflow:'School learning brief',why:'Start with one leadership view that connects curriculum delivery, participation, evidence and response instead of adding another dashboard of disconnected counts.',proof:'Leadership can reach the agreed learning answer without chasing multiple staff members or spreadsheets.'},
  roles:{firstWorkflow:'Identity and role-authority map',why:'Start by making learner, teacher, family and administrator relationships explicit before expanding access or automation.',proof:'Pilot acceptance tests show each role can see and change only the information required for the selected workflow.'},
  pathways:{firstWorkflow:'Learner → Pathways evidence journey',why:'Start with a bounded Senior School decision journey that distinguishes verified information, guidance and uncertainty.',proof:'A learner/family can trace the recommendation context to subjects, careers and school information without unsupported certainty.'},
  connection:{firstWorkflow:'Plan → Teach → Evidence → Assess → Next Action',why:'Start with the complete learning loop for one class/subject rather than digitising another isolated module.',proof:'The same educational story survives across the pilot workflow and produces a clear next action for the teacher and learner.'},
}

const bandEvent: Record<string,PublicEventName> = {
  'Early-stage':'public_readiness_complete_early',
  Fragmented:'public_readiness_complete_fragmented',
  Developing:'public_readiness_complete_developing',
  Connected:'public_readiness_complete_connected',
}

export function SchoolReadinessAssessment(){
  const [answers,setAnswers]=useState<Record<string,number>>({})
  const [showResult,setShowResult]=useState(false)
  const started=useRef(false)
  const answered=Object.keys(answers).length
  const result=useMemo(()=>{
    const raw=Object.values(answers).reduce((a,b)=>a+b,0)
    const score=Math.round(raw/(questions.length*3)*100)
    const band=score>=80?'Connected':score>=55?'Developing':score>=30?'Fragmented':'Early-stage'
    const gaps=questions.filter(([id])=>(answers[id]??3)<=1).map(([,label])=>label)
    const values=questions.map(([id])=>answers[id]??0)
    const highest=Math.max(...values)
    const lowest=Math.min(...values)
    const strongest=questions.find(([id])=>(answers[id]??0)===highest) ?? questions[0]
    const weakest=questions.find(([id])=>(answers[id]??0)===lowest) ?? questions[0]
    const prescription=prescriptions[weakest[0]]
    return {
      score,band,gaps,
      strongest:{id:strongest[0],label:strongest[1],value:answers[strongest[0]]??0},
      weakest:{id:weakest[0],label:weakest[1],value:answers[weakest[0]]??0},
      prescription,
    }
  },[answers])
  const complete=answered===questions.length

  const answer=(id:string,value:number)=>{
    if(!started.current){ started.current=true; trackPublicEvent('public_readiness_start') }
    setAnswers(a=>({...a,[id]:value}))
  }

  const reveal=()=>{
    if(!complete) return
    trackPublicEvent(bandEvent[result.band])
    setShowResult(true)
  }

  const reset=()=>{setAnswers({});setShowResult(false);started.current=false}

  return <section aria-labelledby="school-readiness-assessment-title" style={{padding:'84px max(18px,calc((100vw - 1120px)/2))',background:'#f0f1f8'}}>
    <div style={{maxWidth:760}}><p style={{fontSize:11,letterSpacing:'.16em',fontWeight:850,color:'#725815'}}>SCHOOL READINESS CHECK</p><h2 id="school-readiness-assessment-title" style={{fontSize:'clamp(32px,4.7vw,52px)',lineHeight:1.06,letterSpacing:'-.04em',margin:'10px 0 16px'}}>How connected is learning in your school?</h2><p style={{color:'#626575',lineHeight:1.7}}>Answer eight operational questions. Your result and prescription stay in this browser session. This is a self-assessment, not an external audit or certification; the prescription is a planning aid for deciding what to test first.</p></div>
    {!showResult ? <div style={{display:'grid',gap:12,marginTop:32}}>{questions.map(([id,label,text],i)=><fieldset key={id} style={{border:'1px solid #dcdde6',borderRadius:18,padding:20,background:'#fff'}}><legend style={{fontWeight:900,padding:'0 8px'}}>{i+1}. {label}</legend><p style={{color:'#555866',lineHeight:1.55}}>{text}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{choices.map(c=><button key={c.value} type="button" aria-pressed={answers[id]===c.value} onClick={()=>answer(id,c.value)} style={{border:answers[id]===c.value?'2px solid #4f46e5':'1px solid #d7d8e1',background:answers[id]===c.value?'#eeedff':'#fff',borderRadius:999,padding:'10px 14px',fontWeight:800,cursor:'pointer'}}>{c.label}</button>)}</div></fieldset>)}</div> : <div aria-live="polite" style={{marginTop:32,padding:28,borderRadius:22,background:'#11121d',color:'#fff'}}>
      <p style={{fontSize:12,letterSpacing:'.12em',fontWeight:850,color:'#d6bc67'}}>YOUR VIBESCHOOL IMPROVEMENT PRESCRIPTION</p>
      <div style={{fontSize:'clamp(52px,9vw,86px)',fontWeight:900,letterSpacing:'-.06em'}}>{result.score}<span style={{fontSize:22}}>/100</span></div><h3 style={{fontSize:28,margin:'4px 0 12px'}}>{result.band} learning system</h3>
      <p style={{color:'rgba(255,255,255,.72)',lineHeight:1.7}}>{result.gaps.length?`The clearest opportunities in your answers are: ${result.gaps.join(', ')}.`:'Your answers show strong connection across the educational journey. The next test is whether those connections remain reliable under real classroom and school conditions.'}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,marginTop:22}}>
        <article style={{border:'1px solid rgba(255,255,255,.14)',borderRadius:14,padding:16}}><small style={{color:'#d6bc67',fontWeight:850}}>STRONGEST AREA</small><strong style={{display:'block',fontSize:18,marginTop:5}}>{result.strongest.label}</strong><p style={{color:'rgba(255,255,255,.68)',fontSize:14}}>Protect what already works while changing the weaker workflow.</p></article>
        <article style={{border:'1px solid rgba(255,255,255,.14)',borderRadius:14,padding:16}}><small style={{color:'#d6bc67',fontWeight:850}}>BIGGEST FRAGMENTATION</small><strong style={{display:'block',fontSize:18,marginTop:5}}>{result.weakest.label}</strong><p style={{color:'rgba(255,255,255,.68)',fontSize:14}}>This is the recommended first problem to test, not a diagnosis of the whole school.</p></article>
      </div>
      <div style={{marginTop:18,padding:20,borderRadius:16,background:'rgba(255,255,255,.07)'}}><small style={{color:'#d6bc67',fontWeight:850}}>RECOMMENDED FIRST WORKFLOW</small><h4 style={{fontSize:22,margin:'6px 0'}}>{result.prescription.firstWorkflow}</h4><p style={{color:'rgba(255,255,255,.76)',lineHeight:1.65}}>{result.prescription.why}</p><p style={{color:'rgba(255,255,255,.76)',lineHeight:1.65}}><strong>Evidence to earn:</strong> {result.prescription.proof}</p></div>
      <div style={{marginTop:18}}><small style={{color:'#d6bc67',fontWeight:850}}>30-DAY BOUNDED PILOT</small><ol style={{paddingLeft:22,lineHeight:1.65,color:'rgba(255,255,255,.78)'}}><li><strong>Days 1–5 — Baseline:</strong> map the current workflow, authority, time/duplication and the exact success measure before changing anything.</li><li><strong>Days 6–10 — Prepare:</strong> configure only <em>{result.prescription.firstWorkflow}</em>, train the smallest useful group and test devices/connectivity.</li><li><strong>Days 11–24 — Run:</strong> use the workflow in real school conditions; capture completion, reliability, workload and educational-usefulness evidence.</li><li><strong>Days 25–30 — Decide:</strong> compare with baseline, document limitations and choose expand, adjust or stop. Expansion is earned by evidence, not assumed.</li></ol></div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}><Link href="/institutions" style={{background:'#fff',color:'#11121d',padding:'12px 16px',borderRadius:12,fontWeight:850,textDecoration:'none'}}>Take this to the school pilot model</Link><button type="button" onClick={()=>window.print()} style={{background:'transparent',color:'#fff',border:'1px solid rgba(255,255,255,.3)',padding:'12px 16px',borderRadius:12,fontWeight:850}}>Print / save prescription</button><button type="button" onClick={reset} style={{background:'transparent',color:'#fff',border:'1px solid rgba(255,255,255,.3)',padding:'12px 16px',borderRadius:12,fontWeight:850}}>Retake</button></div>
    </div>}
    {!showResult&&<div style={{display:'flex',alignItems:'center',gap:14,marginTop:18}}><button type="button" disabled={!complete} onClick={reveal} style={{border:0,borderRadius:13,padding:'13px 18px',fontWeight:900,background:complete?'#4f46e5':'#c8cad5',color:'#fff',cursor:complete?'pointer':'not-allowed'}}>See my readiness prescription</button><span style={{fontSize:13,color:'#666978'}}>{answered}/{questions.length} answered</span></div>}
  </section>
}

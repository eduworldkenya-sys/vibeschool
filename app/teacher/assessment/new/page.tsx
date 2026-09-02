'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDraftItem, completeLessonAssessmentGeneration, failLessonAssessmentGeneration, requestLessonAssessment } from '@/lib/assessment'
import type { AutoMarkingMode, LessonAssessmentType, QuestionType } from '@/lib/assessment'

type StudioType = 'exercise' | 'quiz' | 'homework' | 'test'
type DraftQuestion = { prompt: string; answer: string; marks: number; questionType: QuestionType; autoMarkingMode: AutoMarkingMode; difficulty: 'easy'|'medium'|'hard'; bloomLevel: string }

const TYPE_LABEL: Record<StudioType,string> = { exercise:'Class Exercise', quiz:'Quick Quiz', homework:'Homework', test:'CAT' }
const BLUEPRINT: Record<StudioType,{minutes:number; purpose:string}> = {
  exercise:{minutes:25,purpose:'Guided practice on today’s lesson outcomes.'},
  quiz:{minutes:15,purpose:'A short diagnostic check of independent mastery.'},
  homework:{minutes:35,purpose:'Independent reinforcement and transfer after the lesson.'},
  test:{minutes:40,purpose:'A formal assessment candidate. For cumulative CATs, add outcomes from other completed lessons in Advanced Edit.'},
}

function section(body:string, name:string):string { return body.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]?.trim() ?? '' }
function objectiveLines(body:string):string[] {
  return section(body,'objectives').split('\n').map(v=>v.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
}
function certifiedHomework(body:string):string {
  const value=section(body,'homework')
  return /no certified homework task|do not invent/i.test(value) ? '' : value
}
function q(prompt:string, marks:number, bloomLevel:string, difficulty:'easy'|'medium'|'hard'):DraftQuestion { return {prompt,answer:'',marks,questionType:'structured',autoMarkingMode:'none',difficulty,bloomLevel} }
function buildQuestions(type:StudioType, body:string):DraftQuestion[] {
  const objectives=objectiveLines(body)
  if (!objectives.length) return []
  if (type==='exercise') return objectives.map((o,i)=>q(`${i+1}. ${o} Give a clear answer using evidence or an example from the lesson.`, i===0?2:4, i===0?'understand':'apply', i===0?'easy':'medium'))
  if (type==='quiz') return objectives.slice(0,3).map((o,i)=>q(`${i+1}. Show independently that you can: ${o}`, i===0?2:3, i===0?'remember':'understand', i===0?'easy':'medium'))
  if (type==='homework') {
    const homework=certifiedHomework(body)
    if (!homework) return []
    return [q(homework,10,'apply','medium'), q(`Using what was taught, extend or apply this outcome in a new context: ${objectives[0]}`,5,'create','hard')]
  }
  return objectives.map((o,i)=>q(`${i+1}. Assess this taught outcome: ${o}`, i===0?4:6, i<2?'apply':'analyse', i===0?'medium':'hard'))
}

function Studio(){
  const router=useRouter(); const params=useSearchParams()
  const lessonPlanId=params.get('lessonPlanId')??''; const lessonBody=params.get('lessonBody')??''
  const requested=params.get('type'); const initial:StudioType=requested==='exercise'||requested==='homework'||requested==='test'?requested:'quiz'
  const [assessmentType,setAssessmentType]=useState<StudioType>(initial); const [saving,setSaving]=useState(false); const [error,setError]=useState('')
  const questions=useMemo(()=>buildQuestions(assessmentType,lessonBody),[assessmentType,lessonBody])
  const totalMarks=questions.reduce((s,x)=>s+x.marks,0)
  async function createDraft(openBuilder=false){
    if(!lessonPlanId||saving||questions.length===0)return; setSaving(true); setError(''); let assessmentId:string|null=null
    try{
      const request=await requestLessonAssessment({lessonPlanId,assessmentType:assessmentType as LessonAssessmentType,requestKey:`lesson:${lessonPlanId}:${assessmentType}:v3`,title:`${TYPE_LABEL[assessmentType]} — lesson outcomes`,generationMetadata:{generator_version:'curriculum-outcome-assessment-v3',ai_used:false,source:'lesson_plan_curriculum_outcomes',blueprint:{question_count:questions.length,estimated_minutes:BLUEPRINT[assessmentType].minutes,difficulty_progression:questions.map(x=>x.difficulty),bloom_distribution:questions.map(x=>x.bloomLevel)}}})
      assessmentId=request.assessmentId
      if(request.created){
        for(let i=0;i<questions.length;i++){const x=questions[i]; await addDraftItem({assessmentId,questionType:x.questionType,prompt:x.prompt,marks:x.marks,orderNum:i+1,acceptedAnswers:[],correctAnswer:null,autoMarkingMode:'none',difficulty:x.difficulty,bloomLevel:x.bloomLevel,generatedBy:'curriculum_outcome_material'})}
        await completeLessonAssessmentGeneration({assessmentId,itemCount:questions.length,totalMarks,estimatedMinutes:BLUEPRINT[assessmentType].minutes,generationMetadata:{generated_from:'lesson_plan_curriculum_outcomes',ai_used:false,teacher_review_required:true}})
      }
      router.push(openBuilder?`/teacher/assessment/builder/${assessmentId}`:`/teacher/assessment/builder/${assessmentId}?mode=review`)
    }catch(e){if(assessmentId)try{await failLessonAssessmentGeneration({assessmentId,errorCode:'draft_generation_failed',errorMessage:e instanceof Error?e.message:null})}catch{}; setError(e instanceof Error?e.message:'Material could not be prepared.')}finally{setSaving(false)}
  }
  if(!lessonPlanId)return <main style={page}><section style={card}><h1>Lesson Materials</h1><p>Open materials from a saved lesson plan.</p></section></main>
  return <main style={page}><div style={{maxWidth:760,margin:'0 auto'}}>
    <button onClick={()=>router.back()} style={secondary}>← Back to lesson</button>
    <section style={card}><div style={eyebrow}>Prepared assessment pack · No AI</div><h1>Ready from the lesson outcomes</h1><p style={{color:'#6b7280'}}>Each material has a different teaching purpose. Curriculum outcomes—not activity labels—are the source of truth.</p></section>
    <section style={card}><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>{(Object.keys(TYPE_LABEL) as StudioType[]).map(t=><button key={t} onClick={()=>setAssessmentType(t)} style={{padding:14,borderRadius:12,border:assessmentType===t?'2px solid #4338ca':'1px solid #d1d5db',background:assessmentType===t?'#eef2ff':'#fff',fontWeight:800}}>{TYPE_LABEL[t]}</button>)}</div></section>
    <section style={card}><div style={eyebrow}>{TYPE_LABEL[assessmentType]}</div><h2>{BLUEPRINT[assessmentType].purpose}</h2>{questions.length===0?<div style={notice}>{assessmentType==='homework'?'No certified homework is attached to this lesson. VibeSchool will not invent one. Use Advanced Edit only if the teacher intentionally wants to author a task.':'This lesson has no authoritative outcomes available, so automatic assessment generation is blocked.'}</div>:<><div style={{color:'#4b5563'}}>{questions.length} questions · {totalMarks} marks · about {BLUEPRINT[assessmentType].minutes} minutes</div><ol>{questions.map((x,i)=><li key={i} style={{marginBottom:10}}>{x.prompt} <strong>({x.marks})</strong></li>)}</ol></>}</section>
    {error&&<div style={errorBox}>{error}</div>}
    {questions.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><button disabled={saving} onClick={()=>createDraft(false)} style={primary}>{saving?'Preparing…':'Review & assign'}</button><button disabled={saving} onClick={()=>createDraft(true)} style={secondary}>Advanced Edit</button></div>}
  </div></main>
}
const page:React.CSSProperties={minHeight:'100vh',background:'#f8fafc',padding:'18px 14px 80px',fontFamily:"'Plus Jakarta Sans', sans-serif",color:'#111827'}
const card:React.CSSProperties={background:'#fff',border:'1px solid #e5e7eb',borderRadius:16,padding:16,marginBottom:12}
const eyebrow:React.CSSProperties={fontSize:10,fontWeight:800,color:'#4338ca',textTransform:'uppercase',letterSpacing:1}
const primary:React.CSSProperties={border:'none',borderRadius:12,padding:'14px 16px',background:'#4338ca',color:'#fff',fontWeight:800,cursor:'pointer'}
const secondary:React.CSSProperties={border:'1px solid #d1d5db',borderRadius:10,padding:'10px 14px',background:'#fff',color:'#374151',fontWeight:700,cursor:'pointer'}
const notice:React.CSSProperties={padding:12,borderRadius:10,background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e',lineHeight:1.5}
const errorBox:React.CSSProperties={padding:12,borderRadius:10,background:'#fef2f2',border:'1px solid #fecaca',color:'#b91c1c',marginBottom:12}
export default function NewAssessmentPage(){return <Suspense fallback={<main style={{padding:20}}>Loading lesson materials…</main>}><Studio/></Suspense>}

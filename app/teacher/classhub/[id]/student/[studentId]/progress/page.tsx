'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { buildOutcomeProgress, buildProgressHistory, progressBandLabel, progressSummary, type ProgressBand, type ProgressEvidence } from '@/lib/learner-intelligence/progress-record'

export const dynamic = 'force-dynamic'

type Student = { id:string; name:string; admission_number:string|null }
type Subject = { id:string; name:string }
type Enrollment = { isCurrent:boolean; joinedAt:string|null; leftAt:string|null }
type TeacherClassAssignment = { class_id:string; subject_id:string|null }
type TeacherOperatingContext = { school_id:string|null; classes?:TeacherClassAssignment[] }
type StudentNested = { id:string; name:string; admission_number:string|null; deleted_at:string|null }
type EnrollmentRow = { is_current:boolean|null; joined_at:string|null; left_at:string|null; students:StudentNested|StudentNested[]|null }
type OutcomeNested = { outcome_text:string|null; outcome_code:string|null }
type EvidenceRow = { id:string; student_id:string; subject_id:string|null; outcome_id:string|null; evidence_source:string|null; evidence_id:string|null; score:number|string|null; max_score:number|string|null; proficiency:string|null; observed_at:string; notes:string|null; weight:number|string|null; curriculum_learning_outcomes:OutcomeNested|OutcomeNested[]|null }
type Period = '30'|'90'|'term'|'all'
type View = 'record'|'history'
const bands: ProgressBand[] = ['EE','ME','AE','BE','NE']
const tone: Record<ProgressBand,{background:string;color:string}> = { EE:{background:'#ecfdf5',color:'#065f46'}, ME:{background:'#eff6ff',color:'#1e40af'}, AE:{background:'#fffbeb',color:'#92400e'}, BE:{background:'#fef2f2',color:'#991b1b'}, NE:{background:'#f3f4f6',color:'#4b5563'} }

function typed<T>(value:unknown):T{return value as T}
function dateLabel(value:string){ const d=new Date(value); return Number.isFinite(d.getTime())?d.toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'}):value }
function cutoff(period:Period){ if(period==='all') return null; const d=new Date(); d.setDate(d.getDate()-(period==='30'?30:period==='90'?90:120)); return d.toISOString() }

export default function StudentProgressRecordPage(){
  const {id:classId,studentId}=useParams<{id:string;studentId:string}>(); const router=useRouter()
  const [student,setStudent]=useState<Student|null>(null); const [enrollment,setEnrollment]=useState<Enrollment|null>(null); const [subjects,setSubjects]=useState<Subject[]>([]); const [rows,setRows]=useState<ProgressEvidence[]>([])
  const [subject,setSubject]=useState('all'); const [period,setPeriod]=useState<Period>('term'); const [band,setBand]=useState<ProgressBand|'all'>('all'); const [source,setSource]=useState('all'); const [query,setQuery]=useState(''); const [view,setView]=useState<View>('record')
  const [loading,setLoading]=useState(true); const [error,setError]=useState('')

  const load=useCallback(async()=>{ setLoading(true);setError(''); try{
    const {data:auth,error:authError}=await supabase.auth.getUser(); if(authError||!auth.user){router.replace('/login');return}
    const {data:ctx,error:ctxError}=await supabase.rpc('teacher_get_operating_context'); if(ctxError) throw ctxError
    const context=typed<TeacherOperatingContext>(ctx)
    const classAssignments=Array.isArray(context.classes)?context.classes:[]
    if(!context.school_id||!classAssignments.some(item=>item.class_id===classId)) throw new Error('This class is not assigned to you in the active school.')

    const enrollmentRes=await supabase.from('student_classes').select('is_current,joined_at,left_at,students(id,name,admission_number,deleted_at)').eq('school_id',context.school_id).eq('class_id',classId).eq('student_id',studentId).order('is_current',{ascending:false}).order('joined_at',{ascending:false}).limit(1).maybeSingle()
    if(enrollmentRes.error) throw enrollmentRes.error
    const enrollmentRow=typed<EnrollmentRow|null>(enrollmentRes.data)
    const nested=enrollmentRow?.students??null; const learner=Array.isArray(nested)?nested[0]:nested
    if(!learner||learner.deleted_at) throw new Error('Learner is not associated with this class.')
    setStudent({id:learner.id,name:learner.name,admission_number:learner.admission_number??null})
    setEnrollment({isCurrent:Boolean(enrollmentRow?.is_current),joinedAt:enrollmentRow?.joined_at??null,leftAt:enrollmentRow?.left_at??null})

    const subjectIds=Array.from(new Set(classAssignments.filter(item=>item.class_id===classId).map(item=>item.subject_id).filter((value):value is string=>Boolean(value))))
    const [subjectRes,evidenceRes]=await Promise.all([
      subjectIds.length?supabase.from('subjects').select('id,name').in('id',subjectIds):Promise.resolve({data:[],error:null}),
      supabase.from('competency_evidence_ledger').select('id,student_id,subject_id,outcome_id,evidence_source,evidence_id,score,max_score,proficiency,observed_at,notes,weight,curriculum_learning_outcomes(outcome_text,outcome_code)').eq('school_id',context.school_id).eq('class_id',classId).eq('student_id',studentId).in('subject_id',subjectIds.length?subjectIds:['00000000-0000-0000-0000-000000000000']).order('observed_at',{ascending:false}).limit(1000)
    ])
    if(subjectRes.error) throw subjectRes.error; if(evidenceRes.error) throw evidenceRes.error; setSubjects(typed<Subject[]>(subjectRes.data??[]))
    const evidenceRows=typed<EvidenceRow[]>(evidenceRes.data??[])
    setRows(evidenceRows.map(row=>{const nestedOutcome=row.curriculum_learning_outcomes; const outcome=Array.isArray(nestedOutcome)?nestedOutcome[0]:nestedOutcome; return {id:row.id,studentId:row.student_id,subjectId:row.subject_id,outcomeId:row.outcome_id,outcomeText:outcome?.outcome_text??null,outcomeCode:outcome?.outcome_code??null,source:row.evidence_source||'evidence',sourceId:row.evidence_id,observedAt:row.observed_at,score:row.score==null?null:Number(row.score),maxScore:row.max_score==null?null:Number(row.max_score),proficiency:row.proficiency,notes:row.notes,weight:row.weight==null?1:Number(row.weight)} as ProgressEvidence}))
  }catch(e){console.error('[StudentProgressRecord] load',e);setError(e instanceof Error?e.message:'Progress record could not be loaded.')}finally{setLoading(false)} },[classId,studentId,router])
  useEffect(()=>{void load()},[load])

  const filtered=useMemo(()=>{const after=cutoff(period);return rows.filter(r=>(subject==='all'||r.subjectId===subject)&&(!after||r.observedAt>=after)&&(source==='all'||r.source===source))},[rows,subject,period,source])
  const allOutcomes=useMemo(()=>buildOutcomeProgress(filtered),[filtered])
  const outcomes=useMemo(()=>allOutcomes.filter(o=>band==='all'||o.band===band).filter(o=>!query||`${o.outcomeCode??''} ${o.outcomeText} ${o.evidence.map(e=>`${e.source} ${e.notes??''}`).join(' ')}`.toLowerCase().includes(query.toLowerCase().trim())),[allOutcomes,band,query])
  const summary=useMemo(()=>progressSummary(allOutcomes),[allOutcomes])
  const history=useMemo(()=>buildProgressHistory(filtered).filter(h=>band==='all'||h.band===band).filter(h=>!query||`${h.outcomeCode??''} ${h.outcomeText} ${h.source} ${h.notes??''}`.toLowerCase().includes(query.toLowerCase().trim())),[filtered,band,query])
  const sources=useMemo(()=>Array.from(new Set(rows.map(r=>r.source))).sort(),[rows]); const subjectNames=useMemo(()=>new Map(subjects.map(s=>[s.id,s.name])),[subjects])

  if(loading)return <main style={{padding:20}} aria-label="Loading student progress record"><div style={{height:180,borderRadius:20,background:'#e5e7eb'}}/></main>
  if(error||!student)return <main style={{maxWidth:820,margin:'0 auto',padding:20}}><div role="alert" style={{padding:16,borderRadius:16,background:'#fef2f2',color:'#991b1b'}}>{error||'Learner not found.'}</div></main>

  const archived=enrollment&&!enrollment.isCurrent
  return <main style={{maxWidth:920,margin:'0 auto',padding:'16px 14px 112px',color:'#111827'}}>
    <section style={{borderRadius:22,padding:18,background:'linear-gradient(135deg,#111827,#312e81)',color:'#fff'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><button onClick={()=>router.push(`/teacher/classhub/${classId}/student/${studentId}`)} style={heroButton}>‹ Learner</button><button onClick={()=>window.print()} style={{border:0,borderRadius:10,minHeight:38,padding:'0 12px',background:'#fff',color:'#111827',fontWeight:900}}>Print record</button></div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:14}}><div style={{fontSize:11,fontWeight:900,letterSpacing:1.2,opacity:.7}}>STUDENT PROGRESS RECORD</div>{archived&&<span style={{padding:'4px 7px',borderRadius:99,background:'rgba(255,255,255,.16)',fontSize:9,fontWeight:900}}>ARCHIVED CLASS RECORD</span>}</div>
      <h1 style={{margin:'4px 0 2px',fontSize:24}}>{student.name}</h1><div style={{fontSize:12,opacity:.75}}>{student.admission_number?`Admission ${student.admission_number} · `:''}{archived?'Historical evidence retained':'Evidence-backed curriculum progress'}{archived&&enrollment?.leftAt?` · left ${dateLabel(enrollment.leftAt)}`:''}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:15}}>{[{l:'Outcomes assessed',v:summary.assessed},{l:'Meeting / exceeding',v:summary.secure},{l:'Need support',v:summary.needsSupport}].map(x=><div key={x.l} style={{padding:10,borderRadius:12,background:'rgba(255,255,255,.1)',textAlign:'center'}}><div style={{fontSize:20,fontWeight:900}}>{x.v}</div><div style={{fontSize:9,opacity:.7}}>{x.l}</div></div>)}</div>
    </section>

    {archived&&<section style={{marginTop:10,padding:12,border:'1px solid #e5e7eb',borderRadius:13,background:'#f9fafb',fontSize:11,color:'#4b5563'}}><strong>Read-only history.</strong> This learner is no longer current in this class. Their evidence remains available for professional continuity and audit; archive does not delete learning history.</section>}

    <nav aria-label="Progress record views" style={{display:'flex',gap:8,marginTop:12}}>{([['record','Current record'],['history',`History (${history.length})`]] as const).map(([key,text])=><button key={key} onClick={()=>setView(key)} style={{...pill,background:view===key?'#111827':'#fff',color:view===key?'#fff':'#374151'}}>{text}</button>)}</nav>

    <section aria-label="Progress search and filters" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,margin:'10px 0'}}>
      <input aria-label="Search progress record" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search outcome, activity, note" style={selectStyle}/>
      <select aria-label="Subject" value={subject} onChange={e=>setSubject(e.target.value)} style={selectStyle}><option value="all">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select aria-label="Period" value={period} onChange={e=>setPeriod(e.target.value as Period)} style={selectStyle}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="term">This term</option><option value="all">All evidence</option></select>
      <select aria-label="Performance level" value={band} onChange={e=>setBand(e.target.value as ProgressBand|'all')} style={selectStyle}><option value="all">All levels</option>{bands.map(b=><option key={b} value={b}>{b} · {progressBandLabel(b)}</option>)}</select>
      <select aria-label="Evidence source" value={source} onChange={e=>setSource(e.target.value)} style={selectStyle}><option value="all">All activities</option>{sources.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select>
    </section>

    {view==='record'&&(outcomes.length===0?<section style={emptyStyle}><h2 style={{margin:0,fontSize:17}}>No matching progress evidence</h2><p style={{margin:'7px 0 0',color:'#6b7280',fontSize:13}}>The record fills automatically as outcome-linked learner evidence is captured. Change the filters to inspect another period or activity.</p></section>:
    <div style={{display:'grid',gap:10}}>{outcomes.map(o=><article key={o.outcomeId} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:17,padding:14,breakInside:'avoid'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}><div><div style={{fontSize:10,fontWeight:900,color:'#6b7280'}}>{o.outcomeCode||'CURRICULUM OUTCOME'}</div><h2 style={{margin:'4px 0',fontSize:15,lineHeight:1.35}}>{o.outcomeText}</h2></div><span title={progressBandLabel(o.band)} style={{...tone[o.band],borderRadius:99,padding:'6px 9px',fontSize:11,fontWeight:900,whiteSpace:'nowrap'}}>{o.band}</span></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8,fontSize:11,color:'#6b7280'}}><span>{o.evidenceCount} evidence item{o.evidenceCount===1?'':'s'}</span><span>·</span><span>{o.percentage==null?'No numeric score':`${o.percentage}% weighted`}</span><span>·</span><span>{o.trend==='insufficient'?'Trend pending':o.trend}</span><span>·</span><span>Latest {dateLabel(o.latestObservedAt)}</span></div>
      <details style={{marginTop:10}}><summary style={{cursor:'pointer',fontSize:12,fontWeight:900}}>Evidence & teacher observations</summary><div style={{display:'grid',gap:7,marginTop:8}}>{o.evidence.map(e=><div key={e.id} style={{padding:10,borderRadius:11,background:'#f9fafb',fontSize:11}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>{e.source.replaceAll('_',' ')}</strong><span>{dateLabel(e.observedAt)}</span></div><div style={{marginTop:4,color:'#4b5563'}}>{e.score!=null&&e.maxScore!=null?`${e.score}/${e.maxScore}`:e.proficiency||'Observed'}{e.subjectId&&subjectNames.get(e.subjectId)?` · ${subjectNames.get(e.subjectId)}`:''}</div>{e.notes&&<div style={{marginTop:5}}>{e.notes}</div>}</div>)}</div></details>
    </article>)}</div>)}

    {view==='history'&&(history.length===0?<section style={emptyStyle}><h2 style={{margin:0,fontSize:17}}>No history matches these filters</h2><p style={{margin:'7px 0 0',color:'#6b7280',fontSize:13}}>History is generated from dated learner evidence and cannot be manually rewritten from this view.</p></section>:<section aria-label="Progress history" style={{display:'grid',gap:8}}>{history.map((h,index)=><article key={h.id} style={{display:'grid',gridTemplateColumns:'80px minmax(0,1fr)',gap:10,padding:12,border:'1px solid #e5e7eb',borderRadius:15,background:'#fff'}}><div><div style={{fontSize:10,fontWeight:900,color:'#6b7280'}}>{dateLabel(h.observedAt)}</div>{index<history.length-1&&<div aria-hidden="true" style={{width:2,height:28,background:'#e5e7eb',margin:'8px 0 0 8px'}}/>}</div><div><div style={{display:'flex',gap:7,alignItems:'center',justifyContent:'space-between'}}><strong style={{fontSize:12}}>{h.source.replaceAll('_',' ')}</strong><span style={{...tone[h.band],borderRadius:99,padding:'4px 7px',fontSize:10,fontWeight:900}}>{h.band}</span></div><div style={{marginTop:4,fontSize:12,fontWeight:800}}>{h.outcomeCode?`${h.outcomeCode} · `:''}{h.outcomeText}</div><div style={{marginTop:4,fontSize:11,color:'#6b7280'}}>{h.percentage==null?(h.proficiency||'Observed'):`${h.percentage}%`}{h.subjectId&&subjectNames.get(h.subjectId)?` · ${subjectNames.get(h.subjectId)}`:''}</div>{h.notes&&<div style={{marginTop:5,fontSize:11}}>{h.notes}</div>}</div></article>)}</section>)}

    <p style={{marginTop:14,fontSize:10,color:'#6b7280'}}>Current progress is a projection of captured learner evidence. History preserves the dated evidence trail. Archived class records remain read-only; “Not enough evidence” is shown instead of inventing a performance judgement.</p>
  </main>
}

const heroButton:React.CSSProperties={border:0,borderRadius:10,minHeight:38,padding:'0 11px',background:'rgba(255,255,255,.14)',color:'#fff',fontWeight:800}
const pill:React.CSSProperties={minHeight:40,border:'1px solid #d1d5db',borderRadius:99,padding:'0 14px',fontWeight:900,cursor:'pointer'}
const selectStyle:React.CSSProperties={minHeight:44,border:'1px solid #d1d5db',borderRadius:12,background:'#fff',padding:'0 10px',fontWeight:800,color:'#374151',boxSizing:'border-box',width:'100%'}
const emptyStyle:React.CSSProperties={padding:26,border:'1px solid #e5e7eb',borderRadius:17,background:'#fff',textAlign:'center'}

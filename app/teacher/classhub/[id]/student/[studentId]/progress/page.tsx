'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { loadProgressAuthority, loadProgressEvidence, loadProgressRoster, loadProgressTerms } from '@/lib/learner-intelligence/progress-data'
import { currentProgressTerm, inProgressPeriod, progressDate, type ProgressTerm } from '@/lib/learner-intelligence/progress-period'
import { buildOutcomeProgress, buildProgressHistory, progressBandLabel, progressSummary, type ProgressBand, type ProgressEvidence } from '@/lib/learner-intelligence/progress-record'

export const dynamic = 'force-dynamic'

type Student = { id:string; name:string; admission_number:string|null }
type Subject = { id:string; name:string }
type Enrollment = { isCurrent:boolean; joinedAt:string|null; leftAt:string|null }
type Period = '30'|'90'|'term'|'all'
type View = 'record'|'history'
const bands: ProgressBand[] = ['EE','ME','AE','BE','NE']
const tone: Record<ProgressBand,{background:string;color:string}> = { EE:{background:'#ecfdf5',color:'#065f46'}, ME:{background:'#eff6ff',color:'#1e40af'}, AE:{background:'#fffbeb',color:'#92400e'}, BE:{background:'#fef2f2',color:'#991b1b'}, NE:{background:'#f3f4f6',color:'#4b5563'} }

function dateLabel(value:string){ const d=new Date(value); return Number.isFinite(d.getTime())?d.toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Nairobi'}):value }

export default function StudentProgressRecordPage(){
  const {id:classId,studentId}=useParams<{id:string;studentId:string}>(); const router=useRouter(); const search=useSearchParams(); const requestedSubject=search.get('subjectId'); const ticketRef=useRef(0)
  const [student,setStudent]=useState<Student|null>(null); const [enrollment,setEnrollment]=useState<Enrollment|null>(null); const [subjects,setSubjects]=useState<Subject[]>([]); const [rows,setRows]=useState<ProgressEvidence[]>([])
  const [subject,setSubject]=useState('all'); const [period,setPeriod]=useState<Period>('term'); const [band,setBand]=useState<ProgressBand|'all'>('all'); const [source,setSource]=useState('all'); const [query,setQuery]=useState(''); const [view,setView]=useState<View>('record')
  const [terms,setTerms]=useState<ProgressTerm[]>([])
  const [loading,setLoading]=useState(true); const [error,setError]=useState('')

  const load=useCallback(async()=>{
    const ticket=++ticketRef.current
    setLoading(true);setError('')
    try{
      const authority=await loadProgressAuthority(classId)
      const current=await loadProgressRoster(authority,false)
      const learner=current.find(item=>item.id===studentId) ?? (await loadProgressRoster(authority,true)).find(item=>item.id===studentId)
      if(!learner)throw new Error('Learner is not associated with this class.')
      if(requestedSubject&&!authority.subjects.some(item=>item.id===requestedSubject))throw new Error('This subject is not assigned to you in this class.')
      const [evidence,calendar]=await Promise.all([loadProgressEvidence(authority,studentId),loadProgressTerms(authority.schoolId)])
      if(ticket!==ticketRef.current)return
      setStudent({id:learner.id,name:learner.name,admission_number:learner.admission_number})
      setEnrollment({isCurrent:learner.isCurrent,joinedAt:learner.joinedAt,leftAt:learner.leftAt})
      setSubjects(authority.subjects);setRows(evidence);setTerms(calendar);setSubject(requestedSubject??'all')
    }catch(cause){if(ticket===ticketRef.current){setStudent(null);setRows([]);setError(cause instanceof Error?cause.message:'Progress record could not be loaded.')}}
    finally{if(ticket===ticketRef.current)setLoading(false)}
  },[classId,studentId,requestedSubject])
  const invalidatePendingLoad=useCallback(()=>{++ticketRef.current},[])
  useEffect(()=>{void load();return invalidatePendingLoad},[load,invalidatePendingLoad])

  const today=progressDate(new Date())
  const term=useMemo(()=>currentProgressTerm(terms,new Date(`${today}T12:00:00+03:00`)),[terms,today])
  const filtered=useMemo(()=>rows.filter(row=>(subject==='all'||row.subjectId===subject)&&inProgressPeriod(row.observedAt,period,term)&&(source==='all'||row.source===source)),[rows,subject,period,term,source])
  const allOutcomes=useMemo(()=>buildOutcomeProgress(filtered),[filtered])
  const outcomes=useMemo(()=>allOutcomes.filter(o=>band==='all'||o.band===band).filter(o=>!query||`${o.outcomeCode??''} ${o.outcomeText} ${o.evidence.map(e=>`${e.source} ${e.notes??''}`).join(' ')}`.toLowerCase().includes(query.toLowerCase().trim())),[allOutcomes,band,query])
  const summary=useMemo(()=>progressSummary(allOutcomes),[allOutcomes])
  const history=useMemo(()=>buildProgressHistory(filtered).filter(h=>band==='all'||h.band===band).filter(h=>!query||`${h.outcomeCode??''} ${h.outcomeText} ${h.source} ${h.notes??''}`.toLowerCase().includes(query.toLowerCase().trim())),[filtered,band,query])
  const sources=useMemo(()=>Array.from(new Set(rows.map(r=>r.source))).sort(),[rows]); const subjectNames=useMemo(()=>new Map(subjects.map(s=>[s.id,s.name])),[subjects])

  if(loading)return <main style={{padding:20}} aria-label="Loading student progress record"><div style={{height:180,borderRadius:20,background:'#e5e7eb'}}/></main>
  if(error||!student)return <main style={{maxWidth:820,margin:'0 auto',padding:20}}><div role="alert" style={{padding:16,borderRadius:16,background:'#fef2f2',color:'#991b1b'}}>{error||'Learner not found.'}</div><button type="button" onClick={()=>void load()} style={pill}>Retry</button><button type="button" onClick={()=>router.push(`/teacher/classhub/${classId}/progress`)} style={pill}>Class progress</button></main>

  const archived=enrollment&&!enrollment.isCurrent
  return <main style={{maxWidth:920,margin:'0 auto',padding:'16px 14px 112px',color:'#111827'}}>
    <section style={{borderRadius:22,padding:18,background:'linear-gradient(135deg,#111827,#312e81)',color:'#fff'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><button onClick={()=>router.push(`/teacher/classhub/${classId}/student/${studentId}`)} style={heroButton}>‹ Learner</button><button onClick={()=>window.print()} style={{border:0,borderRadius:10,minHeight:44,padding:'0 12px',background:'#fff',color:'#111827',fontWeight:900}}>Print record</button></div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:14}}><div style={{fontSize:11,fontWeight:900,letterSpacing:1.2,opacity:.7}}>STUDENT PROGRESS RECORD</div>{archived&&<span style={{padding:'4px 7px',borderRadius:99,background:'rgba(255,255,255,.16)',fontSize:9,fontWeight:900}}>ARCHIVED CLASS RECORD</span>}</div>
      <h1 style={{margin:'4px 0 2px',fontSize:24}}>{student.name}</h1><div style={{fontSize:12,opacity:.75}}>{student.admission_number?`Admission ${student.admission_number} · `:''}{archived?'Historical evidence retained':'Evidence-backed curriculum progress'}{archived&&enrollment?.leftAt?` · left ${dateLabel(enrollment.leftAt)}`:''}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:15}}>{[{l:'Recorded outcome levels',v:summary.assessed},{l:'Meeting / exceeding',v:summary.secure},{l:'Need support',v:summary.needsSupport}].map(x=><div key={x.l} style={{padding:10,borderRadius:12,background:'rgba(255,255,255,.1)',textAlign:'center'}}><div style={{fontSize:20,fontWeight:900}}>{x.v}</div><div style={{fontSize:9,opacity:.7}}>{x.l}</div></div>)}</div>
    </section>

    {archived&&<section style={{marginTop:10,padding:12,border:'1px solid #e5e7eb',borderRadius:13,background:'#f9fafb',fontSize:11,color:'#4b5563'}}><strong>Read-only history.</strong> This learner is no longer current in this class. Their evidence remains available for professional continuity and audit; archive does not delete learning history.</section>}

    <nav aria-label="Progress record views" style={{display:'flex',gap:8,marginTop:12}}>{([['record','Current record'],['history',`History (${history.length})`]] as const).map(([key,text])=><button key={key} onClick={()=>setView(key)} style={{...pill,background:view===key?'#111827':'#fff',color:view===key?'#fff':'#374151'}}>{text}</button>)}</nav>

    <section aria-label="Progress search and filters" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,margin:'10px 0'}}>
      <input aria-label="Search progress record" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search outcome, activity, note" style={selectStyle}/>
      <select aria-label="Subject" value={subject} onChange={e=>setSubject(e.target.value)} style={selectStyle}><option value="all">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select aria-label="Period" value={period} onChange={e=>setPeriod(e.target.value as Period)} style={selectStyle}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="term">{term?.name??'This term unavailable'}</option><option value="all">All evidence</option></select>
      <select aria-label="Performance level" value={band} onChange={e=>setBand(e.target.value as ProgressBand|'all')} style={selectStyle}><option value="all">All levels</option>{bands.map(b=><option key={b} value={b}>{b} · {progressBandLabel(b)}</option>)}</select>
      <select aria-label="Evidence source" value={source} onChange={e=>setSource(e.target.value)} style={selectStyle}><option value="all">All activities</option>{sources.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select>
    </section>

    {period==='term'&&!term&&<section role="status" style={emptyStyle}>No single school term contains today. Choose another period to view evidence.</section>}
    {!archived&&<section aria-label="Progress actions" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}><button type="button" style={pill} onClick={()=>router.push(`/teacher/assessment/interventions?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(studentId)}${subject==='all'?'':`&subjectId=${encodeURIComponent(subject)}`}`)}>Review support & reassessment</button><button type="button" style={pill} onClick={()=>router.push(`/teacher/classhub/${classId}/workbook?sheet=progress${subject==='all'?'':`&subjectId=${encodeURIComponent(subject)}`}`)}>Open record sheet</button><button type="button" style={pill} onClick={()=>router.push(`/teacher/assessment?classId=${encodeURIComponent(classId)}${subject==='all'?'':`&subjectId=${encodeURIComponent(subject)}`}`)}>Record an observation</button><button type="button" style={pill} onClick={()=>router.push(`/teacher/classhub/${classId}/homework`)}>Review class work</button></section>}
    {filtered.some(row=>!row.outcomeId)&&<section role="status" style={emptyStyle}>{filtered.filter(row=>!row.outcomeId).length} evidence item(s) have no outcome link. They remain in History and do not establish outcome mastery.</section>}

    {view==='record'&&(outcomes.length===0?<section style={emptyStyle}><h2 style={{margin:0,fontSize:17}}>No matching progress evidence</h2><p style={{margin:'7px 0 0',color:'#6b7280',fontSize:13}}>The record fills automatically as outcome-linked learner evidence is captured. Change the filters to inspect another period or activity.</p></section>:
    <div style={{display:'grid',gap:10}}>{outcomes.map(o=><article key={o.key} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:17,padding:14,breakInside:'avoid'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}><div><div style={{fontSize:10,fontWeight:900,color:'#6b7280'}}>{o.subjectId?`${subjectNames.get(o.subjectId)??'Subject'} · `:''}{o.outcomeCode||'CURRICULUM OUTCOME'}</div><h2 style={{margin:'4px 0',fontSize:15,lineHeight:1.35}}>{o.outcomeText}</h2></div><span title={progressBandLabel(o.band)} style={{...tone[o.band],borderRadius:99,padding:'6px 9px',fontSize:11,fontWeight:900,whiteSpace:'nowrap'}}>{o.band}</span></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8,fontSize:11,color:'#6b7280'}}><span>{o.evidenceCount} evidence item{o.evidenceCount===1?'':'s'}</span><span>·</span><span>{o.percentage==null?'No numeric score':`${o.percentage}% latest observation`}</span><span>·</span><span>{o.trend==='insufficient'?'Not enough comparable evidence for a trend':`${o.trend} · ${o.trendDelta!>0?'+':''}${o.trendDelta} points · ${o.trendEvidenceCount} ${o.trendSource} observations`}</span><span>·</span><span>Latest {dateLabel(o.latestObservedAt)}</span></div>
      <details style={{marginTop:10}}><summary style={{cursor:'pointer',fontSize:12,fontWeight:900}}>Evidence & teacher observations</summary><div style={{display:'grid',gap:7,marginTop:8}}>{o.evidence.map(e=><div key={e.id} style={{padding:10,borderRadius:11,background:'#f9fafb',fontSize:11}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>{e.source.replaceAll('_',' ')}</strong><span>{dateLabel(e.observedAt)}</span></div><div style={{marginTop:4,color:'#4b5563'}}>{e.score!=null&&e.maxScore!=null?`${e.score}/${e.maxScore}`:e.proficiency||'Observed'}{e.subjectId&&subjectNames.get(e.subjectId)?` · ${subjectNames.get(e.subjectId)}`:''}</div>{e.notes&&<div style={{marginTop:5}}>{e.notes}</div>}</div>)}</div></details>
    </article>)}</div>)}

    {view==='history'&&(history.length===0?<section style={emptyStyle}><h2 style={{margin:0,fontSize:17}}>No history matches these filters</h2><p style={{margin:'7px 0 0',color:'#6b7280',fontSize:13}}>History is generated from dated learner evidence and cannot be manually rewritten from this view.</p></section>:<section aria-label="Progress history" style={{display:'grid',gap:8}}>{history.map((h,index)=><article key={h.id} style={{display:'grid',gridTemplateColumns:'80px minmax(0,1fr)',gap:10,padding:12,border:'1px solid #e5e7eb',borderRadius:15,background:'#fff'}}><div><div style={{fontSize:10,fontWeight:900,color:'#6b7280'}}>{dateLabel(h.observedAt)}</div>{index<history.length-1&&<div aria-hidden="true" style={{width:2,height:28,background:'#e5e7eb',margin:'8px 0 0 8px'}}/>}</div><div><div style={{display:'flex',gap:7,alignItems:'center',justifyContent:'space-between'}}><strong style={{fontSize:12}}>{h.source.replaceAll('_',' ')}</strong><span style={{...tone[h.band],borderRadius:99,padding:'4px 7px',fontSize:10,fontWeight:900}}>{h.band}</span></div><div style={{marginTop:4,fontSize:12,fontWeight:800}}>{h.outcomeCode?`${h.outcomeCode} · `:''}{h.outcomeText}</div><div style={{marginTop:4,fontSize:11,color:'#6b7280'}}>{h.percentage==null?(h.proficiency||'Observed'):`${h.percentage}%`}{h.subjectId&&subjectNames.get(h.subjectId)?` · ${subjectNames.get(h.subjectId)}`:''}</div>{h.notes&&<div style={{marginTop:5,fontSize:11}}>{h.notes}</div>}</div></article>)}</section>)}

    <p style={{marginTop:14,fontSize:10,color:'#6b7280'}}>Current progress is a projection of captured learner evidence. History preserves the dated evidence trail. Archived class records remain read-only; A score alone does not establish an official CBE level. Trend requires four comparable observations on separate dates; response items cannot stand in for independent assessments. This is your readable evidence projection, not a released report.</p>
  </main>
}

const heroButton:React.CSSProperties={border:0,borderRadius:10,minHeight:44,padding:'0 11px',background:'rgba(255,255,255,.14)',color:'#fff',fontWeight:800}
const pill:React.CSSProperties={minHeight:44,border:'1px solid #d1d5db',borderRadius:99,padding:'0 14px',fontWeight:900,cursor:'pointer'}
const selectStyle:React.CSSProperties={minHeight:44,border:'1px solid #d1d5db',borderRadius:12,background:'#fff',padding:'0 10px',fontWeight:800,color:'#374151',boxSizing:'border-box',width:'100%'}
const emptyStyle:React.CSSProperties={padding:26,border:'1px solid #e5e7eb',borderRadius:17,background:'#fff',textAlign:'center'}

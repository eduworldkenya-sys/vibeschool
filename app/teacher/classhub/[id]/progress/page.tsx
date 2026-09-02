'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { normalizeProgressBand, type ProgressBand } from '@/lib/learner-intelligence/progress-record'

export const dynamic = 'force-dynamic'

type Learner = { id:string; name:string; admission_number:string|null; isCurrent:boolean; joinedAt:string|null; leftAt:string|null }
type Evidence = { student_id:string; score:number|null; max_score:number|null; proficiency:string|null; observed_at:string }
type TeacherClassAssignment = { class_id:string; class_name:string; stream:string|null }
type TeacherOperatingContext = { school_id:string|null; classes?:TeacherClassAssignment[] }
type StudentNested = { id:string; name:string; admission_number:string|null; deleted_at:string|null }
type EnrollmentRow = { student_id:string; is_current:boolean|null; joined_at:string|null; left_at:string|null; students:StudentNested|StudentNested[]|null }
type EvidenceRow = { student_id:string; score:number|string|null; max_score:number|string|null; proficiency:string|null; observed_at:string }
type View = 'current'|'archived'
type SupportFilter = 'all'|'support'|'secure'|'no-evidence'
const order:Record<ProgressBand,number>={BE:0,AE:1,NE:2,ME:3,EE:4}
const label:Record<ProgressBand,string>={EE:'Exceeding',ME:'Meeting',AE:'Approaching',BE:'Below',NE:'No evidence'}

function typed<T>(value:unknown):T{return value as T}
function average(rows:Evidence[]){
  const scored=rows.filter(r=>r.score!=null&&r.max_score!=null&&r.max_score>0)
  return scored.length?Math.round(scored.reduce((n,r)=>n+(r.score!/r.max_score!)*100,0)/scored.length):null
}

export default function ClassStudentProgressPage(){
  const {id:classId}=useParams<{id:string}>(); const router=useRouter()
  const [learners,setLearners]=useState<Learner[]>([]); const [evidence,setEvidence]=useState<Evidence[]>([]); const [className,setClassName]=useState('Class')
  const [query,setQuery]=useState(''); const [view,setView]=useState<View>('current'); const [support,setSupport]=useState<SupportFilter>('all')
  const [loading,setLoading]=useState(true); const [error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser(); if(authError||!auth.user){router.replace('/login');return}
      const {data:ctx,error:ce}=await supabase.rpc('teacher_get_operating_context'); if(ce)throw ce
      const context=typed<TeacherOperatingContext>(ctx)
      const assignment=context.classes?.find(item=>item.class_id===classId)
      if(!context.school_id||!assignment)throw new Error('This class is not assigned to you in the active school.')
      setClassName(`${assignment.class_name}${assignment.stream?` ${assignment.stream}`:''}`)

      const enrollment=await supabase.from('student_classes').select('student_id,is_current,joined_at,left_at,students(id,name,admission_number,deleted_at)').eq('school_id',context.school_id).eq('class_id',classId).order('joined_at',{ascending:false})
      if(enrollment.error)throw enrollment.error
      const deduped=new Map<string,Learner>()
      for(const row of typed<EnrollmentRow[]>(enrollment.data??[])){
        const student=Array.isArray(row.students)?row.students[0]:row.students
        if(!student||student.deleted_at||!student.id)continue
        const candidate:Learner={id:student.id,name:student.name,admission_number:student.admission_number??null,isCurrent:Boolean(row.is_current),joinedAt:row.joined_at??null,leftAt:row.left_at??null}
        const existing=deduped.get(candidate.id)
        if(!existing||candidate.isCurrent)deduped.set(candidate.id,candidate)
      }
      setLearners(Array.from(deduped.values()))

      const er=await supabase.from('competency_evidence_ledger').select('student_id,score,max_score,proficiency,observed_at').eq('school_id',context.school_id).eq('class_id',classId).order('observed_at',{ascending:false}).limit(3000)
      if(er.error)throw er.error
      const evidenceRows=typed<EvidenceRow[]>(er.data??[])
      setEvidence(evidenceRows.map(row=>({student_id:row.student_id,score:row.score==null?null:Number(row.score),max_score:row.max_score==null?null:Number(row.max_score),proficiency:row.proficiency,observed_at:row.observed_at})))
    }catch(e){console.error('[ClassStudentProgress] load',e);setError(e instanceof Error?e.message:'Class progress could not be loaded.')}finally{setLoading(false)}
  },[classId,router])
  useEffect(()=>{void load()},[load])

  const cards=useMemo(()=>learners.map(l=>{
    const rows=evidence.filter(e=>e.student_id===l.id); const avg=average(rows); const latest=rows[0]
    const band=normalizeProgressBand(latest?.proficiency??null,avg)
    return{...l,count:rows.length,avg,band,last:latest?.observed_at??null}
  }).filter(l=>view==='current'?l.isCurrent:!l.isCurrent)
    .filter(l=>!query||`${l.name} ${l.admission_number??''}`.toLowerCase().includes(query.toLowerCase().trim()))
    .filter(l=>support==='all'||(support==='support'&&(l.band==='AE'||l.band==='BE'))||(support==='secure'&&(l.band==='ME'||l.band==='EE'))||(support==='no-evidence'&&l.band==='NE'))
    .sort((a,b)=>order[a.band]-order[b.band]||a.name.localeCompare(b.name)),[learners,evidence,query,view,support])

  const counts=useMemo(()=>({current:learners.filter(l=>l.isCurrent).length,archived:learners.filter(l=>!l.isCurrent).length}),[learners])
  if(loading)return <main style={{padding:20}}><div style={{height:180,borderRadius:20,background:'#e5e7eb'}}/></main>

  return <main style={{maxWidth:900,margin:'0 auto',padding:'16px 14px 112px'}}>
    <section style={{padding:18,borderRadius:21,background:'linear-gradient(135deg,#0f172a,#1d4ed8)',color:'#fff'}}>
      <button onClick={()=>router.push(`/teacher/classhub/${classId}`)} style={heroButton}>‹ Class</button>
      <div style={{marginTop:13,fontSize:11,fontWeight:900,opacity:.7}}>STUDENT PROGRESS</div><h1 style={{margin:'4px 0',fontSize:24}}>{className}</h1>
      <p style={{margin:0,fontSize:12,opacity:.75}}>Search the class, surface learners needing support, and retain read-only progress history after a learner leaves the class.</p>
    </section>

    {error?<div role="alert" style={{marginTop:12,padding:14,borderRadius:14,background:'#fef2f2',color:'#991b1b'}}>{error}</div>:<>
      <nav aria-label="Progress lifecycle" style={{display:'flex',gap:8,marginTop:12}}>
        {([['current',`Current (${counts.current})`],['archived',`Archived (${counts.archived})`]] as const).map(([key,text])=><button key={key} onClick={()=>setView(key)} style={{...pill,background:view===key?'#111827':'#fff',color:view===key?'#fff':'#374151'}}>{text}</button>)}
      </nav>
      <section aria-label="Class progress search and filters" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(150px,220px)',gap:8,margin:'10px 0 12px'}}>
        <input aria-label="Search learners" placeholder="Search learner or admission number" value={query} onChange={e=>setQuery(e.target.value)} style={control}/>
        <select aria-label="Progress status" value={support} onChange={e=>setSupport(e.target.value as SupportFilter)} style={control}><option value="all">All progress</option><option value="support">Needs support</option><option value="secure">Meeting / exceeding</option><option value="no-evidence">Not assessed yet</option></select>
      </section>
      {view==='archived'&&<div style={{marginBottom:10,padding:11,borderRadius:12,background:'#f9fafb',border:'1px solid #e5e7eb',fontSize:11,color:'#4b5563'}}>Archived means the learner is no longer current in this class. Their historical evidence remains available; nothing is deleted.</div>}
      <div style={{display:'grid',gap:9}}>{cards.map(l=><button key={l.id} onClick={()=>router.push(`/teacher/classhub/${classId}/student/${l.id}/progress`)} style={{border:'1px solid #e5e7eb',borderRadius:16,background:'#fff',padding:14,textAlign:'left',font:'inherit',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><strong>{l.name}</strong><div style={{marginTop:4,fontSize:11,color:'#6b7280'}}>{l.admission_number?`Adm ${l.admission_number} · `:''}{l.count} evidence item{l.count===1?'':'s'}{l.avg==null?'':` · ${l.avg}% avg`}{!l.isCurrent&&l.leftAt?` · left ${new Date(l.leftAt).toLocaleDateString('en-KE')}`:''}</div></div><span style={{fontSize:11,fontWeight:900,color:l.band==='BE'?'#991b1b':l.band==='AE'?'#92400e':l.band==='NE'?'#6b7280':'#065f46'}}>{l.band} · {label[l.band]}</span></div>
      </button>)}{!cards.length&&<div style={{padding:28,textAlign:'center',border:'1px solid #e5e7eb',borderRadius:16}}>{view==='archived'?'No archived learners match this view.':'No current learners match this view.'}</div>}</div>
    </>}
  </main>
}

const heroButton:React.CSSProperties={border:0,borderRadius:10,minHeight:38,padding:'0 11px',background:'rgba(255,255,255,.14)',color:'#fff',fontWeight:800}
const pill:React.CSSProperties={minHeight:40,border:'1px solid #d1d5db',borderRadius:99,padding:'0 14px',fontWeight:900,cursor:'pointer'}
const control:React.CSSProperties={width:'100%',boxSizing:'border-box',minHeight:46,border:'1px solid #d1d5db',borderRadius:13,padding:'0 13px',background:'#fff',color:'#374151',fontWeight:700}

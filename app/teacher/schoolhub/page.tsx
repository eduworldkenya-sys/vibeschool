'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'
import { formatJoinCode } from '@/lib/schoolCode'

type SchoolInfo = {
  id: string; name: string; status: string; subdomain: string
  county: string | null; sub_county: string | null; school_type: string | null
  school_category: string | null; knec_code: string | null
}
type SchoolOption = { id: string; name: string; status: string }
type Assignment = { class_id: string; subject_id: string | null; classes: { name: string; stream: string | null } | null; subjects: { name: string } | null }
type Context = { state?: string; active_school_id?: string | null; schools?: SchoolOption[] }

const card: React.CSSProperties = { background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:16 }
const button: React.CSSProperties = { minHeight:44, border:0, borderRadius:12, padding:'0 16px', fontWeight:850, cursor:'pointer', font:'inherit' }

export default function SchoolHubPage() {
  const router = useRouter()
  const [context,setContext]=useState<Context|null>(null)
  const [school,setSchool]=useState<SchoolInfo|null>(null)
  const [assignments,setAssignments]=useState<Assignment[]>([])
  const [loading,setLoading]=useState(true)
  const [switching,setSwitching]=useState(false)
  const [error,setError]=useState('')
  const [copied,setCopied]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){ router.replace('/academy/signin?role=teacher'); return }
    const {data:ctx,error:ctxError}=await supabase.rpc('get_my_teacher_school_context')
    if(ctxError){ setError('Your school workspace could not be loaded. Please retry.'); setLoading(false); return }
    const next=(ctx??{}) as Context
    setContext(next)
    const schoolId=next.active_school_id
    if(!schoolId){ setSchool(null); setAssignments([]); setLoading(false); return }
    const [schoolRes,assignmentRes]=await Promise.all([
      supabase.from('schools').select('id,name,status,subdomain,county,sub_county,school_type,school_category,knec_code').eq('id',schoolId).maybeSingle(),
      supabase.from('teacher_classes').select('class_id,subject_id,classes(name,stream),subjects(name)').eq('teacher_id',user.id).eq('school_id',schoolId)
    ])
    if(schoolRes.error||assignmentRes.error){ setError('Some school workspace details could not be loaded. Please retry.'); setLoading(false); return }
    setSchool(schoolRes.data as SchoolInfo|null)
    setAssignments((assignmentRes.data ?? []).map(row => ({ ...row })) as Assignment[])
    setLoading(false)
  },[router])

  useEffect(()=>{ void load() },[load])

  const schools=context?.schools??[]
  const uniqueClasses=useMemo(()=>new Set(assignments.map(a=>a.class_id)).size,[assignments])
  const uniqueSubjects=useMemo(()=>new Set(assignments.map(a=>a.subject_id).filter(Boolean)).size,[assignments])
  const ready=Boolean(school&&assignments.length>0)
  const nextAction=!school
    ? {label:'Connect your school',hint:'School identity is required before classes and teaching work.',href:'/teacher/onboarding/school'}
    : assignments.length===0
      ? {label:'Add your first class',hint:'Tell VibeSchool the class and subject you teach.',href:'/teacher/onboarding/class'}
      : {label:'Open today’s teaching',hint:'Your school and teaching assignments are ready.',href:'/teacher/pulse'}

  async function switchSchool(id:string){
    if(id===context?.active_school_id||switching)return
    setSwitching(true); setError('')
    const {error:e}=await supabase.rpc('set_my_active_teacher_school',{p_school_id:id})
    if(e) setError('We could not switch schools safely. Your previous school remains active.')
    else await load()
    setSwitching(false)
  }

  async function copyCode(){
    if(!school?.subdomain)return
    try{ await navigator.clipboard.writeText(formatJoinCode(school.subdomain)); setCopied(true); window.setTimeout(()=>setCopied(false),1800) }
    catch{ setError('The join code could not be copied. You can select it manually.') }
  }

  return <main style={{padding:'18px 16px 36px',maxWidth:720,margin:'0 auto',color:C.textPrimary}}>
    <section style={{background:'linear-gradient(135deg,#111827,#312e81)',borderRadius:22,padding:20,color:'#fff'}}>
      <div style={{fontSize:11,fontWeight:800,letterSpacing:1.2,textTransform:'uppercase',opacity:.72}}>School Hub</div>
      <h1 style={{fontSize:24,lineHeight:1.2,margin:'6px 0'}}>{loading?'Loading your school…':school?.name??'Connect your school'}</h1>
      <p style={{margin:0,fontSize:13,lineHeight:1.5,opacity:.8}}>Your school, teaching assignments and next setup action in one place.</p>
      {school&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:13}}>
        <span style={{padding:'5px 9px',borderRadius:999,background:'rgba(255,255,255,.13)',fontSize:12,fontWeight:750}}>{school.status==='active'?'Connected school':school.status==='pending'?'Pending verification':school.status}</span>
        {school.county&&<span style={{padding:'5px 9px',borderRadius:999,background:'rgba(255,255,255,.13)',fontSize:12}}>{school.county}</span>}
        <span style={{padding:'5px 9px',borderRadius:999,background:'rgba(255,255,255,.13)',fontSize:12}}>{ready?'Teaching setup ready':'Setup in progress'}</span>
      </div>}
    </section>

    {error&&<div role="alert" style={{marginTop:14,padding:13,borderRadius:12,background:'#fef2f2',color:'#b42318',fontWeight:700}}>{error} <button onClick={()=>void load()} style={{border:0,background:'transparent',textDecoration:'underline',fontWeight:850,color:'inherit'}}>Retry</button></div>}

    {loading?<div aria-live="polite" style={{display:'grid',gap:12,marginTop:14}}>{[90,150,120].map((h,i)=><div key={i} style={{height:h,borderRadius:18,background:'#f3f4f6'}}/>)}</div>:<>
      <section style={{...card,marginTop:14,borderColor:'#c7d2fe',background:'#f8faff'}}>
        <div style={{fontSize:11,fontWeight:850,textTransform:'uppercase',letterSpacing:1,color:'#4f46e5'}}>Next best action</div>
        <h2 style={{fontSize:18,margin:'6px 0 3px'}}>{nextAction.label}</h2>
        <p style={{margin:'0 0 13px',color:C.textMuted,fontSize:13,lineHeight:1.5}}>{nextAction.hint}</p>
        <button onClick={()=>router.push(nextAction.href)} style={{...button,background:'#111827',color:'#fff',width:'100%'}}>{nextAction.label} →</button>
      </section>

      {schools.length>1&&<section style={{...card,marginTop:14}}>
        <div style={{fontSize:12,fontWeight:850,marginBottom:8}}>Active school</div>
        <select aria-label="Active school" value={context?.active_school_id??''} disabled={switching} onChange={e=>void switchSchool(e.target.value)} style={{width:'100%',minHeight:46,border:'1px solid #d1d5db',borderRadius:12,padding:'0 12px',background:'#fff',font:'inherit'}}>
          {schools.map(s=><option key={s.id} value={s.id}>{s.name}{s.status==='pending'?' · pending':''}</option>)}
        </select>
        <p style={{margin:'8px 0 0',fontSize:12,color:C.textMuted}}>Classes and teaching data below always follow the active school.</p>
      </section>}

      {school&&<section style={{...card,marginTop:14}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
          {[['Classes',String(uniqueClasses)],['Subjects',String(uniqueSubjects)],['Setup',ready?'Ready':'Action needed']].map(([label,value])=><div key={label} style={{padding:12,borderRadius:14,background:'#f9fafb'}}><div style={{fontSize:11,color:C.textMuted,fontWeight:750}}>{label}</div><div style={{fontSize:16,fontWeight:900,marginTop:3}}>{value}</div></div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}>
          <button onClick={()=>router.push('/teacher/classhub')} style={{...button,background:'#111827',color:'#fff'}}>My classes</button>
          <button onClick={()=>router.push('/teacher/timetable')} style={{...button,background:'#fff',color:C.textPrimary,border:'1px solid #d1d5db'}}>Timetable</button>
        </div>
      </section>}

      {school&&assignments.length>0&&<section style={{...card,marginTop:14}}>
        <div style={{fontSize:12,fontWeight:850,marginBottom:10}}>What you teach here</div>
        <div style={{display:'grid',gap:8}}>{assignments.slice(0,6).map((a,i)=><button key={a.class_id+'-'+(a.subject_id??i)} onClick={()=>router.push('/teacher/classhub/'+encodeURIComponent(a.class_id))} style={{textAlign:'left',padding:12,borderRadius:12,border:'1px solid #e5e7eb',background:'#fff',font:'inherit',cursor:'pointer'}}>
          <strong>{a.classes?.name??'Class'}{a.classes?.stream?' '+a.classes.stream:''}</strong>
          <span style={{display:'block',fontSize:12,color:C.textMuted,marginTop:3}}>{a.subjects?.name??'Teaching assignment'} · Open class →</span>
        </button>)}</div>
      </section>}

      {school&&<section style={{...card,marginTop:14}}>
        <div style={{fontSize:12,fontWeight:850}}>School details</div>
        <div style={{marginTop:9,fontSize:13,lineHeight:1.8,color:C.textMuted}}>
          {[school.school_category||school.school_type,school.sub_county,school.county,school.knec_code?('KNEC '+school.knec_code):null].filter(Boolean).join(' · ')||'School profile details are still being completed.'}
        </div>
        {school.subdomain&&<div style={{marginTop:12,padding:12,borderRadius:12,background:'#f9fafb',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div><div style={{fontSize:11,color:C.textMuted,fontWeight:750}}>Staff join code</div><div style={{fontFamily:'monospace',fontSize:18,fontWeight:900,letterSpacing:2}}>{formatJoinCode(school.subdomain)}</div></div>
          <button onClick={()=>void copyCode()} style={{...button,minHeight:40,background:'#fff',border:'1px solid #d1d5db'}}>{copied?'Copied':'Copy'}</button>
        </div>}
      </section>}

      <section style={{marginTop:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <button onClick={()=>router.push('/teacher/onboarding/school')} style={{...button,background:'#fff',border:'1px solid #d1d5db',color:C.textPrimary}}>{school?'Add / change school':'Find school'}</button>
        <button onClick={()=>router.push('/teacher/onboarding/class')} disabled={!school} style={{...button,background:school?'#eef2ff':'#f3f4f6',color:school?'#3730a3':'#9ca3af'}}>Add teaching assignment</button>
      </section>
    </>}
  </main>
}

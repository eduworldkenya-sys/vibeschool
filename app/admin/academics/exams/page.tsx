"use client"
export const dynamic = "force-dynamic"

import {useEffect,useState} from "react"
import Link from "next/link"
import {supabase} from "@/lib/supabase"
import {getAdminSchoolAuthority} from "@/lib/admin/authority"
import {
 getExamLifecycle,reviewExamSubject,setExamPublication,type ExamLifecycle,
} from "@/lib/teacher/examLifecycle"

type Exam={id:string,name:string,term:number,academic_year:number,is_locked:boolean}
type SchoolClass={id:string,name:string,stream:string|null}
type Subject={id:string,name:string}
const panel:React.CSSProperties={background:"#fff",border:"1px solid #dfe8e1",borderRadius:14,padding:16}
const btn:React.CSSProperties={border:"1px solid #bed1c2",borderRadius:9,padding:"9px 13px",fontWeight:700,fontSize:12,cursor:"pointer",background:"#fff",color:"#285b3b"}

export default function ExaminationOfficePage(){
 const [schoolId,setSchoolId]=useState("")
 const [exams,setExams]=useState<Exam[]>([])
 const [classes,setClasses]=useState<SchoolClass[]>([])
 const [subjects,setSubjects]=useState<Subject[]>([])
 const [examId,setExamId]=useState("")
 const [classId,setClassId]=useState("")
 const [lifecycle,setLifecycle]=useState<ExamLifecycle|null>(null)
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [note,setNote]=useState("")
 const [reason,setReason]=useState("")
 useEffect(()=>{let active=true;setLoading(true);setError("")
 void (async()=>{
   const scope=await getAdminSchoolAuthority()
   const [a,b]=await Promise.all([
     supabase.from('exams').select('id,name,term,academic_year,is_locked')
       .eq('school_id',scope.schoolId).order('created_at',{ascending:false}),
     supabase.from('classes').select('id,name,stream').eq('school_id',scope.schoolId)
       .order('name'),
   ])
   if(a.error)throw a.error
   if(b.error)throw b.error
   if(!active)return
   const e=(a.data??[]) as Exam[],c=(b.data??[]) as SchoolClass[]
   setSchoolId(scope.schoolId);setExams(e);setClasses(c)
   setExamId(e[0]?.id??"");setClassId(c[0]?.id??"")
 })().catch(e=>{if(active)setError(e instanceof Error?e.message:'Examination office unavailable.')})
 .finally(()=>{if(active)setLoading(false)})
 return()=>{active=false}
 },[])
 async function reload(){
  if(!schoolId||!examId||!classId)return
  const [review,alloc]=await Promise.all([
   getExamLifecycle({examId,schoolId,classId},'admin'),
   supabase.from('teacher_classes').select('subject_id')
     .eq('school_id',schoolId).eq('class_id',classId),
  ])
  if(alloc.error)throw alloc.error
  const ids=Array.from(new Set((alloc.data??[]).map(x=>x.subject_id)))
  let ss:Subject[]=[]
  if(ids.length){
    const r=await supabase.from('subjects').select('id,name')
      .eq('school_id',schoolId).in('id',ids).order('name')
    if(r.error)throw r.error
    ss=(r.data??[]) as Subject[]
  }
  setLifecycle(review);setSubjects(ss)
 }
 useEffect(()=>{
  let active=true
  setLifecycle(null);setSubjects([]);setError("");setNote("")
  if(!schoolId||!examId||!classId)return
  void reload().catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to read examination status.')})
  return()=>{active=false}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[schoolId,examId,classId])
 async function act(action:'verify'|'reopen'|'publish'|'unpublish',subjectId?:string){
  if(!schoolId||!examId||!classId||busy)return
  if((action==='reopen'||action==='unpublish')&&(reason.trim().length<10||reason.trim().length>500)){
   setError('Provide a reason of 10–500 characters for reopening or unpublishing.')
   return
  }
  if(action==='publish'&&!window.confirm('Publish approved class results to linked parents and learners?'))return
  if(action==='unpublish'&&!window.confirm('Withdraw published results? Parents and learners will lose access immediately.'))return
  setBusy(true);setError("");setNote("")
  try{
   const scope={examId,schoolId,classId}
   if(action==='verify'||action==='reopen'){
    if(!subjectId)throw new Error('Learning area is required.')
    await reviewExamSubject({...scope,subjectId,action,reason:action==='reopen'?reason.trim():null})
   }else{
    await setExamPublication({...scope,publish:action==='publish',reason:action==='unpublish'?reason.trim():null})
   }
   await reload()
   setReason("")
   setNote(action==='verify'?'Subject verified.':action==='reopen'?'Subject reopened.':
     action==='publish'?'Results published.':'Results withdrawn.')
  }catch(e){setError(e instanceof Error?e.message:'Examination action failed.')}
  finally{setBusy(false)}
 }
 const exam=exams.find(x=>x.id===examId)
 const allVerified=!!lifecycle&&subjects.length>0&&subjects.length===lifecycle.expected_subject_count&&
  subjects.every(subject=>lifecycle.subjects.some(r=>r.subject_id===subject.id&&r.state==='verified'))
 return <main style={{maxWidth:1020,margin:'0 auto',display:'grid',gap:14,paddingBottom:70}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
   <div><h1 style={{margin:0,fontSize:23,color:'#153b25'}}>Examination office</h1>
    <p style={{margin:'5px 0 0',color:'#6c8170',fontSize:13}}>Verify results before learners and families receive them.</p></div>
   <Link href="/admin/academics/gradebook" style={{...btn,textDecoration:'none'}}>School gradebook</Link>
  </header>
  {loading?<p role="status" style={panel}>Loading examination office…</p>:<>
   <div style={{...panel,display:'flex',gap:12,flexWrap:'wrap'}}>
    <label style={{display:'grid',flex:'1 1 260px',gap:6,fontSize:12,color:'#4c6955'}}>Examination
     <select value={examId} onChange={e=>setExamId(e.target.value)} style={{padding:11,borderRadius:9,border:'1px solid #dbe5df'}}>
      {exams.map(e=><option key={e.id} value={e.id}>{e.name} · {e.academic_year} Term {e.term}</option>)}
     </select>
    </label>
    <label style={{display:'grid',flex:'1 1 240px',gap:6,fontSize:12,color:'#4c6955'}}>Class
     <select value={classId} onChange={e=>setClassId(e.target.value)} style={{padding:11,borderRadius:9,border:'1px solid #dbe5df'}}>
      {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.stream?' · '+c.stream:''}</option>)}
     </select>
    </label>
   </div>
   {error&&<div role="alert" style={{...panel,color:'#b4232b',borderColor:'#f3b8bd'}}>{error}</div>}
   {note&&<div role="status" style={{...panel,color:'#247342'}}>{note}</div>}
   {(!examId||!classId)&&<section style={panel}>Select an examination and class. Examinations and classes are created through School Hub.</section>}
   {examId&&classId&&!lifecycle&&!error&&<div role="status" style={panel}>Loading class approvals…</div>}
   {lifecycle&&<section style={{display:'grid',gap:13}}>
    <div style={{...panel,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
     <div><strong style={{color:'#18472a'}}>Publication: {lifecycle.status==='published'?'Published':'Not published'}</strong>
     <p style={{margin:'6px 0 0',color:'#6f8072',fontSize:12}}>Verified {subjects.filter(s=>lifecycle.subjects.some(r=>r.subject_id===s.id&&r.state==='verified')).length} of {lifecycle.expected_subject_count} learning areas.</p></div>
     {exam?.is_locked&&<span style={{color:'#ae5e19',fontWeight:700}}>Examination locked</span>}
    </div>
    <div style={panel}>
     <h2 style={{margin:'0 0 14px',fontSize:16,color:'#1b462b'}}>Learning-area verification</h2>
     {subjects.length===0?<p>No assigned learning areas in this class. Check school teacher allocations.</p>:subjects.map(sub=>{
      const state=lifecycle.subjects.find(r=>r.subject_id===sub.id)?.state??'draft'
      return <div key={sub.id} style={{padding:'12px 0',borderTop:'1px solid #edf1ed',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
       <div><strong style={{fontSize:13}}>{sub.name}</strong><div style={{fontSize:12,color:'#728477',marginTop:3}}>{state==='draft'?'Awaiting subject teacher':state}</div></div>
       <div style={{display:'flex',gap:8}}>
        {state==='submitted'&&<button style={btn} disabled={busy||lifecycle.status==='published'||exam?.is_locked} onClick={()=>{void act('verify',sub.id)}}>Verify</button>}
        {['submitted','verified'].includes(state)&&<button style={btn} disabled={busy||lifecycle.status==='published'||exam?.is_locked} onClick={()=>{void act('reopen',sub.id)}}>Reopen</button>}
       </div>
      </div>
     })}
    </div>
    <div style={panel}>
     <h2 style={{fontSize:16,margin:'0 0 5px'}}>Release controls</h2>
     <p style={{fontSize:12,color:'#6b7d6f',lineHeight:1.5}}>Publication requires every class learning area verified. Unpublishing and reopening require a written reason.</p>
     <label style={{display:'grid',gap:7,fontSize:12,color:'#445d4d',margin:'13px 0'}}>Reason for reopening or withdrawing
      <textarea value={reason} rows={3} maxLength={500} onChange={e=>setReason(e.target.value)}
       placeholder="Explain the correction or withdrawal" style={{width:'100%',padding:11,border:'1px solid #d7e1d9',borderRadius:9}}/>
     </label>
     {lifecycle.status==='published'
      ? <button style={{...btn,background:'#a33b30',color:'#fff'}} disabled={busy} onClick={()=>{void act('unpublish')}}>{busy?'Working…':'Withdraw publication'}</button>
      : <button style={{...btn,background:'#207444',color:'#fff'}} disabled={busy||!allVerified||exam?.is_locked}
       title={!allVerified?'Verify every learning area first':''} onClick={()=>{void act('publish')}}>{busy?'Working…':'Publish class results'}</button>}
    </div>
   </section>}
  </>}
 </main>
}

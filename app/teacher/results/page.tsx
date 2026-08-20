"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProfessionalMarkbook from '@/components/teacher/ProfessionalMarkbook'
import AssessmentIntelligenceConsole from '@/components/teacher/AssessmentIntelligenceConsole'
import type { Database } from '@/lib/database.types'

type ExamInsert = Database["public"]["Tables"]["exams"]["Insert"]
type ExamResultInsert = Database["public"]["Tables"]["exam_results"]["Insert"]

interface Exam {
  id: string
  name: string
  term: number
  academic_year: number
  exam_type: string
  pass_mark: number
  is_locked: boolean
  created_by: string
}
interface ClassOption { id: string; name: string; stream: string }
interface SubjectOption { id: string; name: string }
interface Student { id: string; name: string; source: 'db' | 'manual'; class_name?: string }
interface Result { id: string; student_id: string; marks: number; is_absent: boolean }
type Tier = 1 | 2 | 3

function getGrade(marks: number): string {
  if (marks >= 80) return 'EE'
  if (marks >= 60) return 'ME'
  if (marks >= 40) return 'AE'
  return 'BE'
}
function Skeleton({ h = 56 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 12, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%' }} />
}
const W = { bg:'#FFFBF5', card:'#FFF8EF', border:'#EDE0CE', borderSoft:'#F5ECD9', text:'#1c1917', textSoft:'#78716c', textMuted:'#a8998a', gold:'#C8A84B', font:'Jost, sans-serif' }
const inputStyle: React.CSSProperties = { width:'100%', padding:'10px 12px', borderRadius:10, border:`1.5px solid ${W.border}`, fontSize:13, color:W.text, background:W.card, outline:'none', boxSizing:'border-box', fontFamily:W.font }
const labelStyle: React.CSSProperties = { display:'block', fontSize:12, fontWeight:600, color:W.textSoft, marginBottom:6, fontFamily:W.font }
const btnPrimary: React.CSSProperties = { width:'100%', padding:'13px 0', borderRadius:14, border:'none', cursor:'pointer', fontSize:14, fontWeight:700, background:W.gold, color:'#fff', fontFamily:W.font }
function pill(active:boolean, accent=W.gold):React.CSSProperties { return { flexShrink:0, padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:W.font, background:active?accent:W.borderSoft, color:active?'#fff':W.textSoft } }

function ResultsInner() {
  const searchParams = useSearchParams()
  const [teacherId,setTeacherId]=useState<string|null>(null)
  const [schoolId,setSchoolId]=useState<string|null>(null)
  const [tier,setTier]=useState<Tier|null>(null)
  const [classes,setClasses]=useState<ClassOption[]>([])
  const [subjects,setSubjects]=useState<SubjectOption[]>([])
  const [activeClassIdx,setActiveClassIdx]=useState(0)
  const [activeSubjectIdx,setActiveSubjectIdx]=useState(0)
  const [exams,setExams]=useState<Exam[]>([])
  const [activeExam,setActiveExam]=useState<Exam|null>(null)
  const [showExamSheet,setShowExamSheet]=useState(false)
  const [newExamName,setNewExamName]=useState('')
  const [newExamType,setNewExamType]=useState('summative')
  const [newExamTerm,setNewExamTerm]=useState(1)
  const [newExamYear,setNewExamYear]=useState(new Date().getFullYear())
  const [newExamPass,setNewExamPass]=useState(50)
  const [creatingExam,setCreatingExam]=useState(false)
  const [examError,setExamError]=useState<string|null>(null)
  const [students,setStudents]=useState<Student[]>([])
  const [results,setResults]=useState<Result[]>([])
  const [draftMarks,setDraftMarks]=useState<Record<string,string>>({})
  const [savingId,setSavingId]=useState<string|null>(null)
  const [savedId,setSavedId]=useState<string|null>(null)
  const [errorByStudent,setErrorByStudent]=useState<Record<string,string>>({})
  const [activeTab,setActiveTab]=useState<'entry'|'analysis'>('entry')
  const [booting,setBooting]=useState(true)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const loadIdRef=useRef(0)

  useEffect(()=>{ void boot() },[])

  async function boot() {
    setBooting(true); setError(null)
    const { data:{user}, error:authErr } = await supabase.auth.getUser()
    if (authErr || !user) { setError('Not signed in.'); setBooting(false); return }
    setTeacherId(user.id)
    const [teacherRes,memberRes,profileRes]=await Promise.all([
      supabase.from('teacher_profiles').select('school_id').eq('profile_id',user.id).maybeSingle(),
      supabase.from('school_members').select('school_id').eq('profile_id',user.id).maybeSingle(),
      supabase.from('profiles').select('school_id').eq('id',user.id).single(),
    ])
    const sid:string|null = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? null
    setSchoolId(sid)
    if (!sid) { setTier(3); await loadExams(user.id,null); setBooting(false); return }
    const { data:tcRows } = await supabase.from('teacher_classes').select('class_id, subject_id').eq('teacher_id',user.id)
    const rows=tcRows??[]
    const classIds=Array.from(new Set(rows.map((r:{class_id:string})=>r.class_id).filter(Boolean)))
    const subjectIds=Array.from(new Set(rows.map((r:{subject_id:string})=>r.subject_id).filter(Boolean)))
    if (classIds.length===0) { setTier(2); await loadExams(user.id,sid); setBooting(false); return }
    setTier(1)
    const [classesRes,subjectsRes]=await Promise.all([
      supabase.from('classes').select('id, name, stream').in('id',classIds),
      subjectIds.length>0 ? supabase.from('subjects').select('id, name').in('id',subjectIds) : Promise.resolve({data:[]}),
    ])
    const loadedClasses=(classesRes.data??[]) as ClassOption[]
    const loadedSubjects=(subjectsRes.data??[]) as SubjectOption[]
    let ci=0,si=0
    const urlClassId=searchParams.get('classId'); const urlSubjectId=searchParams.get('subjectId')
    if (urlClassId) { const i=loadedClasses.findIndex(c=>c.id===urlClassId); if (i!==-1) ci=i }
    if (urlSubjectId) { const i=loadedSubjects.findIndex(s=>s.id===urlSubjectId); if (i!==-1) si=i }
    setClasses(loadedClasses); setSubjects(loadedSubjects); setActiveClassIdx(ci); setActiveSubjectIdx(si)
    await loadExams(user.id,sid)
    setBooting(false)
  }

  async function loadExams(tid:string,sid:string|null) {
    const query=sid ? supabase.from('exams').select('*').or(`created_by.eq.${tid},school_id.eq.${sid}`).order('created_at',{ascending:false}) : supabase.from('exams').select('*').eq('created_by',tid).order('created_at',{ascending:false})
    const {data}=await query
    const loaded=(data??[]) as Exam[]
    setExams(loaded); setActiveExam(loaded[0]??null)
  }

  useEffect(()=>{
    if (tier!==1) { setStudents([]); return }
    const classId=classes[activeClassIdx]?.id
    if (!classId) return
    const id=++loadIdRef.current
    void loadTier1Students(id,classId)
  },[tier,activeClassIdx,classes])

  async function loadTier1Students(loadId:number,classId:string) {
    setLoading(true)
    const {data:scRows}=await supabase.from('student_classes').select('student_id').eq('class_id',classId).eq('is_current',true)
    if (loadId!==loadIdRef.current) return
    const ids=(scRows??[]).map((r:{student_id:string})=>r.student_id)
    if (ids.length===0) { setStudents([]); setLoading(false); return }
    const {data:studs}=await supabase.from('students').select('id, name').in('id',ids)
    if (loadId!==loadIdRef.current) return
    setStudents(((studs??[]) as {id:string;name:string}[]).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>({...s,source:'db' as const})))
    setLoading(false)
  }

  useEffect(()=>{ if (activeExam && students.length>0) void loadResults() },[activeExam,students,activeSubjectIdx])

  async function loadResults() {
    if (!activeExam) return
    const studentIds=students.map(s=>s.id)
    let query=supabase.from('exam_results').select('id, student_id, marks, is_absent').eq('exam_id',activeExam.id).in('student_id',studentIds)
    const subjectId=subjects[activeSubjectIdx]?.id
    if (subjectId) query=query.eq('subject_id',subjectId)
    const {data}=await query
    const loaded=(data??[]) as Result[]
    setResults(loaded)
    const draft:Record<string,string>={}
    for (const r of loaded) if (!r.is_absent) draft[r.student_id]=String(r.marks)
    setDraftMarks(draft); setErrorByStudent({})
  }

  async function createExam() {
    if (creatingExam || !teacherId || !schoolId) return
    if (!newExamName.trim()) { setExamError('Enter exam name'); return }
    setCreatingExam(true); setExamError(null)
    const payload:ExamInsert={name:newExamName.trim(),exam_type:newExamType,term:newExamTerm,academic_year:newExamYear,pass_mark:newExamPass,created_by:teacherId,school_id:schoolId}
    const {data,error:cErr}=await supabase.from('exams').insert(payload).select('*').single()
    if (cErr || !data) { setExamError('Could not create exam. Please try again.'); setCreatingExam(false); return }
    const created=data as Exam
    setExams(prev=>[created,...prev]); setActiveExam(created); setShowExamSheet(false); setNewExamName(''); setCreatingExam(false)
  }

  async function saveMark(student:Student,isAbsent=false):Promise<boolean> {
    if (!activeExam || !teacherId || activeExam.is_locked) return false
    const raw=draftMarks[student.id]??''
    const marks=isAbsent?0:Number(raw)
    if (!isAbsent && (raw.trim()==='' || !Number.isFinite(marks) || marks<0 || marks>100)) {
      setErrorByStudent(prev=>({...prev,[student.id]:'Enter a mark from 0 to 100.'})); return false
    }
    const classId=classes[activeClassIdx]?.id
    const subjectId=subjects[activeSubjectIdx]?.id
    if (!schoolId || !classId || !subjectId) {
      setErrorByStudent(prev=>({...prev,[student.id]:'Class or subject context is unavailable.'})); return false
    }
    setSavingId(student.id); setErrorByStudent(prev=>{const n={...prev}; delete n[student.id]; return n})
    const payload:ExamResultInsert={exam_id:activeExam.id,student_id:student.id,teacher_id:teacherId,school_id:schoolId,class_id:classId,subject_id:subjectId,marks,is_absent:isAbsent}
    const existing=results.find(r=>r.student_id===student.id)
    const response=existing
      ? await supabase.from('exam_results').update({marks,is_absent:isAbsent}).eq('id',existing.id).select('id, student_id, marks, is_absent').single()
      : await supabase.from('exam_results').insert(payload).select('id, student_id, marks, is_absent').single()
    setSavingId(null)
    if (response.error || !response.data) {
      setErrorByStudent(prev=>({...prev,[student.id]:'Could not save this mark. Check your assignment and try again.'})); return false
    }
    const saved=response.data as Result
    setResults(prev=>existing?prev.map(r=>r.id===saved.id?saved:r):[...prev,saved])
    if (isAbsent) setDraftMarks(prev=>{const n={...prev}; delete n[student.id]; return n})
    setSavedId(student.id); setTimeout(()=>setSavedId(current=>current===student.id?null:current),1600)
    return true
  }

  async function clearAbsent(student:Student):Promise<boolean> {
    const existing=results.find(r=>r.student_id===student.id)
    if (!existing || !existing.is_absent || !activeExam || activeExam.is_locked) return false
    setSavingId(student.id)
    const {data,error:updateError}=await supabase.from('exam_results').update({marks:0,is_absent:false}).eq('id',existing.id).select('id, student_id, marks, is_absent').single()
    setSavingId(null)
    if (updateError || !data) { setErrorByStudent(prev=>({...prev,[student.id]:'Could not clear absence.'})); return false }
    setResults(prev=>prev.map(r=>r.id===existing.id?data as Result:r)); setDraftMarks(prev=>({...prev,[student.id]:'0'})); setSavedId(student.id); return true
  }

  function analysisData() {
    const entered=results.filter(r=>!r.is_absent)
    if (entered.length===0) return null
    const marks=entered.map(r=>r.marks); const avg=marks.reduce((a,b)=>a+b,0)/marks.length
    const passM=activeExam?.pass_mark??50
    const grades:Record<string,number>={}
    for (const m of marks) { const g=getGrade(m); grades[g]=(grades[g]??0)+1 }
    return {avg,passed:marks.filter(m=>m>=passM).length,failed:marks.filter(m=>m<passM).length,grades,total:entered.length,absent:results.filter(r=>r.is_absent).length}
  }
  const analysis=analysisData()

  if (booting) return <div style={{padding:24,display:'flex',flexDirection:'column',gap:12}}><Skeleton h={40}/><Skeleton h={64}/><Skeleton h={64}/></div>
  if (error) return <div style={{padding:24,color:'#991b1b',fontSize:14}}>⚠️ {error}</div>

  const activeClass=classes[activeClassIdx]; const activeSubject=subjects[activeSubjectIdx]; const passM=activeExam?.pass_mark??50

  return <div style={{padding:'0 0 80px',fontFamily:W.font,background:W.bg,minHeight:'100vh'}}>
    <div style={{padding:'20px 16px 12px',borderBottom:'1px solid #EDE0CE'}}>
      <h1 style={{margin:0,fontSize:20,fontWeight:800,color:W.text}}>Results & Intelligence</h1>
      <p style={{margin:'4px 0 0',fontSize:13,color:W.textSoft}}>{tier===1?`${activeClass?.name??'—'}${activeClass?.stream?' '+activeClass.stream:''}${activeSubject?' · '+activeSubject.name:''}`:'Complete school/class setup to use the professional markbook.'}</p>
    </div>

    {tier===1 && <>
      <div style={{overflowX:'auto',display:'flex',gap:8,padding:'12px 16px 0'}}>{classes.map((c,i)=><button key={c.id} onClick={()=>setActiveClassIdx(i)} style={pill(i===activeClassIdx)}>{c.name}{c.stream?' '+c.stream:''}</button>)}</div>
      <div style={{overflowX:'auto',display:'flex',gap:8,padding:'8px 16px 0'}}>{subjects.map((s,i)=><button key={s.id} onClick={()=>setActiveSubjectIdx(i)} style={pill(i===activeSubjectIdx,'#4f46e5')}>{s.name}</button>)}</div>
    </>}

    <div style={{padding:'12px 16px 0',display:'flex',gap:8,alignItems:'center'}}>
      <div style={{flex:1,overflowX:'auto',display:'flex',gap:8}}>{exams.length===0?<span style={{fontSize:13,color:W.textMuted}}>No exams yet</span>:exams.map(e=><button key={e.id} onClick={()=>setActiveExam(e)} style={pill(activeExam?.id===e.id,'#0a0a0a')}>{e.name}{e.is_locked?' · Locked':''}</button>)}</div>
      <button onClick={()=>setShowExamSheet(true)} style={{padding:'6px 14px',borderRadius:20,border:'1px solid #EDE0CE',background:'#fff',fontWeight:700}}>＋ Exam</button>
    </div>

    {activeExam && students.length>0 && <div style={{margin:'12px 16px 0',display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8}}>
      {[['Students',students.length],['Recorded',results.length],['Class mean',analysis?`${analysis.avg.toFixed(1)}%`:'—'],['Need support',analysis?analysis.failed:'—']].map(([label,value])=><div key={String(label)} style={{padding:'12px',background:'#fff',border:'1px solid #E7E5E4',borderRadius:14}}><div style={{fontSize:11,color:W.textSoft,fontWeight:700}}>{label}</div><div style={{fontSize:20,fontWeight:800,marginTop:3}}>{value}</div></div>)}
    </div>}

    {activeExam && <div style={{display:'flex',gap:0,margin:'14px 16px 0',borderRadius:12,background:'#F5ECD9',padding:4}}>{(['entry','analysis'] as const).map(tab=><button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:'9px 0',borderRadius:10,border:'none',fontWeight:700,background:activeTab===tab?'#fff':'transparent',color:activeTab===tab?'#111827':'#9ca3af'}}>{tab==='entry'?'Markbook':'Intelligence'}</button>)}</div>}

    {activeTab==='entry' && <div style={{padding:'14px 16px 0'}}>
      {!activeExam?<div style={{padding:40,textAlign:'center',color:W.textMuted}}>Create or select an exam to open the markbook.</div>
      : tier!==1?<div style={{padding:24,border:'1px solid #fde68a',background:'#fffbeb',borderRadius:14,color:'#92400e'}}>Professional marks entry requires a school class and subject assignment. This prevents unscoped exam records.</div>
      : loading?<Skeleton h={220}/>
      : students.length===0?<div style={{padding:32,textAlign:'center',color:W.textMuted}}>No students enrolled in this class.</div>
      : <ProfessionalMarkbook students={students} results={results} draftMarks={draftMarks} passMark={passM} locked={activeExam.is_locked} savingId={savingId} savedId={savedId} errorByStudent={errorByStudent} onChangeMark={(studentId,value)=>{setDraftMarks(prev=>({...prev,[studentId]:value})); setErrorByStudent(prev=>{const n={...prev}; delete n[studentId]; return n})}} onSaveMark={saveMark} onClearAbsent={clearAbsent} reportCardHref={studentId=>`/teacher/results/report-card/${studentId}?examId=${activeExam.id}`} />}
    </div>}

    {activeTab==='analysis' && <div style={{padding:'14px 16px 0'}}>
      {!activeExam || !activeClass || !activeSubject ? <div style={{padding:40,textAlign:'center',color:W.textMuted}}>Select a class, subject and exam to open intelligence.</div> : <AssessmentIntelligenceConsole examId={activeExam.id} classId={activeClass.id} subjectId={activeSubject.id} refreshKey={`${activeExam.id}:${activeClass.id}:${activeSubject.id}:${results.length}:${results.map(r=>`${r.id}:${r.marks}:${r.is_absent}`).join('|')}`} onOpenMarkbook={()=>setActiveTab('entry')} />}
    </div>}

    {showExamSheet && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)setShowExamSheet(false)}}><div style={{width:'100%',background:W.bg,borderRadius:'22px 22px 0 0',padding:'18px 16px 32px'}}><h2 style={{margin:'0 0 16px',fontSize:18}}>Create exam</h2><label style={labelStyle}>Exam name</label><input style={inputStyle} value={newExamName} onChange={e=>setNewExamName(e.target.value)} placeholder="e.g. Term 2 Midterm"/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}><div><label style={labelStyle}>Type</label><select style={inputStyle} value={newExamType} onChange={e=>setNewExamType(e.target.value)}>{['summative','cat','midterm','opener','endterm'].map(t=><option key={t} value={t}>{t}</option>)}</select></div><div><label style={labelStyle}>Pass mark</label><input type="number" min={0} max={100} style={inputStyle} value={newExamPass} onChange={e=>setNewExamPass(Number(e.target.value))}/></div><div><label style={labelStyle}>Term</label><select style={inputStyle} value={newExamTerm} onChange={e=>setNewExamTerm(Number(e.target.value))}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select></div><div><label style={labelStyle}>Year</label><input type="number" style={inputStyle} value={newExamYear} onChange={e=>setNewExamYear(Number(e.target.value))}/></div></div>{examError&&<p style={{color:'#b91c1c',fontSize:12,fontWeight:700}}>{examError}</p>}<button onClick={()=>void createExam()} disabled={creatingExam} style={{...btnPrimary,marginTop:16,opacity:creatingExam?.6:1}}>{creatingExam?'Creating…':'Create exam'}</button></div></div>}
  </div>
}

export default function ResultsPage(){ return <Suspense fallback={<div style={{padding:24}}>Loading results…</div>}><ResultsInner/></Suspense> }

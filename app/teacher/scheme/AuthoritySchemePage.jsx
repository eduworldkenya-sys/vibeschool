"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LessonPanel } from '@/components/scheme/LessonPanel'
import { SchemeOfWorkPrint } from '@/components/scheme/SchemeOfWorkPrint'
import { resolveGlobalSubjectId } from '@/lib/curriculum/globalSubjects'
import { supabase } from '@/lib/supabase'

const C = {
  surface: '#fff', surface2: '#f1f5f9', border: '#e2e8f0', border2: '#cbd5e1',
  text: '#1e293b', text2: '#64748b', text3: '#94a3b8', teal: '#0d9488',
  tealLight: '#ccfbf1', indigo: '#4f46e5', indigoLight: '#e0e7ff',
  red: '#e11d48', redLight: '#ffe4e6', dark: '#0a1628',
}

const STATUS = {
  planned: { bg: C.surface2, color: C.text2, label: 'Planned' },
  teaching: { bg: '#dbeafe', color: '#1d4ed8', label: 'Teaching' },
  done: { bg: C.tealLight, color: C.teal, label: 'Done' },
  cancelled: { bg: C.redLight, color: C.red, label: 'Cancelled' },
}

function todayIso() { return new Date().toISOString().slice(0, 10) }
function unique(values) { return Array.from(new Set(values)) }
function termLabel(term) {
  return term.name.includes(String(term.academic_year)) ? term.name : `${term.name} ${term.academic_year}`
}
function commitError(message) {
  if (message.includes('SCHEME_CANONICAL_CONTENT_REQUIRED')) return 'Canonical lesson content has not yet been confirmed. Nothing was committed.'
  if (message.includes('SCHEME_CANONICAL_CONTENT_INCOMPLETE')) return 'Canonical content is incomplete. Outcomes, key inquiry, experiences, resources and assessment are all required.'
  if (message.includes('SCHEME_ASSIGNMENT_REQUIRED')) return 'This class and subject are not assigned to you.'
  if (message.includes('SCHEME_CURRICULUM_IDENTITY_MISMATCH')) return 'The curriculum item does not match the canonical class, subject and term.'
  return message
}

function Empty({ title, desc }) {
  return <div style={{padding:28,textAlign:'center',border:`1px dashed ${C.border2}`,borderRadius:14,background:C.surface}}>
    <div style={{fontWeight:800,color:C.text}}>{title}</div>
    <div style={{fontSize:12,color:C.text3,marginTop:5,lineHeight:1.5}}>{desc}</div>
  </div>
}

function Chip({ label, active, onClick }) {
  return <button type="button" onClick={onClick} style={{padding:'7px 13px',borderRadius:99,border:`1px solid ${active?C.indigo:C.border}`,background:active?C.indigo:'#fff',color:active?'#fff':C.text2,fontWeight:700,fontSize:12,cursor:'pointer'}}>{label}</button>
}

function Inner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initial = useRef({classId:searchParams.get('classId'),subjectId:searchParams.get('subjectId'),termId:searchParams.get('termId'),week:searchParams.get('week')})

  const [uid,setUid] = useState(null)
  const [schoolId,setSchoolId] = useState(null)
  const [pairs,setPairs] = useState([])
  const [classes,setClasses] = useState([])
  const [subjects,setSubjects] = useState([])
  const [terms,setTerms] = useState([])
  const [termWeeks,setTermWeeks] = useState([])
  const [todayResolution,setTodayResolution] = useState(null)
  const [selectedClass,setSelectedClass] = useState(null)
  const [selectedSubject,setSelectedSubject] = useState(null)
  const [selectedTermId,setSelectedTermId] = useState(null)
  const [selectedWeek,setSelectedWeek] = useState(1)
  const [schemeItems,setSchemeItems] = useState([])
  const [curriculumRows,setCurriculumRows] = useState([])
  const [linkedResources,setLinkedResources] = useState({})
  const [weeklyTarget,setWeeklyTarget] = useState(null)
  const [loading,setLoading] = useState(true)
  const [fetching,setFetching] = useState(false)
  const [committing,setCommitting] = useState(false)
  const [error,setError] = useState(null)
  const [showPrint,setShowPrint] = useState(false)
  const [newTopic,setNewTopic] = useState('')
  const [newStrand,setNewStrand] = useState('')
  const [adding,setAdding] = useState(false)

  const classObj = useMemo(()=>classes.find(x=>x.id===selectedClass)||null,[classes,selectedClass])
  const subjectObj = useMemo(()=>subjects.find(x=>x.id===selectedSubject)||null,[subjects,selectedSubject])
  const termObj = useMemo(()=>terms.find(x=>x.id===selectedTermId)||null,[terms,selectedTermId])
  const filteredSubjects = useMemo(()=>{
    const ids = new Set(pairs.filter(x=>x.class_id===selectedClass).map(x=>x.subject_id))
    return subjects.filter(x=>ids.has(x.id))
  },[pairs,subjects,selectedClass])

  const weeks = useMemo(()=>{
    const map = new Map()
    termWeeks.forEach(row=>{
      const old = map.get(row.week_number)
      if (!old || (row.school_id && !old.school_id)) map.set(row.week_number,row)
    })
    return Array.from(map.values()).sort((a,b)=>a.week_number-b.week_number)
  },[termWeeks])

  const currentWeek = useMemo(()=>{
    if (todayResolution && todayResolution.term_id===selectedTermId) return todayResolution.week_number
    const d=todayIso(); const row=weeks.find(x=>d>=x.start_date&&d<=x.end_date); return row?row.week_number:0
  },[todayResolution,selectedTermId,weeks])

  const ordered = useMemo(()=>schemeItems.slice().sort((a,b)=>(a.sequence_number||999999)-(b.sequence_number||999999)||(a.lesson_number||999999)-(b.lesson_number||999999)||a.id.localeCompare(b.id)),[schemeItems])
  const selectedWeekItems = useMemo(()=>ordered.filter(x=>x.week===selectedWeek),[ordered,selectedWeek])

  const boot = useCallback(async()=>{
    setLoading(true); setError(null)
    try {
      const auth=await supabase.auth.getUser(); if(auth.error) throw auth.error; if(!auth.data.user) throw new Error('Not signed in')
      const user=auth.data.user; setUid(user.id)
      const [tp,sm,p,tc]=await Promise.all([
        supabase.from('teacher_profiles').select('school_id').eq('profile_id',user.id).maybeSingle(),
        supabase.from('school_members').select('school_id').eq('profile_id',user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id',user.id).maybeSingle(),
        supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id',user.id),
      ])
      const e=tp.error||sm.error||p.error||tc.error; if(e) throw e
      const sid=(sm.data&&sm.data.school_id)||(tp.data&&tp.data.school_id)||(p.data&&p.data.school_id); if(!sid) throw new Error('Teacher school could not be resolved')
      setSchoolId(sid); const ps=tc.data||[]; if(!ps.length) throw new Error('No teaching assignments configured'); setPairs(ps)
      const classIds=unique(ps.map(x=>x.class_id)); const subjectIds=unique(ps.map(x=>x.subject_id))
      const [cr,sr,tr,calendar]=await Promise.all([
        supabase.from('classes').select('id,name,stream').in('id',classIds).eq('school_id',sid),
        supabase.from('subjects').select('id,name').in('id',subjectIds),
        supabase.from('academic_terms').select('id,name,term,academic_year,start_date,end_date,status,school_id').eq('school_id',sid).order('start_date',{ascending:false}),
        supabase.rpc('resolve_instructional_week_for_date',{p_school_id:sid,p_date:todayIso()}),
      ])
      if(cr.error)throw cr.error;if(sr.error)throw sr.error;if(tr.error)throw tr.error
      const cs=(cr.data||[]).map(x=>({id:x.id,grade:x.name,label:x.stream?`${x.name} ${x.stream}`:x.name}))
      const ss=(sr.data||[]).map(x=>({id:x.id,label:x.name})); const ts=tr.data||[]
      setClasses(cs);setSubjects(ss);setTerms(ts)
      const cal=!calendar.error&&calendar.data&&calendar.data.length===1?calendar.data[0]:null;setTodayResolution(cal)
      const cid=initial.current.classId&&cs.some(x=>x.id===initial.current.classId)?initial.current.classId:(cs[0]&&cs[0].id)
      setSelectedClass(cid||null)
      const allowed=new Set(ps.filter(x=>x.class_id===cid).map(x=>x.subject_id))
      const sid2=initial.current.subjectId&&allowed.has(initial.current.subjectId)?initial.current.subjectId:(ss.find(x=>allowed.has(x.id))||{}).id
      setSelectedSubject(sid2||null)
      const requested=initial.current.termId&&ts.some(x=>x.id===initial.current.termId)?initial.current.termId:null
      const tid=requested||(cal&&cal.term_id)||((ts[0]&&ts[0].id)||null);setSelectedTermId(tid)
      const w=parseInt(initial.current.week||'',10); if(w>0)setSelectedWeek(w);else if(cal&&cal.term_id===tid)setSelectedWeek(cal.week_number)
    } catch(err){setError(err instanceof Error?err.message:'Scheme could not be loaded')} finally {setLoading(false)}
  },[])

  useEffect(()=>{void boot()},[boot])
  useEffect(()=>{if(selectedClass&&!filteredSubjects.some(x=>x.id===selectedSubject))setSelectedSubject(filteredSubjects[0]?filteredSubjects[0].id:null)},[filteredSubjects,selectedClass,selectedSubject])
  useEffect(()=>{if(loading)return;const p=new URLSearchParams();if(selectedClass)p.set('classId',selectedClass);if(selectedSubject)p.set('subjectId',selectedSubject);if(selectedTermId)p.set('termId',selectedTermId);p.set('week',String(selectedWeek));router.replace(`/teacher/scheme?${p}`)},[loading,router,selectedClass,selectedSubject,selectedTermId,selectedWeek])

  useEffect(()=>{let live=true;(async()=>{
    if(!schoolId||!selectedTermId){setTermWeeks([]);return}
    const r=await supabase.from('term_weeks').select('school_id,term_id,week_number,start_date,end_date,week_type,label').eq('term_id',selectedTermId).or(`school_id.eq.${schoolId},school_id.is.null`).order('week_number',{ascending:true})
    if(!live)return;if(r.error){setError(`Instructional calendar: ${r.error.message}`);setTermWeeks([])}else setTermWeeks(r.data||[])
  })();return()=>{live=false}},[schoolId,selectedTermId])

  useEffect(()=>{let live=true;(async()=>{
    if(!selectedClass||!selectedSubject){setWeeklyTarget(null);return}
    const r=await supabase.rpc('resolve_subject_weekly_allocation',{p_class_id:selectedClass,p_subject_id:selectedSubject})
    if(!live)return;if(r.error){setWeeklyTarget(null);setError(`Weekly allocation: ${r.error.message}`)}else setWeeklyTarget(r.data)
  })();return()=>{live=false}},[selectedClass,selectedSubject])

  const loadScheme=useCallback(async()=>{
    if(!uid||!schoolId||!selectedClass||!selectedSubject||!selectedTermId||!classObj||!termObj)return
    setFetching(true);setError(null)
    try{
      const s=await supabase.from('scheme_of_work').select('id,curriculum_id,curriculum_content_id,week,strand,sub_strand,topic,status,source,lesson_number,sequence_number,reflection,objectives,key_inquiry_question,learning_resources,assessment_methods,learning_experiences').eq('teacher_id',uid).eq('school_id',schoolId).eq('class_id',selectedClass).eq('subject_id',selectedSubject).eq('academic_term_id',selectedTermId).order('sequence_number',{ascending:true,nullsFirst:false}).order('lesson_number',{ascending:true,nullsFirst:false}).order('id',{ascending:true})
      if(s.error)throw s.error;const items=s.data||[];setSchemeItems(items)
      if(items.length){
        const b=await supabase.rpc('list_scheme_lesson_resources_batch',{p_scheme_ids:items.map(x=>x.id)});if(b.error)throw b.error
        const links=b.data||[];const ids=unique(links.map(x=>x.resource_id));const pubs=unique(links.map(x=>x.publication_id))
        const [rr,pr]=await Promise.all([ids.length?supabase.from('learning_resources').select('id,title').in('id',ids):Promise.resolve({data:[],error:null}),pubs.length?supabase.from('vibe_publications').select('id,title').in('id',pubs):Promise.resolve({data:[],error:null})])
        if(rr.error)throw rr.error;if(pr.error)throw pr.error
        const rt=new Map((rr.data||[]).map(x=>[x.id,x.title]));const pt=new Map((pr.data||[]).map(x=>[x.id,x.title]));const map={}
        links.forEach(x=>{const v={id:x.id,resourceId:x.resource_id,publicationId:x.publication_id,chapterId:x.chapter_id,publicationTitle:pt.get(x.publication_id)||'',chapterTitle:rt.get(x.resource_id)||'Teaching resource',resourceRole:x.resource_role,sequence:x.sequence,pageStart:x.page_start,pageEnd:x.page_end,exerciseRefs:Array.isArray(x.exercise_refs)?x.exercise_refs:[]};map[x.scheme_lesson_id]=(map[x.scheme_lesson_id]||[]).concat(v)})
        setLinkedResources(map)
      }else setLinkedResources({})
      const globalId=await resolveGlobalSubjectId(selectedSubject);if(!globalId)throw new Error('Subject is not linked to the canonical taxonomy')
      const c=await supabase.from('curriculum').select('id,grade,subject,strand,sub_strand,topic,week,term').eq('grade',classObj.grade).eq('global_subject_id',globalId).eq('term',termObj.term).order('week',{ascending:true}).order('created_at',{ascending:true})
      if(c.error)throw c.error;const present=new Set(items.map(x=>x.curriculum_id).filter(Boolean));setCurriculumRows((c.data||[]).filter(x=>!present.has(x.id)))
    }catch(err){setError(err instanceof Error?err.message:'Scheme could not be loaded')}finally{setFetching(false)}
  },[uid,schoolId,selectedClass,selectedSubject,selectedTermId,classObj,termObj])

  useEffect(()=>{if(!loading)void loadScheme()},[loading,loadScheme])

  async function commitScheme(){if(!selectedClass||!selectedSubject||!selectedTermId||!curriculumRows.length)return;setCommitting(true);setError(null);const r=await supabase.rpc('commit_curriculum_scheme',{p_class_id:selectedClass,p_subject_id:selectedSubject,p_academic_term_id:selectedTermId,p_curriculum_ids:curriculumRows.map(x=>x.id)});if(r.error)setError(commitError(r.error.message));else await loadScheme();setCommitting(false)}
  async function addCustom(){if(!selectedClass||!selectedSubject||!selectedTermId||!newTopic.trim())return;setAdding(true);setError(null);const r=await supabase.rpc('commit_custom_scheme_item',{p_class_id:selectedClass,p_subject_id:selectedSubject,p_academic_term_id:selectedTermId,p_week:selectedWeek,p_topic:newTopic.trim(),p_strand:newStrand.trim()||null,p_resource_id:null,p_resource_role:null});if(r.error)setError(r.error.message);else{setNewTopic('');setNewStrand('');await loadScheme()}setAdding(false)}
  async function setStatus(id,status){const r=await supabase.from('scheme_of_work').update({status}).eq('id',id).eq('school_id',schoolId).eq('teacher_id',uid);if(r.error)setError(r.error.message);else setSchemeItems(xs=>xs.map(x=>x.id===id?Object.assign({},x,{status}):x))}
  async function saveReflection(id,reflection){const r=await supabase.from('scheme_of_work').update({reflection}).eq('id',id).eq('school_id',schoolId).eq('teacher_id',uid);if(r.error)setError(r.error.message)}

  if(loading)return <Empty title="Loading Scheme" desc="Resolving teacher, class, subject and instructional-calendar authority."/>
  if(!uid||!schoolId)return <Empty title="Scheme unavailable" desc={error||'Teacher identity could not be resolved.'}/>

  return <div style={{width:'100%'}}>
    <div style={{background:'linear-gradient(135deg,#3730a3,#4338ca)',color:'#fff',borderRadius:18,padding:18,marginBottom:12}}>
      <div style={{fontSize:10,letterSpacing:1.5,opacity:.65,fontWeight:800}}>SCHEME OF WORK</div>
      <div style={{fontSize:20,fontWeight:800,marginTop:3}}>Curriculum Tracker</div>
      <div style={{fontSize:12,opacity:.75,marginTop:4}}>{termObj?`${termLabel(termObj)} · ${currentWeek?`Instructional Week ${currentWeek}`:'Not current term'}`:'Select term'}</div>
      {weeklyTarget!==null&&<div style={{fontSize:11,fontWeight:700,marginTop:10}}>Week {selectedWeek}: {selectedWeekItems.length} of {weeklyTarget} scheduled</div>}
    </div>
    {error&&<div role="alert" style={{background:C.redLight,color:C.red,padding:10,borderRadius:9,fontSize:12,fontWeight:700,marginBottom:10}}>{error}</div>}
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:12}}>
      <div style={{fontSize:10,color:C.text3,fontWeight:800,marginBottom:6}}>CLASS</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{classes.map(x=><Chip key={x.id} label={x.label} active={x.id===selectedClass} onClick={()=>setSelectedClass(x.id)}/>)}</div>
      <div style={{fontSize:10,color:C.text3,fontWeight:800,marginBottom:6}}>SUBJECT</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{filteredSubjects.map(x=><Chip key={x.id} label={x.label} active={x.id===selectedSubject} onClick={()=>setSelectedSubject(x.id)}/>)}</div>
      <div style={{fontSize:10,color:C.text3,fontWeight:800,marginBottom:6}}>TERM</div><div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:12}}>{terms.map(x=><Chip key={x.id} label={termLabel(x)} active={x.id===selectedTermId} onClick={()=>setSelectedTermId(x.id)}/>)}</div>
      <div style={{fontSize:10,color:C.text3,fontWeight:800,marginBottom:6}}>INSTRUCTIONAL WEEK</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:5}}>{weeks.map(x=><button key={x.week_number} type="button" onClick={()=>setSelectedWeek(x.week_number)} style={{padding:8,borderRadius:8,border:`1px solid ${x.week_number===selectedWeek?C.indigo:C.border}`,background:x.week_number===selectedWeek?C.indigoLight:C.surface2,color:x.week_number===currentWeek?C.teal:C.text2,fontWeight:800}}>W{x.week_number}</button>)}</div>
      {!weeks.length&&<div style={{fontSize:12,color:C.red,marginTop:7}}>No instructional weeks configured for this term.</div>}
    </div>

    {classObj&&subjectObj&&termObj&&<>
      {ordered.length>0&&<button type="button" onClick={()=>setShowPrint(true)} style={{width:'100%',padding:10,border:`1px solid ${C.border2}`,borderRadius:10,background:'#fff',fontWeight:700,marginBottom:10}}>Print / Export Scheme</button>}
      {showPrint&&<SchemeOfWorkPrint schoolId={schoolId} teacherId={uid} className={classObj.label} subjectLabel={subjectObj.label} termLabelText={termLabel(termObj)} items={ordered} onClose={()=>setShowPrint(false)}/>} 
      <LessonPanel teacherId={uid} classId={selectedClass} subjectId={selectedSubject} subjectLabel={subjectObj.label} academicTermId={selectedTermId} schoolId={schoolId} week={selectedWeek}/>
    </>}

    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:14}}>
      {curriculumRows.length>0&&<div style={{background:C.indigoLight,padding:12,borderRadius:10,marginBottom:12}}><div style={{fontWeight:800,color:C.indigo,fontSize:13}}>{curriculumRows.length} curriculum item{curriculumRows.length===1?'':'s'} available</div><div style={{fontSize:11,color:C.text2,margin:'4px 0 8px'}}>The server will commit only confirmed, complete canonical lesson content.</div><button type="button" disabled={committing} onClick={()=>void commitScheme()} style={{padding:'8px 12px',border:0,borderRadius:8,background:C.indigo,color:'#fff',fontWeight:700}}>{committing?'Committing…':'Commit approved curriculum'}</button></div>}
      {fetching?<div style={{fontSize:12,color:C.text3}}>Loading authoritative Scheme…</div>:selectedWeekItems.length===0?<Empty title="No lessons scheduled" desc="Commit approved canonical curriculum content or add a legitimate teacher-created lesson."/>:<div style={{display:'grid',gap:9}}>{selectedWeekItems.map(item=>{const st=STATUS[item.status]||STATUS.planned;return <div key={item.id} style={{border:`1px solid ${C.border}`,borderRadius:11,padding:12}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><div style={{fontWeight:800,color:C.text}}>{item.topic}</div><div style={{fontSize:11,color:C.text2}}>{[item.strand,item.sub_strand].filter(Boolean).join(' · ')}</div>{(linkedResources[item.id]||[]).map(r=><div key={r.id} style={{fontSize:10,color:C.indigo,marginTop:5}}>{r.chapterTitle} · {r.resourceRole}</div>)}</div><span style={{fontSize:10,fontWeight:800,padding:'4px 7px',borderRadius:99,background:st.bg,color:st.color}}>{st.label}</span></div><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>{['planned','teaching','done','cancelled'].map(s=><button key={s} type="button" onClick={()=>void setStatus(item.id,s)} style={{fontSize:10,padding:'4px 7px',border:`1px solid ${C.border}`,borderRadius:99,background:item.status===s?(STATUS[s]||STATUS.planned).bg:'#fff'}}>{(STATUS[s]||STATUS.planned).label}</button>)}<button type="button" onClick={()=>router.push(`/teacher/scheme/generate?schemeId=${encodeURIComponent(item.id)}`)} style={{fontSize:10,padding:'4px 7px',border:`1px solid ${C.border}`,borderRadius:99,background:'#fff',color:C.indigo,fontWeight:700}}>Prepare lesson →</button></div><textarea defaultValue={item.reflection||''} onBlur={e=>void saveReflection(item.id,e.target.value)} placeholder="Reflection after teaching" rows={2} style={{width:'100%',marginTop:8,padding:7,border:`1px solid ${C.border2}`,borderRadius:7,fontFamily:'inherit'}}/></div>})}</div>}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:14}}><div style={{fontSize:11,fontWeight:800,color:C.text,marginBottom:7}}>Add teacher-created lesson</div><input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="Lesson focus" style={{width:'100%',padding:8,border:`1px solid ${C.border2}`,borderRadius:7,marginBottom:6}}/><input value={newStrand} onChange={e=>setNewStrand(e.target.value)} placeholder="Strand (optional)" style={{width:'100%',padding:8,border:`1px solid ${C.border2}`,borderRadius:7,marginBottom:6}}/><button type="button" disabled={adding||!newTopic.trim()} onClick={()=>void addCustom()} style={{padding:'8px 12px',border:0,borderRadius:8,background:C.dark,color:'#fff',fontWeight:700}}>{adding?'Adding…':`Add to Week ${selectedWeek}`}</button></div>
    </div>
  </div>
}

export function AuthoritySchemePage(){return <Suspense fallback={<Empty title="Loading Scheme" desc="Resolving Scheme authority."/>}><Inner/></Suspense>}

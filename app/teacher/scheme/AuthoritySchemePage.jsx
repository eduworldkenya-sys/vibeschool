"use client"

import TeachingWorkspaceNav from '@/components/teacher/TeachingWorkspaceNav'
import Grade4EnglishMap from '@/components/teacher/curriculum/Grade4EnglishMap'
import Grade1CreativeActivitiesMap, { GRADE1_CREATIVE_STRANDS, GRADE1_CREATIVE_UNITS } from '@/components/teacher/curriculum/Grade1CreativeActivitiesMap'
import Grade1MathematicsMap, { GRADE1_MATHEMATICS_STRANDS, GRADE1_MATHEMATICS_UNITS } from '@/components/teacher/curriculum/Grade1MathematicsMap'
import Grade1EnglishMap, { GRADE1_ENGLISH_STRANDS, GRADE1_ENGLISH_UNITS } from '@/components/teacher/curriculum/Grade1EnglishMap'
import WeeklyLessonSlots from '@/components/teacher/scheme/WeeklyLessonSlots'

import AutoCreativeScheme from '@/components/teacher/scheme/AutoCreativeScheme'
import { buildCreativeAnnualSchemeDraft, buildGrade1AnnualSchemeDraft, termCreativeSchemeRows } from '@/lib/teaching/creativeSchemeDraft.mjs'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LessonPanel } from '@/components/scheme/LessonPanel'
import { SchemeOfWorkPrint } from '@/components/scheme/SchemeOfWorkPrint'
import { resolveGlobalSubjectId } from '@/lib/curriculum/globalSubjects'
import { supabase } from '@/lib/supabase'
import { studio } from '@/components/teacher/studio-tokens'
import { ensureMyActiveSchoolTerm } from '@/lib/academicTerm'
import { nairobiDateStr } from '@/lib/time'

const C = {
  surface: studio.surface, surface2: studio.canvas, border: studio.border, border2: studio.border,
  text: studio.ink, text2: studio.muted, text3: studio.muted, teal: '#28654d',
  tealLight: '#ccfbf1', indigo: studio.accent, indigoLight: studio.soft,
  red: '#e11d48', redLight: '#ffe4e6', dark: '#0a1628',
}

const STATUS = {
  planned: { bg: C.surface2, color: C.text2, label: 'Planned' },
  teaching: { bg: '#dbeafe', color: '#1d4ed8', label: 'Teaching' },
  done: { bg: C.tealLight, color: C.teal, label: 'Done' },
  cancelled: { bg: C.redLight, color: C.red, label: 'Cancelled' },
}

function todayIso() { return nairobiDateStr() }
function unique(values) { return Array.from(new Set(values)) }
function termLabel(term) {
  return term.name.includes(String(term.academic_year)) ? term.name : `${term.name} ${term.academic_year}`
}
function commitError(message) {
  if (message.includes('SCHEME_CANONICAL_CONTENT_REQUIRED')) return 'Canonical lesson content has not yet been confirmed. Nothing was committed.'
  if (message.includes('SCHEME_CANONICAL_CONTENT_INCOMPLETE')) return 'Canonical content is incomplete. Outcomes, key inquiry, experiences, resources and assessment are all required.'
  if (message.includes('SCHEME_ASSIGNMENT_REQUIRED')) return 'This class and subject are not assigned to you.'
  if (message.includes('SCHEME_CURRICULUM_IDENTITY_MISMATCH')) return 'The curriculum item does not match the canonical class, subject and term.'
  if (message.includes('SCHEME_WEEK_NOT_IN_INSTRUCTIONAL_CALENDAR')) return 'Choose a week from this term’s instructional calendar.'
  if (message.includes('generated always')) return 'This Scheme item could not be saved because the school data contract is out of date. Retry after the repair is released.'
  return 'This Scheme item could not be saved. Your entries are still here; retry, then contact support if the problem continues.'
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

function Inner({ curriculumView = false }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initial = useRef({classId:searchParams.get('classId'),subjectId:searchParams.get('subjectId'),termId:searchParams.get('termId'),week:searchParams.get('week'),curriculumId:searchParams.get('curriculumId'),unitId:searchParams.get('unitId')})

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
  const [allCurriculumRows,setAllCurriculumRows] = useState([])
  const [curriculumOutcomes,setCurriculumOutcomes] = useState({})
  const [curriculumMaterials,setCurriculumMaterials] = useState({})
  const [selectedStrand,setSelectedStrand] = useState('')
  const [showEnglishLegacy,setShowEnglishLegacy] = useState(false)
  const [linkedResources,setLinkedResources] = useState({})
  const [weeklyTarget,setWeeklyTarget] = useState(null)
  const [loading,setLoading] = useState(true)
  const [fetching,setFetching] = useState(false)
  const [committing,setCommitting] = useState(false)
  const [error,setError] = useState(null)
  const [showPrint,setShowPrint] = useState(false)
  const [pendingStatusChange,setPendingStatusChange] = useState(null)
  useEffect(() => setSelectedStrand(''), [selectedClass,selectedSubject,selectedTermId])
  useEffect(() => setShowEnglishLegacy(false), [selectedClass,selectedSubject,selectedTermId])
  // A curriculum-map selection is a planning draft, not a saved or KICD-verified lesson.
  const [draftUnitId,setDraftUnitId] = useState(initial.current.unitId||'')
  const [mapUnitId,setMapUnitId] = useState(initial.current.unitId||'1.1')
  const [draftOutcomeIds,setDraftOutcomeIds] = useState([])
  const [creativeCatalog,setCreativeCatalog] = useState({})
  const [creativeCatalogLoading,setCreativeCatalogLoading] = useState(false)
  const [creativeCatalogError,setCreativeCatalogError] = useState('')
  const [grade1ReaderCatalog,setGrade1ReaderCatalog] = useState({})
  const [grade1ReaderCatalogLoading,setGrade1ReaderCatalogLoading] = useState(false)
  const [grade1ReaderCatalogError,setGrade1ReaderCatalogError] = useState('')
  const [annualTermWeeks,setAnnualTermWeeks] = useState([])
  const [annualCalendarYear,setAnnualCalendarYear] = useState(null)
  const [annualCalendarLoading,setAnnualCalendarLoading] = useState(false)
  const [annualCalendarError,setAnnualCalendarError] = useState('')
  const [autoSavingKey,setAutoSavingKey] = useState(null)
  const [newTopic,setNewTopic] = useState('')
  const [newStrand,setNewStrand] = useState('')
  const [adding,setAdding] = useState(false)

  const classObj = useMemo(()=>classes.find(x=>x.id===selectedClass)||null,[classes,selectedClass])
  const subjectObj = useMemo(()=>subjects.find(x=>x.id===selectedSubject)||null,[subjects,selectedSubject])
  const termObj = useMemo(()=>terms.find(x=>x.id===selectedTermId)||null,[terms,selectedTermId])
  const isGrade4English = classObj?.grade?.trim().toLowerCase()==='grade 4' && subjectObj?.label?.trim().toLowerCase()==='english'
  const isGrade1Creative = /^grade\s*1$/i.test(classObj?.grade?.trim()||'') && /^(creative activities|creative arts activities|creative arts and sports)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade1Mathematics = /^grade\s*1$/i.test(classObj?.grade?.trim()||'') && /^(mathematics|mathematical activities|mathematics activities)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade1English = /^grade\s*1$/i.test(classObj?.grade?.trim()||'') && /^(english|english activities|english language activities)$/i.test(subjectObj?.label?.trim()||'')
  const creativeDraftUnit = !curriculumView && isGrade1Creative ? GRADE1_CREATIVE_UNITS.find(unit=>unit.id===draftUnitId) : null
  const creativeDraftStrand = creativeDraftUnit ? GRADE1_CREATIVE_STRANDS.find(strand=>strand.id===creativeDraftUnit.strand)?.title : null
  const creativeDraftRecord = creativeDraftUnit ? creativeCatalog[creativeDraftUnit.id] : null
  const isGrade1Reader = isGrade1Mathematics || isGrade1English
  const isGrade1AutoScheme = isGrade1Creative || isGrade1Reader
  const autoLearningArea = isGrade1Creative ? 'Creative Activities' : isGrade1Mathematics ? 'Mathematics' : 'English'
  const readerUnits = isGrade1Mathematics ? GRADE1_MATHEMATICS_UNITS : GRADE1_ENGLISH_UNITS
  const readerStrands = isGrade1Mathematics ? GRADE1_MATHEMATICS_STRANDS : GRADE1_ENGLISH_STRANDS
  const readerPrefix = isGrade1Mathematics ? 'VS-CUR-G01-MA-2026' : 'VS-CUR-G01-EN-2026'
  const grade1DraftUnit = !curriculumView && isGrade1Reader ? readerUnits.find(unit=>unit.id===draftUnitId) : null
  const grade1DraftStrand = grade1DraftUnit ? readerStrands.find(strand=>strand.id===grade1DraftUnit.strand)?.title : null
  const grade1DraftRecord = grade1DraftUnit ? grade1ReaderCatalog[grade1DraftUnit.id] : null
  const mappedDraftUnit = creativeDraftUnit || grade1DraftUnit
  const mappedDraftStrand = creativeDraftStrand || grade1DraftStrand
  const mappedDraftRecord = creativeDraftRecord || grade1DraftRecord
  const mappedCatalogLoading = isGrade1Creative ? creativeCatalogLoading : grade1ReaderCatalogLoading
  const mappedCatalogError = isGrade1Creative ? creativeCatalogError : grade1ReaderCatalogError
  const annualTerms = useMemo(()=>terms.filter(term=>Number(term.academic_year)===Number(termObj?.academic_year)),[terms,termObj?.academic_year])
  const annualDraft = useMemo(()=>{
    if(!isGrade1AutoScheme||curriculumView||annualCalendarYear!==termObj?.academic_year)return null
    const shared = {terms:annualTerms,termWeeks:annualTermWeeks,weeklyAllocation:weeklyTarget}
    // The same teacher-safe, read-only preview engine serves all three Grade 1 areas.
    // Do not create a second scheme engine or write any draft rows on page open.
    return isGrade1Creative
      ? buildCreativeAnnualSchemeDraft({...shared,units:GRADE1_CREATIVE_UNITS})
      : buildGrade1AnnualSchemeDraft({...shared,units:readerUnits,expectedUnitCount:readerUnits.length})
  },[isGrade1AutoScheme,isGrade1Creative,readerUnits,curriculumView,annualCalendarYear,termObj?.academic_year,annualTerms,annualTermWeeks,weeklyTarget])
  const autoWeekSuggestions = useMemo(()=>termCreativeSchemeRows(annualDraft,selectedTermId).filter(item=>item.week===selectedWeek),[annualDraft,selectedTermId,selectedWeek])
  useEffect(()=>{
    let live=true
    if(!isGrade1Creative||!selectedSubject){setCreativeCatalog({});setCreativeCatalogError('');setCreativeCatalogLoading(false);return}
    ;(async()=>{
      setCreativeCatalogLoading(true);setCreativeCatalogError('');setCreativeCatalog({})
      try{
        // Load genuine persisted VibeSchool curriculum identities, not display-name matches.
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Global Creative Activities subject is not linked.')
        const strands=await supabase.from('cbc_strands')
          .select('id,source_ref,sub_strand,name')
          .eq('subject_id',globalId).eq('grade','Grade 1')
          .like('source_ref','VS-CUR-G01-CA-2026#%')
        if(strands.error)throw strands.error
        if((strands.data||[]).length!==16)throw new Error('Grade 1 curriculum mapping is incomplete (expected 16 sub-strands).')
        const refs=strands.data||[]
        const outcomes=await supabase.from('curriculum_learning_outcomes')
          .select('id,sub_strand_id,outcome_text,source_ref')
          .in('sub_strand_id',refs.map(row=>row.id))
          .eq('status','active').like('source_ref','VS-CUR-G01-CA-2026#%')
          .order('outcome_code',{ascending:true})
        if(outcomes.error)throw outcomes.error
        if((outcomes.data||[]).length!==68)throw new Error('Grade 1 learning-outcome mapping is incomplete (expected 68 outcomes).')
        const mapped={}
        refs.forEach(row=>{
          const unitId=row.source_ref?.split('#')[1]
          if(unitId && GRADE1_CREATIVE_UNITS.some(unit=>unit.id===unitId))
            mapped[unitId]={id:row.id,name:row.name,sub_strand:row.sub_strand,outcomes:(outcomes.data||[]).filter(outcome=>outcome.sub_strand_id===row.id)}
        })
        if(Object.keys(mapped).length!==16)throw new Error('Grade 1 curriculum mapping contains unidentified sub-strands.')
        if(live)setCreativeCatalog(mapped)
      }catch(err){if(live)setCreativeCatalogError(err instanceof Error?err.message:'Curriculum mapping unavailable.')}
      finally{if(live)setCreativeCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade1Creative,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade1Reader||!selectedSubject){
      setGrade1ReaderCatalog({});setGrade1ReaderCatalogError('');setGrade1ReaderCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade1ReaderCatalogLoading(true);setGrade1ReaderCatalogError('');setGrade1ReaderCatalog({})
      try{
        // Only persisted exact bindings, never provisional label/fuzzy matching.
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Global Grade 1 subject identity is missing.')
        const b=await supabase.from('grade1_curriculum_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',readerPrefix+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==readerUnits.length)throw new Error('Grade 1 curriculum mapping incomplete: expected '+readerUnits.length+' bound sub-strands.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand').in('id',ids)
            .eq('subject_id',globalId).eq('grade','Grade 1'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active')
            .eq('source_type','creator_claimed')
            .like('source_ref',readerPrefix+'#%').order('outcome_code',{ascending:true})
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        const mapped={}
        for(const unit of readerUnits){
          const link=bindings.find(item=>item.source_ref===readerPrefix+'#'+unit.id)
          const row=(strands.data||[]).find(item=>item.id===link?.sub_strand_id)
          const strandTitle=readerStrands.find(item=>item.id===unit.strand)?.title
          if(!link||!row||row.name!==strandTitle||row.sub_strand!==unit.title)
            throw new Error('Grade 1 curriculum identity conflict: '+unit.id)
          const found=(outcomes.data||[]).filter(item=>item.sub_strand_id===row.id &&
            item.source_ref?.startsWith(readerPrefix+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)throw new Error('Grade 1 outcome coverage incomplete: '+unit.id)
          mapped[unit.id]={id:row.id,name:row.name,sub_strand:row.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==readerUnits.reduce((n,u)=>n+u.outcomes.length,0))
          throw new Error('Grade 1 curriculum has unexpected outcome references.')
        if(live)setGrade1ReaderCatalog(mapped)
      }catch(err){if(live)setGrade1ReaderCatalogError(err instanceof Error?err.message:'Curriculum mapping unavailable.')}
      finally{if(live)setGrade1ReaderCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade1Reader,selectedSubject,readerPrefix])
  useEffect(()=>{
    setDraftOutcomeIds(mappedDraftRecord?.outcomes?.[0]?.id?[mappedDraftRecord.outcomes[0].id]:[])
  },[mappedDraftRecord,selectedClass,selectedSubject,selectedTermId])
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

  const currentWeek = todayResolution?.term_id === selectedTermId ? todayResolution.week_number : null

  useEffect(()=>{
    let live=true
    if(!schoolId||!termObj||!isGrade1AutoScheme||curriculumView){
      setAnnualCalendarYear(null);setAnnualTermWeeks([]);setAnnualCalendarLoading(false);setAnnualCalendarError('')
      return
    }
    const forYear=terms.filter(term=>Number(term.academic_year)===Number(termObj.academic_year))
    setAnnualCalendarLoading(true);setAnnualCalendarError('');setAnnualCalendarYear(null);setAnnualTermWeeks([])
    ;(async()=>{
      try{
        if(forYear.length!==3||new Set(forYear.map(term=>Number(term.term))).size!==3)
          throw new Error('The school needs Term 1, Term 2 and Term 3 for this annual scheme.')
        const response=await supabase.from('term_weeks')
          .select('school_id,term_id,week_number,week_type')
          .in('term_id',forYear.map(term=>term.id))
          .or(`school_id.eq.${schoolId},school_id.is.null`)
        if(response.error)throw response.error
        if(live){setAnnualTermWeeks(response.data||[]);setAnnualCalendarYear(termObj.academic_year)}
      }catch(err){if(live)setAnnualCalendarError(err instanceof Error?err.message:'Annual instructional calendar unavailable.')}
      finally{if(live)setAnnualCalendarLoading(false)}
    })()
    return()=>{live=false}
  },[schoolId,termObj?.academic_year,isGrade1AutoScheme,curriculumView,terms])

  const ordered = useMemo(()=>schemeItems.slice().sort((a,b)=>(a.sequence_number||999999)-(b.sequence_number||999999)||(a.lesson_number||999999)-(b.lesson_number||999999)||a.id.localeCompare(b.id)),[schemeItems])
  const selectedWeekItems = useMemo(()=>ordered.filter(x=>x.week===selectedWeek),[ordered,selectedWeek])
  const canonicalRowIds = useMemo(()=>new Set(allCurriculumRows.map(x=>x.id)),[allCurriculumRows])

  function prepareSchemeLesson(item) {
    // The launcher requires the actual assigned class and subject identities.
    // Its server-authoritative checks still verify teacher/school ownership.
    if(!selectedClass||!selectedSubject||!item?.id){
      setError('Choose your assigned class and subject before preparing this lesson.')
      return
    }
    const params=new URLSearchParams({
      schemeId:item.id,
      classId:selectedClass,
      subjectId:selectedSubject,
    })
    if(item.curriculum_id&&canonicalRowIds.has(item.curriculum_id))params.set('curriculumId',item.curriculum_id)
    router.push(`/teacher/scheme/generate?${params.toString()}`)
  }

  function openLinkedCurriculum(item) {
    if(!item?.curriculum_id||!canonicalRowIds.has(item.curriculum_id))return
    const params=new URLSearchParams({
      classId:selectedClass,
      subjectId:selectedSubject,
      termId:selectedTermId,
      week:String(item.week||selectedWeek),
      curriculumId:item.curriculum_id,
    })
    router.push(`/teacher/curriculum?${params.toString()}`)
  }

  const boot = useCallback(async()=>{
    setLoading(true); setError(null)
    try {
      const auth=await supabase.auth.getUser(); if(auth.error) throw auth.error; if(!auth.data.user) throw new Error('Not signed in')
      const user=auth.data.user; setUid(user.id)
      const contextRes=await supabase.rpc('teacher_get_operating_context')
      if(contextRes.error)throw contextRes.error
      const context=contextRes.data||{}
      const sid=context.school_id
      if(!sid)throw new Error('Teacher school could not be resolved')
      setSchoolId(sid)
      // teacher_get_operating_context is the canonical assignment projection.
      // Do not re-read classes/subjects through independent client RLS here:
      // that can erase the label while the assignment itself remains valid.
      const contextClasses=Array.isArray(context.classes)?context.classes:[]
      const ps=contextClasses.map(x=>({class_id:x.class_id,subject_id:x.subject_id}))
      if(!ps.length)throw new Error('No teaching assignments configured')
      setPairs(ps)
      const cs=Array.from(new Map(contextClasses.map(x=>[
        x.class_id,
        {id:x.class_id,grade:x.class_name,label:x.stream?`${x.class_name} ${x.stream}`:x.class_name}
      ])).values())
      const ss=Array.from(new Map(contextClasses.map(x=>[
        x.subject_id,
        {id:x.subject_id,label:x.subject_name}
      ])).values())

      // Provision through the authenticated teacher's server-derived active
      // school before term/week reads. This is idempotent and cannot target an
      // arbitrary school supplied by the browser.
      await ensureMyActiveSchoolTerm(todayIso())

      const [tr,calendar]=await Promise.all([
        supabase.from('academic_terms').select('id,name,term,academic_year,start_date,end_date,status,school_id').eq('school_id',sid).order('start_date',{ascending:false}),
        supabase.rpc('resolve_instructional_week_for_date',{p_school_id:sid,p_date:todayIso()}),
      ])
      if(tr.error)throw tr.error
      const ts=tr.data||[]
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
  useEffect(()=>{if(loading)return;const p=new URLSearchParams();if(selectedClass)p.set('classId',selectedClass);if(selectedSubject)p.set('subjectId',selectedSubject);if(selectedTermId)p.set('termId',selectedTermId);p.set('week',String(selectedWeek));if(curriculumView&&initial.current.curriculumId&&allCurriculumRows.some(x=>x.id===initial.current.curriculumId))p.set('curriculumId',initial.current.curriculumId);if(curriculumView&&(isGrade1Mathematics||isGrade1English))p.set('unitId',mapUnitId);else if(curriculumView&&initial.current.unitId)p.set('unitId',initial.current.unitId);if(!curriculumView&&draftUnitId)p.set('unitId',draftUnitId);router.replace(`${curriculumView ? '/teacher/curriculum' : '/teacher/scheme'}?${p}`)},[loading,router,selectedClass,selectedSubject,selectedTermId,selectedWeek,curriculumView,allCurriculumRows,draftUnitId,mapUnitId,isGrade1Mathematics,isGrade1English])

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
      const s=await supabase.from('scheme_of_work').select('id,curriculum_id,curriculum_content_id,week,strand,sub_strand,topic,status,source,lesson_number,sequence_number,reflection,objectives,key_inquiry_question,learning_resources,assessment_methods,learning_experiences,reference,sub_strand_id,curriculum_outcome_id').eq('teacher_id',uid).eq('school_id',schoolId).eq('class_id',selectedClass).eq('subject_id',selectedSubject).eq('academic_term_id',selectedTermId).order('sequence_number',{ascending:true,nullsFirst:false}).order('lesson_number',{ascending:true,nullsFirst:false}).order('id',{ascending:true})
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
      if(c.error)throw c.error
      const rows=c.data||[]
      setAllCurriculumRows(rows)
      setCurriculumOutcomes({})
      setCurriculumMaterials({})
      const ids=rows.map(x=>x.id)
      if(ids.length){
        // Outcome identity and published learning material are independent of
        // whether the teacher has committed a scheme of work.
        const [outcomeResult,resourceResult]=await Promise.all([
          supabase.from('curriculum_learning_outcomes').select('id,curriculum_id,outcome_text,status').in('curriculum_id',ids),
          supabase.from('learning_resources').select('id,curriculum_id,title,status,visibility,source_type,publication_id').in('curriculum_id',ids).eq('status','active')
        ])
        // Never turn query failures into a misleading "No content" state.
        if(outcomeResult.error)throw new Error('Curriculum learning outcomes: '+outcomeResult.error.message)
        if(resourceResult.error)throw new Error('Curriculum resources: '+resourceResult.error.message)
        const outcomeMap={}
        ;(outcomeResult.data||[]).forEach(x=>{(outcomeMap[x.curriculum_id]??=[]).push(x)})
        const materialMap={}
        const candidates=(resourceResult.data||[]).filter(x=>x.visibility==='public')
        const publicationIds=unique(candidates.filter(x=>x.source_type==='publication'&&x.publication_id).map(x=>x.publication_id))
        const pubResult=publicationIds.length
          ? await supabase.from('vibe_publications').select('id,status').in('id',publicationIds)
          : {data:[],error:null}
        if(pubResult.error)throw new Error('Published material checks: '+pubResult.error.message)
        const publishedIds=new Set((pubResult.data||[]).filter(x=>x.status==='published').map(x=>x.id))
        candidates.filter(x=>x.source_type!=='publication'||publishedIds.has(x.publication_id)).forEach(x=>{
          (materialMap[x.curriculum_id]??=[]).push(x)
        })
        setCurriculumOutcomes(outcomeMap)
        setCurriculumMaterials(materialMap)
      }
      const present=new Set(items.map(x=>x.curriculum_id).filter(Boolean))
      setCurriculumRows(rows.filter(x=>!present.has(x.id)))
    }catch(err){setError(err instanceof Error?err.message:'Scheme could not be loaded')}finally{setFetching(false)}
  },[uid,schoolId,selectedClass,selectedSubject,selectedTermId,classObj,termObj])

  useEffect(()=>{if(!loading)void loadScheme()},[loading,loadScheme])

  useEffect(()=>{
    if(!curriculumView||!initial.current.curriculumId||!allCurriculumRows.length)return
    const row=allCurriculumRows.find(x=>x.id===initial.current.curriculumId)
    if(row){
      setSelectedStrand(row.strand||'Unspecified strand')
      setShowEnglishLegacy(true)
    }
  },[curriculumView,allCurriculumRows])

  async function commitScheme(){if(!selectedClass||!selectedSubject||!selectedTermId||!curriculumRows.length)return;setCommitting(true);setError(null);const r=await supabase.rpc('commit_curriculum_scheme',{p_class_id:selectedClass,p_subject_id:selectedSubject,p_academic_term_id:selectedTermId,p_curriculum_ids:curriculumRows.map(x=>x.id)});if(r.error)setError(commitError(r.error.message));else await loadScheme();setCommitting(false)}
  async function addCustom(){if(!selectedClass||!selectedSubject||!selectedTermId||!newTopic.trim())return;setAdding(true);setError(null);const r=await supabase.rpc('commit_custom_scheme_item',{p_class_id:selectedClass,p_subject_id:selectedSubject,p_academic_term_id:selectedTermId,p_week:selectedWeek,p_topic:newTopic.trim(),p_strand:newStrand.trim()||null,p_resource_id:null,p_resource_role:null});if(r.error)setError(commitError(r.error.message));else{setNewTopic('');setNewStrand('');await loadScheme()}setAdding(false)}
  async function addMappedCreativeLesson(){
    if (!mappedDraftRecord || !mappedDraftStrand || !selectedClass || !selectedSubject || !selectedTermId || !weeks.some(w=>w.week_number===selectedWeek)) {
      setError('Select a connected curriculum sub-strand, class, subject, term and instructional week.')
      return
    }
    const allowed=new Set(mappedDraftRecord.outcomes.map(x=>x.id))
    const selected=draftOutcomeIds.filter(id=>allowed.has(id))
    if(!selected.length){setError('Select at least one learning outcome.');return}
    setAdding(true);setError(null)
    try{
      // Atomic server-side save: validates assignment, term/week, grade/subject,
      // sub-strand and every selected outcome before persisting one scheme lesson.
      const saved=await supabase.rpc('commit_mapped_scheme_lesson',{
        p_class_id:selectedClass,p_subject_id:selectedSubject,
        p_academic_term_id:selectedTermId,p_week:selectedWeek,
        p_sub_strand_id:mappedDraftRecord.id,p_outcome_ids:selected
      })
      if(saved.error)throw new Error(commitError(saved.error.message))
      await loadScheme()
      setDraftUnitId('')
      setDraftOutcomeIds([])
    }catch(err){setError(err instanceof Error?err.message:'Could not save the linked curriculum lesson.')}
    finally{setAdding(false)}
  }
  async function saveAndPrepareAutoDraft(item){
    if(!item?.subStrandId||!Array.isArray(item.outcomeIds)||!item.outcomeIds.length||!selectedClass||!selectedSubject||!selectedTermId){
      setError('Linked curriculum records or teacher context are unavailable.')
      return
    }
    setAutoSavingKey(item.key);setError(null)
    try{
      const result=await supabase.rpc('commit_mapped_scheme_lesson',{
        p_class_id:selectedClass,p_subject_id:selectedSubject,
        p_academic_term_id:selectedTermId,p_week:item.week,
        p_sub_strand_id:item.subStrandId,p_outcome_ids:item.outcomeIds
      })
      if(result.error)throw new Error(commitError(result.error.message))
      const saved=Array.isArray(result.data)?result.data[0]:result.data
      if(!saved?.id)throw new Error('Scheme did not return a saved lesson.')
      await loadScheme()
      prepareSchemeLesson(saved)
    }catch(err){setError(err instanceof Error?err.message:'Could not save and prepare the curriculum lesson.')}
    finally{setAutoSavingKey(null)}
  }
  async function setStatus(id,status){setPendingStatusChange(null);setError(null);const r=await supabase.from('scheme_of_work').update({status}).eq('id',id).eq('school_id',schoolId).eq('teacher_id',uid);if(r.error)setError(r.error.message);else setSchemeItems(xs=>xs.map(x=>x.id===id?Object.assign({},x,{status}):x))}
  async function saveReflection(id,reflection){const r=await supabase.from('scheme_of_work').update({reflection}).eq('id',id).eq('school_id',schoolId).eq('teacher_id',uid);if(r.error)setError(r.error.message)}

  if(loading)return <Empty title="Loading Scheme" desc="Resolving teacher, class, subject and instructional-calendar authority."/>
  if(!uid||!schoolId)return <Empty title="Scheme unavailable" desc={error||'Teacher identity could not be resolved.'}/>

  return <div className="teacher-scheme-workspace" style={{width:'100%'}}>
    {selectedClass && selectedSubject && <TeachingWorkspaceNav classId={selectedClass} subjectId={selectedSubject} termId={selectedTermId} current={curriculumView ? "Curriculum" : "Scheme"}/>}
    <div style={{background:'#173f32',color:'#fff',borderRadius:18,padding:18,marginBottom:12}}>
      <div style={{fontSize:11,letterSpacing:1.5,opacity:.65,fontWeight:800}}>{curriculumView ? "CURRICULUM" : "SCHEME OF WORK"}</div>
      <div style={{fontSize:20,fontWeight:800,marginTop:3}}>{curriculumView ? "Curriculum map" : "Scheme of work"}</div>
      <div style={{fontSize:13,opacity:.9,marginTop:4}}>{curriculumView&&(isGrade1Mathematics||isGrade1English) ? 'Grade 1 · Annual learning-area reference · VibeSchool-authored' : termObj?`${termLabel(termObj)} · Selected Week ${selectedWeek}${currentWeek ? ` · Current Week ${currentWeek}` : ''}`:'Select term'}</div>
    </div>
    {error&&<div role="alert" style={{background:C.redLight,color:C.red,padding:10,borderRadius:9,fontSize:12,fontWeight:700,marginBottom:10}}>{error}</div>}
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:12}}>
      <div className="studio-context-selectors"><div style={{fontSize:11,color:C.text3,fontWeight:800,marginBottom:6}}>CLASS</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{classes.map(x=><Chip key={x.id} label={x.label} active={x.id===selectedClass} onClick={()=>{setSelectedClass(x.id);setMapUnitId('1.1')}}/>)}</div>
      <div style={{fontSize:11,color:C.text3,fontWeight:800,marginBottom:6}}>SUBJECT</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{filteredSubjects.map(x=><Chip key={x.id} label={x.label} active={x.id===selectedSubject} onClick={()=>{setSelectedSubject(x.id);setMapUnitId('1.1')}}/>)}</div>
      <div style={{fontSize:11,color:C.text3,fontWeight:800,marginBottom:6}}>TERM</div><div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:12}}>{terms.map(x=><Chip key={x.id} label={termLabel(x)} active={x.id===selectedTermId} onClick={()=>setSelectedTermId(x.id)}/>)}</div>
      </div><div style={{fontSize:12,color:C.text3,fontWeight:800,marginBottom:8}}>INSTRUCTIONAL WEEK</div><div className="studio-scheme-weeks">{weeks.map(x=><button key={x.week_number} type="button" onClick={()=>setSelectedWeek(x.week_number)} style={{padding:8,borderRadius:8,border:`1px solid ${x.week_number===selectedWeek?C.indigo:C.border}`,background:x.week_number===selectedWeek?C.indigoLight:C.surface2,color:x.week_number===currentWeek?C.teal:C.text2,fontWeight:800}}>W{x.week_number}</button>)}</div>
      {!selectedTermId?<div style={{fontSize:12,color:C.red,marginTop:7}}>Your class and subject assignment are still connected, but the school calendar could not be prepared automatically. Retry this page; if the problem continues, the calendar health check needs attention.</div>:!weeks.length&&<div style={{fontSize:12,color:C.red,marginTop:7}}>Instructional weeks could not be prepared automatically for this term. Retry this page.</div>}
    </div>

    {selectedSubject && !(curriculumView && (isGrade1Mathematics || isGrade1English)) && <WeeklyLessonSlots week={selectedWeek} allocation={weeklyTarget} lessons={selectedWeekItems} previewCount={!curriculumView&&isGrade1AutoScheme?autoWeekSuggestions.length:0} label={subjectObj?.label || 'Selected subject'} curriculumTopics={curriculumView ? allCurriculumRows : []} compact={!curriculumView}/>}
    {!curriculumView && isGrade1AutoScheme && <AutoCreativeScheme
      draft={annualDraft} termId={selectedTermId} week={selectedWeek}
      savedLessons={ordered} catalog={isGrade1Creative?creativeCatalog:grade1ReaderCatalog}
      learningArea={autoLearningArea}
      onWeekChange={setSelectedWeek}
      onSaveAndPrepare={item=>void saveAndPrepareAutoDraft(item)}
      onViewUnit={unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/curriculum?'+p.toString())
      }}
      savingKey={autoSavingKey}
      loading={annualCalendarLoading||mappedCatalogLoading}
      error={annualCalendarError||mappedCatalogError}
    />}
    {curriculumView && isGrade1Creative && <Grade1CreativeActivitiesMap selectedUnitId={initial.current.unitId||'1.1'} mappedUnits={creativeCatalog} catalogLoading={creativeCatalogLoading} catalogError={creativeCatalogError} onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
      const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
      router.push('/teacher/scheme?'+p.toString())
    }:undefined} />}
    {curriculumView && isGrade1Mathematics && <Grade1MathematicsMap key={selectedSubject} selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      mappedUnits={grade1ReaderCatalog} catalogLoading={grade1ReaderCatalogLoading} catalogError={grade1ReaderCatalogError}
      onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }:undefined} />}
    {curriculumView && isGrade1English && <Grade1EnglishMap key={selectedSubject} selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      mappedUnits={grade1ReaderCatalog} catalogLoading={grade1ReaderCatalogLoading} catalogError={grade1ReaderCatalogError}
      onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }:undefined} />}
    {curriculumView && isGrade4English && <Grade4EnglishMap
      selectedTerm={termObj?.term ?? null}
      showExisting={showEnglishLegacy}
      onToggleExisting={()=>setShowEnglishLegacy(value=>!value)}
      weeklyCount={allCurriculumRows.length}
      schemeCount={schemeItems.length}
      verifiedOutcomeCount={Object.values(curriculumOutcomes).flat().filter(outcome=>outcome.status==='verified').length}
      onOpenScheme={()=>router.push(`/teacher/scheme?classId=${encodeURIComponent(selectedClass)}&subjectId=${encodeURIComponent(selectedSubject)}&termId=${encodeURIComponent(selectedTermId)}&week=${selectedWeek}`)}
    />}
    {curriculumView ? <section className="studio-canonical-map" style={{display:isGrade1Creative||((isGrade1Mathematics||isGrade1English)&&!allCurriculumRows.length)||(isGrade4English&&!showEnglishLegacy)?'none':undefined}}>
      <p className="studio-map-source">Stored curriculum · {classObj?.label} · {subjectObj?.label} · {termObj ? termLabel(termObj) : 'Select term'}</p>
      {fetching ? <p role="status">Loading curriculum…</p> : !allCurriculumRows.length ? <Empty title="No curriculum records for this context" desc="Select a class, subject and term. Missing curriculum is not treated as completed coverage."/> : <>
      <div className="studio-curriculum-grid">{unique(allCurriculumRows.map(row => row.strand || 'Unspecified strand')).map((strand,index) => <button type="button" key={strand} className="studio-curriculum-tile" aria-pressed={(selectedStrand || allCurriculumRows[0]?.strand || 'Unspecified strand') === strand} onClick={() => setSelectedStrand(strand)}><div className="studio-strand-cover" aria-hidden="true">{String(index+1).padStart(2,'0')}</div><h2>{strand}</h2><span>{allCurriculumRows.filter(row => (row.strand || 'Unspecified strand') === strand).length} curriculum items</span><span aria-hidden="true">↗</span></button>)}</div>
      <article className="studio-map-detail"><h2>{selectedStrand || allCurriculumRows[0]?.strand || 'Unspecified strand'}</h2>{allCurriculumRows.filter(row => (row.strand || 'Unspecified strand') === (selectedStrand || allCurriculumRows[0]?.strand || 'Unspecified strand')).map(row => {const linked=ordered.find(item=>item.curriculum_id===row.id);return <div key={row.id} className="studio-map-row"><div><h3>{row.topic || row.sub_strand || 'Curriculum item'}</h3><small>{row.sub_strand} · Week {row.week ?? 'unassigned'}</small>
                <div style={{marginTop:8,fontSize:12,color:C.text2}}>
                  {(curriculumMaterials[row.id]||[]).length===0 ? 'No published learning content yet' : `${curriculumMaterials[row.id].length} published learning resource(s)`}
                </div>
                {(curriculumMaterials[row.id]||[]).map(resource=><div key={resource.id} style={{marginTop:4,fontSize:12,color:C.teal}}>Resource: {resource.title}</div>)}
                {(curriculumOutcomes[row.id]||[]).length>0 ? <details className="studio-curriculum-outcomes"><summary>Specific learning outcomes ({curriculumOutcomes[row.id].length})</summary><ul>{curriculumOutcomes[row.id].map(outcome=><li key={outcome.id}>{outcome.outcome_text} {outcome.status !== 'verified' ? '(not verified)' : ''}</li>)}</ul></details> : <small style={{display:'block',marginTop:5,color:C.text3}}>Specific learning outcomes not yet mapped</small>}
                {linked?.objectives && <details className="studio-curriculum-outcomes"><summary>Linked lesson outcomes</summary><p style={{whiteSpace:'pre-wrap'}}>{typeof linked.objectives === 'string' ? linked.objectives : JSON.stringify(linked.objectives)}</p></details>}</div><span>{linked ? (STATUS[linked.status]?.label || linked.status) : 'Not in scheme'}</span>{linked && <button type="button" onClick={() => prepareSchemeLesson(linked)}>Prepare lesson →</button>}</div>})}<button className="studio-map-action" onClick={() => router.push(`/teacher/scheme?classId=${encodeURIComponent(selectedClass)}&subjectId=${encodeURIComponent(selectedSubject)}&termId=${encodeURIComponent(selectedTermId)}`)}>Open linked scheme →</button></article>
      <p className="studio-map-source">Planning status comes from your scheme. It does not establish learner mastery or certify the source version.</p></>}
    </section> : <>
    {classObj&&subjectObj&&termObj&&<>
      {ordered.length>0&&<button type="button" onClick={()=>setShowPrint(true)} style={{width:'100%',padding:10,border:`1px solid ${C.border2}`,borderRadius:10,background:'#fff',fontWeight:700,marginBottom:10}}>Print / Export Scheme</button>}
      {showPrint&&<SchemeOfWorkPrint schoolId={schoolId} teacherId={uid} className={classObj.label} subjectLabel={subjectObj.label} termLabelText={termLabel(termObj)} items={ordered} onClose={()=>setShowPrint(false)}/>} 
      <details style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:12}}><summary style={{cursor:'pointer',color:C.text,fontWeight:700,fontSize:13}}>Teaching notes and observations</summary><div style={{marginTop:12}}><LessonPanel teacherId={uid} classId={selectedClass} subjectId={selectedSubject} subjectLabel={subjectObj.label} academicTermId={selectedTermId} schoolId={schoolId} week={selectedWeek}/></div></details>
    </>}

    {mappedDraftUnit && <section aria-label="Plan mapped Grade 1 curriculum lesson" style={{background:'#f1f8f3',border:'1px solid #9fbbaa',borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:800,color:C.teal,letterSpacing:'.04em'}}>CURRICULUM MAP → SCHEME OF WORK</div>
      <h2 style={{margin:'6px 0',fontSize:18,color:C.text}}>{mappedDraftUnit.title}</h2>
      <p style={{fontSize:13,color:C.text2,margin:'0 0 10px'}}>{mappedDraftStrand} · Sub-strand {mappedDraftUnit.id} · Week {selectedWeek}</p>
      <p style={{fontSize:12,color:C.text2,margin:'0 0 12px'}}>Select the outcomes for one lesson. The draft uses VibeSchool-authored guidance and will not be recorded as officially KICD-verified.</p>
      {mappedCatalogLoading&&<p role="status" style={{fontSize:12}}>Loading linked curriculum outcomes…</p>}
      {mappedCatalogError&&<p role="alert" style={{fontSize:12,color:C.red}}>{mappedCatalogError}</p>}
      <fieldset style={{border:0,padding:0,margin:0}}>
        <legend style={{fontSize:13,fontWeight:800,marginBottom:8}}>Specific learning outcomes</legend>
        {(mappedDraftRecord?.outcomes||[]).map((outcome,i)=><label key={outcome.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',fontSize:13,lineHeight:1.5}}>
          <input type="checkbox" checked={draftOutcomeIds.includes(outcome.id)} onChange={e=>setDraftOutcomeIds(old=>e.target.checked?[...new Set([...old,outcome.id])]:old.filter(id=>id!==outcome.id))} style={{marginTop:4,minWidth:18,minHeight:18}}/>
          <span>{outcome.outcome_text}</span>
        </label>)}
      </fieldset>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>
        <button type="button" disabled={adding||!mappedDraftRecord||!draftOutcomeIds.length||!!mappedCatalogError||!weeks.some(w=>w.week_number===selectedWeek)} onClick={()=>void addMappedCreativeLesson()} style={{minHeight:44,padding:'10px 14px',border:0,borderRadius:9,background:C.teal,color:'#fff',fontWeight:800,opacity:adding?0.5:1}}>{adding?'Adding lesson…':`Add to Week ${selectedWeek} Scheme`}</button>
        <button type="button" onClick={()=>setDraftUnitId('')} style={{minHeight:44,padding:'10px 14px',border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.text2,fontWeight:700}}>Cancel</button>
      </div>
    </section>}
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:14}}>
      {curriculumRows.length>0&&<div style={{background:C.indigoLight,padding:12,borderRadius:10,marginBottom:12}}><div style={{fontWeight:800,color:C.indigo,fontSize:13}}>{curriculumRows.length} curriculum item{curriculumRows.length===1?'':'s'} available</div><div style={{fontSize:11,color:C.text2,margin:'4px 0 8px'}}>The server will commit only confirmed, complete canonical lesson content.</div><button type="button" disabled={committing} onClick={()=>void commitScheme()} style={{padding:'8px 12px',border:0,borderRadius:8,background:C.indigo,color:'#fff',fontWeight:700}}>{committing?'Committing…':'Commit approved curriculum'}</button></div>}
      {!selectedTermId?<Empty title="Scheme setup incomplete" desc={`${subjectObj?.label||'This subject'} is connected to ${classObj?.label||'this class'}, but the school calendar could not be prepared automatically. Retry before creating a term-scoped Scheme.`}/>:fetching?<div style={{fontSize:12,color:C.text3}}>Loading authoritative Scheme…</div>:selectedWeekItems.length===0?<Empty title="No lessons scheduled" desc="Commit approved canonical curriculum content or add a legitimate teacher-created lesson."/>:<div className="studio-scheme-sequence">{selectedWeekItems.map((item,index)=>{const st=STATUS[item.status]||STATUS.planned;const mappedUnitId=item.sub_strand_id?Object.keys(isGrade1Creative?creativeCatalog:grade1ReaderCatalog).find(id=>(isGrade1Creative?creativeCatalog:grade1ReaderCatalog)[id].id===item.sub_strand_id):null;return <div key={item.id} className="studio-lesson-card studio-sequence-card"><span className="studio-sequence-number" aria-label={`Lesson ${index+1}`}>{String(index+1).padStart(2,'0')}</span><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><div style={{fontWeight:800,color:C.text}}>{item.topic}</div><div style={{fontSize:11,color:C.text2}}>{[item.strand,item.sub_strand].filter(Boolean).join(' · ')}</div><div style={{fontSize:11,color:C.text3,marginTop:4}}>{item.curriculum_id&&canonicalRowIds.has(item.curriculum_id)?'Linked to an existing curriculum record · KICD alignment not yet verified':mappedUnitId?'Linked to VibeSchool curriculum outcomes · KICD alignment not yet verified':'No curriculum record linked · KICD alignment not yet verified'}</div>{(linkedResources[item.id]||[]).map(r=><div key={r.id} style={{fontSize:11,color:C.indigo,marginTop:5}}>{r.chapterTitle} · {r.resourceRole}</div>)}</div><span style={{fontSize:11,fontWeight:800,padding:'4px 7px',borderRadius:99,background:st.bg,color:st.color}}>{st.label}</span></div><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}><button type="button" onClick={()=>prepareSchemeLesson(item)} style={{fontSize:12,padding:'10px 15px',border:0,borderRadius:9,background:C.teal,color:'#fff',fontWeight:800}}>Prepare lesson →</button>
      {mappedUnitId&&<button type="button" onClick={()=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(item.week),unitId:mappedUnitId})
        router.push('/teacher/curriculum?'+p.toString())
      }} style={{fontSize:12,padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.teal,fontWeight:700}}>View curriculum map</button>}
      {item.curriculum_id&&canonicalRowIds.has(item.curriculum_id)&&<button type="button" onClick={()=>openLinkedCurriculum(item)} style={{fontSize:12,padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.teal,fontWeight:700}}>View curriculum</button>}
      <details style={{position:'relative'}}><summary style={{fontSize:12,padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.text2,cursor:'pointer'}}>Change status</summary><div style={{display:'flex',gap:6,flexWrap:'wrap',padding:'8px 0'}}>{['planned','teaching','done','cancelled'].filter(s=>s!==item.status).map(next=><button key={next} type="button" onClick={()=>setPendingStatusChange({id:item.id,status:next,topic:item.topic})} style={{fontSize:12,padding:'8px 10px',border:`1px solid ${C.border}`,borderRadius:8,background:'#fff'}}>{STATUS[next].label}</button>)}</div></details></div>{pendingStatusChange?.id===item.id&&<div role="alert" style={{marginTop:10,padding:10,border:`1px solid ${C.border}`,borderRadius:9,background:C.surface2}}><div style={{fontSize:12,fontWeight:700}}>Change “{item.topic}” to {STATUS[pendingStatusChange.status]?.label}?</div><div style={{display:'flex',gap:8,marginTop:7}}><button type="button" onClick={()=>void setStatus(item.id,pendingStatusChange.status)} style={{padding:'8px 12px',background:C.teal,color:'#fff',border:0,borderRadius:7,fontWeight:700}}>Confirm</button><button type="button" onClick={()=>setPendingStatusChange(null)} style={{padding:'8px 12px',border:`1px solid ${C.border}`,borderRadius:7,background:'#fff'}}>Cancel</button></div></div>}
      <details className="studio-scheme-reflection"><summary>Teaching reflection</summary><textarea aria-label={`Reflection for ${item.topic}`} defaultValue={item.reflection||''} onBlur={e=>void saveReflection(item.id,e.target.value)} placeholder="Reflection after teaching" rows={2} style={{width:'100%',marginTop:8,padding:7,border:`1px solid ${C.border2}`,borderRadius:7,fontFamily:'inherit'}}/></details></div>})}</div>}
      <details style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:14}}><summary style={{fontSize:12,fontWeight:700,color:C.text,cursor:'pointer',marginBottom:7}}>Add teacher-created lesson</summary><div style={{marginTop:10}}><input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="Lesson focus" style={{width:'100%',padding:8,border:`1px solid ${C.border2}`,borderRadius:7,marginBottom:6}}/><input value={newStrand} onChange={e=>setNewStrand(e.target.value)} placeholder="Strand (optional)" style={{width:'100%',padding:8,border:`1px solid ${C.border2}`,borderRadius:7,marginBottom:6}}/><button type="button" disabled={adding||!newTopic.trim()} onClick={()=>void addCustom()} style={{padding:'8px 12px',border:0,borderRadius:8,background:C.dark,color:'#fff',fontWeight:700}}>{adding?'Adding…':`Add to Week ${selectedWeek}`}</button></div></details>
    </div>
    </>}
  </div>
}

export function AuthoritySchemePage({ curriculumView = false } = {}){return <Suspense fallback={<Empty title="Loading Scheme" desc="Resolving Scheme authority."/>}><Inner curriculumView={curriculumView}/></Suspense>}

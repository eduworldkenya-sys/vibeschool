"use client"

import TeachingWorkspaceNav from '@/components/teacher/TeachingWorkspaceNav'
import Grade4EnglishMap from '@/components/teacher/curriculum/Grade4EnglishMap'
import Grade4IndigenousMap from '@/components/teacher/curriculum/Grade4IndigenousMap'
import Grade8KiswahiliMap from '@/components/teacher/curriculum/Grade8KiswahiliMap'
import Grade4KiswahiliMap from '@/components/teacher/curriculum/Grade4KiswahiliMap'
import Grade9EnglishMap, { GRADE9_ENGLISH_UNITS } from '@/components/teacher/curriculum/Grade9EnglishMap'
import Grade9MathematicsMap, { GRADE9_MATHEMATICS_UNITS } from '@/components/teacher/curriculum/Grade9MathematicsMap'
import Grade1CreativeActivitiesMap, { GRADE1_CREATIVE_STRANDS, GRADE1_CREATIVE_UNITS } from '@/components/teacher/curriculum/Grade1CreativeActivitiesMap'
import Grade1MathematicsMap, { GRADE1_MATHEMATICS_STRANDS, GRADE1_MATHEMATICS_UNITS } from '@/components/teacher/curriculum/Grade1MathematicsMap'
import Grade1EnglishMap, { GRADE1_ENGLISH_STRANDS, GRADE1_ENGLISH_UNITS } from '@/components/teacher/curriculum/Grade1EnglishMap'
import Grade8MathematicsMap from '@/components/teacher/curriculum/Grade8MathematicsMap'
import Grade6MathematicsMap from '@/components/teacher/curriculum/Grade6MathematicsMap'
import Grade4MathematicsMap from '@/components/teacher/curriculum/Grade4MathematicsMap'
import Grade8EnglishMap from '@/components/teacher/curriculum/Grade8EnglishMap'
import Grade6EnglishMap from '@/components/teacher/curriculum/Grade6EnglishMap'
import Grade6KiswahiliMap from '@/components/teacher/curriculum/Grade6KiswahiliMap'
import Grade3KiswahiliMap from '@/components/teacher/curriculum/Grade3KiswahiliMap'
import { projectGrade3KiswahiliRows } from '@/lib/curriculum/grade3KiswahiliMap.mjs'
import { GRADE6_KISWAHILI_UNITS, GRADE6_KISWAHILI_PREFIX } from '@/lib/teaching/grade6KiswahiliCatalog.mjs'
import { GRADE6_ENGLISH_UNITS, GRADE6_ENGLISH_PREFIX } from '@/lib/teaching/grade6EnglishCatalog.mjs'
import { GRADE8_ENGLISH_UNITS, GRADE8_ENGLISH_PREFIX } from '@/lib/teaching/grade8EnglishCatalog.mjs'
import { GRADE4_ENGLISH_UNITS, GRADE4_ENGLISH_PREFIX } from '@/lib/teaching/grade4EnglishCatalog.mjs'
import { GRADE4_INDIGENOUS_UNITS, GRADE4_INDIGENOUS_PREFIX } from '@/lib/teaching/grade4IndigenousCatalog.mjs'
import { GRADE8_MATHEMATICS_UNITS, GRADE8_MATHEMATICS_PREFIX } from '@/lib/teaching/grade8MathematicsCatalog.mjs'
import { GRADE6_MATHEMATICS_UNITS, GRADE6_MATHEMATICS_PREFIX } from '@/lib/teaching/grade6MathematicsCatalog.mjs'
import { GRADE4_MATHEMATICS_UNITS, GRADE4_MATHEMATICS_PREFIX } from '@/lib/teaching/grade4MathematicsCatalog.mjs'
import WeeklyLessonSlots from '@/components/teacher/scheme/WeeklyLessonSlots'
import JumpingSchemeContent from '@/components/teacher/JumpingSchemeContent'

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
  const [finderQuery,setFinderQuery] = useState('')
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
  useEffect(() => setFinderQuery(''), [selectedClass, selectedSubject])
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
  const [grade8Catalog,setGrade8Catalog] = useState({})
  const [grade8CatalogLoading,setGrade8CatalogLoading] = useState(false)
  const [grade8CatalogError,setGrade8CatalogError] = useState('')
  const [grade6Catalog,setGrade6Catalog] = useState({})
  const [grade6CatalogLoading,setGrade6CatalogLoading] = useState(false)
  const [grade6CatalogError,setGrade6CatalogError] = useState('')
  const [grade4Catalog,setGrade4Catalog] = useState({})
  const [grade4CatalogLoading,setGrade4CatalogLoading] = useState(false)
  const [grade4CatalogError,setGrade4CatalogError] = useState('')
  const [grade9EnglishCatalog,setGrade9EnglishCatalog] = useState({})
  const [grade9EnglishCatalogLoading,setGrade9EnglishCatalogLoading] = useState(false)
  const [grade9EnglishCatalogError,setGrade9EnglishCatalogError] = useState('')
  const [grade8EnglishCatalog,setGrade8EnglishCatalog] = useState({})
  const [grade8EnglishCatalogLoading,setGrade8EnglishCatalogLoading] = useState(false)
  const [grade8EnglishCatalogError,setGrade8EnglishCatalogError] = useState('')
  const [grade4EnglishCatalog,setGrade4EnglishCatalog] = useState({})
  const [grade4EnglishCatalogLoading,setGrade4EnglishCatalogLoading] = useState(false)
  const [grade4EnglishCatalogError,setGrade4EnglishCatalogError] = useState('')
  const [grade4IndigenousCatalog,setGrade4IndigenousCatalog] = useState({})
  const [grade4IndigenousCatalogLoading,setGrade4IndigenousCatalogLoading] = useState(false)
  const [grade4IndigenousCatalogError,setGrade4IndigenousCatalogError] = useState('')
  const [grade6EnglishCatalog,setGrade6EnglishCatalog] = useState({})
  const [grade6EnglishCatalogLoading,setGrade6EnglishCatalogLoading] = useState(false)
  const [grade6EnglishCatalogError,setGrade6EnglishCatalogError] = useState('')
  const [grade6KiswahiliCatalog,setGrade6KiswahiliCatalog] = useState({})
  const [grade6KiswahiliCatalogLoading,setGrade6KiswahiliCatalogLoading] = useState(false)
  const [grade6KiswahiliCatalogError,setGrade6KiswahiliCatalogError] = useState('')
  const [grade3KiswahiliCatalog,setGrade3KiswahiliCatalog] = useState([])
  const [grade3KiswahiliCatalogLoading,setGrade3KiswahiliCatalogLoading] = useState(false)
  const [grade3KiswahiliCatalogError,setGrade3KiswahiliCatalogError] = useState('')
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
  const isGrade4English = /^grade\s*4$/i.test(classObj?.grade?.trim()||'') && /^(english|english language)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade4Indigenous = /^grade\s*4$/i.test(classObj?.grade?.trim()||'') && /^indigenous languages?$/i.test(subjectObj?.label?.trim()||'')
  const isGrade4Kiswahili = /^grade\s*4$/i.test(classObj?.grade?.trim()||'') && /^kiswahili$/i.test(subjectObj?.label?.trim()||'')
  const isGrade8Kiswahili = /^grade\s*8$/i.test(classObj?.grade?.trim()||'') && /^kiswahili$/i.test(subjectObj?.label?.trim()||'')
  const isGrade9English = /^grade\s*9$/i.test(classObj?.grade?.trim()||'') && /^english$/i.test(subjectObj?.label?.trim()||'')
  const grade9EnglishDraftUnit = !curriculumView && isGrade9English ? GRADE9_ENGLISH_UNITS.find(unit=>unit.code===draftUnitId) : null
  const grade9EnglishDraftRecord = grade9EnglishDraftUnit ? grade9EnglishCatalog[grade9EnglishDraftUnit.code] : null
  const isGrade9Mathematics = /^grade\s*9$/i.test(classObj?.grade?.trim()||'') && /^mathematics$/i.test(subjectObj?.label?.trim()||'')
  const grade9DraftUnit = !curriculumView && isGrade9Mathematics ? GRADE9_MATHEMATICS_UNITS.find(unit=>unit.id===draftUnitId) : null
  const isGrade1Creative = /^grade\s*1$/i.test(classObj?.grade?.trim()||'') && /^(creative activities|creative arts activities|creative arts and sports)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade1Mathematics = /^grade\s*1$/i.test(classObj?.grade?.trim()||'') && /^(mathematics|mathematical activities|mathematics activities)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade1English = /^grade\s*1$/i.test(classObj?.grade?.trim()||'') && /^(english|english activities|english language activities)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade8Mathematics = /^grade\s*8$/i.test(classObj?.grade?.trim()||'') && /^mathematics$/i.test(subjectObj?.label?.trim()||'')
  const isGrade6Mathematics = /^grade\s*6$/i.test(classObj?.grade?.trim()||'') && /^mathematics$/i.test(subjectObj?.label?.trim()||'')
  const isGrade4Mathematics = /^grade\s*4$/i.test(classObj?.grade?.trim()||'') && /^(mathematics|mathematics activities)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade8English = /^grade\s*8$/i.test(classObj?.grade?.trim()||'') && /^(english|english language)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade6English = /^grade\s*6$/i.test(classObj?.grade?.trim()||'') && /^(english|english language)$/i.test(subjectObj?.label?.trim()||'')
  const isGrade6Kiswahili = /^grade\s*6$/i.test(classObj?.grade?.trim()||'') && /^kiswahili$/i.test(subjectObj?.label?.trim()||'')
  const isGrade3Kiswahili = /^grade\s*3$/i.test(classObj?.grade?.trim()||'') && /^kiswahili$/i.test(subjectObj?.label?.trim()||'')
  const grade3KiswahiliDraftUnit = !curriculumView && isGrade3Kiswahili ? grade3KiswahiliCatalog.find(unit=>unit.id===draftUnitId) : null
  const creativeDraftUnit = !curriculumView && isGrade1Creative ? GRADE1_CREATIVE_UNITS.find(unit=>unit.id===draftUnitId) : null
  const creativeDraftStrand = creativeDraftUnit ? GRADE1_CREATIVE_STRANDS.find(strand=>strand.id===creativeDraftUnit.strand)?.title : null
  const creativeDraftRecord = creativeDraftUnit ? creativeCatalog[creativeDraftUnit.id] : null
  const isGrade1Reader = isGrade1Mathematics || isGrade1English
  const isGrade1AutoScheme = isGrade1Creative || isGrade1Reader
  const isAutoScheme = isGrade1AutoScheme || isGrade8Mathematics || isGrade8English || isGrade6Mathematics || isGrade6English || isGrade4Mathematics || isGrade4English || isGrade6Kiswahili || isGrade4Indigenous
  const autoLearningArea = isGrade1Creative ? 'Creative Activities' : (isGrade1Mathematics || isGrade8Mathematics || isGrade6Mathematics || isGrade4Mathematics) ? 'Mathematics' : isGrade6Kiswahili ? 'Kiswahili' : isGrade4Indigenous ? 'Indigenous Languages' : 'English'
  const readerUnits = isGrade4Indigenous ? GRADE4_INDIGENOUS_UNITS : isGrade4English ? GRADE4_ENGLISH_UNITS : isGrade4Mathematics ? GRADE4_MATHEMATICS_UNITS : isGrade6Kiswahili ? GRADE6_KISWAHILI_UNITS : isGrade6English ? GRADE6_ENGLISH_UNITS : isGrade6Mathematics ? GRADE6_MATHEMATICS_UNITS : isGrade8Mathematics ? GRADE8_MATHEMATICS_UNITS : isGrade1Mathematics ? GRADE1_MATHEMATICS_UNITS : GRADE1_ENGLISH_UNITS
  const readerStrands = isGrade1Mathematics ? GRADE1_MATHEMATICS_STRANDS : GRADE1_ENGLISH_STRANDS
  const readerPrefix = isGrade8Mathematics ? GRADE8_MATHEMATICS_PREFIX : isGrade1Mathematics ? 'VS-CUR-G01-MA-2026' : 'VS-CUR-G01-EN-2026'
  const grade1DraftUnit = !curriculumView && isGrade1Reader ? readerUnits.find(unit=>unit.id===draftUnitId) : null
  const grade1DraftStrand = grade1DraftUnit ? readerStrands.find(strand=>strand.id===grade1DraftUnit.strand)?.title : null
  const grade1DraftRecord = grade1DraftUnit ? grade1ReaderCatalog[grade1DraftUnit.id] : null
  const grade8DraftUnit = !curriculumView && isGrade8Mathematics ? GRADE8_MATHEMATICS_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade8DraftRecord = grade8DraftUnit ? grade8Catalog[grade8DraftUnit.id] : null
  const grade6DraftUnit = !curriculumView && isGrade6Mathematics ? GRADE6_MATHEMATICS_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade6DraftRecord = grade6DraftUnit ? grade6Catalog[grade6DraftUnit.id] : null
  const grade4DraftUnit = !curriculumView && isGrade4Mathematics ? GRADE4_MATHEMATICS_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade4DraftRecord = grade4DraftUnit ? grade4Catalog[grade4DraftUnit.id] : null
  const grade4EnglishDraftUnit = !curriculumView && isGrade4English ? GRADE4_ENGLISH_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade4EnglishDraftRecord = grade4EnglishDraftUnit ? grade4EnglishCatalog[grade4EnglishDraftUnit.id] : null
  const grade4IndigenousDraftUnit = !curriculumView && isGrade4Indigenous ? GRADE4_INDIGENOUS_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade4IndigenousDraftRecord = grade4IndigenousDraftUnit ? grade4IndigenousCatalog[grade4IndigenousDraftUnit.id] : null
  const grade8EnglishDraftUnit = !curriculumView && isGrade8English ? GRADE8_ENGLISH_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade8EnglishDraftRecord = grade8EnglishDraftUnit ? grade8EnglishCatalog[grade8EnglishDraftUnit.id] : null
  const grade6EnglishDraftUnit = !curriculumView && isGrade6English ? GRADE6_ENGLISH_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade6EnglishDraftRecord = grade6EnglishDraftUnit ? grade6EnglishCatalog[grade6EnglishDraftUnit.id] : null
  const grade6KiswahiliDraftUnit = !curriculumView && isGrade6Kiswahili ? GRADE6_KISWAHILI_UNITS.find(unit=>unit.id===draftUnitId) : null
  const grade6KiswahiliDraftRecord = grade6KiswahiliDraftUnit ? grade6KiswahiliCatalog[grade6KiswahiliDraftUnit.id] : null
  const mappedDraftUnit = creativeDraftUnit || grade1DraftUnit || grade8DraftUnit || grade8EnglishDraftUnit || grade6DraftUnit || grade6EnglishDraftUnit || grade4DraftUnit || grade6KiswahiliDraftUnit || grade4EnglishDraftUnit || grade4IndigenousDraftUnit || (grade9EnglishDraftRecord ? grade9EnglishDraftUnit : null)
  const mappedDraftStrand = creativeDraftStrand || grade1DraftStrand || grade8DraftUnit?.strand || grade8EnglishDraftUnit?.strand || grade6DraftUnit?.strand || grade6EnglishDraftUnit?.strand || grade4DraftUnit?.strand || grade6KiswahiliDraftUnit?.strand || grade4EnglishDraftUnit?.strand || grade4IndigenousDraftUnit?.strand || (grade9EnglishDraftRecord ? grade9EnglishDraftUnit?.strand : null)
  const mappedDraftRecord = creativeDraftRecord || grade1DraftRecord || grade8DraftRecord || grade8EnglishDraftRecord || grade6DraftRecord || grade6EnglishDraftRecord || grade4DraftRecord || grade6KiswahiliDraftRecord || grade4EnglishDraftRecord || grade4IndigenousDraftRecord || grade9EnglishDraftRecord
  const mappedCatalogLoading = isGrade9English ? grade9EnglishCatalogLoading : isGrade4Indigenous ? grade4IndigenousCatalogLoading : isGrade4English ? grade4EnglishCatalogLoading : isGrade4Mathematics ? grade4CatalogLoading : isGrade6Kiswahili ? grade6KiswahiliCatalogLoading : isGrade6English ? grade6EnglishCatalogLoading : isGrade6Mathematics ? grade6CatalogLoading : isGrade8English ? grade8EnglishCatalogLoading : isGrade8Mathematics ? grade8CatalogLoading : isGrade1Creative ? creativeCatalogLoading : grade1ReaderCatalogLoading
  const mappedCatalogError = isGrade9English ? grade9EnglishCatalogError : isGrade4Indigenous ? grade4IndigenousCatalogError : isGrade4English ? grade4EnglishCatalogError : isGrade4Mathematics ? grade4CatalogError : isGrade6Kiswahili ? grade6KiswahiliCatalogError : isGrade6English ? grade6EnglishCatalogError : isGrade6Mathematics ? grade6CatalogError : isGrade8English ? grade8EnglishCatalogError : isGrade8Mathematics ? grade8CatalogError : isGrade1Creative ? creativeCatalogError : grade1ReaderCatalogError
  const autoUnits = isGrade8English ? GRADE8_ENGLISH_UNITS : readerUnits
  const annualTerms = useMemo(()=>terms.filter(term=>Number(term.academic_year)===Number(termObj?.academic_year)),[terms,termObj?.academic_year])
  const annualDraft = useMemo(()=>{
    if(!isAutoScheme||curriculumView||annualCalendarYear!==termObj?.academic_year)return null
    const shared = {terms:annualTerms,termWeeks:annualTermWeeks,weeklyAllocation:weeklyTarget}
    // The same teacher-safe, read-only preview engine serves all three Grade 1 areas.
    // Do not create a second scheme engine or write any draft rows on page open.
    return isGrade1Creative
      ? buildCreativeAnnualSchemeDraft({...shared,units:GRADE1_CREATIVE_UNITS})
      : buildGrade1AnnualSchemeDraft({...shared,units:autoUnits,expectedUnitCount:autoUnits.length,gradeLabel:(isGrade4English||isGrade4Mathematics||isGrade4Indigenous)?'Grade 4':(isGrade6Mathematics||isGrade6English)?'Grade 6':isGrade6Kiswahili?'Grade 6':(isGrade8Mathematics||isGrade8English)?'Grade 8':'Grade 1'})
  },[isAutoScheme,isGrade1Creative,isGrade8Mathematics,isGrade8English,isGrade6Mathematics,isGrade6English,isGrade6Kiswahili,isGrade4Mathematics,isGrade4English,isGrade4Indigenous,autoUnits,curriculumView,annualCalendarYear,termObj?.academic_year,annualTerms,annualTermWeeks,weeklyTarget])
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
    let live=true
    if(!isGrade8Mathematics||!selectedSubject){
      setGrade8Catalog({});setGrade8CatalogError('');setGrade8CatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade8CatalogLoading(true);setGrade8CatalogError('');setGrade8Catalog({})
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Grade 8 Mathematics is not linked to the global subject.')
        const b=await supabase.from('grade8_mathematics_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',GRADE8_MATHEMATICS_PREFIX+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==GRADE8_MATHEMATICS_UNITS.length)
          throw new Error('Grade 8 curriculum incomplete: 16 sub-strands are required.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes,guidance]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand')
            .in('id',ids).eq('subject_id',globalId).eq('grade','Grade 8'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active').eq('source_type','creator_claimed')
            .like('source_ref',GRADE8_MATHEMATICS_PREFIX+'#%').order('outcome_code',{ascending:true}),
          supabase.from('curriculum_unit_guidance')
            .select('sub_strand_id,suggested_lessons').in('sub_strand_id',ids).eq('content_status','active')
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        if(guidance.error)throw guidance.error
        const mapped={}
        for(const unit of GRADE8_MATHEMATICS_UNITS){
          const link=bindings.find(item=>item.source_ref===GRADE8_MATHEMATICS_PREFIX+'#'+unit.id)
          const row=(strands.data||[]).find(item=>item.id===link?.sub_strand_id)
          const guide=(guidance.data||[]).find(item=>item.sub_strand_id===row?.id)
          if(!link||!row||row.name!==unit.strand||row.sub_strand!==unit.title)
            throw new Error('Grade 8 curriculum identity conflict at '+unit.id)
          if(!guide||guide.suggested_lessons!==unit.lessons)
            throw new Error('Grade 8 lesson allocation mismatch at '+unit.id)
          const found=(outcomes.data||[]).filter(item=>item.sub_strand_id===row.id &&
            item.source_ref?.startsWith(GRADE8_MATHEMATICS_PREFIX+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)
            throw new Error('Grade 8 VibeSchool outcome coverage incomplete at '+unit.id)
          mapped[unit.id]={id:row.id,name:row.name,sub_strand:row.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE8_MATHEMATICS_UNITS.reduce((sum,unit)=>sum+unit.outcomes.length,0))
          throw new Error('Grade 8 curriculum includes unexpected outcome records.')
        if(live)setGrade8Catalog(mapped)
      }catch(err){if(live)setGrade8CatalogError(err instanceof Error?err.message:'Grade 8 curriculum mapping unavailable.')}
      finally{if(live)setGrade8CatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade8Mathematics,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade6Mathematics||!selectedSubject){
      setGrade6Catalog({});setGrade6CatalogError('');setGrade6CatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade6CatalogLoading(true);setGrade6CatalogError('');setGrade6Catalog({})
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Grade 6 Mathematics is not linked to the global subject.')
        const b=await supabase.from('grade6_mathematics_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',GRADE6_MATHEMATICS_PREFIX+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==GRADE6_MATHEMATICS_UNITS.length)
          throw new Error('Grade 6 curriculum incomplete: 16 sub-strands are required.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes,guidance]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand')
            .in('id',ids).eq('subject_id',globalId).eq('grade','Grade 6'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active').eq('source_type','creator_claimed')
            .like('source_ref',GRADE6_MATHEMATICS_PREFIX+'#%').order('outcome_code',{ascending:true}),
          supabase.from('curriculum_unit_guidance')
            .select('sub_strand_id,suggested_lessons').in('sub_strand_id',ids).eq('content_status','active')
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        if(guidance.error)throw guidance.error
        const mapped={}
        for(const unit of GRADE6_MATHEMATICS_UNITS){
          const link=bindings.find(item=>item.source_ref===GRADE6_MATHEMATICS_PREFIX+'#'+unit.id)
          const row=(strands.data||[]).find(item=>item.id===link?.sub_strand_id)
          const guide=(guidance.data||[]).find(item=>item.sub_strand_id===row?.id)
          if(!link||!row||row.name!==unit.strand||row.sub_strand!==unit.title)
            throw new Error('Grade 6 curriculum identity conflict at '+unit.id)
          if(!guide||guide.suggested_lessons!==unit.lessons)
            throw new Error('Grade 6 lesson allocation mismatch at '+unit.id)
          const found=(outcomes.data||[]).filter(item=>item.sub_strand_id===row.id &&
            item.source_ref?.startsWith(GRADE6_MATHEMATICS_PREFIX+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)
            throw new Error('Grade 6 VibeSchool outcome coverage incomplete at '+unit.id)
          mapped[unit.id]={id:row.id,name:row.name,sub_strand:row.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE6_MATHEMATICS_UNITS.reduce((sum,unit)=>sum+unit.outcomes.length,0))
          throw new Error('Grade 6 curriculum includes unexpected outcome records.')
        if(live)setGrade6Catalog(mapped)
      }catch(err){if(live)setGrade6CatalogError(err instanceof Error?err.message:'Grade 6 curriculum mapping unavailable.')}
      finally{if(live)setGrade6CatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade6Mathematics,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade4Mathematics||!selectedSubject){
      setGrade4Catalog({});setGrade4CatalogError('');setGrade4CatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade4CatalogLoading(true);setGrade4CatalogError('');setGrade4Catalog({})
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Grade 4 Mathematics is not linked to the global subject.')
        const b=await supabase.from('grade4_mathematics_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',GRADE4_MATHEMATICS_PREFIX+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==GRADE4_MATHEMATICS_UNITS.length)
          throw new Error('Grade 4 curriculum incomplete: 19 sub-strands are required.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes,guidance]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand')
            .in('id',ids).eq('subject_id',globalId).eq('grade','Grade 4'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active').eq('source_type','creator_claimed')
            .like('source_ref',GRADE4_MATHEMATICS_PREFIX+'#%').order('outcome_code',{ascending:true}),
          supabase.from('curriculum_unit_guidance')
            .select('sub_strand_id,suggested_lessons').in('sub_strand_id',ids).eq('content_status','active')
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        if(guidance.error)throw guidance.error
        const mapped={}
        for(const unit of GRADE4_MATHEMATICS_UNITS){
          const link=bindings.find(item=>item.source_ref===GRADE4_MATHEMATICS_PREFIX+'#'+unit.id)
          const row=(strands.data||[]).find(item=>item.id===link?.sub_strand_id)
          const guide=(guidance.data||[]).find(item=>item.sub_strand_id===row?.id)
          if(!link||!row||row.name!==unit.strand||row.sub_strand!==unit.title)
            throw new Error('Grade 4 curriculum identity conflict at '+unit.id)
          if(!guide||guide.suggested_lessons!==unit.lessons)
            throw new Error('Grade 4 lesson allocation mismatch at '+unit.id)
          const found=(outcomes.data||[]).filter(item=>item.sub_strand_id===row.id &&
            item.source_ref?.startsWith(GRADE4_MATHEMATICS_PREFIX+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)
            throw new Error('Grade 4 VibeSchool outcome coverage incomplete at '+unit.id)
          mapped[unit.id]={id:row.id,name:row.name,sub_strand:row.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE4_MATHEMATICS_UNITS.reduce((sum,unit)=>sum+unit.outcomes.length,0))
          throw new Error('Grade 4 curriculum includes unexpected outcome records.')
        if(live)setGrade4Catalog(mapped)
      }catch(err){if(live)setGrade4CatalogError(err instanceof Error?err.message:'Grade 4 curriculum mapping unavailable.')}
      finally{if(live)setGrade4CatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade4Mathematics,selectedSubject])

  // Grade 9 English reuses the persisted 75-unit heading identity and canonical
  // curriculum tables. This loader never creates outcomes or makes an official
  // KICD verification claim; a teacher may save only eligible original content.
  useEffect(()=>{
    let live=true
    if(!isGrade9English||curriculumView||!selectedSubject||!grade9EnglishDraftUnit){
      setGrade9EnglishCatalog({});setGrade9EnglishCatalogError('');setGrade9EnglishCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade9EnglishCatalogLoading(true);setGrade9EnglishCatalogError('');setGrade9EnglishCatalog({})
      try{
        const unit=grade9EnglishDraftUnit
        if(!unit.canonicalSubStrandId)throw new Error('Grade 9 English canonical heading identity is missing.')
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Canonical English subject identity is unavailable.')
        const reference='VS-REF-G09-EN-2024#'+unit.code
        const [heading,guidance,outcomes]=await Promise.all([
          supabase.from('cbc_strands')
            .select('id,subject_id,grade,name,sub_strand,source_ref,key_inquiry_questions,suggested_experiences')
            .eq('id',unit.canonicalSubStrandId).eq('subject_id',globalId).eq('grade','Grade 9').maybeSingle(),
          supabase.from('curriculum_unit_guidance')
            .select('sub_strand_id,content_status,learning_resources,assessment_methods')
            .eq('sub_strand_id',unit.canonicalSubStrandId).eq('content_status','active').maybeSingle(),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code,status,source_type')
            .eq('sub_strand_id',unit.canonicalSubStrandId)
            .eq('status','active').eq('source_type','creator_claimed')
            .like('source_ref',reference+'/%')
            .order('outcome_code',{ascending:true})
        ])
        for(const response of [heading,guidance,outcomes])if(response.error)throw response.error
        const row=heading.data
        if(!row||row.source_ref!==reference||row.name!==unit.strand||row.sub_strand!==unit.code+' · '+unit.title)
          throw new Error('Grade 9 English heading identity does not match the canonical curriculum.')
        const hasText=entries=>Array.isArray(entries)&&entries.some(value=>typeof value==='string'&&!!value.trim())
        const complete=hasText(row.key_inquiry_questions)&&hasText(row.suggested_experiences)
          &&!!guidance.data?.learning_resources?.trim()&&!!guidance.data?.assessment_methods?.trim()
        const eligible=(outcomes.data||[]).filter(outcome=>outcome.sub_strand_id===row.id
          &&outcome.source_ref?.startsWith(reference+'/')&&!!outcome.outcome_text?.trim())
        if(complete&&eligible.length&&live){
          setGrade9EnglishCatalog({[unit.code]:{
            id:row.id,name:row.name,sub_strand:row.sub_strand,outcomes:eligible
          }})
        }
      }catch(err){
        if(live)setGrade9EnglishCatalogError(err instanceof Error?err.message:'Grade 9 English canonical learning outcomes could not be loaded.')
      }finally{if(live)setGrade9EnglishCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade9English,curriculumView,selectedSubject,grade9EnglishDraftUnit?.code])

  useEffect(()=>{
    let live=true
    if(!isGrade8English||!selectedSubject){
      setGrade8EnglishCatalog({});setGrade8EnglishCatalogError('');setGrade8EnglishCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade8EnglishCatalogLoading(true);setGrade8EnglishCatalogError('');setGrade8EnglishCatalog({})
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Canonical English identity is not available.')
        const b=await supabase.from('grade8_english_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',GRADE8_ENGLISH_PREFIX+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==GRADE8_ENGLISH_UNITS.length)throw new Error('Grade 8 English catalog is incomplete. Expected 75 planning units.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand').in('id',ids)
            .eq('subject_id',globalId).eq('grade','Grade 8'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active')
            .eq('source_type','creator_claimed').like('source_ref',GRADE8_ENGLISH_PREFIX+'#%')
            .order('outcome_code',{ascending:true})
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        const mapped={}
        for(const unit of GRADE8_ENGLISH_UNITS){
          const link=bindings.find(row=>row.source_ref===GRADE8_ENGLISH_PREFIX+'#'+unit.id)
          const record=(strands.data||[]).find(row=>row.id===link?.sub_strand_id)
          if(!link||!record||record.name!==unit.strand||record.sub_strand!==unit.title)
            throw new Error('Grade 8 English curriculum identity conflict: '+unit.id)
          const found=(outcomes.data||[]).filter(row=>row.sub_strand_id===record.id && row.source_ref?.startsWith(GRADE8_ENGLISH_PREFIX+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)throw new Error('Grade 8 English learning-outcome coverage incomplete: '+unit.id)
          mapped[unit.id]={id:record.id,name:record.name,sub_strand:record.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE8_ENGLISH_UNITS.reduce((sum,u)=>sum+u.outcomes.length,0))
          throw new Error('Unexpected Grade 8 English outcome references.')
        if(live)setGrade8EnglishCatalog(mapped)
      }catch(err){if(live)setGrade8EnglishCatalogError(err instanceof Error?err.message:'Grade 8 English curriculum unavailable.')}
      finally{if(live)setGrade8EnglishCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade8English,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade4English||!selectedSubject){
      setGrade4EnglishCatalog({});setGrade4EnglishCatalogError('');setGrade4EnglishCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade4EnglishCatalogLoading(true);setGrade4EnglishCatalogError('');setGrade4EnglishCatalog({})
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Canonical English identity is not available.')
        const b=await supabase.from('grade4_english_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',GRADE4_ENGLISH_PREFIX+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==GRADE4_ENGLISH_UNITS.length)throw new Error('Grade 4 English catalog is incomplete. Expected 52 planning units.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand').in('id',ids)
            .eq('subject_id',globalId).eq('grade','Grade 4'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active')
            .eq('source_type','creator_claimed').like('source_ref',GRADE4_ENGLISH_PREFIX+'#%')
            .order('outcome_code',{ascending:true})
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        const mapped={}
        for(const unit of GRADE4_ENGLISH_UNITS){
          const link=bindings.find(row=>row.source_ref===GRADE4_ENGLISH_PREFIX+'#'+unit.id)
          const record=(strands.data||[]).find(row=>row.id===link?.sub_strand_id)
          if(!link||!record||record.name!==unit.strand||record.sub_strand!==unit.title)
            throw new Error('Grade 4 English curriculum identity conflict: '+unit.id)
          const found=(outcomes.data||[]).filter(row=>row.sub_strand_id===record.id && row.source_ref?.startsWith(GRADE4_ENGLISH_PREFIX+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)throw new Error('Grade 4 English learning-outcome coverage incomplete: '+unit.id)
          mapped[unit.id]={id:record.id,name:record.name,sub_strand:record.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE4_ENGLISH_UNITS.reduce((sum,u)=>sum+u.outcomes.length,0))
          throw new Error('Unexpected Grade 4 English outcome references.')
        if(live)setGrade4EnglishCatalog(mapped)
      }catch(err){if(live)setGrade4EnglishCatalogError(err instanceof Error?err.message:'Grade 4 English curriculum unavailable.')}
      finally{if(live)setGrade4EnglishCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade4English,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade4Indigenous||!selectedSubject){
      setGrade4IndigenousCatalog({});setGrade4IndigenousCatalogError('');setGrade4IndigenousCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade4IndigenousCatalogLoading(true);setGrade4IndigenousCatalogError('');setGrade4IndigenousCatalog({})
      try{
        const linkedId=await resolveGlobalSubjectId(selectedSubject)
        if(!linkedId)throw new Error('Indigenous Languages subject identity is unavailable.')
        const canonical=await supabase.from('subjects').select('id')
          .eq('name','Indigenous Languages').is('school_id',null).is('global_subject_id',null).maybeSingle()
        if(canonical.error||!canonical.data?.id)throw new Error('Canonical Indigenous Languages subject is unavailable.')
        const globalId=canonical.data.id
        if(linkedId!==globalId){
          const alias=await supabase.from('subjects').select('name').eq('id',linkedId).maybeSingle()
          if(alias.error||alias.data?.name!=='Indigenous Language')
            throw new Error('Selected Indigenous Languages subject does not match the canonical curriculum.')
        }
        const b=await supabase.from('grade4_indigenous_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',GRADE4_INDIGENOUS_PREFIX+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==GRADE4_INDIGENOUS_UNITS.length)throw new Error('Grade 4 Indigenous Languages catalog is incomplete. Expected 28 planning units.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand').in('id',ids)
            .eq('subject_id',globalId).eq('grade','Grade 4'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active')
            .eq('source_type','creator_claimed').like('source_ref',GRADE4_INDIGENOUS_PREFIX+'#%')
            .order('outcome_code',{ascending:true})
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        const mapped={}
        for(const unit of GRADE4_INDIGENOUS_UNITS){
          const link=bindings.find(row=>row.source_ref===GRADE4_INDIGENOUS_PREFIX+'#'+unit.id)
          const record=(strands.data||[]).find(row=>row.id===link?.sub_strand_id)
          if(!link||!record||record.name!==unit.strand||record.sub_strand!==unit.title)
            throw new Error('Grade 4 Indigenous Languages curriculum identity conflict: '+unit.id)
          const found=(outcomes.data||[]).filter(row=>row.sub_strand_id===record.id && row.source_ref?.startsWith(GRADE4_INDIGENOUS_PREFIX+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)throw new Error('Grade 4 Indigenous Languages learning-outcome coverage incomplete: '+unit.id)
          mapped[unit.id]={id:record.id,name:record.name,sub_strand:record.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE4_INDIGENOUS_UNITS.reduce((sum,u)=>sum+u.outcomes.length,0))
          throw new Error('Unexpected Grade 4 Indigenous Languages outcome references.')
        if(live)setGrade4IndigenousCatalog(mapped)
      }catch(err){if(live)setGrade4IndigenousCatalogError(err instanceof Error?err.message:'Grade 4 Indigenous Languages curriculum unavailable.')}
      finally{if(live)setGrade4IndigenousCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade4Indigenous,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade6English||!selectedSubject){
      setGrade6EnglishCatalog({});setGrade6EnglishCatalogError('');setGrade6EnglishCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade6EnglishCatalogLoading(true);setGrade6EnglishCatalogError('');setGrade6EnglishCatalog({})
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Canonical English identity is not available.')
        const b=await supabase.from('grade6_english_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active')
          .like('source_ref',GRADE6_ENGLISH_PREFIX+'#%')
        if(b.error)throw b.error
        const bindings=b.data||[]
        if(bindings.length!==GRADE6_ENGLISH_UNITS.length)throw new Error('Grade 6 English catalog is incomplete. Expected 10 sub-strands.')
        const ids=bindings.map(row=>row.sub_strand_id)
        const [strands,outcomes]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand').in('id',ids)
            .eq('subject_id',globalId).eq('grade','Grade 6'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active')
            .eq('source_type','creator_claimed').like('source_ref',GRADE6_ENGLISH_PREFIX+'#%')
            .order('outcome_code',{ascending:true})
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        const mapped={}
        for(const unit of GRADE6_ENGLISH_UNITS){
          const link=bindings.find(row=>row.source_ref===GRADE6_ENGLISH_PREFIX+'#'+unit.id)
          const record=(strands.data||[]).find(row=>row.id===link?.sub_strand_id)
          if(!link||!record||record.name!==unit.strand||record.sub_strand!==unit.title)
            throw new Error('Grade 6 English curriculum identity conflict: '+unit.id)
          const found=(outcomes.data||[]).filter(row=>row.sub_strand_id===record.id && row.source_ref?.startsWith(GRADE6_ENGLISH_PREFIX+'#'+unit.id+'/'))
          if(found.length!==unit.outcomes.length)throw new Error('Grade 6 English learning-outcome coverage incomplete: '+unit.id)
          mapped[unit.id]={id:record.id,name:record.name,sub_strand:record.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE6_ENGLISH_UNITS.reduce((sum,u)=>sum+u.outcomes.length,0))
          throw new Error('Unexpected Grade 6 English outcome references.')
        if(live)setGrade6EnglishCatalog(mapped)
      }catch(err){if(live)setGrade6EnglishCatalogError(err instanceof Error?err.message:'Grade 6 English curriculum unavailable.')}
      finally{if(live)setGrade6EnglishCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade6English,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade6Kiswahili||!selectedSubject){
      setGrade6KiswahiliCatalog({});setGrade6KiswahiliCatalogError('');setGrade6KiswahiliCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade6KiswahiliCatalogLoading(true);setGrade6KiswahiliCatalogError('');setGrade6KiswahiliCatalog({})
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Utambulisho wa somo la Kiswahili haujaunganishwa.')
        const bindingResult=await supabase.from('grade6_kiswahili_reader_bindings')
          .select('source_ref,sub_strand_id').eq('status','active').like('source_ref',GRADE6_KISWAHILI_PREFIX+'#%')
        if(bindingResult.error)throw bindingResult.error
        const bindings=bindingResult.data||[]
        if(bindings.length!==GRADE6_KISWAHILI_UNITS.length)throw new Error('Gredi ya 6 Kiswahili: mada ndogo 53 hazijakamilika.')
        const ids=bindings.map(x=>x.sub_strand_id)
        const [strands,outcomes]=await Promise.all([
          supabase.from('cbc_strands').select('id,subject_id,grade,name,sub_strand').in('id',ids)
            .eq('subject_id',globalId).eq('grade','Grade 6'),
          supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,source_ref,outcome_code')
            .in('sub_strand_id',ids).eq('status','active').eq('source_type','creator_claimed')
            .like('source_ref',GRADE6_KISWAHILI_PREFIX+'#%').order('outcome_code',{ascending:true})
        ])
        if(strands.error)throw strands.error
        if(outcomes.error)throw outcomes.error
        const mapped={}
        for(const unit of GRADE6_KISWAHILI_UNITS){
          const key=GRADE6_KISWAHILI_PREFIX+'#'+unit.id
          const link=bindings.find(x=>x.source_ref===key)
          const record=(strands.data||[]).find(x=>x.id===link?.sub_strand_id)
          if(!link||!record||record.name!==unit.strand||record.sub_strand!==unit.persistedTitle)
            throw new Error('Utambulisho wa mada ndogo za Kiswahili umetofautiana: '+unit.id)
          const found=(outcomes.data||[]).filter(x=>x.sub_strand_id===record.id&&x.source_ref?.startsWith(key+'/'))
          if(found.length!==unit.outcomes.length)throw new Error('Matokeo ya Kiswahili hayajakamilika: '+unit.id)
          mapped[unit.id]={id:record.id,name:record.name,sub_strand:record.sub_strand,outcomes:found}
        }
        if((outcomes.data||[]).length!==GRADE6_KISWAHILI_UNITS.reduce((n,u)=>n+u.outcomes.length,0))
          throw new Error('Matokeo ya Kiswahili yamezidi orodha ya mtaala.')
        if(live)setGrade6KiswahiliCatalog(mapped)
      }catch(err){if(live)setGrade6KiswahiliCatalogError(err instanceof Error?err.message:'Mtaala wa Kiswahili haupatikani.')}
      finally{if(live)setGrade6KiswahiliCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade6Kiswahili,selectedSubject])
  useEffect(()=>{
    let live=true
    if(!isGrade3Kiswahili||!selectedSubject){
      setGrade3KiswahiliCatalog([])
      setGrade3KiswahiliCatalogError('')
      setGrade3KiswahiliCatalogLoading(false)
      return
    }
    ;(async()=>{
      setGrade3KiswahiliCatalog([])
      setGrade3KiswahiliCatalogLoading(true)
      setGrade3KiswahiliCatalogError('')
      try{
        const globalId=await resolveGlobalSubjectId(selectedSubject)
        if(!globalId)throw new Error('Canonical Kiswahili subject identity is unavailable.')
        const rows=await supabase.from('cbc_strands')
          .select('id,subject_id,grade,name,sub_strand,source_ref')
          .eq('subject_id',globalId).eq('grade','Grade 3')
        if(rows.error)throw rows.error
        const ids=(rows.data||[]).map(row=>row.id)
        const outcomes=ids.length
          ? await supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,outcome_code,source_ref,source_type,status')
            .in('sub_strand_id',ids).eq('status','active').eq('source_type','creator_claimed')
          : {data:[],error:null}
        if(outcomes.error)throw outcomes.error
        const projected=projectGrade3KiswahiliRows(rows.data||[],outcomes.data||[],globalId)
        if(projected.length!==(rows.data||[]).length)throw new Error('Grade 3 Kiswahili contains conflicting or duplicate canonical sub-strand identities.')
        if(live)setGrade3KiswahiliCatalog(projected)
      }catch(err){
        if(live)setGrade3KiswahiliCatalogError(err instanceof Error?err.message:'Mtaala haupatikani.')
      }finally{if(live)setGrade3KiswahiliCatalogLoading(false)}
    })()
    return()=>{live=false}
  },[isGrade3Kiswahili,selectedSubject])
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
    if(!schoolId||!termObj||!isAutoScheme||curriculumView){
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
  },[schoolId,termObj?.academic_year,isAutoScheme,curriculumView,terms])

  const ordered = useMemo(()=>schemeItems.slice().sort((a,b)=>(a.sequence_number||999999)-(b.sequence_number||999999)||(a.lesson_number||999999)-(b.lesson_number||999999)||a.id.localeCompare(b.id)),[schemeItems])
  const selectedWeekItems = useMemo(()=>ordered.filter(x=>x.week===selectedWeek),[ordered,selectedWeek])
  // Search the already-authorised Curriculum and Scheme state. Do not
  // add a second search index or bypass the class/subject authority.
  const searchableUnits = useMemo(()=>{
    if(isGrade4Mathematics)return GRADE4_MATHEMATICS_UNITS
    if(isGrade6Mathematics)return GRADE6_MATHEMATICS_UNITS
    if(isGrade8Mathematics)return GRADE8_MATHEMATICS_UNITS
    if(isGrade9Mathematics)return GRADE9_MATHEMATICS_UNITS
    if(isGrade4English)return GRADE4_ENGLISH_UNITS
    if(isGrade8English)return GRADE8_ENGLISH_UNITS
    if(isGrade6English)return GRADE6_ENGLISH_UNITS
    if(isGrade6Kiswahili)return GRADE6_KISWAHILI_UNITS
    if(isGrade4Indigenous)return GRADE4_INDIGENOUS_UNITS
    if(isGrade1Mathematics)return GRADE1_MATHEMATICS_UNITS
    if(isGrade1English)return GRADE1_ENGLISH_UNITS
    if(isGrade1Creative)return GRADE1_CREATIVE_UNITS
    return []
  },[isGrade4Mathematics,isGrade6Mathematics,isGrade8Mathematics,isGrade9Mathematics,isGrade4English,isGrade8English,isGrade6English,isGrade6Kiswahili,isGrade4Indigenous,isGrade1Mathematics,isGrade1English,isGrade1Creative])
  const finderResults=useMemo(()=>{
    const needle=finderQuery.trim().toLocaleLowerCase()
    if(needle.length<2)return []
    const matches=(...fields)=>fields.some(field=>String(field??'').toLocaleLowerCase().includes(needle))
    const units=searchableUnits.filter(unit=>matches(unit.id,unit.title,unit.strand,unit.subStrand,unit.sub_strand,unit.theme,unit.outcomes?.join?.(' ')))
      .map(unit=>({kind:'unit',id:unit.id,title:unit.title||unit.name||unit.id,detail:unit.strand||'Curriculum sub-strand',unit}))
    const rows=allCurriculumRows.filter(row=>matches(row.topic,row.strand,row.sub_strand,row.id,...(curriculumOutcomes[row.id]||[]).map(x=>x.outcome_text)))
      .map(row=>({kind:'curriculum',id:row.id,title:row.topic||row.sub_strand||'Curriculum item',detail:row.strand||'Curriculum',row}))
    const scheme=ordered.filter(item=>matches(item.topic,item.strand,item.sub_strand,item.objectives,item.key_inquiry_question,item.learning_experiences,item.reference,item.week))
      .map(item=>({kind:'scheme',id:item.id,title:item.topic||'Scheme lesson',detail:'Scheme · Week '+item.week,item}))
    return [...units,...rows,...scheme].slice(0,30)
  },[finderQuery,searchableUnits,allCurriculumRows,curriculumOutcomes,ordered])
  function chooseFinderResult(result){
    setFinderQuery('')
    if(result.kind==='scheme'){
      setSelectedWeek(result.item.week)
      if(curriculumView){
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(result.item.week)})
        router.push('/teacher/scheme?'+p.toString())
      }
      return
    }
    if(result.kind==='unit'){
      setMapUnitId(result.id)
      if(!curriculumView){
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId:result.id})
        router.push('/teacher/curriculum?'+p.toString())
      }
      return
    }
    setSelectedStrand(result.row.strand||'Unspecified strand')
    if(!curriculumView){
      const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,curriculumId:result.id})
      router.push('/teacher/curriculum?'+p.toString())
    }
  }
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
  useEffect(()=>{if(loading)return;const p=new URLSearchParams();if(selectedClass)p.set('classId',selectedClass);if(selectedSubject)p.set('subjectId',selectedSubject);if(selectedTermId)p.set('termId',selectedTermId);p.set('week',String(selectedWeek));if(curriculumView&&initial.current.curriculumId&&allCurriculumRows.some(x=>x.id===initial.current.curriculumId))p.set('curriculumId',initial.current.curriculumId);if(curriculumView&&(isGrade1Mathematics||isGrade1English||isGrade8Mathematics||isGrade8English||isGrade9Mathematics||isGrade6Mathematics||isGrade6English||isGrade4Mathematics||isGrade4English||isGrade6Kiswahili||isGrade3Kiswahili||isGrade4Indigenous))p.set('unitId',mapUnitId);else if(curriculumView&&initial.current.unitId)p.set('unitId',initial.current.unitId);if(!curriculumView&&draftUnitId)p.set('unitId',draftUnitId);router.replace(`${curriculumView ? '/teacher/curriculum' : '/teacher/scheme'}?${p}`)},[loading,router,selectedClass,selectedSubject,selectedTermId,selectedWeek,curriculumView,allCurriculumRows,draftUnitId,mapUnitId,isGrade1Mathematics,isGrade1English,isGrade8Mathematics,isGrade8English,isGrade9Mathematics,isGrade6Mathematics,isGrade6English,isGrade4Mathematics,isGrade4English,isGrade6Kiswahili,isGrade3Kiswahili,isGrade4Indigenous])

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
      const params={
        p_class_id:selectedClass,p_subject_id:selectedSubject,
        p_academic_term_id:selectedTermId,p_week:item.week,
        p_sub_strand_id:item.subStrandId,p_outcome_ids:item.outcomeIds
      }
      const result=isGrade4Mathematics && item.unitId==='2.6'
        ? await supabase.rpc('commit_grade4_time_scheme_lesson',{
            ...params,p_content_lesson:item.suggestedLesson
          })
        : await supabase.rpc('commit_mapped_scheme_lesson',params)
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
      <div style={{fontSize:13,opacity:.9,marginTop:4}}>{curriculumView&&isGrade4Indigenous ? 'Grade 4 · Indigenous Languages · KICD 2024 framework · native-speaker review required' : curriculumView&&isGrade4English ? 'Grade 4 · English · KICD 2024 theme index · VibeSchool-original outcomes' : curriculumView&&isGrade4Mathematics ? 'Grade 4 · Mathematics · Revised KICD 2024 map · VibeSchool teaching guidance' : curriculumView&&isGrade6Mathematics ? 'Grade 6 · Revised KICD 2024 structure · VibeSchool-authored guidance' : curriculumView&&isGrade8English ? 'Grade 8 · English · KICD-referenced themes · VibeSchool original guidance' : curriculumView&&isGrade6English ? 'Grade 6 · English · KICD 2024 structural reference; VibeSchool-authored outcomes' : curriculumView&&isGrade6Kiswahili ? 'Gredi ya 6 · Kiswahili · KICD 2024 · Maudhui asilia ya VibeSchool' : curriculumView&&isGrade3Kiswahili ? 'Gredi ya 3 · Kiswahili · Rekodi za mtaala · Uhakiki wa KICD bado' : curriculumView&&isGrade4Kiswahili ? 'Grade 4 · Kiswahili · Revised KICD 2024 reference' : curriculumView&&isGrade8Kiswahili ? 'Grade 8 · Kiswahili · KICD 2024 thematic reference' : curriculumView&&isGrade9Mathematics ? 'Grade 9 · Mathematics · 2024 reference outline · Revised outcomes pending verification' : curriculumView&&isGrade9English ? 'Grade 9 · Revised KICD 2024 structure · Specific outcomes pending verification' : curriculumView&&(isGrade1Mathematics||isGrade1English) ? 'Grade 1 · Annual learning-area reference · VibeSchool-authored' : termObj?`${termLabel(termObj)} · Selected Week ${selectedWeek}${currentWeek ? ` · Current Week ${currentWeek}` : ''}`:'Select term'}</div>
    </div>
    {error&&<div role="alert" style={{background:C.redLight,color:C.red,padding:10,borderRadius:9,fontSize:12,fontWeight:700,marginBottom:10}}>{error}</div>}
    {selectedClass && selectedSubject && <section aria-label="Search curriculum and scheme" style={{background:'#fff',border:`1px solid ${C.border}`,padding:12,borderRadius:12,marginBottom:12}}>
      <label htmlFor="curriculum-scheme-search" style={{display:'block',fontSize:12,fontWeight:800,marginBottom:5}}>Find a curriculum outcome or Scheme lesson</label>
      <input id="curriculum-scheme-search" type="search" value={finderQuery} onChange={e=>setFinderQuery(e.target.value)} placeholder="Topic, sub-strand, outcome or week" style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border2}`,borderRadius:9,minHeight:44,padding:'10px 12px',fontSize:14}} />
      {finderQuery.trim().length>1 && <div role="region" aria-label="Curriculum and Scheme search results" style={{marginTop:8,maxHeight:360,overflowY:'auto'}}>
        {finderResults.length===0?<p style={{fontSize:12,color:C.text3}}>No matching records in this class and subject. Try a different term or keyword.</p>:
          finderResults.map(result=><button key={result.kind+':'+result.id} type="button" onClick={()=>chooseFinderResult(result)} style={{display:'block',width:'100%',textAlign:'left',padding:10,border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.text,marginBottom:5,cursor:'pointer'}}>
            <strong style={{display:'block',fontSize:13}}>{result.title}</strong><span style={{fontSize:11,color:C.text3}}>{result.detail} · {result.kind==='scheme'?'Open Scheme lesson':'Open Curriculum Map'}</span>
          </button>)}
      </div>}
    </section>}
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:12}}>
      <div className="studio-context-selectors"><div style={{fontSize:11,color:C.text3,fontWeight:800,marginBottom:6}}>CLASS</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{classes.map(x=><Chip key={x.id} label={x.label} active={x.id===selectedClass} onClick={()=>{setSelectedClass(x.id);setMapUnitId('1.1')}}/>)}</div>
      <div style={{fontSize:11,color:C.text3,fontWeight:800,marginBottom:6}}>SUBJECT</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{filteredSubjects.map(x=><Chip key={x.id} label={x.label} active={x.id===selectedSubject} onClick={()=>{setSelectedSubject(x.id);setMapUnitId('1.1')}}/>)}</div>
      <div style={{fontSize:11,color:C.text3,fontWeight:800,marginBottom:6}}>TERM</div><div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:12}}>{terms.map(x=><Chip key={x.id} label={termLabel(x)} active={x.id===selectedTermId} onClick={()=>setSelectedTermId(x.id)}/>)}</div>
      </div><div style={{fontSize:12,color:C.text3,fontWeight:800,marginBottom:8}}>INSTRUCTIONAL WEEK</div><div className="studio-scheme-weeks">{weeks.map(x=><button key={x.week_number} type="button" onClick={()=>setSelectedWeek(x.week_number)} style={{padding:8,borderRadius:8,border:`1px solid ${x.week_number===selectedWeek?C.indigo:C.border}`,background:x.week_number===selectedWeek?C.indigoLight:C.surface2,color:x.week_number===currentWeek?C.teal:C.text2,fontWeight:800}}>W{x.week_number}</button>)}</div>
      {curriculumView&&isGrade8English&&!selectedTermId
        ? <div style={{fontSize:12,color:C.text3,marginTop:7}}>English Curriculum Map is available without a term or timetable. Select a term when saving a Scheme lesson.</div>
        :curriculumView&&isGrade4Kiswahili?null:!selectedTermId?<div style={{fontSize:12,color:C.red,marginTop:7}}>Your class and subject assignment are still connected, but the school calendar could not be prepared automatically. Retry this page; if the problem continues, the calendar health check needs attention.</div>:!weeks.length&&<div style={{fontSize:12,color:C.red,marginTop:7}}>Instructional weeks could not be prepared automatically for this term. Retry this page.</div>}
    </div>

    {selectedSubject && !(curriculumView && (isGrade1Mathematics || isGrade1English || isGrade8Mathematics || isGrade8English || isGrade9English || isGrade9Mathematics || isGrade8Kiswahili || isGrade4Kiswahili || isGrade6Mathematics || isGrade6English || isGrade6Kiswahili || isGrade3Kiswahili || isGrade4Mathematics || isGrade4Indigenous)) && <WeeklyLessonSlots week={selectedWeek} allocation={weeklyTarget} lessons={selectedWeekItems} previewCount={!curriculumView&&isAutoScheme?autoWeekSuggestions.length:0} label={subjectObj?.label || 'Selected subject'} curriculumTopics={curriculumView ? allCurriculumRows : []} compact={!curriculumView}/>}
    {!curriculumView && isAutoScheme && <AutoCreativeScheme
      draft={annualDraft} termId={selectedTermId} week={selectedWeek}
      savedLessons={ordered} catalog={isGrade4Indigenous?grade4IndigenousCatalog:isGrade4English?grade4EnglishCatalog:isGrade4Mathematics?grade4Catalog:isGrade6English?grade6EnglishCatalog:isGrade6Mathematics?grade6Catalog:isGrade6Kiswahili?grade6KiswahiliCatalog:isGrade8English?grade8EnglishCatalog:isGrade8Mathematics?grade8Catalog:isGrade1Creative?creativeCatalog:grade1ReaderCatalog}
      learningArea={autoLearningArea} gradeLabel={(isGrade4English||isGrade4Mathematics||isGrade4Indigenous)?'Grade 4':(isGrade6Mathematics||isGrade6English)?'Grade 6':isGrade6Kiswahili?'Grade 6':(isGrade8Mathematics||isGrade8English)?'Grade 8':'Grade 1'}
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
    {curriculumView && isGrade4Mathematics && <Grade4MathematicsMap
       selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
       mappedUnits={grade4Catalog} catalogLoading={grade4CatalogLoading} catalogError={grade4CatalogError}
       onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
         const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
         router.push('/teacher/scheme?'+p.toString())
       }:undefined} />}
    {curriculumView && isGrade6English && <Grade6EnglishMap selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      mappedUnits={grade6EnglishCatalog} catalogLoading={grade6EnglishCatalogLoading} catalogError={grade6EnglishCatalogError}
      onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }:undefined} />}
    {curriculumView && isGrade3Kiswahili && <Grade3KiswahiliMap
      selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      units={grade3KiswahiliCatalog} loading={grade3KiswahiliCatalogLoading}
      error={grade3KiswahiliCatalogError} schemeCount={schemeItems.length}
      onOpenScheme={unitId=>{
        const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }} />}
    {curriculumView && isGrade6Kiswahili && <Grade6KiswahiliMap key={selectedSubject} selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId} schemeCount={schemeItems.length}
      onOpenScheme={()=>{
        const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek)})
        router.push('/teacher/scheme?'+p.toString())
      }}
      mappedUnits={grade6KiswahiliCatalog} catalogLoading={grade6KiswahiliCatalogLoading} catalogError={grade6KiswahiliCatalogError}
      onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }:undefined} />}
    {curriculumView && isGrade6Mathematics && <Grade6MathematicsMap
      selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      mappedUnits={grade6Catalog} catalogLoading={grade6CatalogLoading} catalogError={grade6CatalogError}
      onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }:undefined} />}
    {curriculumView && isGrade8Mathematics && <Grade8MathematicsMap
      selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      mappedUnits={grade8Catalog} catalogLoading={grade8CatalogLoading} catalogError={grade8CatalogError}
      onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }:undefined} />}
    {curriculumView && isGrade8English && <Grade8EnglishMap key={selectedSubject} selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      mappedUnits={grade8EnglishCatalog} catalogLoading={grade8EnglishCatalogLoading} catalogError={grade8EnglishCatalogError}
      termSelected={!!selectedTermId}
      onPlanUnit={selectedClass&&selectedSubject ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,week:String(selectedWeek),unitId})
        if(selectedTermId)p.set('termId',selectedTermId)
        router.push('/teacher/scheme?'+p.toString())
      }:undefined} />}
    {curriculumView && isGrade4Kiswahili && <Grade4KiswahiliMap
      showExisting={showEnglishLegacy}
      onToggleExisting={()=>setShowEnglishLegacy(value=>!value)}
      schemeCount={schemeItems.length}
      onOpenScheme={()=>{
        const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek)})
        router.push('/teacher/scheme?'+p.toString())
      }}
    />}
    {curriculumView && isGrade8Kiswahili && <Grade8KiswahiliMap
      selectedTerm={termObj?.term ?? null}
      onOpenScheme={()=>{
        const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek)})
        router.push('/teacher/scheme?'+p.toString())
      }} />}
    {curriculumView && isGrade9English && <Grade9EnglishMap
      selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      onOpenScheme={unitId=>{
        const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek),unitId:unitId||mapUnitId})
        router.push('/teacher/scheme?'+p.toString())
      }} />}
    {curriculumView && isGrade9Mathematics && <Grade9MathematicsMap
      selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      legacyCount={allCurriculumRows.length}
      showExisting={showEnglishLegacy} onToggleExisting={()=>setShowEnglishLegacy(value=>!value)}
      onOpenScheme={unitId=>{
        const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek),unitId:unitId||mapUnitId})
        router.push('/teacher/scheme?'+p.toString())
      }}
    />}
    {curriculumView && isGrade4Indigenous && <Grade4IndigenousMap
       selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
       mappedUnits={grade4IndigenousCatalog} catalogLoading={grade4IndigenousCatalogLoading}
       catalogError={grade4IndigenousCatalogError} schemeCount={schemeItems.length}
       showExisting={showEnglishLegacy} onToggleExisting={()=>setShowEnglishLegacy(value=>!value)}
       onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
         const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
         router.push('/teacher/scheme?'+p.toString())
       }:undefined}
    />}
    {curriculumView && isGrade4English && <Grade4EnglishMap
      selectedTerm={termObj?.term ?? null}
      selectedUnitId={mapUnitId} onSelectUnit={setMapUnitId}
      mappedUnits={grade4EnglishCatalog} catalogLoading={grade4EnglishCatalogLoading} catalogError={grade4EnglishCatalogError}
      onPlanUnit={selectedClass&&selectedSubject&&selectedTermId ? unitId=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(selectedWeek),unitId})
        router.push('/teacher/scheme?'+p.toString())
      }:undefined}
      showExisting={showEnglishLegacy}
      onToggleExisting={()=>setShowEnglishLegacy(value=>!value)}
      weeklyCount={allCurriculumRows.length}
      schemeCount={schemeItems.length}
      verifiedOutcomeCount={Object.values(curriculumOutcomes).flat().filter(outcome=>outcome.status==='verified').length}
      onOpenScheme={()=>router.push(`/teacher/scheme?classId=${encodeURIComponent(selectedClass)}&subjectId=${encodeURIComponent(selectedSubject)}&termId=${encodeURIComponent(selectedTermId)}&week=${selectedWeek}`)}
    />}
    {curriculumView ? <section className="studio-canonical-map" style={{display:isGrade1Creative||isGrade8Mathematics||isGrade8English||isGrade6Mathematics||isGrade6English||isGrade4Mathematics||((isGrade1Mathematics||isGrade1English)&&!allCurriculumRows.length)||(isGrade4English&&!showEnglishLegacy)||(isGrade4Indigenous&&!showEnglishLegacy)||(isGrade8Kiswahili&&!showEnglishLegacy)||(isGrade4Kiswahili&&!showEnglishLegacy)||isGrade6Kiswahili||isGrade3Kiswahili||isGrade9English||(isGrade9Mathematics&&!showEnglishLegacy)?'none':undefined}}>
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

         {grade3KiswahiliDraftUnit && <section aria-label="Grade 3 Kiswahili Scheme planning reference" style={{background:'#f1f8f3',border:'1px solid #9fbbaa',borderRadius:14,padding:16,marginBottom:12}}>
       <div style={{fontSize:11,fontWeight:800,color:C.teal}}>RAMANI YA MTAALA → SCHEME · REFERENCE ONLY</div>
       <h2 style={{margin:'6px 0',fontSize:18,color:C.text}}>{grade3KiswahiliDraftUnit.subStrand}</h2>
       <p style={{fontSize:13,color:C.text2}}>{grade3KiswahiliDraftUnit.strand} · Wiki {selectedWeek}</p>
       <p role="status" style={{fontSize:13,color:'#825b25'}}>Rekodi hii ni kichwa cha mada ya zamani. Uhakiki wa matokeo ya KICD na uunganishaji wa Scheme haujakamilika. Kufungua mada hapa hakuundi somo.</p>
       <button type="button" onClick={()=>{
         const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek),unitId:grade3KiswahiliDraftUnit.id})
         router.push('/teacher/curriculum?'+p.toString())
       }} style={{minHeight:44,padding:'10px 14px',border:'1px solid #9fbbaa',borderRadius:9,background:'#fff',color:C.teal,fontWeight:700}}>
         Rudi kwenye ramani ya mtaala
       </button>
     </section>}
         {grade9EnglishDraftUnit && !grade9EnglishDraftRecord && <section aria-label="Grade 9 English planning reference" style={{background:'#f1f8f3',border:'1px solid #9fbbaa',borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:800,color:C.teal}}>CURRICULUM MAP → SCHEME OF WORK · REFERENCE ONLY</div>
      <h2 style={{margin:'6px 0',fontSize:18,color:C.text}}>{grade9EnglishDraftUnit.code} · {grade9EnglishDraftUnit.title}</h2>
      <p style={{fontSize:13,color:C.text2,margin:'0 0 8px'}}>{grade9EnglishDraftUnit.themeName} · {grade9EnglishDraftUnit.strand} · Week {selectedWeek}</p>
      <p style={{fontSize:12,color:C.text2,margin:'0 0 12px'}}>This Grade 9 English curriculum heading is stored and its source reference is indexed, but verified learning outcomes, teaching guidance and lesson-to-outcome Scheme connections are not yet populated. The 2 suggested lessons are a source allocation, not saved lessons or assigned school weeks.</p>
      {grade9EnglishCatalogLoading ? <p role="status" style={{fontSize:12,color:C.text2}}>Checking the canonical outcome and teaching-guidance records…</p> : grade9EnglishCatalogError ? <p role="alert" style={{fontSize:12,color:C.red}}>{grade9EnglishCatalogError}</p> : <p role="status" style={{fontSize:12,color:'#784b0c',background:'#fff8e8',border:'1px solid #eadbb3',padding:10,borderRadius:8,margin:'0 0 12px'}}>This unit does not yet have all required active VibeSchool-authored outcomes, inquiry questions, experiences and teaching guidance. No Scheme lesson has been created.</p>}
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        <button type="button" onClick={()=>{const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek),unitId:grade9EnglishDraftUnit.code});router.push('/teacher/curriculum?'+p.toString())}} style={{minHeight:44,padding:'10px 14px',border:'1px solid #9fbbaa',borderRadius:9,background:'#fff',color:C.teal,fontWeight:700}}>Back to selected English sub-strand</button>
        <button type="button" onClick={()=>setDraftUnitId('')} style={{minHeight:44,padding:'10px 14px',border:0,borderRadius:9,background:C.teal,color:'#fff',fontWeight:700}}>Close reference</button>
      </div>
    </section>}

    {grade9DraftUnit && <section aria-label="Grade 9 Mathematics planning reference" style={{background:'#f1f8f3',border:'1px solid #9fbbaa',borderRadius:14,padding:16,marginBottom:12}}>
       <div style={{fontSize:11,fontWeight:800,color:C.teal,letterSpacing:'.04em'}}>CURRICULUM MAP → SCHEME OF WORK · REFERENCE ONLY</div>
       <h2 style={{margin:'6px 0',fontSize:18,color:C.text}}>{grade9DraftUnit.id} · {grade9DraftUnit.title}</h2>
       <p style={{fontSize:13,color:C.text2,margin:'0 0 10px'}}>{grade9DraftUnit.strand} · Selected instructional week {selectedWeek}</p>
       <p style={{fontSize:12,color:C.text2,margin:'0 0 10px'}}>April 2024 reference: {grade9DraftUnit.lessons} suggested lessons for this sub-strand. The July 2024 revised learning outcomes are not yet verified in the canonical curriculum, so this selection is a planning reference only; no Scheme lesson has been created.</p>
       <p style={{fontSize:12,color:C.text2,margin:'0 0 12px'}}>Once the revised source is verified and each outcome is linked to an approved sub-strand, use the existing Scheme of Work workflow to allocate lessons to your actual school calendar.</p>
       <p role="status" style={{fontSize:12,color:'#784b0c',background:'#fff8e8',border:'1px solid #eadbb3',padding:10,borderRadius:8,margin:'0 0 12px'}}>{grade9DraftUnit.headingStatus === 'LEGACY_HEADING_PAIR_MATCH_ONLY' ? 'This topic heading matches an older stored unit, but it has no verified linked outcomes. A Scheme lesson cannot yet be saved from this reference.' : grade9DraftUnit.headingStatus === 'REVIEW_STRAND_ALIAS_NOT_BOUND' ? 'A similarly named older unit exists, but the strand identity needs reconciliation before any Scheme linkage.' : 'This reference unit has no exact canonical sub-strand mapping. The Curriculum Map selection is visible here, but no saved Scheme link exists.'}</p>
       <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
         <button type="button" onClick={()=>{const p=new URLSearchParams({classId:selectedClass||'',subjectId:selectedSubject||'',termId:selectedTermId||'',week:String(selectedWeek),unitId:grade9DraftUnit.id});router.push('/teacher/curriculum?'+p.toString())}} style={{minHeight:44,padding:'10px 14px',border:'1px solid #9fbbaa',borderRadius:9,background:'#fff',color:C.teal,fontWeight:700}}>View curriculum sub-strand</button>
         <button type="button" onClick={()=>setDraftUnitId('')} style={{minHeight:44,padding:'10px 14px',border:0,borderRadius:9,background:C.teal,color:'#fff',fontWeight:700}}>Close reference</button>
       </div>
     </section>}
{mappedDraftUnit && <section aria-label={(isGrade4English||isGrade4Mathematics||isGrade4Indigenous)?'Plan mapped Grade 4 curriculum lesson':(isGrade6Mathematics||isGrade6English)?'Plan mapped Grade 6 curriculum lesson':(isGrade8Mathematics||isGrade8English)?'Plan mapped Grade 8 curriculum lesson':isGrade9English?'Plan mapped Grade 9 English curriculum lesson':'Plan mapped Grade 1 curriculum lesson'} style={{background:'#f1f8f3',border:'1px solid #9fbbaa',borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:800,color:C.teal,letterSpacing:'.04em'}}>CURRICULUM MAP → SCHEME OF WORK</div>
      <h2 style={{margin:'6px 0',fontSize:18,color:C.text}}>{mappedDraftUnit.title}</h2>
      <p style={{fontSize:13,color:C.text2,margin:'0 0 10px'}}>{mappedDraftStrand} · Sub-strand {mappedDraftUnit.id || mappedDraftUnit.code} · Week {selectedWeek}</p>
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
      {!selectedTermId?<Empty title="Scheme setup incomplete" desc={`${subjectObj?.label||'This subject'} is connected to ${classObj?.label||'this class'}, but the school calendar could not be prepared automatically. Retry before creating a term-scoped Scheme.`}/>:fetching?<div style={{fontSize:12,color:C.text3}}>Loading authoritative Scheme…</div>:selectedWeekItems.length===0?<Empty title="No lessons scheduled" desc="Commit approved canonical curriculum content or add a legitimate teacher-created lesson."/>:<div className="studio-scheme-sequence">{selectedWeekItems.map((item,index)=>{const st=STATUS[item.status]||STATUS.planned;const mappedCatalog=isGrade4Indigenous?grade4IndigenousCatalog:isGrade4English?grade4EnglishCatalog:isGrade4Mathematics?grade4Catalog:isGrade6English?grade6EnglishCatalog:isGrade6Mathematics?grade6Catalog:isGrade6Kiswahili?grade6KiswahiliCatalog:isGrade8English?grade8EnglishCatalog:isGrade8Mathematics?grade8Catalog:isGrade1Creative?creativeCatalog:grade1ReaderCatalog;const mappedUnitId=item.sub_strand_id?Object.keys(mappedCatalog).find(id=>mappedCatalog[id].id===item.sub_strand_id):null;return <div key={item.id} className="studio-lesson-card studio-sequence-card"><span className="studio-sequence-number" aria-label={`Lesson ${index+1}`}>{String(index+1).padStart(2,'0')}</span><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><div style={{fontWeight:800,color:C.text}}>{item.topic}</div><div style={{fontSize:11,color:C.text2}}>{[item.strand,item.sub_strand].filter(Boolean).join(' · ')}</div><div style={{fontSize:11,color:C.text3,marginTop:4}}>{item.curriculum_outcome_id&&item.sub_strand_id?'Curriculum outcome and sub-strand linked':item.curriculum_id&&canonicalRowIds.has(item.curriculum_id)?'Curriculum record linked':mappedUnitId?'VibeSchool curriculum unit mapped':'Curriculum outcome link not set'}</div>{(linkedResources[item.id]||[]).map(r=><div key={r.id} style={{fontSize:11,color:C.indigo,marginTop:5}}>{r.chapterTitle} · {r.resourceRole}</div>)}</div><span style={{fontSize:11,fontWeight:800,padding:'4px 7px',borderRadius:99,background:st.bg,color:st.color}}>{st.label}</span></div><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}><button type="button" onClick={()=>prepareSchemeLesson(item)} style={{fontSize:12,padding:'10px 15px',border:0,borderRadius:9,background:C.teal,color:'#fff',fontWeight:800}}>Prepare lesson →</button>
      {isGrade4Mathematics && mappedUnitId==='2.6' && item.curriculum_outcome_id
        && grade4Catalog['2.6']?.outcomes?.some(outcome=>outcome.id===item.curriculum_outcome_id)
        && <button type="button" onClick={()=>router.push('/teacher/outcome-package?outcomeId='+encodeURIComponent(item.curriculum_outcome_id))}
          style={{fontSize:12,padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:'#ecf8f0',color:C.teal,fontWeight:700}}>
          Notes · Guide · Exercises
        </button>}
      {mappedUnitId&&<button type="button" onClick={()=>{
        const p=new URLSearchParams({classId:selectedClass,subjectId:selectedSubject,termId:selectedTermId,week:String(item.week),unitId:mappedUnitId})
        router.push('/teacher/curriculum?'+p.toString())
      }} style={{fontSize:12,padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.teal,fontWeight:700}}>View curriculum map</button>}
      {item.curriculum_id&&canonicalRowIds.has(item.curriculum_id)&&<button type="button" onClick={()=>openLinkedCurriculum(item)} style={{fontSize:12,padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.teal,fontWeight:700}}>View curriculum</button>}
      <details style={{position:'relative'}}><summary style={{fontSize:12,padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:'#fff',color:C.text2,cursor:'pointer'}}>Change status</summary><div style={{display:'flex',gap:6,flexWrap:'wrap',padding:'8px 0'}}>{['planned','teaching','done','cancelled'].filter(s=>s!==item.status).map(next=><button key={next} type="button" onClick={()=>setPendingStatusChange({id:item.id,status:next,topic:item.topic})} style={{fontSize:12,padding:'8px 10px',border:`1px solid ${C.border}`,borderRadius:8,background:'#fff'}}>{STATUS[next].label}</button>)}</div></details></div>{pendingStatusChange?.id===item.id&&<div role="alert" style={{marginTop:10,padding:10,border:`1px solid ${C.border}`,borderRadius:9,background:C.surface2}}><div style={{fontSize:12,fontWeight:700}}>Change “{item.topic}” to {STATUS[pendingStatusChange.status]?.label}?</div><div style={{display:'flex',gap:8,marginTop:7}}><button type="button" onClick={()=>void setStatus(item.id,pendingStatusChange.status)} style={{padding:'8px 12px',background:C.teal,color:'#fff',border:0,borderRadius:7,fontWeight:700}}>Confirm</button><button type="button" onClick={()=>setPendingStatusChange(null)} style={{padding:'8px 12px',border:`1px solid ${C.border}`,borderRadius:7,background:'#fff'}}>Cancel</button></div></div>}
      {isGrade1Creative && item.sub_strand_id===creativeCatalog['1.1']?.id && <JumpingSchemeContent schemeId={item.id}/>}
      <details className="studio-scheme-reflection"><summary>Teaching reflection</summary><textarea aria-label={`Reflection for ${item.topic}`} defaultValue={item.reflection||''} onBlur={e=>void saveReflection(item.id,e.target.value)} placeholder="Reflection after teaching" rows={2} style={{width:'100%',marginTop:8,padding:7,border:`1px solid ${C.border2}`,borderRadius:7,fontFamily:'inherit'}}/></details></div>})}</div>}
      <details style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:14}}><summary style={{fontSize:12,fontWeight:700,color:C.text,cursor:'pointer',marginBottom:7}}>Add teacher-created lesson</summary><div style={{marginTop:10}}><input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="Lesson focus" style={{width:'100%',padding:8,border:`1px solid ${C.border2}`,borderRadius:7,marginBottom:6}}/><input value={newStrand} onChange={e=>setNewStrand(e.target.value)} placeholder="Strand (optional)" style={{width:'100%',padding:8,border:`1px solid ${C.border2}`,borderRadius:7,marginBottom:6}}/><button type="button" disabled={adding||!newTopic.trim()} onClick={()=>void addCustom()} style={{padding:'8px 12px',border:0,borderRadius:8,background:C.dark,color:'#fff',fontWeight:700}}>{adding?'Adding…':`Add to Week ${selectedWeek}`}</button></div></details>
    </div>
    </>}
  </div>
}

export function AuthoritySchemePage({ curriculumView = false } = {}){return <Suspense fallback={<Empty title="Loading Scheme" desc="Resolving Scheme authority."/>}><Inner curriculumView={curriculumView}/></Suspense>}

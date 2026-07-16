"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LessonPanel } from '@/components/scheme/LessonPanel'
import { supabase } from '@/lib/supabase'
import { getContentForSubject, resolveGlobalSubjectId, lastResolveDebug } from '@/lib/curriculum/globalSubjects'
import { SchemeOfWorkPrint } from '@/components/scheme/SchemeOfWorkPrint'

// ── DESIGN TOKENS (exact app colors) ──────────────────────────
const C = {
  bg:           '#f8fafc',
  surface:      '#ffffff',
  surface2:     '#f1f5f9',
  border:       '#e2e8f0',
  border2:      '#cbd5e1',
  text:         '#1e293b',
  text2:        '#64748b',
  text3:        '#94a3b8',
  heroFrom:     '#3730a3',
  heroTo:       '#4338ca',
  teal:         '#0d9488',
  tealLight:    '#ccfbf1',
  indigo:       '#4f46e5',
  indigoLight:  '#e0e7ff',
  green:        '#16a34a',
  greenLight:   '#dcfce7',
  amber:        '#d97706',
  amberLight:   '#fef3c7',
  red:          '#e11d48',
  redLight:     '#ffe4e6',
  dark:         '#0a1628',
  shadow:       '0 1px 3px rgba(0,0,0,0.08)',
  shadowMd:     '0 4px 16px rgba(0,0,0,0.08)',
} as const

// ── INTERFACES ─────────────────────────────────────────────────
interface ClassOption    { id: string; label: string; grade: string }
interface SubjectOption  { id: string; label: string }
interface TermRecord     { id: string; name: string; term: number; academic_year: number; start_date: string; end_date: string; status: string; school_id: string }
interface CurriculumRow  { id: string; grade: string; subject: string; strand: string; sub_strand: string | null; topic: string; week: number; term: number }
interface SchemeItem     { id: string; curriculum_id: string | null; curriculum_content_id: string | null; week: number; strand: string | null; sub_strand: string | null; topic: string; status: string; source: string; lesson_number: number | null; reflection: string | null; key_inquiry_question: string | null; learning_resources: string | null; assessment_methods: string | null; learning_experiences: string | null }
interface EbookSuggestion { chapterId: string; chapterTitle: string; publicationTitle: string; strandName: string; learningOutcomes: string[] }
interface AssignmentPair { class_id: string; subject_id: string }

// ── STATUS CONFIG ──────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; border: string }> = {
  planned:   { bg: C.surface2,   color: C.text2,   label: "Planned",   border: C.border  },
  teaching:  { bg: '#dbeafe',    color: '#1d4ed8', label: "Teaching",  border: '#93c5fd' },
  done:      { bg: C.tealLight,  color: C.teal,    label: "Done",      border: '#5eead4' },
  cancelled: { bg: C.redLight,   color: C.red,     label: "Cancelled", border: '#fda4af' },
}
const STATUSES = ['planned', 'teaching', 'done', 'cancelled'] as const

// ── HELPERS ────────────────────────────────────────────────────
function totalWeeks(term: TermRecord): number {
  const start = new Date(term.start_date)
  const end   = new Date(term.end_date)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 13
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  return Math.max(1, Math.ceil(days / 7))
}

function currentWeekOf(term: TermRecord): number {
  const start = new Date(term.start_date)
  if (isNaN(start.getTime())) return 1
  const now = Date.now()
  if (now < start.getTime()) return 1
  const diff = Math.floor((now - start.getTime()) / (1000*60*60*24*7))
  return Math.max(1, Math.min(diff + 1, totalWeeks(term)))
}

function weekCoverageLevel(pct: number): 'full' | 'partial' | 'empty' {
  if (pct >= 80) return 'full'
  if (pct > 0)   return 'partial'
  return 'empty'
}

function termLabel(t: TermRecord): string {
  return t.name.includes(String(t.academic_year)) ? t.name : `${t.name} ${t.academic_year}`
}

// ── SKELETON ───────────────────────────────────────────────────
function Skeleton({ h = 56, mb = 8 }: { h?: number; mb?: number }) {
  return (
    <div style={{
      height:         h,
      borderRadius:   12,
      marginBottom:   mb,
      background:     'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation:      'shimmer 1.4s infinite',
    }} />
  )
}

// ── EMPTY STATE ────────────────────────────────────────────────
function EmptyState({
  icon, title, desc, action
}: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div style={{
      textAlign:    'center',
      padding:      '36px 24px',
      background:   C.surface,
      borderRadius: 16,
      border:       `1.5px dashed ${C.border2}`,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{
        fontSize:     15,
        fontWeight:   800,
        color:        C.text,
        marginBottom: 6,
      }}>{title}</div>
      <div style={{
        fontSize:   13,
        color:      C.text3,
        lineHeight: 1.6,
        maxWidth:   260,
        margin:     '0 auto',
      }}>{desc}</div>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

// ── WEEK GRID ──────────────────────────────────────────────────
function WeekGrid({
  totalWks, currentWk, weekCoverage, selectedWeek, onSelect
}: {
  totalWks:     number
  currentWk:    number
  weekCoverage: Record<number, number>
  selectedWeek: number
  onSelect:     (w: number) => void
}) {
  return (
    <div>
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap:                 5,
        marginBottom:        10,
      }}>
        {Array.from({ length: totalWks }, (_, i) => i + 1).map(w => {
          const pct     = weekCoverage[w] ?? 0
          const level   = weekCoverageLevel(pct)
          const active  = selectedWeek === w
          const current = currentWk > 0 && currentWk === w

          const dotColor =
            level === 'full'    ? C.teal  :
            level === 'partial' ? C.amber : C.border2

          return (
            <button
              key={w}
              type="button"
              aria-pressed={active}
              aria-label={`Select week ${w}`}
              onClick={() => onSelect(w)}
              style={{
                aspectRatio:    '1',
                borderRadius:   10,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            3,
                cursor:         'pointer',
                fontFamily:     'inherit',
                padding:        0,
                border:         active
                  ? `2px solid ${C.indigo}`
                  : current
                  ? `2px solid ${C.teal}`
                  : `1.5px solid ${C.border}`,
                background:     active
                  ? C.indigoLight
                  : current
                  ? C.tealLight
                  : C.surface2,
                transition:     'all 0.15s ease',
              }}
            >
              <div style={{
                fontSize:   10,
                fontWeight: 800,
                color:      active ? C.indigo : current ? C.teal : C.text2,
              }}>W{w}</div>
              <div style={{
                width:        5,
                height:       5,
                borderRadius: '50%',
                background:   dotColor,
                boxShadow:    level !== 'empty' ? `0 0 4px ${dotColor}` : 'none',
              }} />
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[
          { color: C.teal,    label: "Covered"     },
          { color: C.amber,   label: "Partial"      },
          { color: C.border2, label: "Not started"  },
        ].map(l => (
          <div key={l.label} style={{
            display:    'flex',
            alignItems: 'center',
            gap:        5,
            fontSize:   10,
            color:      C.text3,
            fontWeight: 500,
          }}>
            <div style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   l.color,
              boxShadow:    l.color !== C.border2 ? `0 0 4px ${l.color}` : 'none',
            }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CHIP ───────────────────────────────────────────────────────
function Chip({
  label, active, color = C.indigo, onClick
}: {
  label: string; active: boolean; color?: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding:      '7px 16px',
        borderRadius: 99,
        fontSize:     13,
        fontWeight:   700,
        border:       `1.5px solid ${active ? color : C.border}`,
        cursor:       'pointer',
        fontFamily:   'inherit',
        background:   active ? color : C.surface,
        color:        active ? '#fff' : C.text2,
        boxShadow:    active ? `0 2px 8px ${color}33` : 'none',
        transition:   'all 0.15s ease',
        whiteSpace:   'nowrap',
        flexShrink:   0,
      }}
    >{label}</button>
  )
}

// ── MAIN INNER ─────────────────────────────────────────────────
function SchemePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Read initial URL params ONCE — boot must never re-run on filter changes
  const initialParamsRef = useRef({
    classId:   searchParams.get('classId'),
    subjectId: searchParams.get('subjectId'),
    termId:    searchParams.get('termId'),
    week:      searchParams.get('week'),
  })
  const initialClassId   = initialParamsRef.current.classId
  const initialSubjectId = initialParamsRef.current.subjectId
  const initialTermId    = initialParamsRef.current.termId
  const initialWeekStr   = initialParamsRef.current.week

  const [uid,              setUid]              = useState<string | null>(null)
  const [schoolId,         setSchoolId]         = useState<string | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [bootError,        setBootError]        = useState<string | null>(null)

  const [pairs,            setPairs]            = useState<AssignmentPair[]>([])
  const [classes,          setClasses]          = useState<ClassOption[]>([])
  const [allSubjects,      setAllSubjects]      = useState<SubjectOption[]>([])
  const [terms,            setTerms]            = useState<TermRecord[]>([])

  const [selectedClass,    setSelectedClass]    = useState<string | null>(null)
  const [selectedSubject,  setSelectedSubject]  = useState<string | null>(null)
  const [selectedTermId,   setSelectedTermId]   = useState<string | null>(null)
  const [selectedWeek,     setSelectedWeek]     = useState(1)

  const [schemeItems,      setSchemeItems]      = useState<SchemeItem[]>([])
  const [fetching,         setFetching]         = useState(false)
  const [fetchError,       setFetchError]       = useState<string | null>(null)
  const [debugTrace,       setDebugTrace]       = useState<string[]>([])
  const [savingSet,        setSavingSet]        = useState<Set<string>>(new Set())
  const [showPrint,        setShowPrint]        = useState(false)

  const [curriculumRows,   setCurriculumRows]   = useState<CurriculumRow[]>([])
  const [ebookSuggestions, setEbookSuggestions] = useState<EbookSuggestion[]>([])
  const [loadingCurric,    setLoadingCurric]    = useState(false)
  const [committing,       setCommitting]       = useState(false)

  const [newTopicName,     setNewTopicName]     = useState('')
  const [newStrandName,    setNewStrandName]    = useState('')
  const [addCustomBusy,    setAddCustomBusy]    = useState(false)
  const [addCustomError,   setAddCustomError]   = useState<string | null>(null)

  const schemeRequestIdRef = useRef(0)

  // Filter subjects paired with selected class
  const filteredSubjects = useMemo(() => {
    if (!selectedClass) return []
    const pairedIds = pairs.filter(p => p.class_id === selectedClass).map(p => p.subject_id)
    return allSubjects.filter(s => pairedIds.includes(s.id))
  }, [selectedClass, pairs, allSubjects])

  // Get selected objects
  const selectedClassObj   = useMemo(() => classes.find(c => c.id === selectedClass) ?? null, [classes, selectedClass])
  const selectedSubjectObj = useMemo(() => allSubjects.find(s => s.id === selectedSubject) ?? null, [allSubjects, selectedSubject])
  const selectedTermObj    = useMemo(() => terms.find(t => t.id === selectedTermId) ?? null, [terms, selectedTermId])

  // Auto-select paired subject if selection becomes invalid
  useEffect(() => {
    if (!selectedClass) return
    const valid = filteredSubjects.some(s => s.id === selectedSubject)
    if (!valid) {
      setSelectedSubject(filteredSubjects[0]?.id ?? null)
    }
  }, [selectedClass, selectedSubject, filteredSubjects])

  // Clamp week on term switch
  useEffect(() => {
    if (selectedTermObj) {
      const maxW = totalWeeks(selectedTermObj)
      if (selectedWeek > maxW) {
        setSelectedWeek(maxW)
      }
    }
  }, [selectedTermId, selectedTermObj, selectedWeek])

  // Reflect filter state back to the browser URL (read-once above, so no boot loop)
  useEffect(() => {
    if (loading || bootError) return
    const currentParams = new URLSearchParams()
    if (selectedClass)   currentParams.set('classId', selectedClass)
    if (selectedSubject) currentParams.set('subjectId', selectedSubject)
    if (selectedTermId)  currentParams.set('termId', selectedTermId)
    currentParams.set('week', String(selectedWeek))
    router.replace(`/teacher/scheme?${currentParams.toString()}`)
  }, [selectedClass, selectedSubject, selectedTermId, selectedWeek, loading, bootError, router])

  // ── Boot (runs once) ──────────────────────────────────────────
  const boot = useCallback(async () => {
    setLoading(true)
    setBootError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!user) {
        setBootError("Not signed in")
        setLoading(false)
        return
      }
      setUid(user.id)

      const [teacherRes, memberRes, profileRes, tcRes] = await Promise.all([
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
        supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id', user.id),
      ])

      const firstBootError = teacherRes.error ?? memberRes.error ?? profileRes.error
      if (firstBootError) throw firstBootError
      if (tcRes.error) throw tcRes.error

      const sid = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? null
      if (!sid) {
        setBootError("no-school")
        setLoading(false)
        return
      }
      setSchoolId(sid)

      const teacherClasses = (tcRes.data ?? []) as AssignmentPair[]
      if (teacherClasses.length === 0) {
        setBootError("no-classes")
        setLoading(false)
        return
      }
      setPairs(teacherClasses)

      const classIds   = Array.from(new Set(teacherClasses.map((r: { class_id: string }) => r.class_id)))
      const subjectIds = Array.from(new Set(teacherClasses.map((r: { subject_id: string }) => r.subject_id)))

      const [clRes, subRes, termRes] = await Promise.all([
        supabase.from('classes').select('id,name,stream').in('id', classIds).eq('school_id', sid),
        supabase.from('subjects').select('id,name').in('id', subjectIds),
        supabase.from('academic_terms').select('id,name,term,academic_year,start_date,end_date,status,school_id').eq('school_id', sid).order('academic_year', { ascending: false }).order('term', { ascending: true }),
      ])

      if (clRes.error) throw clRes.error
      if (subRes.error) throw subRes.error
      if (termRes.error) throw termRes.error

      const loadedTerms = (termRes.data ?? []) as TermRecord[]
      if (loadedTerms.length === 0) {
        setBootError("no-terms")
        setLoading(false)
        return
      }

      const classOptions: ClassOption[] = (clRes.data ?? []).map((c: { id: string; name: string; stream: string | null }) => ({
        id: c.id,
        label: c.stream ? `${c.name} ${c.stream}` : c.name,
        grade: c.name,
      }))

      const subjectOptions: SubjectOption[] = (subRes.data ?? []).map((s: { id: string; name: string }) => ({
        id: s.id,
        label: s.name,
      }))

      setTerms(loadedTerms)
      setClasses(classOptions)
      setAllSubjects(subjectOptions)

      const matchClass   = initialClassId   ? classOptions.find(c => c.id === initialClassId)     : null
      const matchSubject = initialSubjectId ? subjectOptions.find(s => s.id === initialSubjectId) : null

      const defaultClass = matchClass?.id ?? classOptions[0]?.id ?? null
      setSelectedClass(defaultClass)

      if (defaultClass) {
        const pairedSubjs = teacherClasses.filter((p: { class_id: string }) => p.class_id === defaultClass).map((p: { subject_id: string }) => p.subject_id)
        const validMatchSubj = matchSubject && pairedSubjs.includes(matchSubject.id) ? matchSubject.id : null
        const firstPairedSubj = subjectOptions.find(s => pairedSubjs.includes(s.id))?.id ?? null
        setSelectedSubject(validMatchSubj ?? firstPairedSubj)
      }

      const matchTerm  = initialTermId ? loadedTerms.find(t => t.id === initialTermId) : null
      const activeTerm = loadedTerms.find(t => t.status === 'active') ?? loadedTerms[0]
      const chosenTerm = matchTerm ?? activeTerm
      setSelectedTermId(chosenTerm?.id ?? null)

      if (initialWeekStr && !isNaN(parseInt(initialWeekStr))) {
        setSelectedWeek(parseInt(initialWeekStr))
      } else if (chosenTerm) {
        setSelectedWeek(currentWeekOf(chosenTerm))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Request failed"
      setBootError(message || "Request failed")
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    boot()
  }, [boot])

  // ── Load scheme items + delta against reference curriculum ────
  const loadScheme = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !selectedTermId || !schoolId || !uid) return

    const requestId = ++schemeRequestIdRef.current
    setFetching(true)
    setFetchError(null)
    setSchemeItems([])
    setCurriculumRows([])
    setEbookSuggestions([])

    const { data, error } = await supabase
      .from('scheme_of_work')
      .select('id,curriculum_id,curriculum_content_id,week,strand,sub_strand,topic,status,source,lesson_number,reflection,key_inquiry_question,learning_resources,assessment_methods,learning_experiences')
      .eq('teacher_id', uid)
      .eq('class_id', selectedClass)
      .eq('subject_id', selectedSubject)
      .eq('academic_term_id', selectedTermId)
      .eq('school_id', schoolId)

    if (requestId !== schemeRequestIdRef.current) return

    if (error) {
      setFetchError(`Failed to load scheme of work items: ${error.message}`)
      setFetching(false)
      return
    }

    const items = (data ?? []) as SchemeItem[]
    setSchemeItems(items)

    // Delta: which national curriculum items are not yet in this teacher's scheme
    if (selectedClassObj && selectedSubjectObj && selectedTermObj) {
      setLoadingCurric(true)
      const { data: currData, error: currErr } = await supabase
        .from('curriculum')
        .select('id,grade,subject,strand,sub_strand,topic,week,term')
        .eq('grade', selectedClassObj.grade)
        .eq('subject', selectedSubjectObj.label)
        .eq('term', selectedTermObj.term)

      if (requestId !== schemeRequestIdRef.current) {
        setDebugTrace(t => [...t.slice(-39), `req#${requestId} ABORTED at curriculum-fetch (superseded)`])
        return
      }

      if (currErr) {
        setFetchError(`Failed to load curriculum: ${currErr.message}`)
        setLoadingCurric(false)
        setFetching(false)
        return
      }

      if (currData) {
        const activeCurriculumIds = new Set(items.map(i => i.curriculum_id).filter(Boolean))
        const unseededRows = (currData as CurriculumRow[]).filter(row => !activeCurriculumIds.has(row.id))
        setCurriculumRows(unseededRows)
      }
      setLoadingCurric(false)

      // Published, CBC-aligned ebook chapters linked to a real KICD
      // sub-strand for this grade/subject. Not week-matched yet —
      // cbc_strands.term/week aren't populated. Teacher picks the week.
      setDebugTrace(t => [...t.slice(-39), `req#${requestId} subjectLabel=${JSON.stringify(selectedSubjectObj.label)} grade=${JSON.stringify(selectedClassObj.grade)}`])
      const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)
      setDebugTrace(t => [...t.slice(-39), `req#${requestId} globalSubjectId=${globalSubjectId ?? 'NULL'}`, `req#${requestId} resolveDebug=${lastResolveDebug}`])
      if (globalSubjectId) {
        const { data: strandRows } = await supabase
          .from('cbc_strands')
          .select('id')
          .eq('subject_id', globalSubjectId)
          .ilike('grade', selectedClassObj.grade)

        const strandIds = (strandRows ?? []).map(r => r.id)
        setDebugTrace(t => [...t.slice(-39), `req#${requestId} strandIds.length=${strandIds.length}`])

        if (strandIds.length > 0) {
          const { data: chapterRows, error: chapterErr } = await supabase
            .from('vibe_chapters')
            .select('id,title,cbc_strand,learning_outcomes,sub_strand_id,vibe_publications(id,title,cbc_aligned,status)')
            .in('sub_strand_id', strandIds)
            .eq('status', 'published')

          setDebugTrace(t => [...t.slice(-39), `req#${requestId} chapterRows=${chapterRows?.length ?? 'null'} err=${chapterErr?.message ?? 'none'}`])

          if (chapterErr) {
            console.error('ebook suggestion query failed:', chapterErr)
            setFetchError(`Ebook suggestion query failed: ${chapterErr.message}`)
          }

          // vibe_publications may come back as a single object or a
          // one-item array depending on how Supabase resolves the FK —
          // normalize both shapes.
          const normalizePub = (pub: any) => Array.isArray(pub) ? pub[0] : pub

          const validChapters = (chapterRows ?? []).filter((c: any) => {
            const pub = normalizePub(c.vibe_publications)
            return pub?.cbc_aligned === true && pub?.status === 'published'
          })

          setDebugTrace(t => [...t.slice(-39), `req#${requestId} validChapters.length=${validChapters.length} isCurrent=${requestId === schemeRequestIdRef.current}`])

          if (requestId === schemeRequestIdRef.current) {
            setEbookSuggestions(validChapters.map((c: any) => {
              const pub = normalizePub(c.vibe_publications)
              return {
                chapterId: c.id,
                chapterTitle: c.title,
                publicationTitle: pub?.title ?? '',
                strandName: c.cbc_strand,
                learningOutcomes: c.learning_outcomes ?? [],
              }
            }))
          }
        } else {
          setEbookSuggestions([])
        }
      }
    }
    setFetching(false)
  }, [selectedClass, selectedSubject, selectedTermId, schoolId, uid, selectedClassObj, selectedSubjectObj, selectedTermObj])

  useEffect(() => {
    if (!loading && !bootError) {
      loadScheme()
    }
  }, [loading, bootError, loadScheme])

  // ── Commit unseeded curriculum references (copy-on-commit) ────
  async function commitScheme() {
    if (!selectedClass || !selectedSubject || !selectedTermId || !schoolId || !uid || !selectedClassObj || !selectedSubjectObj || !selectedTermObj || curriculumRows.length === 0) return
    setCommitting(true)

    const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)
    const contentByCurriculumId = new Map<string, string | null>()
    if (globalSubjectId) {
      await Promise.all(curriculumRows.map(async row => {
        const content = await getContentForSubject(schoolId, globalSubjectId, uid, row.id)
        contentByCurriculumId.set(row.id, content?.id ?? null)
      }))
    }

    const payloads = curriculumRows.map(row => ({
      school_id: schoolId,
      teacher_id: uid,
      class_id: selectedClass,
      subject_id: selectedSubject,
      curriculum_id: row.id,
      curriculum_content_id: contentByCurriculumId.get(row.id) ?? null,
      academic_term_id: selectedTermId,
      curriculum_type: 'cbc',
      grade: row.grade,
      subject: row.subject,
      term: row.term,
      week: row.week,
      strand: row.strand,
      sub_strand: row.sub_strand,
      topic: row.topic,
      status: 'planned',
      source: 'curriculum'
    }))

    const { error } = await supabase.from('scheme_of_work').insert(payloads)

    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        // Another tab/device already committed some rows — resync instead of erroring
        await loadScheme()
      } else {
        setFetchError(`Failed to commit scheme items: ${error.message}`)
      }
    } else {
      await loadScheme()
    }
    setCommitting(false)
  }

  // ── Add a custom (teacher-created) scheme row ─────────────────
  async function addCustomItem() {
    const topic  = newTopicName.trim()
    const strand = newStrandName.trim()
    if (!topic || !selectedClass || !selectedSubject || !selectedTermId || !schoolId || !uid || !selectedClassObj || !selectedSubjectObj || !selectedTermObj) return
    setAddCustomBusy(true)
    setAddCustomError(null)

    const payload = {
      school_id: schoolId,
      teacher_id: uid,
      class_id: selectedClass,
      subject_id: selectedSubject,
      curriculum_id: null,
      curriculum_content_id: null,
      academic_term_id: selectedTermId,
      curriculum_type: 'custom',
      grade: selectedClassObj.grade,
      subject: selectedSubjectObj.label,
      term: selectedTermObj.term,
      week: selectedWeek,
      strand: strand || null,
      sub_strand: null,
      topic: topic,
      status: 'planned',
      source: 'custom'
    }

    const { error } = await supabase.from('scheme_of_work').insert(payload)
    if (error) {
      setAddCustomError(error.message)
    } else {
      setNewTopicName('')
      setNewStrandName('')
      await loadScheme()
    }
    setAddCustomBusy(false)
  }

  // ── Update item status (per-item saving, plain update by id) ──
  async function updateStatus(itemId: string, nextStatus: string) {
    if (!schoolId || !uid) return
    setSavingSet(prev => { const n = new Set(prev); n.add(itemId); return n })

    const { error } = await supabase
      .from('scheme_of_work')
      .update({ status: nextStatus })
      .eq('id', itemId)
      .eq('school_id', schoolId)
      .eq('teacher_id', uid)

    if (error) {
      setFetchError(`Failed to update status: ${error.message}`)
    } else {
      setSchemeItems(prev => prev.map(item => item.id === itemId ? { ...item, status: nextStatus } : item))
    }
    setSavingSet(prev => { const n = new Set(prev); n.delete(itemId); return n })
  }

  // ── Update lesson number (TSC scheme document column) ──────────
  async function updateLessonNumber(itemId: string, lessonNumber: number | null) {
    if (!schoolId || !uid) return
    const { error } = await supabase
      .from('scheme_of_work')
      .update({ lesson_number: lessonNumber })
      .eq('id', itemId)
      .eq('school_id', schoolId)
      .eq('teacher_id', uid)

    if (error) {
      setFetchError(`Failed to update lesson number: ${error.message}`)
    } else {
      setSchemeItems(prev => prev.map(item => item.id === itemId ? { ...item, lesson_number: lessonNumber } : item))
    }
  }

  // ── Update reflection (TSC scheme document column) ─────────────
  async function updateReflection(itemId: string, reflection: string) {
    if (!schoolId || !uid) return
    const { error } = await supabase
      .from('scheme_of_work')
      .update({ reflection })
      .eq('id', itemId)
      .eq('school_id', schoolId)
      .eq('teacher_id', uid)

    if (error) {
      setFetchError(`Failed to update reflection: ${error.message}`)
    } else {
      setSchemeItems(prev => prev.map(item => item.id === itemId ? { ...item, reflection } : item))
    }
  }

  // ── Generic override-field updater for the 4 TSC document fields ──
  const TSC_OVERRIDE_FIELDS = ['key_inquiry_question', 'learning_resources', 'assessment_methods', 'learning_experiences'] as const
  type TscOverrideField = typeof TSC_OVERRIDE_FIELDS[number]

  async function updateTscField(itemId: string, field: TscOverrideField, value: string) {
    if (!schoolId || !uid) return
    const { error } = await supabase
      .from('scheme_of_work')
      .update({ [field]: value || null })
      .eq('id', itemId)
      .eq('school_id', schoolId)
      .eq('teacher_id', uid)

    if (error) {
      setFetchError(`Failed to update ${field}: ${error.message}`)
    } else {
      setSchemeItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value || null } : item))
    }
  }

  // ── Coverage ──────────────────────────────────────────────────
  const weekCoverage = useMemo(() => {
    const map: Record<number, number> = {}
    if (!selectedTermObj) return map
    const maxW = totalWeeks(selectedTermObj)
    for (let w = 1; w <= maxW; w++) {
      const wItems = schemeItems.filter(i => i.week === w)
      if (wItems.length === 0) {
        map[w] = 0
      } else {
        const done = wItems.filter(i => i.status === 'done').length
        map[w] = Math.round((done / wItems.length) * 100)
      }
    }
    return map
  }, [schemeItems, selectedTermObj])

  const selectedWeekItems = useMemo(() => {
    return schemeItems.filter(i => i.week === selectedWeek)
  }, [schemeItems, selectedWeek])

  const donePct = useMemo(() => {
    if (selectedWeekItems.length === 0) return 0
    const done = selectedWeekItems.filter(i => i.status === 'done').length
    return Math.round((done / selectedWeekItems.length) * 100)
  }, [selectedWeekItems])

  // Scheduled-but-not-yet-taught share of the week, shown alongside donePct
  // so a 0%-done week with topics already planned reads as "not started
  // teaching" rather than looking identical to an empty week.
  const plannedPct = useMemo(() => {
    if (selectedWeekItems.length === 0) return 0
    const planned = selectedWeekItems.filter(i => i.status === 'planned').length
    return Math.round((planned / selectedWeekItems.length) * 100)
  }, [selectedWeekItems])

  const totWks = selectedTermObj ? totalWeeks(selectedTermObj) : 13
  const selectedTermIsActive = selectedTermObj?.status === 'active'
  const curWeek = selectedTermObj && selectedTermIsActive ? currentWeekOf(selectedTermObj) : 0

  // ── RENDER STATES ──────────────────────────────────────────────
  if (bootError) {
    if (bootError === "no-school") {
      return (
        <EmptyState
          icon="🏫"
          title="Not linked to a school yet"
          desc="Ask your school admin to add you, or complete onboarding to link your account."
          action={
            <a href="/teacher/onboarding/school" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 12, background: C.dark, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Complete Onboarding →
            </a>
          }
        />
      )
    }
    if (bootError === "no-classes") {
      return (
        <EmptyState
          icon="📋"
          title="No classes assigned yet"
          desc="To use the Scheme of Work you need classes and subjects assigned to you."
          action={
            <a href="/teacher/classhub" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 12, background: C.dark, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Go to ClassHub →
            </a>
          }
        />
      )
    }
    if (bootError === "no-terms") {
      return (
        <EmptyState
          icon="📅"
          title="No terms set up yet"
          desc="Your school has not configured academic terms. Please coordinate with your school admin."
        />
      )
    }
    return (
      <EmptyState
        icon="⚠️"
        title="Request failed"
        desc={bootError}
        action={<button type="button" onClick={boot} style={{ padding: '9px 18px', borderRadius: 12, background: C.indigo, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Try Again</button>}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1,2,3].map(i => <Skeleton key={i} h={60} />)}
      </div>
    )
  }

  return (
    <div className="vs-scheme" style={{ width: '100%' }}>
      <style>{`
        .vs-scheme * { box-sizing: border-box; }
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.heroFrom} 0%, ${C.heroTo} 100%)`, borderRadius: 20, padding: 20, marginBottom: 14, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 10, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4, position: 'relative', zIndex: 1 }}>Scheme of Work</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, position: 'relative', zIndex: 1, letterSpacing: -0.3 }}>Curriculum Tracker</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 5, lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
          {selectedTermObj ? `${termLabel(selectedTermObj)} · ${curWeek > 0 ? `Week ${curWeek} of ${totWks}` : `${totWks} weeks total`}` : "Track coverage across terms and weeks"}
        </div>

        {debugTrace.length > 0 && (
          <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.3)', fontSize: 10, fontFamily: 'monospace', color: '#fef3c7', position: 'relative', zIndex: 1, lineHeight: 1.6 }}>
            {debugTrace.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}

        {debugTrace.length > 0 && (
          <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.3)', fontSize: 10, fontFamily: 'monospace', color: '#fef3c7', position: 'relative', zIndex: 1, lineHeight: 1.6 }}>
            {debugTrace.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}

        {schemeItems.length > 0 && selectedWeekItems.length > 0 && (
          <div style={{ marginTop: 14, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 6 }}>
              <span>Week {selectedWeek} Coverage</span>
              <span>
                <span style={{ color: donePct >= 80 ? '#5eead4' : donePct >= 50 ? '#fcd34d' : donePct > 0 ? '#fca5a5' : 'rgba(255,255,255,0.5)' }}>{donePct}% taught</span>
                {plannedPct > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}> · {plannedPct}% planned</span>
                )}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ height: 5, background: donePct >= 80 ? C.teal : donePct >= 50 ? C.amber : C.red, width: `${donePct}%`, transition: 'width 0.5s ease' }} />
              <div style={{ height: 5, background: 'rgba(255,255,255,0.35)', width: `${plannedPct}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── FILTERS ── */}
      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: '16px', marginBottom: 12, boxShadow: C.shadow }}>
        {/* Class */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          Class <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
          {classes.map(c => (
            <Chip key={c.id} label={c.label} active={selectedClass === c.id} color={C.dark} onClick={() => { setSelectedClass(c.id); setFetchError(null) }} />
          ))}
        </div>

        {/* Subject */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          Subject <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
          {filteredSubjects.map(s => (
            <Chip key={s.id} label={s.label} active={selectedSubject === s.id} color={C.teal} onClick={() => { setSelectedSubject(s.id); setFetchError(null) }} />
          ))}
        </div>

        {/* Term */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          Term <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, overflowX: 'auto' }}>
          {terms.map(t => (
            <Chip key={t.id} label={termLabel(t)} active={selectedTermId === t.id} color={C.teal} onClick={() => setSelectedTermId(t.id)} />
          ))}
        </div>

        {/* Week Grid */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          Week <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>
        <WeekGrid totalWks={totWks} currentWk={curWeek} weekCoverage={weekCoverage} selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
      </div>

      {/* ── LESSON CONTEXT PANEL (label props only — ID props land in the LessonPanel cycle) ── */}
      {selectedClassObj && selectedSubjectObj && selectedTermObj && uid && schoolId && selectedClass && selectedSubject && selectedTermId && schemeItems.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPrint(true)}
          style={{ width: '100%', padding: '11px', borderRadius: 12, border: `1.5px solid ${C.border2}`, background: C.surface, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}
        >🖨️ Print / Export Scheme of Work</button>
      )}

      {showPrint && selectedClassObj && selectedSubjectObj && selectedTermObj && schoolId && (
        <SchemeOfWorkPrint
          schoolId={schoolId}
          className={selectedClassObj.label}
          subjectLabel={selectedSubjectObj.label}
          termLabelText={termLabel(selectedTermObj)}
          items={schemeItems}
          onClose={() => setShowPrint(false)}
        />
      )}

      {selectedClassObj && selectedSubjectObj && selectedTermObj && uid && schoolId && selectedClass && selectedSubject && selectedTermId && (
        <LessonPanel
          teacherId={uid}
          classId={selectedClass}
          subjectId={selectedSubject}
          subjectLabel={selectedSubjectObj.label}
          academicTermId={selectedTermId}
          schoolId={schoolId}
          week={selectedWeek}
        />
      )}

      {/* ── CONTENT BODY ── */}
      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: '16px', boxShadow: C.shadow, marginBottom: 20 }}>
        {fetchError && (
          <div style={{ padding: 10, background: C.redLight, color: C.red, borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{fetchError}</div>
        )}

        {fetching || loadingCurric ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} h={80} />)}
          </div>
        ) : schemeItems.length === 0 && curriculumRows.length === 0 ? (
          /* ── NO SCHEME, NO REFERENCE CONTENT — manual custom entry ── */
          <EmptyState
            icon="📭"
            title="Nothing scheduled yet"
            desc={`No curriculum content exists for this grade and subject yet. Add your own topic for Week ${selectedWeek} below.`}
            action={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280, margin: '0 auto' }}>
                {ebookSuggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: 1, textTransform: 'uppercase' }}>
                      From published ebooks
                    </div>
                    {ebookSuggestions.map(s => (
                      <div key={s.chapterId} style={{ padding: 10, borderRadius: 10, border: `1.5px solid #c7d2fe`, background: C.indigoLight }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.chapterTitle}</div>
                        <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{s.publicationTitle} · {s.strandName}</div>
                        <button
                          type="button"
                          onClick={() => { setNewTopicName(s.chapterTitle); setNewStrandName(s.strandName) }}
                          style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Use this
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input value={newTopicName} onChange={e => setNewTopicName(e.target.value)} placeholder="Topic name, e.g. Whole Numbers" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                <input value={newStrandName} onChange={e => setNewStrandName(e.target.value)} placeholder="Strand name (optional), e.g. Numbers" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                {addCustomError && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{addCustomError}</div>}
                <button type="button" onClick={addCustomItem} disabled={addCustomBusy || !newTopicName.trim()} style={{ padding: '10px 16px', background: C.indigo, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: addCustomBusy ? 'not-allowed' : 'pointer', opacity: addCustomBusy || !newTopicName.trim() ? 0.6 : 1, fontFamily: 'inherit' }}>
                  {addCustomBusy ? "Adding..." : "Add Topic"}
                </button>
              </div>
            }
          />
        ) : (
          /* ── TRACKER STATE (with delta import banner when reference items are unseeded) ── */
          <div>
            {curriculumRows.length > 0 && (
              <div style={{ padding: 14, background: C.indigoLight, borderRadius: 12, marginBottom: 16, border: '1.5px solid #c7d2fe' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.indigo, marginBottom: 4 }}>
                  {schemeItems.length === 0 ? "Build your Scheme of Work" : "New curriculum items available"}
                </div>
                <div style={{ fontSize: 11, color: '#4338ca', marginBottom: 10, lineHeight: 1.4 }}>
                  {curriculumRows.length} national curriculum item{curriculumRows.length !== 1 ? 's' : ''} for this class and subject {schemeItems.length === 0 ? "can be copied into your scheme as your term plan." : "are not yet in your scheme."}
                </div>
                <button type="button" onClick={commitScheme} disabled={committing} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: C.indigo, color: '#fff', fontWeight: 700, fontSize: 13, cursor: committing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {committing ? "Committing..." : `Commit ${curriculumRows.length} item${curriculumRows.length !== 1 ? 's' : ''} to my scheme`}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Topics — Week {selectedWeek}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, background: C.tealLight, padding: '3px 9px', borderRadius: 99, border: '1px solid #5eead4' }}>
                {selectedWeekItems.length} item{selectedWeekItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {selectedWeekItems.length === 0 ? (
              <EmptyState
                icon="📭"
                title="Empty week"
                desc={`No topics scheduled for Week ${selectedWeek}. Add a custom topic for this week.`}
                action={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260, margin: '0 auto' }}>
                    <input value={newTopicName} onChange={e => setNewTopicName(e.target.value)} placeholder="Topic name" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                    <input value={newStrandName} onChange={e => setNewStrandName(e.target.value)} placeholder="Strand name (optional)" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                    {addCustomError && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{addCustomError}</div>}
                    <button type="button" onClick={addCustomItem} disabled={addCustomBusy || !newTopicName.trim()} style={{ padding: '10px 16px', background: C.indigo, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: addCustomBusy ? 'not-allowed' : 'pointer', opacity: addCustomBusy || !newTopicName.trim() ? 0.6 : 1, fontFamily: 'inherit' }}>
                      Add Topic to Week {selectedWeek}
                    </button>
                  </div>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedWeekItems.map(item => {
                  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.planned
                  const isSaving = savingSet.has(item.id)

                  return (
                    <div key={item.id} style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface, overflow: 'hidden', boxShadow: C.shadow, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: st.color, borderRadius: '0 2px 2px 0' }} />
                      <div style={{ padding: '12px 14px 12px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{item.topic}</div>
                            {item.strand && (
                              <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
                                {item.strand}{item.sub_strand ? ` · ${item.sub_strand}` : ''}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => {
                                const qs = new URLSearchParams({
                                  schemeId: item.id,
                                  classId: selectedClass ?? '',
                                  subjectId: selectedSubject ?? '',
                                  grade: selectedClassObj?.grade ?? '',
                                  subject: selectedSubjectObj?.label ?? '',
                                  strand: item.strand ?? '',
                                  topic: item.topic,
                                  week: String(selectedWeek),
                                  term: String(selectedTermObj?.term ?? 1),
                                  ...(item.curriculum_id ? { curriculumId: item.curriculum_id } : {})
                                })
                                router.push(`/teacher/scheme/generate?${qs.toString()}`)
                              }}
                              style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border2}`, background: '#fff', color: C.indigo, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Lesson Plan →
                            </button>
                            <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${st.border}` }}>
                              {isSaving ? "…" : st.label}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {STATUSES.map(s => {
                            const ss = STATUS_STYLE[s]
                            const isActive = item.status === s
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateStatus(item.id, s)}
                                disabled={isSaving}
                                style={{
                                  padding: '5px 11px',
                                  borderRadius: 8,
                                  border: `1.5px solid ${isActive ? ss.border : C.border}`,
                                  cursor: isSaving ? 'not-allowed' : 'pointer',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: 'inherit',
                                  background: isActive ? ss.bg : C.surface2,
                                  color: isActive ? ss.color : C.text3,
                                  opacity: isSaving ? 0.6 : 1,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {ss.label}
                              </button>
                            )
                          })}
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: C.text3 }}>Lesson #</label>
                          <input
                            type="number"
                            min={1}
                            defaultValue={item.lesson_number ?? ''}
                            onBlur={e => updateLessonNumber(item.id, e.target.value ? parseInt(e.target.value) : null)}
                            style={{ width: 52, padding: '5px 8px', borderRadius: 8, border: `1px solid ${C.border2}`, fontSize: 12, fontFamily: 'inherit', color: C.text }}
                          />
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: C.text3, display: 'block', marginBottom: 4 }}>Reflection</label>
                          <textarea
                            defaultValue={item.reflection ?? ''}
                            placeholder="How did this lesson go? (saved when you tap away)"
                            onBlur={e => updateReflection(item.id, e.target.value)}
                            rows={2}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border2}`, fontSize: 12, fontFamily: 'inherit', color: C.text, resize: 'vertical' }}
                          />
                        </div>

                        <details style={{ marginTop: 8 }}>
                          <summary style={{ fontSize: 11, fontWeight: 700, color: C.indigo, cursor: 'pointer' }}>TSC document fields (optional overrides)</summary>
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {([
                              ['key_inquiry_question', 'Key Inquiry Question'],
                              ['learning_experiences', 'Learning Experiences'],
                              ['learning_resources', 'Learning Resources'],
                              ['assessment_methods', 'Assessment Methods'],
                            ] as const).map(([field, label]) => (
                              <div key={field}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: C.text3, display: 'block', marginBottom: 4 }}>{label}</label>
                                <textarea
                                  defaultValue={item[field] ?? ''}
                                  placeholder="Leave blank to use the content default"
                                  onBlur={e => updateTscField(item.id, field, e.target.value)}
                                  rows={2}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border2}`, fontSize: 12, fontFamily: 'inherit', color: C.text, resize: 'vertical' }}
                                />
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── EXPORT ─────────────────────────────────────────────────────
export default function SchemePage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 60, borderRadius: 12, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
        ))}
      </div>
    }>
      <SchemePageInner />
    </Suspense>
  )
}

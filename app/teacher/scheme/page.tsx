"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { LessonPanel } from '@/components/scheme/LessonPanel'
import { supabase } from '@/lib/supabase'

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
interface ClassOption   { id: string; label: string; grade: string }
interface SubjectOption { id: string; label: string }
interface Strand        { id: string; name: string }
interface Progress      { strand_id: string; term: number; week: number; status: string; notes: string | null }
interface Term          { id: string; name: string; term: number; academic_year: number; start_date: string; end_date: string }
interface CurriculumRow { grade: string; subject: string; strand: string; week: number; term: number }

// ── STATUS CONFIG ──────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; border: string }> = {
  planned:   { bg: C.surface2,   color: C.text2,   label: 'Planned',   border: C.border  },
  teaching:  { bg: '#dbeafe',    color: '#1d4ed8', label: 'Teaching',  border: '#93c5fd' },
  done:      { bg: C.tealLight,  color: C.teal,    label: 'Done',      border: '#5eead4' },
  cancelled: { bg: C.redLight,   color: C.red,     label: 'Cancelled', border: '#fda4af' },
}
const STATUSES = ['planned', 'teaching', 'done', 'cancelled'] as const

// ── HELPERS ────────────────────────────────────────────────────
function totalWeeks(term: Term): number {
  const start = new Date(term.start_date)
  const end   = new Date(term.end_date)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 13
  const weeks = Math.round((end.getTime() - start.getTime()) / (1000*60*60*24*7))
  return Math.max(1, weeks)
}

function currentWeekOf(term: Term): number {
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

// ── COVERAGE PILL ──────────────────────────────────────────────
function CoveragePill({ pct }: { pct: number }) {
  const color = pct >= 80 ? C.teal : pct >= 50 ? C.amber : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex:         1,
        height:       5,
        background:   C.border,
        borderRadius: 99,
        overflow:     'hidden',
      }}>
        <div style={{
          width:        `${pct}%`,
          height:       '100%',
          background:   color,
          borderRadius: 99,
          transition:   'width 0.5s ease',
        }} />
      </div>
      <div style={{
        fontSize:   11,
        fontWeight: 800,
        color,
        minWidth:   32,
        textAlign:  'right',
        fontFamily: 'monospace',
      }}>{pct}%</div>
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
          const current = currentWk === w

          const dotColor =
            level === 'full'    ? C.teal  :
            level === 'partial' ? C.amber : C.border2

          return (
            <div
              key={w}
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
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[
          { color: C.teal,    label: 'Covered'     },
          { color: C.amber,   label: 'Partial'      },
          { color: C.border2, label: 'Not started'  },
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

// ── STRAND CARD ────────────────────────────────────────────────
function StrandCard({
  strand, status, isSaving, onUpdate
}: {
  strand:   Strand
  status:   string
  isSaving: boolean
  onUpdate: (strandId: string, status: string) => void
}) {
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.planned

  return (
    <div style={{
      borderRadius: 14,
      border:       `1px solid ${C.border}`,
      background:   C.surface,
      overflow:     'hidden',
      boxShadow:    C.shadow,
      position:     'relative',
    }}>
      {/* Left accent */}
      <div style={{
        position:   'absolute',
        left: 0, top: 0, bottom: 0,
        width:      3,
        background: st.color,
        borderRadius: '0 2px 2px 0',
      }} />

      <div style={{ padding: '12px 14px 12px 18px' }}>
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   10,
        }}>
          <div style={{
            fontSize:   14,
            fontWeight: 700,
            color:      C.text,
            flex:       1,
            marginRight: 10,
          }}>{strand.name}</div>

          <span style={{
            background:   st.bg,
            color:        st.color,
            padding:      '3px 10px',
            borderRadius: 20,
            fontSize:     11,
            fontWeight:   700,
            border:       `1px solid ${st.border}`,
            flexShrink:   0,
          }}>
            {isSaving ? '…' : st.label}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map(s => {
            const ss      = STATUS_STYLE[s]
            const isActive = status === s
            return (
              <button
                key={s}
                onClick={() => onUpdate(strand.id, s)}
                disabled={isSaving}
                style={{
                  padding:      '5px 11px',
                  borderRadius: 8,
                  border:       `1.5px solid ${isActive ? ss.border : C.border}`,
                  cursor:       isSaving ? 'not-allowed' : 'pointer',
                  fontSize:     11,
                  fontWeight:   700,
                  fontFamily:   'inherit',
                  background:   isActive ? ss.bg : C.surface2,
                  color:        isActive ? ss.color : C.text3,
                  opacity:      isSaving ? 0.6 : 1,
                  transition:   'all 0.15s ease',
                }}
              >{ss.label}</button>
            )
          })}
        </div>
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

  const [uid,             setUid]             = useState<string | null>(null)
  const [schoolId,        setSchoolId]        = useState<string | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [classes,         setClasses]         = useState<ClassOption[]>([])
  const [subjects,        setSubjects]        = useState<SubjectOption[]>([])
  const [strands,         setStrands]         = useState<Strand[]>([])
  const [progress,        setProgress]        = useState<Progress[]>([])
  const [curriculum,      setCurriculum]      = useState<CurriculumRow[]>([])
  const [activeTerm,      setActiveTerm]      = useState<Term | null>(null)
  const [selectedClass,   setSelectedClass]   = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedTerm,    setSelectedTerm]    = useState(1)
  const [selectedWeek,    setSelectedWeek]    = useState(1)
  const [fetching,        setFetching]        = useState(false)
  const [saving,          setSaving]          = useState<string | null>(null)
  const [fetchError,      setFetchError]      = useState<string | null>(null)
  const [noSchool,        setNoSchool]        = useState(false)
  const [noClasses,       setNoClasses]       = useState(false)
  const [addingStrand,    setAddingStrand]    = useState(false)
  const [newStrandName,   setNewStrandName]   = useState('')
  const [addStrandBusy,   setAddStrandBusy]   = useState(false)
  const [addStrandError,  setAddStrandError]  = useState<string | null>(null)

  // ── Boot ──────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setUid(user.id)

        const [teacherRes, memberRes, profileRes, tcRes] = await Promise.all([
          supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
          supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
          supabase.from('profiles').select('school_id').eq('id', user.id).single(),
          supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id', user.id),
        ])

        const sid = memberRes.data?.school_id
          ?? teacherRes.data?.school_id
          ?? profileRes.data?.school_id
          ?? null

        // Teacher exists without school
        if (!sid) {
          setNoSchool(true)
          setLoading(false)
          return
        }

        setSchoolId(sid)

        const teacherClasses = tcRes.data ?? []
        const classIds       = Array.from(new Set(teacherClasses.map((r: { class_id: string }) => r.class_id)))
        const subjectIds     = Array.from(new Set(teacherClasses.map((r: { subject_id: string }) => r.subject_id)))

        if (classIds.length === 0) {
          setNoClasses(true)
          setLoading(false)
          return
        }

        const [clRes, subRes, termRes] = await Promise.all([
          supabase.from('classes').select('id,name,stream').in('id', classIds),
          supabase.from('subjects').select('id,name').in('id', subjectIds),
          supabase
            .from('academic_terms')
            .select('id,name,term,academic_year,start_date,end_date,status')
            .eq('school_id', sid)
            .eq('status', 'active')
            .single(),
        ])

        const classOptions: ClassOption[] = (clRes.data ?? []).map(
          (c: { id: string; name: string; stream: string | null }) => ({
            id:    c.id,
            label: c.stream ? `${c.name} ${c.stream}` : c.name,
            grade: c.name,
          })
        )

        const subjectOptions: SubjectOption[] = (subRes.data ?? []).map(
          (s: { id: string; name: string }) => ({ id: s.id, label: s.name })
        )

        const term = termRes.data as Term | null
        setActiveTerm(term)

        if (term) {
          const curWeek = currentWeekOf(term)
          setSelectedTerm(term.term)
          setSelectedWeek(curWeek)
        }

        setClasses(classOptions)
        setSubjects(subjectOptions)

        // URL params
        const urlClassId   = searchParams.get('classId')
        const urlSubjectId = searchParams.get('subjectId')
        const matchClass   = urlClassId   ? classOptions.find(c => c.id === urlClassId)     : null
        const matchSubject = urlSubjectId ? subjectOptions.find(s => s.id === urlSubjectId) : null

        const defaultClass   = matchClass?.id   ?? classOptions[0]?.id   ?? null
        const defaultSubject = matchSubject?.id ?? subjectOptions[0]?.id ?? null

        setSelectedClass(defaultClass)
        setSelectedSubject(defaultSubject)

        // Load curriculum for coverage dots
        if (term) {
          const grades = Array.from(new Set(classOptions.map(c => c.grade)))
          const { data: currData } = await supabase
            .from('curriculum')
            .select('grade,subject,strand,week,term')
            .eq('term', term.term)
            .in('grade', grades)
          setCurriculum((currData ?? []) as CurriculumRow[])
        }
      } catch {
        // silent fail — show empty state
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  // ── Load strands ──────────────────────────────────────────────
  const loadStrands = useCallback(async () => {
    if (!selectedSubject || !selectedClass || !schoolId || !uid) return
    setFetching(true)
    setStrands([])
    setProgress([])
    setFetchError(null)
    setAddingStrand(false)
    setAddStrandError(null)

    const cls  = classes.find(c => c.id === selectedClass)
    const grade = cls?.grade ?? ''

    const [strandsRes, progressRes] = await Promise.all([
      supabase
        .from('cbc_strands')
        .select('id,name')
        .eq('subject_id', selectedSubject)
        .eq('grade', grade)
        .order('name'),
      supabase
        .from('strand_progress')
        .select('strand_id,term,week,status,notes')
        .eq('teacher_id', uid)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term', selectedTerm),
    ])

    if (strandsRes.error)  { setFetchError(strandsRes.error.message);  setFetching(false); return }
    if (progressRes.error) { setFetchError(progressRes.error.message); setFetching(false); return }

    setStrands(strandsRes.data ?? [])
    setProgress(progressRes.data ?? [])
    setFetching(false)
  }, [selectedSubject, selectedClass, selectedTerm, schoolId, uid, classes, subjects])

  useEffect(() => {
    if (!loading) loadStrands()
  }, [loading, loadStrands])

  // ── Manual add-strand fallback ──────────────────────────────────
  // Used only when the curriculum table has no rows for this grade/subject
  // at all (a genuine content gap, not just an unseeded school).
  async function addStrand() {
    const name = newStrandName.trim()
    if (!name || !selectedSubject || !schoolId) return
    setAddStrandBusy(true)
    setAddStrandError(null)

    const { data, error } = await supabase
      .from('strands')
      .insert({ name, subject_id: selectedSubject, school_id: schoolId })
      .select('id,name')
      .single()

    if (error) {
      setAddStrandError(error.message)
      setAddStrandBusy(false)
      return
    }

    setStrands(prev => [...prev, data])
    setNewStrandName('')
    setAddingStrand(false)
    setAddStrandBusy(false)
  }

  // ── Update status ─────────────────────────────────────────────
  async function updateStatus(strandId: string, status: string) {
    if (!uid || !selectedClass || !selectedSubject || !schoolId) return
    setSaving(strandId)

    const { error } = await supabase.from('strand_progress').upsert({
      teacher_id: uid,
      class_id:   selectedClass,
      subject_id: selectedSubject,
      school_id:  schoolId,
      strand_id:  strandId,
      term:       selectedTerm,
      week:       selectedWeek,
      status,
    }, { onConflict: 'teacher_id,class_id,strand_id,term,week' })

    if (!error) {
      setProgress(prev => {
        const exists = prev.find(p => p.strand_id === strandId && p.week === selectedWeek)
        if (exists) return prev.map(p =>
          p.strand_id === strandId && p.week === selectedWeek ? { ...p, status } : p
        )
        return [...prev, { strand_id: strandId, term: selectedTerm, week: selectedWeek, status, notes: null }]
      })
    }
    setSaving(null)
  }

  const getStatus = (strandId: string) =>
    progress.find(p => p.strand_id === strandId && p.week === selectedWeek)?.status ?? 'planned'

  // ── Week coverage dots (synced with curriculum table) ─────────
  const weekCoverage = useMemo(() => {
    const map: Record<number, number> = {}
    if (!activeTerm || !selectedClass || !selectedSubject) return map

    const cls        = classes.find(c => c.id === selectedClass)
    const subj       = subjects.find(s => s.id === selectedSubject)
    if (!cls || !subj) return map

    const totWks  = totalWeeks(activeTerm)
    const nameToId = new Map(strands.map(s => [s.name, s.id]))

    for (let w = 1; w <= totWks; w++) {
      const weekStrands = curriculum.filter(c =>
        c.grade   === cls.grade &&
        c.subject === subj.label &&
        c.week    === w &&
        c.term    === selectedTerm
      )
      const delivered = weekStrands.filter(c => {
        const strandId = nameToId.get(c.strand)
        return strandId != null && progress.some(p =>
          p.strand_id === strandId &&
          p.week      === w &&
          p.status    === 'done'
        )
      }).length
      map[w] = weekStrands.length > 0
        ? Math.round((delivered / weekStrands.length) * 100)
        : 0
    }
    return map
  }, [activeTerm, selectedClass, selectedSubject, classes, subjects, curriculum, progress, selectedTerm, strands])

  // ── Derived ───────────────────────────────────────────────────
  const totWks  = activeTerm ? totalWeeks(activeTerm)   : 13
  const curWeek = activeTerm ? currentWeekOf(activeTerm): 1
  const selectedClassObj   = classes.find(c => c.id === selectedClass)   ?? null
  const selectedSubjectObj = subjects.find(s => s.id === selectedSubject) ?? null

  const donePct = strands.length > 0
    ? Math.round(
        (progress.filter(p => p.status === 'done' && p.week === selectedWeek).length / strands.length) * 100
      )
    : 0

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        .btn-status:hover { opacity: 0.85; transform: translateY(-1px); }
        .week-chip:hover  { opacity: 0.85; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{
        background:   `linear-gradient(135deg, ${C.heroFrom} 0%, ${C.heroTo} 100%)`,
        borderRadius: 20,
        padding:      20,
        marginBottom: 14,
        color:        '#fff',
        position:     'relative',
        overflow:     'hidden',
      }}>
        <div style={{
          position:     'absolute',
          top: -40, right: -40,
          width:        140, height: 140,
          borderRadius: '50%',
          background:   'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position:     'absolute',
          bottom: -30, left: 10,
          width:        80, height: 80,
          borderRadius: '50%',
          background:   'rgba(255,255,255,0.04)',
        }} />

        <div style={{
          fontSize:      10,
          color:         'rgba(255,255,255,0.55)',
          fontWeight:    700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom:  4,
          position:      'relative',
          zIndex:        1,
        }}>Scheme of Work</div>

        <div style={{
          fontSize:     20,
          fontWeight:   800,
          marginTop:    2,
          position:     'relative',
          zIndex:       1,
          letterSpacing: -0.3,
        }}>Curriculum Tracker</div>

        <div style={{
          fontSize:   12,
          color:      'rgba(255,255,255,0.6)',
          marginTop:  5,
          lineHeight: 1.5,
          position:   'relative',
          zIndex:     1,
        }}>
          {activeTerm
            ? `${activeTerm.name} ${activeTerm.academic_year} · Week ${curWeek} of ${totWks}`
            : 'Track strand coverage across terms and weeks'}
        </div>

        {strands.length > 0 && (
          <div style={{ marginTop: 14, position: 'relative', zIndex: 1 }}>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              fontSize:       11,
              color:          'rgba(255,255,255,0.65)',
              fontWeight:     600,
              marginBottom:   6,
            }}>
              <span>Week {selectedWeek} Coverage</span>
              <span style={{ color: donePct >= 80 ? '#5eead4' : donePct >= 50 ? '#fcd34d' : '#fca5a5' }}>
                {donePct}%
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
              <div style={{
                height:     5,
                borderRadius: 99,
                background:   donePct >= 80 ? C.teal : donePct >= 50 ? C.amber : C.red,
                width:        `${donePct}%`,
                transition:   'width 0.5s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── NO SCHOOL STATE ── */}
      {noSchool ? (
        <EmptyState
          icon="🏫"
          title="Not linked to a school yet"
          desc="Ask your school admin to add you, or complete onboarding to link your account."
          action={
            <a
              href="/teacher/onboarding/school"
              style={{
                display:      'inline-block',
                padding:      '10px 24px',
                borderRadius: 12,
                background:   C.dark,
                color:        '#fff',
                fontWeight:   700,
                fontSize:     13,
                textDecoration: 'none',
              }}
            >Complete Onboarding →</a>
          }
        />
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <Skeleton key={i} h={60} />)}
        </div>
      ) : noClasses ? (
        <EmptyState
          icon="📋"
          title="No classes assigned yet"
          desc="To use the Curriculum Tracker you need classes and subjects assigned to you."
          action={
            <a
              href="/teacher/classhub"
              style={{
                display:      'inline-block',
                padding:      '10px 24px',
                borderRadius: 12,
                background:   C.dark,
                color:        '#fff',
                fontWeight:   700,
                fontSize:     13,
                textDecoration: 'none',
              }}
            >Go to ClassHub →</a>
          }
        />
      ) : (
        <>
          {/* ── FILTER CARD ── */}
          <div style={{
            background:   C.surface,
            borderRadius: 16,
            border:       `1px solid ${C.border}`,
            padding:      '16px',
            marginBottom: 12,
            boxShadow:    C.shadow,
          }}>
            {/* Class */}
            <div style={{
              fontSize:      10,
              fontWeight:    700,
              color:         C.text3,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom:  10,
              display:       'flex',
              alignItems:    'center',
              gap:           8,
            }}>
              Class
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
              {classes.map(c => (
                <Chip
                  key={c.id}
                  label={c.label}
                  active={selectedClass === c.id}
                  color={C.dark}
                  onClick={() => {
                    setSelectedClass(c.id)
                    setFetchError(null)
                  }}
                />
              ))}
            </div>

            {/* Subject */}
            <div style={{
              fontSize:      10,
              fontWeight:    700,
              color:         C.text3,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom:  10,
              display:       'flex',
              alignItems:    'center',
              gap:           8,
            }}>
              Subject
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
              {subjects.map(s => (
                <Chip
                  key={s.id}
                  label={s.label}
                  active={selectedSubject === s.id}
                  color={C.teal}
                  onClick={() => {
                    setSelectedSubject(s.id)
                    setFetchError(null)
                  }}
                />
              ))}
            </div>

            {/* Term */}
            <div style={{
              fontSize:      10,
              fontWeight:    700,
              color:         C.text3,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom:  10,
              display:       'flex',
              alignItems:    'center',
              gap:           8,
            }}>
              Term
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
              {[1,2,3].map(t => (
                <Chip
                  key={t}
                  label={`Term ${t}`}
                  active={selectedTerm === t}
                  color={C.teal}
                  onClick={() => setSelectedTerm(t)}
                />
              ))}
            </div>

            {/* Week grid */}
            <div style={{
              fontSize:      10,
              fontWeight:    700,
              color:         C.text3,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom:  10,
              display:       'flex',
              alignItems:    'center',
              gap:           8,
            }}>
              Week
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <WeekGrid
              totalWks={totWks}
              currentWk={curWeek}
              weekCoverage={weekCoverage}
              selectedWeek={selectedWeek}
              onSelect={setSelectedWeek}
            />
          </div>

          {/* ── LESSON CONTENT (teacher/parent tabs) ── */}
          {selectedClassObj && selectedSubjectObj && (
            <LessonPanel
              gradeLabel={selectedClassObj.grade}
              subjectLabel={selectedSubjectObj.label}
              term={selectedTerm}
              week={selectedWeek}
            />
          )}

          {/* ── STRANDS CARD ── */}
          <div style={{
            background:   C.surface,
            borderRadius: 16,
            border:       `1px solid ${C.border}`,
            padding:      '16px',
            boxShadow:    C.shadow,
            marginBottom: 20,
          }}>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              marginBottom:   14,
            }}>
              <div style={{
                fontSize:      10,
                fontWeight:    700,
                color:         C.text3,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}>
                Strands — Term {selectedTerm}, Week {selectedWeek}
              </div>
              {strands.length > 0 && (
                <div style={{
                  fontSize:     11,
                  fontWeight:   700,
                  color:        C.teal,
                  background:   C.tealLight,
                  padding:      '3px 9px',
                  borderRadius: 99,
                  border:       `1px solid #5eead4`,
                }}>{strands.length} strand{strands.length !== 1 ? 's' : ''}</div>
              )}
            </div>

            {fetchError ? (
              <EmptyState
                icon="⚠️"
                title="Failed to load strands"
                desc={fetchError}
                action={
                  <button
                    onClick={loadStrands}
                    style={{
                      padding:      '9px 18px',
                      borderRadius: 12,
                      background:   C.indigo,
                      color:        '#fff',
                      border:       'none',
                      fontWeight:   700,
                      fontSize:     13,
                      cursor:       'pointer',
                      fontFamily:   'inherit',
                    }}
                  >Try Again</button>
                }
              />
            ) : fetching ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={80} />)}
              </div>
            ) : strands.length === 0 ? (
              <EmptyState
                icon="📭"
                title="No strands yet"
                desc={
                  addingStrand
                    ? 'Add the first strand for this subject.'
                    : `Week ${selectedWeek} hasn't been set up yet. Add strands or check a different week.`
                }
                action={
                  addingStrand ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260, margin: '0 auto' }}>
                      <input
                        autoFocus
                        value={newStrandName}
                        onChange={e => setNewStrandName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addStrand() }}
                        placeholder="e.g. Numbers"
                        style={{
                          padding:      '9px 12px',
                          borderRadius: 10,
                          border:       `1.5px solid ${C.border2}`,
                          fontSize:     13,
                          fontFamily:   'inherit',
                          outline:      'none',
                        }}
                      />
                      {addStrandError && (
                        <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{addStrandError}</div>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          onClick={addStrand}
                          disabled={addStrandBusy || !newStrandName.trim()}
                          style={{
                            padding:      '8px 16px',
                            background:   C.indigo,
                            color:        '#fff',
                            border:       'none',
                            borderRadius: 10,
                            fontSize:     13,
                            fontWeight:   700,
                            cursor:       addStrandBusy ? 'not-allowed' : 'pointer',
                            opacity:      addStrandBusy || !newStrandName.trim() ? 0.6 : 1,
                            fontFamily:   'inherit',
                          }}
                        >{addStrandBusy ? 'Adding…' : 'Add'}</button>
                        <button
                          onClick={() => { setAddingStrand(false); setNewStrandName(''); setAddStrandError(null) }}
                          style={{
                            padding:      '8px 16px',
                            background:   C.surface2,
                            color:        C.text2,
                            border:       `1.5px solid ${C.border2}`,
                            borderRadius: 10,
                            fontSize:     13,
                            fontWeight:   700,
                            cursor:       'pointer',
                            fontFamily:   'inherit',
                          }}
                        >Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setAddingStrand(true)}
                        style={{
                          padding:      '9px 18px',
                          background:   `linear-gradient(135deg, ${C.indigo}, #6366f1)`,
                          color:        '#fff',
                          border:       'none',
                          borderRadius: 12,
                          fontSize:     13,
                          fontWeight:   700,
                          cursor:       'pointer',
                          fontFamily:   'inherit',
                        }}>+ Add Strands</button>
                      {selectedWeek > 1 && (
                        <button
                          onClick={() => setSelectedWeek(w => w - 1)}
                          style={{
                            padding:      '9px 18px',
                            background:   C.surface2,
                            color:        C.text2,
                            border:       `1.5px solid ${C.border2}`,
                            borderRadius: 12,
                            fontSize:     13,
                            fontWeight:   700,
                            cursor:       'pointer',
                            fontFamily:   'inherit',
                          }}>← Try W{selectedWeek - 1}</button>
                      )}
                    </div>
                  )
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {strands.map(strand => (
                  <StrandCard
                    key={strand.id}
                    strand={strand}
                    status={getStatus(strand.id)}
                    isSaving={saving === strand.id}
                    onUpdate={updateStatus}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ── EXPORT ─────────────────────────────────────────────────────
export default function SchemePage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            height:         60,
            borderRadius:   12,
            background:     'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation:      'shimmer 1.4s infinite',
          }} />
        ))}
      </div>
    }>
      <SchemePageInner />
    </Suspense>
  )
}

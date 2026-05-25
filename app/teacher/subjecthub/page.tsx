'use client'
import { Card, SectionLabel, Btn, C, ReadinessChip } from '@/components/teacher/ui'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface SubjectOption {
  id:   string
  name: string
}

interface ClassForSubject {
  id:         string
  name:       string
  stream:     string
  studentCount: number
}

interface Teammate {
  profileId: string
  fullName:  string
  initials:  string
  isYou:     boolean
}

const PALETTES = [
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: C.accentLight, color: '#065f46' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#e0f2fe', color: '#0369a1' },
]

function getInitials(name: string) {
  return name.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function Skeleton({ h = 56, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
    }} />
  )
}

function HeroSkeleton() {
  return (
    <div style={{
      background: 'linear-gradient(90deg,rgba(255,255,255,0.12) 25%,rgba(255,255,255,0.22) 50%,rgba(255,255,255,0.12) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      height: 16, borderRadius: 8,
    }} />
  )
}

export default function SubjectHubPage() {
  const router = useRouter()

  const [subjects,     setSubjects]     = useState<SubjectOption[]>([])
  const [activeIdx,    setActiveIdx]    = useState(0)
  const [classes,      setClasses]      = useState<ClassForSubject[]>([])
  const [teammates,    setTeammates]    = useState<Teammate[]>([])
  const [schoolId,     setSchoolId]     = useState<string | null>(null)
  const [currentId,    setCurrentId]    = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [classLoading, setClassLoading] = useState(false)
  const [teamLoading,  setTeamLoading]  = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [showAddSubject,    setShowAddSubject]    = useState(false)
  const [newSubjectName,    setNewSubjectName]    = useState('')
  const [newSubjectClassId, setNewSubjectClassId] = useState('')
  const [addingSubject,     setAddingSubject]     = useState(false)
  const [addSubjectError,   setAddSubjectError]   = useState<string | null>(null)
  const [allClasses,        setAllClasses]        = useState<{id: string; name: string; stream: string | null}[]>([])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }
    setCurrentId(user.id)

    const [tcRes, memberRes] = await Promise.all([
      supabase.from('teacher_classes').select('subject_id').eq('teacher_id', user.id),
      supabase.from('profiles').select('school_id').eq('id', user.id).single(),
    ])

    const sid = memberRes.data?.school_id ?? null
    setSchoolId(sid)

    const subjectIds = Array.from(new Set(
      (tcRes.data ?? []).map((r: { subject_id: string }) => r.subject_id).filter(Boolean)
    ))

    if (subjectIds.length === 0) { setLoading(false); return }

    const { data: subData } = await supabase
      .from('subjects').select('id, name').in('id', subjectIds).order('name')

    setSubjects(subData ?? [])

    // Load classes for add-subject modal (best-effort, MVP)
    const { data: clData } = await supabase
      .from('classes').select('id,name,stream')
      .eq('school_id', sid ?? null)
    setAllClasses(clData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (subjects.length === 0) return
    loadClassesForSubject(subjects[activeIdx]?.id)
    loadTeamForSubject(subjects[activeIdx]?.id)
  }, [subjects, activeIdx, schoolId, currentId])

  async function loadClassesForSubject(subjectId: string) {
    if (!subjectId || !currentId) return
    setClassLoading(true)

    const { data: tcData } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', currentId)
      .eq('subject_id', subjectId)

    const classIds = (tcData ?? []).map((r: { class_id: string }) => r.class_id).filter(Boolean)

    if (classIds.length === 0) { setClasses([]); setClassLoading(false); return }

    const [classRes, studentRes] = await Promise.all([
      supabase.from('classes').select('id, name, stream').in('id', classIds),
      supabase.from('students').select('class_id').in('class_id', classIds),
    ])

    const counts: Record<string, number> = {}
    for (const s of studentRes.data ?? []) {
      counts[s.class_id] = (counts[s.class_id] ?? 0) + 1
    }

    const mapped: ClassForSubject[] = (classRes.data ?? []).map((c: { id: string; name: string; stream: string }) => ({
      id:           c.id,
      name:         c.name,
      stream:       c.stream,
      studentCount: counts[c.id] ?? 0,
    }))

    setClasses(mapped)
    setClassLoading(false)
  }

  async function loadTeamForSubject(subjectId: string) {
    if (!subjectId || !schoolId) { setTeammates([]); return }
    setTeamLoading(true)

    const { data: tcData } = await supabase
      .from('teacher_classes')
      .select('teacher_id')
      .eq('subject_id', subjectId)
      .eq('school_id', schoolId)

    const teacherIds = Array.from(new Set(
      (tcData ?? []).map((r: { teacher_id: string }) => r.teacher_id)
    ))

    if (teacherIds.length === 0) { setTeammates([]); setTeamLoading(false); return }

    const { data: profileData } = await supabase
      .from('profiles').select('id, full_name').in('id', teacherIds)

    const team: Teammate[] = (profileData ?? []).map((p: { id: string; full_name: string }, idx: number) => ({
      profileId: p.id,
      fullName:  p.full_name ?? 'Unknown',
      initials:  getInitials(p.full_name ?? '?'),
      isYou:     p.id === currentId,
    }))
    team.sort((a, b) => (a.isYou ? -1 : b.isYou ? 1 : 0))
    setTeammates(team)
    setTeamLoading(false)
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showAddSubject) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showAddSubject])

  function openAddSubject() {
    setNewSubjectName('')
    setNewSubjectClassId('')
    setAddSubjectError(null)
    setAddingSubject(false)
    setShowAddSubject(true)
  }

  function closeAddSubject() {
    setShowAddSubject(false)
    setNewSubjectName('')
    setNewSubjectClassId('')
    setAddSubjectError(null)
    setAddingSubject(false)
  }

  async function addSubject() {
    if (addingSubject) return
    if (!newSubjectName.trim()) { setAddSubjectError('Enter a subject name'); return }
    if (!currentId) { setAddSubjectError('Not signed in'); return }
    setAddingSubject(true)
    setAddSubjectError(null)

    // Deduplicate — no unique constraint on subjects.name
    const dedupBase = supabase.from('subjects').select('id').eq('name', newSubjectName.trim())
    const { data: existing } = await (
      schoolId ? dedupBase.eq('school_id', schoolId) : dedupBase.is('school_id', null)
    ).maybeSingle()

    let subjectId: string
    if (existing) {
      subjectId = existing.id
    } else {
      const { data: newSub, error: subErr } = await supabase
        .from('subjects')
        .insert({ name: newSubjectName.trim(), school_id: schoolId ?? null })
        .select('id')
        .single()
      if (subErr || !newSub) { setAddSubjectError('Failed to create subject'); setAddingSubject(false); return }
      subjectId = newSub.id
    }

    const { error: tcErr } = await supabase.from('teacher_classes').insert({
      teacher_id:       currentId,
      subject_id:       subjectId,
      class_id:         newSubjectClassId || null,
      school_id:        schoolId ?? null,
      is_class_teacher: false,
    })
    if (tcErr) { setAddSubjectError('Failed to link subject'); setAddingSubject(false); return }

    setSubjects(prev => [...prev, { id: subjectId, name: newSubjectName.trim() }])
    closeAddSubject()
  }

  const activeSubject = subjects[activeIdx] ?? null

  const SUBJECT_ACTIONS = [
    { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', route: '/teacher/attendance' },
    { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', route: '/teacher/lessonplan' },
    { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', route: '/teacher/assessment' },
    { id: 'scheme',     label: 'Scheme',       icon: '📋', bg: '#075985', route: '/teacher/scheme'     },
    { id: 'timetable',  label: 'Timetable',    icon: '📅', bg: '#0f766e', route: '/teacher/timetable'  },
  ]

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 60, background: C.surface, minHeight: '100%' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(135deg, #075985 0%, #0ea5e9 80%, #10b981 150%)',
        padding: '20px 16px 28px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(16,185,129,0.1)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2, textTransform: 'uppercase' }}>SubjectHub</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>🔔</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HeroSkeleton />
            <div style={{ marginTop: 4 }}><HeroSkeleton /></div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🔬</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  {activeSubject ? activeSubject.name : 'No Subjects'}
                </h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '3px 0 0' }}>
                  {subjects.length > 1 ? `${subjects.length} subjects assigned` : 'Subject Teacher'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'My Classes',  value: classes.length },
                { label: 'Teammates',   value: teammates.length },
                { label: 'Subjects',    value: subjects.length },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── SUBJECT TABS (if multiple) ── */}
      {!loading && subjects.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
          <button
            onClick={openAddSubject}
            style={{ padding: '7px 16px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Subject
          </button>
        </div>
      )}

      {!loading && subjects.length > 1 && (
        <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {subjects.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveIdx(i)}
              style={{
                padding: '7px 16px', borderRadius: 20, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                background: i === activeIdx ? '#075985' : '#fff',
                color:      i === activeIdx ? '#fff'    : C.textMuted,
                boxShadow: i === activeIdx ? '0 2px 8px rgba(7,89,133,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                fontFamily: 'inherit',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* ── QUICK ACTIONS ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>Subject Tools</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {SUBJECT_ACTIONS.map(a => (
              <button
                key={a.id}
                onClick={() => router.push(a.route + '?subjectId=' + activeSubject.id + (classes[0] ? '&classId=' + classes[0].id : ''))}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 4px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: a.bg, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MY CLASSES FOR THIS SUBJECT ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: 0 }}>My Classes</p>
            <p style={{ fontSize: 12, color: C.textMuted, margin: '3px 0 0' }}>Classes you teach {activeSubject.name} in</p>
          </div>

          {classLoading && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2].map(i => <Skeleton key={i} h={64} />)}
            </div>
          )}

          {!classLoading && classes.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: 28 }}>📚</span>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>No classes assigned for this subject yet.</p>
            </div>
          )}

          {!classLoading && classes.map((cls, i) => (
            <button
              key={cls.id}
              onClick={() => router.push('/teacher/classhub/' + cls.id + '?mode=subject&subjectId=' + activeSubject.id)}
              style={{
                width: '100%', padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                background: 'transparent', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: PALETTES[i % PALETTES.length].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏫</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>
                    {cls.name}{cls.stream ? ' · ' + cls.stream : ''}
                  </p>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: '2px 0 0' }}>{cls.studentCount} students</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push('/teacher/assessment?classId=' + cls.id + '&subjectId=' + activeSubject.id)
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: '#92400e', color: '#fff',
                    fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Assess
                </button>
                <span style={{ fontSize: 18, color: '#9ca3af' }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── DEPARTMENT TEAM ── */}
      {!loading && activeSubject && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: 0 }}>Department Team</p>
            <p style={{ fontSize: 12, color: C.textMuted, margin: '3px 0 0' }}>Teachers in {activeSubject.name}</p>
          </div>

          {teamLoading && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2].map(i => <Skeleton key={i} h={52} />)}
            </div>
          )}

          {!teamLoading && teammates.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: C.textMuted }}>
              No teammates found for this subject.
            </div>
          )}

          {!teamLoading && teammates.map((t, idx) => (
            <div
              key={t.profileId}
              style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: PALETTES[idx % PALETTES.length].bg,
                color: PALETTES[idx % PALETTES.length].color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>
                {t.initials}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                  {t.fullName}{t.isYou ? ' (You)' : ''}
                </p>
                <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{activeSubject.name}</p>
              </div>
              {t.isYou && (
                <div style={{ background: C.accentLight, borderRadius: 20, padding: '3px 10px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>You</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── EMPTY STATE (no subjects) ── */}
      {!loading && subjects.length === 0 && (
        <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 40 }}>🔬</span>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0, textAlign: 'center' }}>No subjects assigned yet</p>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, textAlign: 'center' }}>Add a subject you teach to get started.</p>
          <button
            onClick={openAddSubject}
            style={{ marginTop: 8, padding: '12px 24px', borderRadius: 12, background: C.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Subject
          </button>
        </div>
      )}

      {showAddSubject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 16 }}>Add Subject</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>SUBJECT NAME</div>
            <input
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSubject() }}
              placeholder="e.g. Mathematics"
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', marginBottom: 14, outline: 'none' }}
            />
            {allClasses.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>CLASS (OPTIONAL)</div>
                <select
                  value={newSubjectClassId}
                  onChange={e => setNewSubjectClassId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', marginBottom: 14, background: '#fff' }}>
                  <option value="">No class yet</option>
                  {allClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</option>
                  ))}
                </select>
              </>
            )}
            {addSubjectError && <div style={{ fontSize: 13, color: C.error, marginBottom: 12, marginTop: 4 }}>{addSubjectError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={closeAddSubject}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: C.textMuted }}>
                Cancel
              </button>
              <button
                onClick={addSubject}
                disabled={addingSubject}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: C.accent, fontSize: 14, fontWeight: 700, cursor: addingSubject ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff', opacity: addingSubject ? 0.7 : 1 }}>
                {addingSubject ? 'Saving…' : 'Add Subject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ margin: '14px 16px', padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: C.error, fontSize: 13 }}>
          {error}
        </div>
      )}

    </div>
  )
}

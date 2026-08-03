"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { nairobiWeekStart, nairobiDateAdd } from '@/lib/time'
import { loadTeacherTimetableForRange } from '@/lib/timetable/engine'

import {
  parseGeneratedLessonPlan,
  serializeLessonPlanBody,
} from '@/lib/teaching/lessonPlanCodec'
import type {
  LessonPlanSections,
} from '@/lib/teaching/lessonPlanCodec'

const C = {
  bg:          '#f8fafc',
  surface:     '#ffffff',
  surface2:    '#f1f5f9',
  border:      '#e2e8f0',
  text:        '#1e293b',
  text2:       '#64748b',
  text3:       '#94a3b8',
  indigo:      '#4f46e5',
  indigoLight: '#e0e7ff',
  teal:        '#0d9488',
  tealLight:   '#ccfbf1',
  dark:        '#0a1628',
  green:       '#16a34a',
  greenLight:  '#dcfce7',
  amber:       '#d97706',
  amberLight:  '#fef3c7',
  red:         '#e11d48',
  redLight:    '#ffe4e6',
  heroFrom:    '#3730a3',
  heroTo:      '#4338ca',
}

type GeneratedPlan = LessonPlanSections

interface TimetableSlot {
  id:              string
  day_of_week:     number
  start_time:      string
  end_time:        string
  room:            string | null
  effective_from:  string
  effective_until: string | null
}

const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }

function GeneratePageInner() {
  const params     = useSearchParams()
  const router     = useRouter()

  const classId    = params.get('classId')    ?? ''
  const subjectId  = params.get('subjectId')  ?? ''
  const grade      = params.get('grade')      ?? ''
  const subject    = params.get('subject')    ?? ''
  const strand     = params.get('strand')     ?? ''
  const subStrand  = params.get('subStrand')  ?? ''
  const topic      = params.get('topic')      ?? ''
  const week       = parseInt(params.get('week') ?? '1')
  const term       = parseInt(params.get('term') ?? '1')
  const curriculumId = params.get('curriculumId') || null
  const schemeId     = params.get('schemeId')     || null

  const [uid,         setUid]         = useState<string | null>(null)
  const [schoolId,    setSchoolId]    = useState<string | null>(null)
  const [className,   setClassName]   = useState('')
  const [generating,  setGenerating]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [generated,   setGenerated]   = useState<GeneratedPlan | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)
  const [credits,     setCredits]     = useState<{ balance: number; used: number } | null>(null)
  const [editSection, setEditSection] = useState<keyof GeneratedPlan | null>(null)
  const [editValue,   setEditValue]   = useState('')

  const [slots,        setSlots]        = useState<TimetableSlot[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUid(user.id)

      const [memberRes, teacherRes, profileRes, clRes] = await Promise.all([
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
        classId ? supabase.from('classes').select('name,stream').eq('id', classId).single() : Promise.resolve({ data: null }),
      ])
      setSchoolId(
        memberRes.data?.school_id ??
        teacherRes.data?.school_id ??
        profileRes.data?.school_id ??
        null
      )
      if (clRes.data) {
        const cl = clRes.data as { name: string; stream: string | null }
        setClassName(cl.stream ? `${cl.name} ${cl.stream}` : cl.name)
      }
    }
    boot()
  }, [classId])

  // Fetch the timetable occurrences this generated plan could be assigned to.
  // These are the only valid save targets — the plan is not written to
  // lesson_plans until the teacher picks one.
  // TBL-007F1: routed through the canonical engine's range loader, keyed to
  // the browsed week (activeOn=today would wrongly hide future-effective
  // slots when paging forward). Per the engine contract, the per-occurrence
  // effectiveness check below (slotsForSelectedWeek) remains the consumer's
  // responsibility. School identity is required by the engine; without it
  // there is no canonical timetable to read.
  useEffect(() => {
    if (!generated || !uid || !classId || !subjectId) return
    let cancelled = false
    async function loadSlots() {
      setSlots(null)
      setSlotsLoading(true)
      setSelectedSlotId(null)
      if (!schoolId) {
        setSlots([])
        setSlotsLoading(false)
        return
      }
      const weekStart = nairobiDateAdd(nairobiWeekStart(), weekOffset * 7)
      const weekEnd = nairobiDateAdd(weekStart, 6)
      try {
        const canonical = await loadTeacherTimetableForRange({
          teacherId: uid!,
          schoolId,
          rangeStart: weekStart,
          rangeEnd: weekEnd,
        })
        if (cancelled) return
        const matching = canonical.filter(
          (s) => s.class_id === classId && s.subject_id === subjectId
        )
        setError(null)
        setSlots(matching as TimetableSlot[])
        setSlotsLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('[SchemeGenerate] canonical timetable load failed:', err)
        setSlots([])
        setSlotsLoading(false)
        setError('Could not load matching timetable lessons.')
      }
    }
    loadSlots()
    return () => { cancelled = true }
  }, [generated, uid, schoolId, classId, subjectId, weekOffset])

  const selectedWeekStart = nairobiDateAdd(nairobiWeekStart(), weekOffset * 7)

  // A slot is a valid target for the selected week only if THIS slot's
  // specific weekday occurrence in that week falls inside its effective
  // range — not merely that the range overlaps the week somewhere. E.g. a
  // Monday slot effective from Wednesday must not show for that week's
  // Monday even though the week overall overlaps effective_from.
  const slotsForSelectedWeek = (slots ?? []).filter(s => {
    const occurrenceDate = nairobiDateAdd(selectedWeekStart, s.day_of_week - 1)
    return (
      s.effective_from <= occurrenceDate &&
      (s.effective_until === null || s.effective_until >= occurrenceDate)
    )
  })

  const selectedSlot = slotsForSelectedWeek.find(s => s.id === selectedSlotId) ?? null

  async function generate() {
    setGenerating(true)
    setError(null)
    setGenerated(null)

    const prompt = `You are an expert CBC (Competency Based Curriculum) lesson plan writer for Kenyan primary schools.

Generate a detailed, practical lesson plan for:
- Grade: ${grade}
- Subject: ${subject}
- Strand: ${strand}
- Sub-Strand: ${subStrand}
- Topic: ${topic}
- Term: ${term}, Week: ${week}
- Class: ${className}

Return ONLY a valid JSON object with exactly these keys:
{
  "objectives": "3-4 specific learning objectives starting with measurable action verbs",
  "resources": "Locally available materials and learning resources",
  "introduction": "5-7 minute practical and engaging introduction",
  "development": "20-25 minute step-by-step teaching and learner activities, including CBC competencies",
  "consolidation": "8-10 minute recap, learner practice and lesson closure",
  "assessmentHook": "Specific formative assessment using observation, oral questions or a written task",
  "homework": "Specific achievable homework with exact questions or instructions",
  "differentiation": "Separate support for struggling learners, on-track learners and advanced learners"
}

Be specific, practical and rooted in the Kenyan CBC context. Use simple English appropriate for the grade level.`

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/generate-lesson-plan', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()

      if (res.status === 402) {
        setError('insufficient_credits')
        return
      }
      if (data.error) throw new Error(data.error)

      const parsedPlan =
        parseGeneratedLessonPlan(data.plan)

      if (!parsedPlan) {
        throw new Error(
          'The AI returned an invalid lesson-plan format.'
        )
      }

      setGenerated(parsedPlan)
      if (data.credits) setCredits(data.credits)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function startEdit(section: keyof GeneratedPlan) {
    setEditSection(section)
    setEditValue(generated![section])
  }

  function saveEdit() {
    if (!editSection || !generated) return
    setGenerated({ ...generated, [editSection]: editValue })
    setEditSection(null)
  }

  async function savePlan() {
    if (!generated || !uid || !classId || !subjectId || !selectedSlot) return
    if (selectedSlot.day_of_week < 1 || selectedSlot.day_of_week > 5) {
      setError('This lesson slot is outside the supported Monday–Friday lesson-plan week.')
      return
    }
    setSaving(true)
    setError(null)

    const body =
      serializeLessonPlanBody(generated)

    const taughtDate = nairobiDateAdd(selectedWeekStart, selectedSlot.day_of_week - 1)

    const payload = {
      teacher_id:        uid,
      school_id:         schoolId,
      class_id:          classId,
      subject_id:        subjectId,
      title:              `${subject} — ${className} — ${topic}`,
      topic:              topic,
      body:               body,
      timetable_slot_id: selectedSlot.id,
      week_start:         selectedWeekStart,
      day_of_week:        selectedSlot.day_of_week,
      taught_date:        taughtDate,
      curriculum_id:      curriculumId,
      scheme_id:          schemeId,
      status:             'draft',
      generated_by:       'twin',
    }

    const { error: saveError } = await supabase.from('lesson_plans').insert(payload)
    if (saveError) {
      setError(saveError.message)
    } else {
      setSaved(true)
      setTimeout(() => router.push('/teacher/lessonplan'), 1500)
    }
    setSaving(false)
  }

  const SECTION_LABELS: Record<
    keyof GeneratedPlan,
    { label: string; icon: string }
  > = {
    objectives: {
      label: 'Learning Objectives',
      icon: '🎯',
    },
    resources: {
      label: 'Resources',
      icon: '🛠️',
    },
    introduction: {
      label: 'Introduction',
      icon: '🚀',
    },
    development: {
      label: 'Development',
      icon: '📚',
    },
    consolidation: {
      label: 'Consolidation',
      icon: '✅',
    },
    assessmentHook: {
      label: 'Assessment Hook',
      icon: '📊',
    },
    homework: {
      label: 'Homework',
      icon: '🏠',
    },
    differentiation: {
      label: 'Differentiation',
      icon: '⚡',
    },
  }

  if (!classId || !subjectId || !topic) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.text2 }}>
        Missing parameters. Go back and tap Generate from a strand.
      </div>
    )
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 40 }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* Hero */}
      <div style={{
        background:    `linear-gradient(135deg, ${C.heroFrom}, ${C.heroTo})`,
        padding:       '20px 16px 24px',
        marginBottom:  16,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border:     'none',
            color:      '#fff',
            borderRadius: 8,
            padding:    '6px 12px',
            fontSize:   12,
            fontWeight: 700,
            cursor:     'pointer',
            fontFamily: 'inherit',
            marginBottom: 12,
          }}
        >← Back</button>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
          Lesson Plan Generator
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          {strand}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
          {subject} · {className} · Term {term} Week {week}
        </div>
        {subStrand && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            {subStrand} · {topic}
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* Context card */}
        <div style={{
          background:   C.surface,
          borderRadius: 16,
          border:       `1px solid ${C.border}`,
          padding:      16,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Plan Details
          </div>
          {[
            { label: 'Grade',      value: grade },
            { label: 'Subject',    value: subject },
            { label: 'Strand',     value: strand },
            { label: 'Sub-Strand', value: subStrand },
            { label: 'Topic',      value: topic },
            { label: 'Term/Week',  value: `Term ${term}, Week ${week}` },
          ].map(r => r.value ? (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.text3 }}>{r.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{r.value}</span>
            </div>
          ) : null)}
        </div>

        {/* Generate button */}
        {!generated && !generating && (
          <button
            onClick={generate}
            style={{
              width:        '100%',
              padding:      '14px',
              background:   `linear-gradient(135deg, ${C.indigo}, #6366f1)`,
              color:        '#fff',
              border:       'none',
              borderRadius: 14,
              fontSize:     15,
              fontWeight:   800,
              cursor:       'pointer',
              fontFamily:   'inherit',
              marginBottom: 12,
            }}
          >
            ✨ Generate Lesson Plan
          </button>
        )}

        {/* Generating state */}
        {generating && (
          <div style={{
            background:   C.surface,
            borderRadius: 16,
            border:       `1px solid ${C.border}`,
            padding:      32,
            textAlign:    'center',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              Generating your lesson plan...
            </div>
            <div style={{ fontSize: 12, color: C.text3 }}>
              Creating CBC-aligned content for {grade} {subject}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background:   error === 'insufficient_credits' ? C.amberLight : C.redLight,
            border:       `1px solid ${error === 'insufficient_credits' ? '#fcd34d' : '#fda4af'}`,
            borderRadius: 12,
            padding:      16,
            marginBottom: 12,
          }}>
            {error === 'insufficient_credits' ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.amber, marginBottom: 4 }}>
                  🪙 No Vibe Credits
                </div>
                <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>
                  You need Vibe Credits to generate lesson plans. Buy credits to continue.
                </div>
                <a
                  href="/teacher/credits"
                  style={{
                    display: 'inline-block', padding: '9px 18px',
                    background: C.amber, color: '#fff',
                    borderRadius: 10, fontSize: 13, fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >Buy Vibe Credits →</a>
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>⚠️ {error}</div>
            )}
          </div>
        )}

        {/* Generated sections */}
        {generated && (
          <>
            {(Object.keys(SECTION_LABELS) as (keyof GeneratedPlan)[]).map(key => {
              const { label, icon } = SECTION_LABELS[key]
              const isEditing = editSection === key
              return (
                <div key={key} style={{
                  background:   C.surface,
                  borderRadius: 16,
                  border:       `1px solid ${C.border}`,
                  padding:      16,
                  marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                      {icon} {label}
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(key)}
                        style={{
                          fontSize: 11, fontWeight: 700, color: C.indigo,
                          background: C.indigoLight, border: 'none',
                          borderRadius: 6, padding: '3px 9px',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >Edit</button>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        style={{
                          width: '100%', minHeight: 100,
                          border: `1.5px solid ${C.indigo}`,
                          borderRadius: 10, padding: 10,
                          fontSize: 13, color: C.text,
                          fontFamily: 'inherit', lineHeight: 1.6,
                          resize: 'vertical', outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={saveEdit}
                          style={{
                            flex: 1, padding: '8px', background: C.teal,
                            color: '#fff', border: 'none', borderRadius: 8,
                            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >Save</button>
                        <button
                          onClick={() => setEditSection(null)}
                          style={{
                            flex: 1, padding: '8px', background: C.surface2,
                            color: C.text2, border: `1px solid ${C.border}`,
                            borderRadius: 8, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {generated[key]}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Credit usage */}
            {credits && (
              <div style={{
                background: C.tealLight, border: `1px solid #5eead4`,
                borderRadius: 10, padding: '10px 14px',
                marginBottom: 10, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: C.teal, fontWeight: 700 }}>
                  🪙 {credits.used} credit used
                </span>
                <span style={{ fontSize: 12, color: C.text2 }}>
                  Balance: <strong>{credits.balance}</strong> credits remaining
                </span>
              </div>
            )}

            {/* Assign to lesson — bind this draft to a real timetable occurrence */}
            <div style={{
              background:   C.surface,
              borderRadius: 16,
              border:       `1px solid ${C.border}`,
              padding:      16,
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 10 }}>
                📌 Assign to Lesson
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  onClick={() => { setWeekOffset(w => w - 1); setSelectedSlotId(null) }}
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
                >‹</button>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                  Week of {selectedWeekStart}{weekOffset === 0 ? ' (this week)' : ''}
                </span>
                <button
                  onClick={() => { setWeekOffset(w => w + 1); setSelectedSlotId(null) }}
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
                >›</button>
              </div>

              {slotsLoading && (
                <div style={{ fontSize: 12, color: C.text3 }}>Loading timetable…</div>
              )}

              {!slotsLoading && slotsForSelectedWeek.length === 0 && (
                <div style={{
                  background: C.amberLight, border: '1px solid #fcd34d',
                  borderRadius: 10, padding: 12,
                }}>
                  <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>
                    No timetable lesson exists for this class and subject in this week. Add the lesson to your timetable before creating a lesson plan.
                  </div>
                  <a
                    href="/teacher/timetable"
                    style={{ fontSize: 12, fontWeight: 700, color: C.indigo, textDecoration: 'none' }}
                  >Go to Timetable →</a>
                </div>
              )}

              {!slotsLoading && slotsForSelectedWeek.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {slotsForSelectedWeek.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSlotId(s.id)}
                      style={{
                        textAlign: 'left', padding: '10px 12px',
                        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1.5px solid ${selectedSlotId === s.id ? C.indigo : C.border}`,
                        background: selectedSlotId === s.id ? C.indigoLight : C.surface,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                        {DAY_NAMES[s.day_of_week] ?? s.day_of_week} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </span>
                      {s.room && <span style={{ fontSize: 11, color: C.text3 }}> · {s.room}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={generate}
                disabled={generating}
                style={{
                  flex: 1, padding: '12px',
                  background: C.surface, color: C.indigo,
                  border: `1.5px solid ${C.indigo}`,
                  borderRadius: 12, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >🔄 Regenerate</button>
              <button
                onClick={savePlan}
                disabled={saving || saved || !selectedSlot}
                style={{
                  flex: 2, padding: '12px',
                  background: saved ? C.green : `linear-gradient(135deg, ${C.teal}, #0f766e)`,
                  color: '#fff', border: 'none',
                  borderRadius: 12, fontSize: 13, fontWeight: 800,
                  cursor: (saving || saved || !selectedSlot) ? 'not-allowed' : 'pointer',
                  opacity: !selectedSlot && !saved ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {saved ? '✅ Saved! Redirecting...' : saving ? 'Saving...' : !selectedSlot ? 'Select a lesson slot above' : '💾 Save to Lesson Plans'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function GenerateLessonPlanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Loading...</div>}>
      <GeneratePageInner />
    </Suspense>
  )
}

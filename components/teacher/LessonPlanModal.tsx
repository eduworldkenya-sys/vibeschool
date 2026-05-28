'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'
import type { TimetableSlot } from '@/lib/types'

interface PlanSections {
  objectives:      string
  resources:       string
  introduction:    string
  development:     string
  consolidation:   string
  assessmentHook:  string
  homework:        string
  differentiation: string
}

interface Props {
  slot:    TimetableSlot
  onClose: () => void
}

interface Context {
  teacherName:    string
  schoolName:     string
  schoolId:       string | null
  studentCount:   number
  previousTopics: string[]
}

type Phase = 'loading' | 'form' | 'generating' | 'view' | 'edit' | 'content' | 'publish'
type PlanStatus = 'draft' | 'published' | 'shared'

const SECTION_LABELS: { key: keyof PlanSections; label: string; icon: string }[] = [
  { key: 'objectives',      label: 'Learning Objectives',      icon: '🎯' },
  { key: 'resources',       label: 'Resources Needed',         icon: '🗂️' },
  { key: 'introduction',    label: 'Introduction (5-7 min)',   icon: '🔥' },
  { key: 'development',     label: 'Development (20-25 min)',  icon: '📖' },
  { key: 'consolidation',   label: 'Consolidation (8-10 min)', icon: '✅' },
  { key: 'assessmentHook',  label: 'Assessment Hook',          icon: '📊' },
  { key: 'homework',        label: 'Homework',                 icon: '🏠' },
  { key: 'differentiation', label: 'Differentiation',          icon: '⚡' },
]

const EMPTY: PlanSections = {
  objectives: '', resources: '', introduction: '', development: '',
  consolidation: '', assessmentHook: '', homework: '', differentiation: '',
}

function parsePlan(raw: string): PlanSections {
  const get = (tag: string) => {
    const m = raw.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'))
    return m ? m[1].trim() : ''
  }
  return {
    objectives:      get('objectives'),
    resources:       get('resources'),
    introduction:    get('introduction'),
    development:     get('development'),
    consolidation:   get('consolidation'),
    assessmentHook:  get('assessmentHook'),
    homework:        get('homework'),
    differentiation: get('differentiation'),
  }
}

function getTag(raw: string, tag: string): string {
  const m = raw.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'))
  return m ? m[1].trim() : ''
}

function Skeleton({ h = 48 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 10,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function StatusPill({ status }: { status: PlanStatus }) {
  const map = {
    draft:     { bg: '#f3f4f6', color: '#6b7280', label: 'Draft'     },
    published: { bg: '#d1fae5', color: '#065f46', label: 'Published' },
    shared:    { bg: '#dbeafe', color: '#1e40af', label: 'Shared'    },
  }
  const s = map[status]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
      borderRadius: 20, padding: '3px 10px',
    }}>{s.label}</span>
  )
}

export default function LessonPlanModal({ slot, onClose }: Props) {
  const [phase,         setPhase]         = useState<Phase>('loading')
  const [sections,      setSections]      = useState<PlanSections>(EMPTY)
  const [draft,         setDraft]         = useState<PlanSections>(EMPTY)
  const [planId,        setPlanId]        = useState<string | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [publishing,    setPublishing]    = useState(false)
  const [error,         setError]         = useState('')
  const [ctx,           setCtx]           = useState<Context>({ teacherName: '', schoolName: '', schoolId: null, studentCount: 0, previousTopics: [] })
  const [topic,         setTopic]         = useState('')
  const [focus,         setFocus]         = useState('')
  const [studentNotes,  setStudentNotes]  = useState('')
  const [parentMessage, setParentMessage] = useState('')
  const [planStatus,    setPlanStatus]    = useState<PlanStatus>('draft')
  const [notesShared,   setNotesShared]   = useState(false)
  const [parentsShared, setParentsShared] = useState(false)

  function getWeekStart() {
    const d    = new Date()
    const dow  = d.getDay()
    const diff = d.getDate() - dow + (dow === 0 ? -6 : 1)
    return new Date(new Date(d).setDate(diff)).toISOString().split('T')[0]
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const weekStart = getWeekStart()
      const dow       = new Date().getDay()

      const [profileRes, existingRes] = await Promise.all([
        supabase.from('profiles').select('full_name, school_id').eq('id', user.id).single(),
        supabase.from('lesson_plans')
          .select('id, title, body, topic, status')
          .eq('teacher_id',  user.id)
          .eq('class_id',    slot.class_id)
          .eq('subject_id',  slot.subject_id)
          .eq('timetable_slot_id', slot.id)
          .eq('week_start',  weekStart)
          .maybeSingle(),
      ])

      const schoolId = profileRes.data?.school_id ?? null

      const [schoolRes, studentRes, prevRes] = await Promise.all([
        schoolId
          ? supabase.from('schools').select('name').eq('id', schoolId).single()
          : Promise.resolve({ data: null }),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', slot.class_id),
        supabase.from('lesson_plans')
          .select('topic')
          .eq('teacher_id', user.id)
          .eq('class_id',   slot.class_id)
          .eq('subject_id', slot.subject_id)
          .not('topic', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setCtx({
        teacherName:    profileRes.data?.full_name ?? 'Teacher',
        schoolName:     (schoolRes as { data: { name: string } | null }).data?.name ?? 'the school',
        schoolId,
        studentCount:   studentRes.count ?? 0,
        previousTopics: (prevRes.data ?? []).map((r: { topic: string }) => r.topic).filter(Boolean),
      })

      if (existingRes.data?.body) {
        const has = existingRes.data.body.includes('<objectives>')
        setSections(has ? parsePlan(existingRes.data.body) : { ...EMPTY, development: existingRes.data.body })
        if (existingRes.data.topic)  setTopic(existingRes.data.topic)
        if (existingRes.data.status) setPlanStatus(existingRes.data.status as PlanStatus)
        setPlanId(existingRes.data.id)

        const sn = getTag(existingRes.data.body, 'student_notes')
        const pm = getTag(existingRes.data.body, 'parent_message')
        if (sn) setStudentNotes(sn)
        if (pm) setParentMessage(pm)

        setPhase('view')
      } else {
        setPhase('form')
      }
    }
    load()
  }, [slot.id, slot.class_id, slot.subject_id])

  async function generate() {
    if (!topic.trim()) { setError('Please enter a topic first.'); return }
    setPhase('generating')
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const duration = slot.start && slot.end
        ? (() => {
            const [sh, sm] = slot.start.split(':').map(Number)
            const [eh, em] = slot.end.split(':').map(Number)
            return ((eh * 60 + em) - (sh * 60 + sm)) + ' minutes'
          })()
        : '40 minutes'

      const sessionRes = await supabase.auth.getSession()
      const token      = sessionRes.data.session?.access_token ?? ''

      const res = await fetch(
        process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/generate-lesson-plan',
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({
            teacher:        ctx.teacherName,
            school:         ctx.schoolName,
            subject:        slot.subject,
            className:      slot.class,
            studentCount:   ctx.studentCount,
            duration,
            topic:          topic.trim(),
            focus:          focus.trim() || undefined,
            previousTopics: ctx.previousTopics,
          }),
        }
      )

      const json = await res.json()
      if (!json.plan) { setError('Generation failed. Try again.'); setPhase('form'); return }

      const parsed = parsePlan(json.plan)
      setSections(parsed)
      setStudentNotes(getTag(json.plan, 'student_notes'))
      setParentMessage(getTag(json.plan, 'parent_message'))

      const weekStart      = getWeekStart()
      const dow            = new Date().getDay()
      const { data: prof } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()

      const payload = {
        teacher_id:   user.id,
        school_id:    prof?.school_id ?? null,
        class_id:     slot.class_id,
        subject_id:   slot.subject_id,
        week_start:   weekStart,
        day_of_week:  dow,
        timetable_slot_id: slot.id,
        topic:        topic.trim(),
        title:        slot.subject + ' — ' + slot.class + ' — ' + topic.trim(),
        body:         json.plan,
        generated_by: 'twin',
        status:       'draft',
      }

      if (planId) {
        await supabase.from('lesson_plans').update(payload).eq('id', planId)
      } else {
        const { data: ins } = await supabase.from('lesson_plans').insert(payload).select('id').single()
        if (ins?.id) setPlanId(ins.id)
      }

      setPlanStatus('draft')
      setPhase('view')
    } catch {
      setError('Something went wrong. Check your connection.')
      setPhase('form')
    }
  }

  async function saveEdit() {
    setSaving(true)
    const newBody = SECTION_LABELS
      .map(s => '<' + s.key + '>\n' + draft[s.key] + '\n</' + s.key + '>')
      .join('\n\n')
    if (planId) {
      await supabase.from('lesson_plans')
        .update({ body: newBody, title: slot.subject + ' — ' + slot.class + ' — ' + topic })
        .eq('id', planId)
    }
    setSections(draft)
    setSaving(false)
    setPhase('view')
  }

  async function shareNotes() {
    if (!planId) return
    setPublishing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()

      await supabase.from('lesson_content').upsert({
        lesson_plan_id: planId,
        teacher_id:     user.id,
        school_id:      prof?.school_id ?? null,
        content_type:   'notes',
        student_copy:   studentNotes,
        teacher_copy:   sections.objectives + '\n\n' + sections.development,
        generated_by:   'ai',
      }, { onConflict: 'lesson_plan_id,content_type' })

      await supabase.from('lesson_plans')
        .update({ status: 'published' })
        .eq('id', planId)

      setPlanStatus('published')
      setNotesShared(true)
    } catch {
      setError('Failed to share notes. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  async function shareToParents() {
    if (!planId) return
    setPublishing(true)
    try {
      await supabase.from('lesson_plans')
        .update({ status: 'shared' })
        .eq('id', planId)

      setPlanStatus('shared')
      setParentsShared(true)
    } catch {
      setError('Failed to update status. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes twinPulse { 0%,80%,100%{transform:scale(0.7);opacity:0.5} 40%{transform:scale(1);opacity:1} }
      `}</style>

      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.45)',
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 910,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '14px auto 0' }} />

        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid ' + C.border,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>{slot.subject}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {slot.class}{slot.room ? ' · ' + slot.room : ''}{slot.start ? ' · ' + slot.start + '–' + slot.end : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {phase !== 'loading' && phase !== 'form' && phase !== 'generating' && (
              <StatusPill status={planStatus} />
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20,
              color: C.textMuted, cursor: 'pointer', padding: '4px 8px',
            }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>

          {phase === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[80, 56, 120, 200, 80].map((h, i) => <Skeleton key={i} h={h} />)}
            </div>
          )}

          {phase === 'form' && (
            <div>
              {ctx.studentCount > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {[ctx.teacherName, ctx.studentCount + ' learners', ctx.schoolName].map(b => (
                    <span key={String(b)} style={{
                      fontSize: 11, fontWeight: 700,
                      background: C.accentLight, color: '#065f46',
                      borderRadius: 20, padding: '3px 10px',
                    }}>{b}</span>
                  ))}
                </div>
              )}

              {ctx.previousTopics.length > 0 && (
                <div style={{
                  background: '#f0fdf4', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 20,
                  fontSize: 12, color: '#065f46',
                }}>
                  <span style={{ fontWeight: 700 }}>Previously covered: </span>
                  {ctx.previousTopics.join(' → ')}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  fontSize: 11, fontWeight: 800, color: C.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase',
                  display: 'block', marginBottom: 6,
                }}>Topic *</label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Fractions on a Number Line"
                  style={{
                    width: '100%', padding: '12px 14px',
                    borderRadius: 10, border: '1.5px solid ' + (error && !topic.trim() ? C.error : C.border),
                    fontSize: 14, color: C.textPrimary,
                    fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{
                  fontSize: 11, fontWeight: 800, color: C.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase',
                  display: 'block', marginBottom: 6,
                }}>Specific focus <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input
                  value={focus}
                  onChange={e => setFocus(e.target.value)}
                  placeholder="e.g. Struggling learners need visual aids"
                  style={{
                    width: '100%', padding: '12px 14px',
                    borderRadius: 10, border: '1.5px solid ' + C.border,
                    fontSize: 14, color: C.textPrimary,
                    fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && <p style={{ fontSize: 12, color: C.error, marginBottom: 12 }}>{error}</p>}

              <button
                onClick={generate}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: 12, border: 'none',
                  background: C.accent, color: '#fff',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                <span>✦</span> Generate Lesson Plan
              </button>
            </div>
          )}

          {phase === 'generating' && (
            <div style={{
              padding: '40px 0',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(16,185,129,0.1)',
                border: '1.5px solid rgba(16,185,129,0.35)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 22, color: C.accent,
              }}>✦</div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, margin: 0 }}>
                  Building your plan…
                </p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                  {slot.subject} · {slot.class} · {topic}
                </p>
                {ctx.previousTopics.length > 0 && (
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    Building on {ctx.previousTopics.length} previous lesson{ctx.previousTopics.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 0.2, 0.4].map(d => (
                  <span key={d} style={{
                    display: 'inline-block', width: 8, height: 8,
                    borderRadius: '50%', background: C.accent,
                    animation: 'twinPulse 1.4s ease-in-out ' + d + 's infinite',
                  }} />
                ))}
              </div>
            </div>
          )}

          {phase === 'view' && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 16, fontSize: 12, color: C.textMuted,
              }}>
                <span style={{ color: C.accent }}>✦</span>
                <span>Generated by Twin · CBC aligned</span>
                {topic && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                    background: C.accentLight, color: '#065f46',
                    borderRadius: 20, padding: '2px 10px',
                  }}>{topic}</span>
                )}
              </div>

              {SECTION_LABELS.map(s => sections[s.key] ? (
                <div key={s.key} style={{
                  marginBottom: 20,
                  background: '#fafafa',
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '1px solid ' + C.border,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: C.textMuted,
                    letterSpacing: 1, textTransform: 'uppercase',
                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{s.icon}</span>{s.label}
                  </div>
                  <div style={{
                    fontSize: 13, color: C.textPrimary,
                    lineHeight: 1.75, whiteSpace: 'pre-wrap',
                  }}>{sections[s.key]}</div>
                </div>
              ) : null)}

              <div style={{
                display: 'flex', gap: 10,
                paddingTop: 16, borderTop: '1px solid ' + C.border,
                marginTop: 8,
              }}>
                <button onClick={() => { setDraft({ ...sections }); setPhase('edit') }} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1.5px solid ' + C.border, background: '#fff',
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Edit</button>
                <button onClick={() => setPhase('form')} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1.5px solid ' + C.border, background: '#fff',
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Regenerate</button>
                <button onClick={() => setPhase('content')} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: 'none', background: C.accent,
                  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Next →</button>
              </div>
            </div>
          )}

          {phase === 'edit' && (
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
                Edit any section then save.
              </div>
              {SECTION_LABELS.map(s => (
                <div key={s.key} style={{ marginBottom: 16 }}>
                  <label style={{
                    fontSize: 10, fontWeight: 800, color: C.textMuted,
                    letterSpacing: 1, textTransform: 'uppercase',
                    display: 'block', marginBottom: 5,
                  }}>{s.icon} {s.label}</label>
                  <textarea
                    value={draft[s.key]}
                    onChange={e => setDraft(d => ({ ...d, [s.key]: e.target.value }))}
                    rows={5}
                    style={{
                      width: '100%', padding: '10px 12px',
                      borderRadius: 10, border: '1.5px solid ' + C.border,
                      fontSize: 13, color: C.textPrimary,
                      fontFamily: 'inherit', lineHeight: 1.6,
                      resize: 'vertical', outline: 'none',
                      background: '#f9fafb', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
              <div style={{
                display: 'flex', gap: 10,
                paddingTop: 8, borderTop: '1px solid ' + C.border,
              }}>
                <button onClick={() => setPhase('view')} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1.5px solid ' + C.border, background: '#fff',
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Cancel</button>
                <button onClick={saveEdit} disabled={saving} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: 'none', background: C.accent,
                  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
                }}>
                  {saving ? 'Saving…' : 'Save Plan'}
                </button>
              </div>
            </div>
          )}

          {phase === 'content' && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 20, fontSize: 12, color: C.textMuted,
              }}>
                <span style={{ color: C.accent }}>✦</span>
                <span>Review AI-generated content before publishing</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: 10, fontWeight: 800, color: C.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase',
                  display: 'block', marginBottom: 8,
                }}>📚 Student Notes</label>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                  What students and parents will see in the Lessons tab
                </div>
                <textarea
                  value={studentNotes}
                  onChange={e => setStudentNotes(e.target.value)}
                  rows={6}
                  style={{
                    width: '100%', padding: '12px 14px',
                    borderRadius: 10, border: '1.5px solid ' + C.border,
                    fontSize: 13, color: C.textPrimary,
                    fontFamily: 'inherit', lineHeight: 1.7,
                    resize: 'vertical', outline: 'none',
                    background: '#f9fafb', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{
                  fontSize: 10, fontWeight: 800, color: C.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase',
                  display: 'block', marginBottom: 8,
                }}>👨‍👩‍👧 Parent Message</label>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                  Ready-to-send message for parents
                </div>
                <textarea
                  value={parentMessage}
                  onChange={e => setParentMessage(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%', padding: '12px 14px',
                    borderRadius: 10, border: '1.5px solid ' + C.border,
                    fontSize: 13, color: C.textPrimary,
                    fontFamily: 'inherit', lineHeight: 1.7,
                    resize: 'vertical', outline: 'none',
                    background: '#f9fafb', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setPhase('view')} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1.5px solid ' + C.border, background: '#fff',
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>← Back</button>
                <button onClick={() => setPhase('publish')} style={{
                  flex: 2, padding: '12px', borderRadius: 10,
                  border: 'none', background: C.accent,
                  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Next: Publish →</button>
              </div>
            </div>
          )}

          {phase === 'publish' && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 20, fontSize: 12, color: C.textMuted,
              }}>
                <span style={{ color: C.accent }}>✦</span>
                <span>Choose what to send out</span>
              </div>

              {error && (
                <p style={{ fontSize: 12, color: C.error, marginBottom: 12 }}>{error}</p>
              )}

              <button
                onClick={shareNotes}
                disabled={publishing || notesShared}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: 12, border: 'none',
                  background: notesShared ? '#d1fae5' : C.accent,
                  color: notesShared ? '#065f46' : '#fff',
                  fontSize: 14, fontWeight: 800, cursor: publishing || notesShared ? 'default' : 'pointer',
                  marginBottom: 10, opacity: publishing ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                {notesShared ? '✓ Notes shared to students' : '📚 Share Notes to Students'}
              </button>

              <button
                onClick={shareToParents}
                disabled={publishing || parentsShared}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: 12, border: '1.5px solid #1e40af',
                  background: parentsShared ? '#dbeafe' : '#eff6ff',
                  color: '#1e40af',
                  fontSize: 14, fontWeight: 800, cursor: publishing || parentsShared ? 'default' : 'pointer',
                  marginBottom: 10, opacity: publishing ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                {parentsShared ? '✓ Parent message queued' : '👨‍👩‍👧 Share to Parents'}
              </button>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={() => setPhase('content')} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1.5px solid ' + C.border, background: '#fff',
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>← Back</button>
                <button onClick={onClose} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: 'none', background: '#1e1b4b',
                  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>✓ Done</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase, SUPABASE_URL } from '@/lib/supabase'
import { resolveGlobalSubjectId } from '@/lib/curriculum/globalSubjects'
import { C } from '@/components/teacher/ui'
import { nairobiDateStr } from '@/lib/time'
import { getActiveTerm, currentWeekOf } from '@/lib/academicTerm'
import type { TimetableSlot, CurriculumSuggestion } from '@/lib/types'
import { refreshPulse } from "@/lib/pulse/refresh";

// ── Types ────────────────────────────────────────────────────────────────────

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

interface Student {
  id:   string
  name: string
}

interface Ctx {
  teacherName:    string
  schoolName:     string
  schoolId:       string
  studentCount:   number
  previousTopics: string[]
  students:       Student[]
}

interface Props {
  slot:       TimetableSlot
  weekStart:  string
  taughtDate: string
  onClose:    () => void
}

type Phase  = 'loading' | 'form' | 'generating' | 'view' | 'edit'
type Status = 'draft' | 'published' | 'shared_to_parents'
type Busy   = 'idle' | 'publishing' | 'sharing' | 'saving' | 'generating'

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY: PlanSections = {
  objectives: '', resources: '', introduction: '', development: '',
  consolidation: '', assessmentHook: '', homework: '', differentiation: '',
}

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

const STATUS_BADGE = {
  draft:             { label: 'Draft',             bg: '#f3f4f6', color: '#6b7280' },
  published:         { label: 'Published',         bg: '#d1fae5', color: '#065f46' },
  shared_to_parents: { label: 'Shared to Parents', bg: '#dbeafe', color: '#1e40af' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// G3: returns null on bad parse — caller must check
function parsePlan(raw: string): PlanSections | null {
  const result = { ...EMPTY }
  let filled   = 0
  for (const { key } of SECTION_LABELS) {
    const m = raw.match(new RegExp('<' + key + '>([\\s\\S]*?)</' + key + '>'))
    if (m) { result[key] = m[1].trim(); filled++ }
  }
  return filled >= 3 ? result : null
}

function calcDuration(start?: string, end?: string): string {
  if (!start || !end) return '40 minutes'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return ((eh * 60 + em) - (sh * 60 + sm)) + ' minutes'
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

// ── Component ────────────────────────────────────────────────────────────────

export default function LessonPlanModal({ slot, weekStart, taughtDate, onClose }: Props) {
  const [phase,    setPhase]    = useState<Phase>('loading')
  const [sections, setSections] = useState<PlanSections>(EMPTY)
  const [draft,    setDraft]    = useState<PlanSections>(EMPTY)
  const [status,   setStatus]   = useState<Status>('draft')
  const [busy,     setBusy]     = useState<Busy>('idle')
  const [toast,    setToast]    = useState('')
  const [error,    setError]    = useState('')
  const [topic,    setTopic]    = useState('')
  const [focus,    setFocus]    = useState('')
  const [suggestion,      setSuggestion]      = useState<CurriculumSuggestion | null>(null)
  const [usedSuggestion,  setUsedSuggestion]  = useState(false)
  const [ctx,      setCtx]      = useState<Ctx>({
    teacherName: '', schoolName: '', schoolId: '',
    studentCount: 0, previousTopics: [], students: [],
  })

  // G4: ref mirrors state so async actions always read current value
  const planIdRef = useRef<string | null>(null)
  const [planId, _setPlanId] = useState<string | null>(null)
  function setPlanId(id: string) { planIdRef.current = id; _setPlanId(id) }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // G1: auth guard — every action calls this first
  async function getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (session == null || session.access_token == null) {
      setError('Session expired. Please refresh.')
      return null
    }
    return session.access_token
  }

  // G8: context load separated from plan load
  async function loadContext(userId: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, school_id')
      .eq('id', userId)
      .single()

    const schoolId = prof?.school_id ?? null

    const [schoolRes, studentRes, prevRes, classRes] = await Promise.all([
      schoolId
        ? supabase.from('schools').select('name').eq('id', schoolId).single()
        : Promise.resolve({ data: null }),
      // G6: always select id explicitly — never assume id === auth id
      supabase.from('students')
        .select('id, name, id')
        .eq('class_id', slot.class_id),
      supabase.from('lesson_plans')
        .select('topic')
        .eq('teacher_id', userId)
        .eq('class_id',   slot.class_id)
        .eq('subject_id', slot.subject_id)
        .not('topic', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('classes').select('name').eq('id', slot.class_id).single(),
    ])

    setCtx({
      teacherName:    prof?.full_name ?? 'Teacher',
      schoolName:     (schoolRes as any).data?.name ?? 'the school',
      schoolId:       schoolId ?? '',
      studentCount:   studentRes.data?.length ?? 0,
      previousTopics: (prevRes.data ?? []).map((r: any) => r.topic).filter(Boolean),
      students:       (studentRes.data ?? []) as Student[],
    })

    // Connect to the Scheme of Work: look up what the KICD curriculum
    // says should be taught this week for this exact grade/subject, so
    // the lesson plan isn't just a freeform topic disconnected from
    // everything else in the app.
    const grade = (classRes as any).data?.name ?? null
    if (schoolId && grade) {
      try {
        const term = await getActiveTerm(schoolId)
        if (term) {
          const week = currentWeekOf(term)

          // 1) The teacher's own Scheme of Work is the source of truth
          //    for what is taught this week — suggest from it first.
          const { data: schemeRows } = await supabase
            .from('scheme_of_work')
            .select('id, curriculum_id, strand, sub_strand, topic')
            .eq('teacher_id',       userId)
            .eq('class_id',         slot.class_id)
            .eq('subject_id',       slot.subject_id)
            .eq('academic_term_id', term.id)
            .eq('school_id',        schoolId)
            .eq('week',             week)
            .limit(1)

          const schemeRow = schemeRows?.[0]
          if (schemeRow) {
            setSuggestion({
              id:        schemeRow.curriculum_id ?? null,
              strand:    schemeRow.strand ?? '',
              subStrand: schemeRow.sub_strand ?? '',
              topic:     schemeRow.topic,
              term:      term.term,
              week,
              strandId:  null,
              schemeId:  schemeRow.id,
            })
          } else {
            // 2) Fallback: national curriculum guess — teacher has not
            //    committed a scheme for this term yet.
            const { data: currRows } = await supabase
              .from('curriculum')
              .select('id, strand, sub_strand, topic')
              .eq('grade',   grade)
              .eq('subject', slot.subject)
              .eq('term',    term.term)
              .eq('week',    week)
              .limit(1)

            const currRow = currRows?.[0]
            if (currRow) {
              let strandId: string | null = null
              try {
                const globalSubjectId = await resolveGlobalSubjectId(slot.subject)
                const strandRows = globalSubjectId
                  ? (await supabase
                      .from('cbc_strands')
                      .select('id, name')
                      .eq('subject_id', globalSubjectId)
                      .ilike('grade', grade)).data
                  : []
                strandId = strandRows?.find(s => s.name === currRow.strand)?.id ?? null
              } catch {
                // non-fatal — suggestion still useful even without a strand_id
              }

              setSuggestion({
                id:        currRow.id,
                strand:    currRow.strand,
                subStrand: currRow.sub_strand,
                topic:     currRow.topic,
                term:      term.term,
                week,
                strandId,
                schemeId:  null,
              })
            }
          }
        }
      } catch {
        // non-fatal — falls back to plain freeform topic entry
      }
    }
  }

  async function loadExistingPlan(userId: string) {
    // Fix 14C: lesson_plans' occurrence identity is (timetable_slot_id,
    // taught_date) — the same pair Fix 14B hardened as a UNIQUE constraint.
    // Load by that exact pair, not by day_of_week/week_start, which do not
    // uniquely identify an occurrence on their own.
    if (!taughtDate) {
      throw new Error(
        'LessonPlanModal: taughtDate is missing — cannot resolve occurrence.'
      )
    }

    const { data, error } = await supabase
      .from('lesson_plans')
      .select('id, title, body, topic, status, curriculum_id, strand_id, scheme_id')
      .eq('teacher_id', userId)
      .eq('timetable_slot_id', slot.id)
      .eq('taught_date', taughtDate)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  }

  useEffect(() => {
    async function boot() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user == null) { setError('Not signed in.'); setPhase('form'); return }

        const [, existing] = await Promise.all([
          loadContext(user.id),
          loadExistingPlan(user.id),
        ])

        if (existing != null && existing.body) {
          // G3: check null before trusting parse
          const parsed = parsePlan(existing.body)
          setSections(parsed ?? { ...EMPTY, development: existing.body })
          if (existing.topic)  setTopic(existing.topic)
          if (existing.status) setStatus(existing.status as Status)
          setPlanId(existing.id)

          // Carry the curriculum identity this plan was actually generated
          // against — not loadContext's guess for the CURRENT week, which
          // would be wrong if this plan belongs to a past or future week.
          if (existing.curriculum_id) {
            try {
              const { data: currRow } = await supabase
                .from('curriculum')
                .select('id, strand, sub_strand, topic, week, term')
                .eq('id', existing.curriculum_id)
                .single()
              if (currRow) {
                setSuggestion({
                  id:        currRow.id,
                  strand:    currRow.strand,
                  subStrand: currRow.sub_strand,
                  topic:     currRow.topic,
                  term:      currRow.term,
                  week:      currRow.week,
                  strandId:  existing.strand_id ?? null,
                  schemeId:  existing.scheme_id ?? null,
                })
                setUsedSuggestion(true)
              }
            } catch {
              // non-fatal — plan still opens fine without the curriculum badge
            }
          }

          setPhase('view')
        } else {
          setPhase('form')
        }
      } catch (err) {
        // G7: no silent swallows
        console.error('[LessonPlanModal] boot', err)
        setError('Failed to load. Please close and retry.')
        setPhase('form')
      }
    }
    boot()
  }, [slot.id, slot.class_id, slot.subject_id])

  async function generate() {
    if (topic.trim() === '') { setError('Please enter a topic first.'); return }
    // G1
    const token = await getToken()
    if (token == null) return

    setBusy('generating')
    setPhase('generating')
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user == null) return

      const res = await fetch(
        SUPABASE_URL + '/functions/v1/generate-lesson-plan',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            teacher:        ctx.teacherName,
            school:         ctx.schoolName,
            subject:        slot.subject,
            className:      slot.class,
            studentCount:   ctx.studentCount,
            duration:       calcDuration(slot.start, slot.end),
            topic:          topic.trim(),
            focus:          focus.trim() || undefined,
            previousTopics: ctx.previousTopics,
            curriculumStrand:    usedSuggestion ? suggestion?.strand    : undefined,
            curriculumSubStrand: usedSuggestion ? suggestion?.subStrand : undefined,
          }),
        }
      )

      const json = await res.json()
      if (!res.ok || !json.plan) {
        const detail = json.error ?? 'Generation failed. Try again.'
        setError(detail)
        setPhase('form')
        setBusy('idle')
        return
      }
      // G3: null check on parse
      const parsed = parsePlan(json.plan)
      if (parsed == null) {
        setError('Gemini returned an unreadable plan. Try again.')
        setPhase('form')
        setBusy('idle')
        return
      }

      setSections(parsed)

      // Fix 14C: week_start / day_of_week / taught_date come from the exact
      // occurrence the teacher browsed to (props) — never from the old
      // server-clock lookup, which always resolved to "now" regardless of
      // which week was on screen.
      if (slot.day_of_week == null) {
        throw new Error('LessonPlanModal: slot.day_of_week is missing — refusing to save to an unknown occurrence.')
      }
      if (!taughtDate) {
        throw new Error('LessonPlanModal: taughtDate is missing — refusing to save to an unknown occurrence.')
      }
      const { data: prof } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()

      const payload = {
        teacher_id:         user.id,
        school_id:          prof?.school_id ?? null,
        class_id:           slot.class_id,
        subject_id:         slot.subject_id,
        timetable_slot_id:  slot.id,
        week_start:         weekStart,
        day_of_week:        slot.day_of_week,
        taught_date:        taughtDate,
        topic:              topic.trim(),
        title:              slot.subject + ' — ' + slot.class + ' — ' + topic.trim(),
        body:               json.plan,
        status:             'draft',
        generated_by:       'twin',
        curriculum_id:      usedSuggestion ? suggestion?.id ?? null : null,
        strand_id:          usedSuggestion ? suggestion?.strandId ?? null : null,
        scheme_id:          usedSuggestion ? suggestion?.schemeId ?? null : null,
      }

      // G4: read ref not state
      const currentId = planIdRef.current
      if (currentId != null) {
        await supabase.from('lesson_plans').update(payload).eq('id', currentId)
      } else {
        const { data: ins } = await supabase.from('lesson_plans').insert(payload).select('id').single()
        if (ins?.id) setPlanId(ins.id)
      }

      // Close the loop with Scheme of Work: if this plan came from a
      // scheme item, mark that item as "teaching" — the Scheme page
      // lights up automatically when a lesson is planned from Timetable.
      if (usedSuggestion && suggestion?.schemeId && ctx.schoolId) {
        try {
          await supabase.from('scheme_of_work')
            .update({ status: 'teaching' })
            .eq('id',         suggestion.schemeId)
            .eq('school_id',  ctx.schoolId)
            .eq('teacher_id', user.id)
        } catch {
          // non-fatal — the lesson plan itself already saved successfully
        }
      }

      setStatus('draft')
      setPhase('view')
    } catch (err) {
      // G7
      console.error('[LessonPlanModal] generate', err)
      setError('Something went wrong. Check your connection.')
      setPhase('form')
    } finally {
      setBusy('idle')
    }
  }

  async function saveEdit() {
    setBusy('saving')
    try {
      const newBody = SECTION_LABELS
        .map(s => '<' + s.key + '>\n' + draft[s.key] + '\n</' + s.key + '>')
        .join('\n\n')
      const currentId = planIdRef.current
      if (currentId != null) {
        await supabase.from('lesson_plans')
          .update({ body: newBody, title: slot.subject + ' — ' + slot.class + ' — ' + topic, updated_at: new Date().toISOString() })
          .eq('id', currentId)
      }
      setSections(draft)
      setPhase('view')
      showToast('Plan saved')
      refreshPulse('lesson')
    } catch (err) {
      console.error('[LessonPlanModal] saveEdit', err)
      setError('Save failed. Try again.')
    } finally {
      setBusy('idle')
    }
  }

  async function handlePublish() {
    const currentId = planIdRef.current
    if (currentId == null) return
    const token = await getToken()
    if (token == null) return

    setBusy('publishing')
    try {
      await supabase.from('lesson_plans').update({ status: 'published' }).eq('id', currentId)
      if (ctx.students.length > 0) {
        await supabase.from('notifications').insert(
          ctx.students.map(s => ({
            school_id:  ctx.schoolId || null,
            // G6: id not table PK
            user_id:    s.id,
            title:      'New Lesson: ' + topic,
            body:       slot.subject + ' lesson plan published by ' + ctx.teacherName,
            type:       'lesson_plan',
            related_id: currentId,
          }))
        )
      }
      setStatus('published')
      showToast('Published to students ✓')
    } catch (err) {
      console.error('[LessonPlanModal] publish', err)
      setError('Publish failed. Try again.')
    } finally {
      setBusy('idle')
    }
  }

  async function handleShareToParents() {
    const currentId = planIdRef.current
    if (currentId == null) return
    const token = await getToken()
    if (token == null) return

    setBusy('sharing')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user == null) return

      const summary = [
        'Topic: ' + topic, '',
        'Learning Objectives:', sections.objectives, '',
        sections.homework ? 'Homework:\n' + sections.homework : '',
      ].filter(Boolean).join('\n')

      if (ctx.students.length > 0) {
        await supabase.from('parent_messages').insert(
          ctx.students.map(s => ({
            school_id:    ctx.schoolId,
            teacher_id:   user.id,
            student_id:   s.id,
            channel:      'app',
            subject:      slot.subject + ' — Lesson: ' + topic,
            body:         summary,
            generated_by: 'lesson_plan',
            sent_at:      new Date().toISOString(),
            created_at:   new Date().toISOString(),
          }))
        )
      }

      await supabase.from('lesson_plans').update({ status: 'shared_to_parents' }).eq('id', currentId)

      if (sections.homework.trim() !== '') {
        const due = new Date()
        due.setDate(due.getDate() + 1) // TODO: allow teacher to set due date
        const { data: hw } = await supabase.from('homework').upsert({
          class_id:           slot.class_id,
          teacher_id:         user.id,
          school_id:          ctx.schoolId || null,
          lesson_plan_id:     currentId,
          title:              topic + ' — Homework',
          subject:            slot.subject,
          instructions:       sections.homework.trim(),
          type:               'written',
          due_date:           nairobiDateStr(due),
        }, { onConflict: 'lesson_plan_id' }).select('id').single()

        if (hw?.id) {
          await supabase.from('homework_questions').delete().eq('homework_id', hw.id)
          const questions = sections.homework
            .split('\n')
            .filter((l: string) => l.trim().endsWith('?') || /^\d+\./.test(l.trim()))
            .slice(0, 5)
            .map((q: string, i: number) => ({ homework_id: hw.id, question: q.trim(), order_num: i + 1 }))
          if (questions.length > 0) await supabase.from('homework_questions').insert(questions)
        }
      }

      // NOTE: assessmentHook content lives in lesson_plans.body already.
      // Actual student scoring happens in /teacher/assessment (cbc_assessments),
      // which now carries lesson_plan_id for traceability. We deliberately do NOT
      // auto-insert a score here — that would fabricate an assessment result
      // before any student was actually observed/graded.

      if (sections.consolidation.trim() !== '') {
        await supabase.from('exercises').upsert({
          class_id:       slot.class_id,
          subject_id:     slot.subject_id,
          teacher_id:     user.id,
          school_id:      ctx.schoolId || null,
          lesson_plan_id: currentId,
          title:          topic + ' — In-Class Exercise',
          instructions:   sections.consolidation.trim(),
          status:         'active',
        }, { onConflict: 'lesson_plan_id' })
      }

      setStatus('shared_to_parents')
      showToast('Shared to parents + homework synced ✓')
    } catch (err) {
      console.error('[LessonPlanModal] shareToParents', err)
      setError('Share failed. Try again.')
    } finally {
      setBusy('idle')
    }
  }

  const isbusy      = busy !== 'idle'
  const statusBadge = STATUS_BADGE[status]

  return (
    <>
      <style>{`
        @keyframes shimmer   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideUp   { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes twinPulse { 0%,80%,100%{transform:scale(0.7);opacity:0.5} 40%{transform:scale(1);opacity:1} }
        @keyframes fadeIn    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, background: '#1e1b4b', color: '#fff',
          padding: '10px 20px', borderRadius: 20, fontSize: 13, fontWeight: 700,
          animation: 'fadeIn 0.2s ease', whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.45)' }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 910,
        background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '14px auto 0' }} />

        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid ' + C.border,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>{slot.subject}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {slot.class}{slot.room ? ' · ' + slot.room : ''}{slot.start ? ' · ' + slot.start + '–' + slot.end : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {phase === 'view' && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '3px 10px',
                borderRadius: 20, background: statusBadge.bg, color: statusBadge.color,
              }}>{statusBadge.label}</span>
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
                  padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#065f46',
                }}>
                  <span style={{ fontWeight: 700 }}>Previously covered: </span>
                  {ctx.previousTopics.join(' → ')}
                </div>
              )}
              {suggestion && (
                <div style={{
                  background: usedSuggestion ? '#eef2ff' : '#fafafa',
                  border: '1.5px solid ' + (usedSuggestion ? '#c7d2fe' : C.border),
                  borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: usedSuggestion ? '#4338ca' : C.textMuted,
                    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
                  }}>📘 From Scheme of Work · Week {suggestion.week}, Term {suggestion.term}</div>
                  <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>{suggestion.topic}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {suggestion.strand}{suggestion.subStrand ? ' → ' + suggestion.subStrand : ''}
                  </div>
                  {!usedSuggestion && (
                    <button
                      onClick={() => { setTopic(suggestion.topic); setUsedSuggestion(true) }}
                      style={{
                        marginTop: 8, padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: C.accent, color: '#fff', fontSize: 12, fontWeight: 800,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >Use This Topic</button>
                  )}
                  {usedSuggestion && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#4338ca' }}>
                      ✓ Will sync to Scheme of Work as "Teaching" on save
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  fontSize: 11, fontWeight: 800, color: C.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                }}>Topic *</label>
                <input
                  value={topic} onChange={e => { setTopic(e.target.value); setUsedSuggestion(false) }}
                  placeholder="Topic e.g. Fractions on a Number Line"
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    border: '1.5px solid ' + (error !== '' && topic.trim() === '' ? C.error : C.border),
                    fontSize: 14, color: C.textPrimary, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  fontSize: 11, fontWeight: 800, color: C.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                }}>Specific focus <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input
                  value={focus} onChange={e => setFocus(e.target.value)}
                  placeholder="Focus e.g. Struggling learners need visual aids"
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    border: '1.5px solid ' + C.border, fontSize: 14, color: C.textPrimary,
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {error !== '' && <p style={{ fontSize: 12, color: C.error, marginBottom: 12 }}>{error}</p>}
              <button onClick={generate} disabled={isbusy} style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: C.accent, color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: isbusy ? 'not-allowed' : 'pointer', opacity: isbusy ? 0.7 : 1,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, fontFamily: 'inherit',
              }}>
                <span>✦</span> Generate Lesson Plan
              </button>
            </div>
          )}

          {phase === 'generating' && (
            <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: C.accent,
              }}>✦</div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, margin: 0 }}>Building your plan…</p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{slot.subject} · {slot.class} · {topic}</p>
                {ctx.previousTopics.length > 0 && (
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    Building on {ctx.previousTopics.length} previous lesson{ctx.previousTopics.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 0.2, 0.4].map(d => (
                  <span key={d} style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.accent,
                    animation: 'twinPulse 1.4s ease-in-out ' + d + 's infinite',
                  }} />
                ))}
              </div>
            </div>
          )}

          {phase === 'view' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: suggestion ? 8 : 16, fontSize: 12, color: C.textMuted }}>
                <span style={{ color: C.accent }}>✦</span>
                <span>Generated by Twin · CBC aligned</span>
                {topic !== '' && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                    background: C.accentLight, color: '#065f46', borderRadius: 20, padding: '2px 10px',
                  }}>{topic}</span>
                )}
              </div>
              {suggestion && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
                  fontSize: 11, color: C.textMuted, flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontWeight: 700, background: '#eef2ff', color: '#4338ca',
                    borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap',
                  }}>📘 Week {suggestion.week} · Term {suggestion.term}</span>
                  <span>{suggestion.strand}{suggestion.subStrand ? ' → ' + suggestion.subStrand : ''}</span>
                </div>
              )}
              {SECTION_LABELS.map(s => sections[s.key] ? (
                <div key={s.key} style={{
                  marginBottom: 20, background: '#fafafa',
                  borderRadius: 12, padding: '14px 16px', border: '1px solid ' + C.border,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: C.textMuted,
                    letterSpacing: 1, textTransform: 'uppercase',
                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{s.icon}</span>{s.label}
                  </div>
                  <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                    {sections[s.key]}
                  </div>
                </div>
              ) : null)}

              {error !== '' && <p style={{ fontSize: 12, color: C.error, marginBottom: 12 }}>{error}</p>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid ' + C.border, marginTop: 8 }}>
                {status === 'draft' && (
                  <button onClick={handlePublish} disabled={isbusy} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: C.accent, color: '#fff', fontSize: 13, fontWeight: 800,
                    cursor: isbusy ? 'not-allowed' : 'pointer', opacity: isbusy ? 0.7 : 1, fontFamily: 'inherit',
                  }}>
                    {busy === 'publishing' ? 'Publishing…' : '📤 Publish to Students'}
                  </button>
                )}
                {status !== 'shared_to_parents' && (
                  <button onClick={handleShareToParents} disabled={isbusy} style={{
                    width: '100%', padding: '13px', borderRadius: 12,
                    border: '1.5px solid #1e40af', background: '#eff6ff', color: '#1e40af',
                    fontSize: 13, fontWeight: 800, cursor: isbusy ? 'not-allowed' : 'pointer',
                    opacity: isbusy ? 0.7 : 1, fontFamily: 'inherit',
                  }}>
                    {busy === 'sharing' ? 'Sharing…' : '👨‍👩‍👧 Share to Parents'}
                  </button>
                )}
                {status === 'shared_to_parents' && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12, background: '#dbeafe',
                    color: '#1e40af', fontSize: 13, fontWeight: 700, textAlign: 'center',
                  }}>
                    ✓ Shared to parents · Homework synced
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setDraft({ ...sections }); setPhase('edit') }} disabled={isbusy} style={{
                    flex: 1, padding: '12px', borderRadius: 10,
                    border: '1.5px solid ' + C.border, background: '#fff',
                    fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Edit</button>
                  <button onClick={() => setPhase('form')} disabled={isbusy} style={{
                    flex: 1, padding: '12px', borderRadius: 10,
                    border: '1.5px solid ' + C.border, background: '#fff',
                    fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Regenerate</button>
                  <button onClick={onClose} style={{
                    flex: 1, padding: '12px', borderRadius: 10,
                    border: 'none', background: C.dark,
                    fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  }}>Done</button>
                </div>
              </div>
            </div>
          )}

          {phase === 'edit' && (
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Edit any section then save.</div>
              {SECTION_LABELS.map(s => (
                <div key={s.key} style={{ marginBottom: 16 }}>
                  <label style={{
                    fontSize: 10, fontWeight: 800, color: C.textMuted,
                    letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 5,
                  }}>{s.icon} {s.label}</label>
                  <textarea
                    value={draft[s.key]}
                    onChange={e => setDraft(d => ({ ...d, [s.key]: e.target.value }))}
                    rows={5}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid ' + C.border, fontSize: 13, color: C.textPrimary,
                      fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical',
                      outline: 'none', background: '#f9fafb', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid ' + C.border }}>
                <button onClick={() => setPhase('view')} disabled={isbusy} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1.5px solid ' + C.border, background: '#fff',
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
                <button onClick={saveEdit} disabled={isbusy} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: C.accent, fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: isbusy ? 'not-allowed' : 'pointer', opacity: isbusy ? 0.7 : 1, fontFamily: 'inherit',
                }}>
                  {busy === 'saving' ? 'Saving…' : 'Save Plan'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

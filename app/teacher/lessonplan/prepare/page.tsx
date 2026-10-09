"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, Btn, C, SectionLabel } from '@/components/teacher/ui'
import { nairobiDateAdd, nairobiDayOfWeek, nairobiWeekStart } from '@/lib/time'
import { loadTeacherTimetableForRange, type CanonicalTimetableSlot } from '@/lib/timetable/engine'
import {
  archiveLessonPlanDraft,
  attachLessonPlanDraftToOccurrence,
  loadLessonPlanDrafts,
  saveLessonPlanDraft,
  type LessonPlanDraft,
} from '@/lib/teaching/lessonDrafts'

interface OperatingClass {
  assignment_id: string
  class_id: string
  class_name: string
  stream?: string | null
  subject_id: string
  subject_name: string
}

interface OperatingContext {
  school_id?: string | null
  classes?: OperatingClass[]
}

interface DraftTarget {
  slotId: string
  date: string
  label: string
  classId: string
  subjectId: string
}

interface ScopeOption {
  key: string
  classId: string | null
  subjectId: string
  label: string
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(date + 'T12:00:00+03:00'))
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.slice(0,5).split(':').map(Number)
  const [eh, em] = end.slice(0,5).split(':').map(Number)
  return Math.max(1, eh * 60 + em - (sh * 60 + sm))
}

export default function PrepareLessonPage() {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<OperatingClass[]>([])
  const [slots, setSlots] = useState<CanonicalTimetableSlot[]>([])
  const [drafts, setDrafts] = useState<LessonPlanDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scopeKey, setScopeKey] = useState('')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [body, setBody] = useState('')
  const [duration, setDuration] = useState('40')

  async function refreshDrafts(uid: string, sid: string) {
    setDrafts(await loadLessonPlanDrafts(uid, sid))
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) {
          router.replace('/?role=teacher')
          return
        }

        const { data: contextData, error: contextError } = await supabase.rpc(
          'teacher_get_operating_context',
        )
        if (contextError) throw contextError
        const context = contextData as OperatingContext | null
        const sid = context?.school_id ?? null
        if (!sid) throw new Error('Choose or connect a school before preparing lessons.')

        const rows = (context?.classes ?? []).filter(
          row => row.assignment_id && row.class_id && row.subject_id,
        )
        const start = nairobiWeekStart()
        const end = nairobiDateAdd(start, 27)
        const [slotRows, draftRows] = await Promise.all([
          loadTeacherTimetableForRange({
            teacherId: user.id,
            schoolId: sid,
            rangeStart: start,
            rangeEnd: end,
          }),
          loadLessonPlanDrafts(user.id, sid),
        ])

        if (cancelled) return
        setTeacherId(user.id)
        setSchoolId(sid)
        setAssignments(rows)
        setSlots(slotRows)
        setDrafts(draftRows)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load lesson preparation.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  const scopeOptions = useMemo<ScopeOption[]>(() => {
    const bySubject = new Map<string, string>()
    for (const row of assignments) bySubject.set(row.subject_id, row.subject_name)

    const options: ScopeOption[] = []
    for (const [subjectId, subjectName] of bySubject) {
      options.push({
        key: 'subject:' + subjectId,
        classId: null,
        subjectId,
        label: subjectName + ' · any of my classes',
      })
    }
    for (const row of assignments) {
      options.push({
        key: 'class:' + row.assignment_id,
        classId: row.class_id,
        subjectId: row.subject_id,
        label: row.subject_name + ' · ' + row.class_name + (row.stream ? ' ' + row.stream : ''),
      })
    }
    return options
  }, [assignments])

  const selectedScope = scopeOptions.find(option => option.key === scopeKey) ?? null

  const targetMap = useMemo(() => {
    const result = new Map<string, DraftTarget[]>()
    const start = nairobiWeekStart()

    for (const draft of drafts) {
      const targets: DraftTarget[] = []
      for (let offset = 0; offset < 28 && targets.length < 6; offset += 1) {
        const date = nairobiDateAdd(start, offset)
        const dow = nairobiDayOfWeek(new Date(date + 'T12:00:00+03:00'))
        for (const slot of slots) {
          if (slot.day_of_week !== dow) continue
          if (slot.subject_id !== draft.subject_id) continue
          if (draft.class_id && slot.class_id !== draft.class_id) continue
          if (slot.effective_from > date) continue
          if (slot.effective_until && slot.effective_until < date) continue
          const assignment = assignments.find(
            row => row.class_id === slot.class_id && row.subject_id === slot.subject_id,
          )
          targets.push({
            slotId: slot.id,
            date,
            classId: slot.class_id,
            subjectId: slot.subject_id,
            label:
              formatDate(date) + ' · ' +
              (assignment?.class_name ?? 'Class') +
              (assignment?.stream ? ' ' + assignment.stream : '') +
              ' · ' + slot.start_time.slice(0,5),
          })
          if (targets.length >= 6) break
        }
      }
      result.set(draft.id, targets)
    }
    return result
  }, [drafts, slots, assignments])

  async function saveDraft() {
    if (!teacherId || !schoolId || !selectedScope || busy) return
    if (!title.trim() && !body.trim()) {
      setError('Add a title or lesson content before saving.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveLessonPlanDraft({
        schoolId,
        teacherId,
        classId: selectedScope.classId,
        subjectId: selectedScope.subjectId,
        title,
        topic,
        body,
        durationMinutes: Number(duration) || null,
        status: 'draft',
      })
      setTitle('')
      setTopic('')
      setBody('')
      await refreshDrafts(teacherId, schoolId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save prepared lesson.')
    } finally {
      setBusy(false)
    }
  }

  async function attach(draft: LessonPlanDraft, target: DraftTarget) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await attachLessonPlanDraftToOccurrence({
        draftId: draft.id,
        timetableSlotId: target.slotId,
        taughtDate: target.date,
      })
      const params = new URLSearchParams({
        timetableSlotId: target.slotId,
        date: target.date,
        classId: target.classId,
        subjectId: target.subjectId,
      })
      router.push('/teacher/lessonplan?' + params.toString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach prepared lesson.')
    } finally {
      setBusy(false)
    }
  }

  async function archive(draftId: string) {
    if (!teacherId || !schoolId || busy) return
    if (!window.confirm('Archive this prepared lesson?')) return
    setBusy(true)
    setError(null)
    try {
      await archiveLessonPlanDraft(draftId, teacherId)
      await refreshDrafts(teacherId, schoolId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not archive prepared lesson.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 14 }}>
      <div>
        <button
          type="button"
          onClick={() => router.push('/teacher/lessonplan')}
          style={{ border: 0, background: 'transparent', color: C.accent, fontWeight: 800, padding: 0 }}
        >
          ← Lesson plans
        </button>
        <h1 style={{ margin: '10px 0 4px', fontSize: 22, color: C.textPrimary }}>
          Prepare a lesson before it is scheduled
        </h1>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>
          Build reusable teaching content now. When the timetable is ready, attach it to the exact dated lesson without copying attendance, evidence or delivery history.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ padding: 12, borderRadius: 12, background: '#fef2f2', color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      <Card>
        <SectionLabel>New prepared lesson</SectionLabel>
        {loading ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Loading your teaching context…</div>
        ) : scopeOptions.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            Add a class and subject assignment before preparing a lesson.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800, color: C.textMuted }}>
              Use with
              <select value={scopeKey} onChange={e => setScopeKey(e.target.value)} style={{ padding: 11, borderRadius: 10, border: '1px solid ' + C.border }}>
                <option value="">Choose subject or class</option>
                {scopeOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lesson title" style={{ padding: 11, borderRadius: 10, border: '1px solid ' + C.border }} />
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic or concept" style={{ padding: 11, borderRadius: 10, border: '1px solid ' + C.border }} />
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Teaching steps, examples, questions, resources and notes…" rows={9} style={{ padding: 11, borderRadius: 10, border: '1px solid ' + C.border, resize: 'vertical', fontFamily: 'inherit' }} />
            <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800, color: C.textMuted }}>
              Planned duration
              <input type="number" min={10} max={240} value={duration} onChange={e => setDuration(e.target.value)} style={{ padding: 11, borderRadius: 10, border: '1px solid ' + C.border }} />
            </label>
            <Btn onClick={saveDraft} disabled={!selectedScope || busy}>{busy ? 'Saving…' : 'Save prepared lesson'}</Btn>
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Prepared lessons</SectionLabel>
        {loading ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Loading…</div>
        ) : drafts.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            No prepared lessons yet. A prepared lesson is independent of the timetable until you attach it.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {drafts.map(draft => {
              const assignment = assignments.find(
                row => row.subject_id === draft.subject_id && (!draft.class_id || row.class_id === draft.class_id),
              )
              const targets = targetMap.get(draft.id) ?? []
              return (
                <div key={draft.id} style={{ border: '1px solid ' + C.border, borderRadius: 14, padding: 13 }}>
                  <div style={{ fontWeight: 750, color: C.textPrimary }}>
                    {draft.title || draft.topic || 'Prepared lesson'}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                    {assignment?.subject_name ?? 'Subject'}
                    {draft.class_id ? ' · ' + (assignment?.class_name ?? 'Class') + (assignment?.stream ? ' ' + assignment.stream : '') : ' · any assigned class'}
                    {draft.duration_minutes ? ' · ' + draft.duration_minutes + ' min' : ''}
                  </div>
                  {draft.body && (
                    <div style={{ marginTop: 8, fontSize: 12, color: C.textPrimary, whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'hidden' }}>
                      {draft.body}
                    </div>
                  )}
                  <div style={{ marginTop: 11, display: 'grid', gap: 6 }}>
                    {targets.length > 0 ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted }}>Attach to an upcoming lesson</div>
                        {targets.map(target => (
                          <button
                            key={target.slotId + ':' + target.date}
                            type="button"
                            disabled={busy}
                            onClick={() => void attach(draft, target)}
                            style={{ textAlign: 'left', padding: 9, borderRadius: 10, border: '1px solid ' + C.border, background: C.surface, color: C.textPrimary, fontWeight: 700 }}
                          >
                            {target.label}
                          </button>
                        ))}
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        No compatible scheduled lesson in the next four weeks. Keep this draft and attach it after scheduling.
                      </div>
                    )}
                    <button type="button" disabled={busy} onClick={() => void archive(draft.id)} style={{ justifySelf: 'start', border: 0, background: 'transparent', color: C.textMuted, fontSize: 12, fontWeight: 700 }}>
                      Archive
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

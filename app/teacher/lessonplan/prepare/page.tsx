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

interface SchemeChoice {
  id: string
  topic: string
  week: number
  curriculum_id: string | null
  sub_strand_id: string | null
  curriculum_outcome_id: string
}

function friendlyError(value: unknown, fallback: string): string {
  const message = value instanceof Error ? value.message : ''
  if (/lesson_plan_drafts|schema cache|PGRST205/i.test(message)) {
    return 'Prepared lessons are temporarily unavailable. Your teaching assignments are unchanged. Please retry.'
  }
  if (/DRAFT_ASSIGNMENT|DRAFT_SCHEDULE_SCOPE|42501/i.test(message)) {
    return 'Your assigned school, class or subject no longer permits this action. Refresh your teaching assignments.'
  }
  if (/DRAFT_SCHEME|DRAFT_OUTCOME/i.test(message)) {
    return 'The selected Scheme must have a verified learning outcome. Reconnect it before saving.'
  }
  return message && !/(PGRST|public\.|syntax error|relation |constraint |function )/i.test(message) ? message : fallback
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
  const [draftError, setDraftError] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [schemeError, setSchemeError] = useState<string | null>(null)
  const [schemeLoading, setSchemeLoading] = useState(false)
  const [schemeChoices, setSchemeChoices] = useState<SchemeChoice[]>([])
  const [schemeId, setSchemeId] = useState('')
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
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
        // A missing draft dependency must not erase valid teaching assignments.
        if (cancelled) return
        setTeacherId(user.id)
        setSchoolId(sid)
        setAssignments(rows)
        const [slotResult, draftResult] = await Promise.allSettled([
          loadTeacherTimetableForRange({
            teacherId: user.id,
            schoolId: sid,
            rangeStart: start,
            rangeEnd: end,
          }),
          loadLessonPlanDrafts(user.id, sid),
        ])
        if (cancelled) return
        if (slotResult.status === 'fulfilled') {
          setSlots(slotResult.value)
          setScheduleError(null)
        } else {
          setScheduleError('Scheduled lesson choices could not load. Saved drafts remain available.')
        }
        if (draftResult.status === 'fulfilled') {
          setDrafts(draftResult.value)
          setDraftError(null)
        } else {
          setDraftError(friendlyError(draftResult.reason, 'Could not load prepared lessons. Retry this page.'))
        }
      } catch (e) {
        if (!cancelled) {
          setError(friendlyError(e, 'Could not load lesson preparation.'))
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

  const selectedScheme = schemeChoices.find(s => s.id === schemeId) ?? null

  useEffect(() => {
    let cancelled = false
    async function loadSchemeOptions() {
      setSchemeChoices([])
      setSchemeError(null)
      if (!schoolId || !selectedScope?.classId) return
      setSchemeLoading(true)
      try {
        const { data: terms, error: termError } = await supabase
          .from('academic_terms')
          .select('id')
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .order('start_date', { ascending: false })
          .limit(1)
        if (termError) throw termError
        if (!terms?.[0]?.id) {
          if (!cancelled) setSchemeError('No active academic term is configured for this school.')
          return
        }
        const { data, error: schemeLoadError } = await supabase
          .from('scheme_of_work')
          .select('id,topic,week,curriculum_id,sub_strand_id,curriculum_outcome_id')
          .eq('school_id', schoolId)
          .eq('class_id', selectedScope.classId)
          .eq('subject_id', selectedScope.subjectId)
          .eq('academic_term_id', terms[0].id)
          .not('curriculum_outcome_id', 'is', null)
          .order('week', { ascending: true })
          .limit(60)
        if (schemeLoadError) throw schemeLoadError
        if (!cancelled) setSchemeChoices((data ?? []).filter((item): item is SchemeChoice => typeof item.curriculum_outcome_id === 'string'))
      } catch {
        if (!cancelled) setSchemeError('Could not check Scheme learning outcomes. Save as a draft and reconnect later.')
      } finally {
        if (!cancelled) setSchemeLoading(false)
      }
    }
    void loadSchemeOptions()
    return () => { cancelled = true }
  }, [schoolId, selectedScope?.classId, selectedScope?.subjectId])

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
        id: editingDraftId,
        schoolId,
        teacherId,
        classId: selectedScope.classId,
        subjectId: selectedScope.subjectId,
        title,
        topic: selectedScheme?.topic ?? topic,
        body,
        schemeId: selectedScheme?.id ?? null,
        curriculumId: selectedScheme?.curriculum_id ?? null,
        strandId: selectedScheme?.sub_strand_id ?? null,
        curriculumOutcomeId: selectedScheme?.curriculum_outcome_id ?? null,
        durationMinutes: Number(duration) || null,
        status: 'draft',
      })
      setTitle('')
      setTopic('')
      setBody('')
      setEditingDraftId(null)
      setSchemeId('')
      await refreshDrafts(teacherId, schoolId)
    } catch (e) {
      setError(friendlyError(e, 'Could not save prepared lesson.'))
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
      setError(friendlyError(e, 'Could not attach prepared lesson.'))
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
      setError(friendlyError(e, 'Could not archive prepared lesson.'))
    } finally {
      setBusy(false)
    }
  }

  function editDraft(draft: LessonPlanDraft) {
    const matching = scopeOptions.find(s =>
      s.subjectId === draft.subject_id && s.classId === draft.class_id)
    if (!matching) {
      setError('This draft no longer matches a current teaching assignment.')
      return
    }
    setEditingDraftId(draft.id)
    setScopeKey(matching.key)
    setSchemeId(draft.scheme_id ?? '')
    setTitle(draft.title ?? '')
    setTopic(draft.topic ?? '')
    setBody(draft.body ?? '')
    setDuration(String(draft.duration_minutes ?? 40))
    setError(null)
    document.getElementById('prepared-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <main className="lp-prepare">
      <style>{`
        .lp-prepare{--lp-green:#087255;--lp-ink:#152720;--lp-muted:#697a71;--lp-line:#dee8e1;color:var(--lp-ink);padding:16px 16px 96px;max-width:1020px;margin:auto}
        .lp-prepare *{box-sizing:border-box}
        .lp-prepare button,.lp-prepare input,.lp-prepare select,.lp-prepare textarea{font:inherit}
        .lp-prepare__back{border:0;background:none;color:var(--lp-green);padding:3px 0;font-size:13px;font-weight:750;cursor:pointer}
        .lp-prepare__header{margin:11px 0 18px}
        .lp-prepare__eyebrow{text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:.11em;color:var(--lp-muted)}
        .lp-prepare h1{font-size:27px;line-height:1.12;letter-spacing:-.035em;margin:5px 0 6px;font-weight:760}
        .lp-prepare h2{font-size:16px;margin:0;letter-spacing:-.016em;font-weight:760}
        .lp-prepare__sub{font-size:12px;line-height:1.6;color:var(--lp-muted);max-width:55ch;margin:0}
        .lp-prepare__grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);align-items:start;gap:14px}
        .lp-prepare__panel{border:1px solid var(--lp-line);background:#fff;border-radius:18px;padding:16px;min-width:0;box-shadow:0 3px 13px #152b2110}
        .lp-prepare__paneltop{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:15px}
        .lp-prepare__chip{font-size:10px;font-weight:750;padding:5px 9px;border-radius:99px;background:#e9f5ef;color:#087255;white-space:nowrap}
        .lp-prepare__count{color:var(--lp-muted);font-size:12px}
        .lp-prepare__label{display:block;font-size:11px;font-weight:750;color:#51645a;margin:12px 0 5px}
        .lp-prepare__field{min-height:44px;width:100%;border:1px solid #d5e1d9;border-radius:11px;background:#fff;padding:11px 12px;font-size:13px!important;outline:none;color:var(--lp-ink)}
        .lp-prepare__field:focus{border-color:#53ae8c;box-shadow:0 0 0 3px #e4f5eb}
        .lp-prepare__field::placeholder{color:#94a39a}
        .lp-prepare__hint{font-size:11px;color:var(--lp-muted);margin:7px 0;line-height:1.55}
        .lp-prepare__notice{background:#fff7eb;border:1px solid #efdcbc;border-radius:12px;padding:12px;color:#8a5424;font-size:12px;line-height:1.5;margin:12px 0}
        .lp-prepare__notice--red{background:#fff1f0;border-color:#efd0cd;color:#9f3838}
        .lp-prepare__notice--subtle{background:#eef7f1;border-color:#d4e9dc;color:#28664d}
        .lp-prepare__btn{display:inline-flex;align-items:center;justify-content:center;text-align:center;min-height:43px;border-radius:11px;border:1px solid #d5e4db;background:#fff;color:var(--lp-green);font-size:12px!important;font-weight:760!important;padding:10px 13px;cursor:pointer;gap:5px}
        .lp-prepare__btn--main{background:var(--lp-green);color:white;border-color:var(--lp-green)}
        .lp-prepare__btn:disabled{opacity:.48;cursor:not-allowed}
        .lp-prepare__btn--full{width:100%}
        .lp-prepare__row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
        .lp-prepare__row--between{justify-content:space-between}
        .lp-prepare__item{border:1px solid var(--lp-line);border-radius:13px;padding:12px;margin:10px 0;background:#fff}
        .lp-prepare__itemtitle{font-size:14px;font-weight:760}
        .lp-prepare__meta{font-size:11px;color:var(--lp-muted);margin:4px 0 9px}
        .lp-prepare__preview{font-size:12px;line-height:1.55;color:#51635a;white-space:pre-wrap;max-height:54px;overflow:hidden;margin:8px 0}
        .lp-prepare__targets{border-top:1px solid var(--lp-line);margin-top:10px;padding-top:9px}
        .lp-prepare__target{display:block;width:100%;margin:5px 0;text-align:left;border:1px solid #d9e9de;background:#f2f8f3;color:var(--lp-green);font-size:12px;font-weight:720;border-radius:10px;padding:10px;cursor:pointer}
        .lp-prepare__empty{display:flex;flex-direction:column;gap:5px;color:var(--lp-muted);font-size:12px;line-height:1.55;padding:15px 0}
        .lp-prepare__empty strong{color:var(--lp-ink);font-size:14px}
        @media(max-width:760px){.lp-prepare{padding:14px 16px 106px}.lp-prepare__grid{grid-template-columns:1fr}.lp-prepare h1{font-size:25px}.lp-prepare__panel{padding:14px;border-radius:17px}}
      `}</style>
      <button type="button" className="lp-prepare__back" onClick={() => router.push('/teacher/lessonplan')}>← Lesson plans</button>
      <header className="lp-prepare__header">
        <div className="lp-prepare__eyebrow">Teacher workspace · lesson preparation</div>
        <h1>Prepare ahead</h1>
        <p className="lp-prepare__sub">Build your teaching plan now. Attach it to a dated lesson when the timetable is ready.</p>
      </header>
      {error && <div className="lp-prepare__notice lp-prepare__notice--red" role="alert">{error}</div>}
      <div className="lp-prepare__grid">
        <section className="lp-prepare__panel" id="prepared-editor" aria-label="Prepare lesson">
          <div className="lp-prepare__paneltop"><h2>{editingDraftId ? 'Edit prepared lesson' : 'New prepared lesson'}</h2><span className="lp-prepare__chip">Unscheduled draft</span></div>
          {loading ? <div role="status" className="lp-prepare__empty">Loading your teaching assignments…</div> :
            scopeOptions.length === 0 ? (
              <div className="lp-prepare__empty"><strong>No class and subject assignment</strong>Connect a teaching assignment in My Classes before preparing a lesson.<button className="lp-prepare__btn" type="button" onClick={() => router.push('/teacher/classes')}>Open My Classes</button></div>
            ) : (
              <>
                <label className="lp-prepare__label" htmlFor="draft-class">Class and subject</label>
                <select id="draft-class" className="lp-prepare__field" value={scopeKey} onChange={e=>{setScopeKey(e.target.value);setSchemeId('')}}>
                  <option value="">Choose assigned class or subject</option>
                  {scopeOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
                <label className="lp-prepare__label" htmlFor="draft-scheme">Scheme & learning outcome</label>
                <select id="draft-scheme" className="lp-prepare__field" value={schemeId} onChange={e=>setSchemeId(e.target.value)}
                  disabled={!selectedScope?.classId || schemeLoading || schemeChoices.length===0}>
                  <option value="">Not linked · keep as draft</option>
                  {schemeChoices.map(s=><option key={s.id} value={s.id}>Week {s.week} · {s.topic}</option>)}
                </select>
                {!selectedScope?.classId ? (
                  <p className="lp-prepare__hint">Select a specific class to link a Scheme item. Subject-wide drafts can be saved without a Scheme.</p>
                ) : schemeLoading ? (
                  <p className="lp-prepare__hint">Checking current-term learning outcomes…</p>
                ) : schemeError || schemeChoices.length === 0 ? (
                  <div className="lp-prepare__notice" role="status">{schemeError ?? 'No current-term Scheme item has a canonical learning outcome. Save your work as a draft; curriculum readiness remains incomplete.'}</div>
                ) : selectedScheme ? (
                  <div className="lp-prepare__notice lp-prepare__notice--subtle">Linked to a current-term Scheme and its canonical learning outcome.</div>
                ) : <p className="lp-prepare__hint">Choose a verified Scheme item to preserve outcome authority.</p>}
                <label className="lp-prepare__label" htmlFor="draft-title">Lesson title</label>
                <input id="draft-title" className="lp-prepare__field" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Reading and responding" />
                <label className="lp-prepare__label" htmlFor="draft-topic">Specific focus <span style={{fontWeight:400}}>(optional)</span></label>
                <input id="draft-topic" className="lp-prepare__field" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Teaching focus or note" />
                <label className="lp-prepare__label" htmlFor="draft-body">Teaching notes</label>
                <textarea id="draft-body" className="lp-prepare__field" rows={5} style={{resize:'vertical'}} value={body} onChange={e=>setBody(e.target.value)} placeholder="Key explanations, worked examples, questions, activities and resources…" />
                <label className="lp-prepare__label" htmlFor="draft-duration">Duration (minutes)</label>
                <input id="draft-duration" className="lp-prepare__field" type="number" min={10} max={240} value={duration} onChange={e=>setDuration(e.target.value)} />
                <p className="lp-prepare__hint">Saving a draft does not mark a lesson taught, create attendance or record progress.</p>
                <div className="lp-prepare__row">
                  <button type="button" className="lp-prepare__btn lp-prepare__btn--main" disabled={!selectedScope || busy || (!title.trim() && !body.trim())} onClick={()=>void saveDraft()}>{busy ? 'Saving…' : editingDraftId ? 'Save changes' : 'Save prepared lesson'}</button>
                  {editingDraftId && <button type="button" className="lp-prepare__btn" onClick={()=>{setEditingDraftId(null);setTitle('');setTopic('');setBody('');setSchemeId('')}}>Cancel edit</button>}
                </div>
              </>
            )}
        </section>
        <section className="lp-prepare__panel" aria-label="Prepared lessons">
          <div className="lp-prepare__paneltop"><h2>Prepared lessons</h2><span className="lp-prepare__count">{drafts.length} saved</span></div>
          {draftError && <div className="lp-prepare__notice lp-prepare__notice--red" role="alert">{draftError}</div>}
          {scheduleError && <div className="lp-prepare__notice" role="status">{scheduleError}</div>}
          {loading ? <div className="lp-prepare__empty" role="status">Loading saved lessons…</div> :
            drafts.length === 0 ? (
              <div className="lp-prepare__empty"><strong>No prepared lessons yet</strong>Save your first draft on this page. Your lesson can be linked to a timetable slot later.</div>
            ) : drafts.map(draft=>{
              const assignment=assignments.find(row=>row.subject_id===draft.subject_id && (!draft.class_id || row.class_id===draft.class_id))
              const targets=targetMap.get(draft.id) ?? []
              return <article className="lp-prepare__item" key={draft.id}>
                <div className="lp-prepare__row lp-prepare__row--between"><span className="lp-prepare__itemtitle">{draft.title || draft.topic || 'Prepared lesson'}</span><span className="lp-prepare__chip">{draft.curriculum_outcome_id ? 'Outcome linked' : 'Draft only'}</span></div>
                <div className="lp-prepare__meta">{assignment?.subject_name ?? 'Subject'} · {draft.class_id ? (assignment?.class_name ?? 'Class') + (assignment?.stream ? ' ' + assignment.stream : '') : 'Any assigned class'}{draft.duration_minutes ? ' · '+draft.duration_minutes+' min' : ''}</div>
                {draft.body && <p className="lp-prepare__preview">{draft.body}</p>}
                <div className="lp-prepare__row">
                  <button className="lp-prepare__btn" type="button" disabled={busy} onClick={()=>editDraft(draft)}>Edit</button>
                  <button className="lp-prepare__btn" type="button" disabled={busy} onClick={()=>void archive(draft.id)}>Archive</button>
                </div>
                <div className="lp-prepare__targets">
                  <div className="lp-prepare__label" style={{marginTop:0}}>Attach to a dated lesson</div>
                  {targets.length>0?targets.map(target=><button type="button" className="lp-prepare__target" key={target.slotId+':'+target.date} disabled={busy} onClick={()=>void attach(draft,target)}>{target.label} →</button>) :
                    <p className="lp-prepare__hint">{scheduleError ? 'Schedule unavailable; retry later.' : 'No matching timetable lesson in the next four weeks. Your draft stays saved.'}</p>}
                </div>
              </article>
            })}
        </section>
      </div>
    </main>
  )
}

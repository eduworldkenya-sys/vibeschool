"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { nairobiDateAdd, nairobiDayOfWeek, nairobiWeekStart } from '@/lib/time'
import { loadTeacherTimetableForRange, type CanonicalTimetableSlot } from '@/lib/timetable/engine'
import { generateLessonPlan } from '@/lib/teaching/lessonGeneration'
import { generateCanonicalLessonPlan } from '@/lib/teaching/canonicalLessonGeneration'
import { loadCertifiedContentForSource } from '@/lib/teaching/lessonSourceBundle'
import JumpingSchemeContent from '@/components/teacher/JumpingSchemeContent'
import { buildJumpingDraftSections, type JumpingContentSelection } from '@/lib/teaching/jumpingDraftSections'
import { timeOriginalLessonSections } from '@/lib/teaching/lessonTiming'
import { LESSON_PLAN_SECTION_KEYS, parseLessonPlanBody, serializeLessonPlanBody } from '@/lib/teaching/lessonPlanCodec'
import {
  archiveLessonPlanDraft,
  attachLessonPlanDraftToOccurrence,
  loadLessonPlanDrafts,
  restoreLessonPlanDraft,
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
  lesson_number: number | null
  curriculum_id: string | null
  sub_strand_id: string | null
  curriculum_outcome_id: string
  outcome_status: 'verified' | 'active'
  strand: string | null
  sub_strand: string | null
  objectives: string | null
  key_inquiry_question: string | null
  learning_resources: string | null
  learning_experiences: string | null
  assessment_methods: string | null
  reference: string | null
}

const SCHEME_CHOICE_FIELDS = 'id,topic,week,lesson_number,curriculum_id,sub_strand_id,curriculum_outcome_id,strand,sub_strand,objectives,key_inquiry_question,learning_resources,learning_experiences,assessment_methods,reference'
const SECTION_LABELS: Record<(typeof LESSON_PLAN_SECTION_KEYS)[number], string> = {
  objectives: 'Learning outcomes', resources: 'Resources and references',
  introduction: 'Introduction', development: 'Lesson development',
  consolidation: 'Conclusion and consolidation', assessmentHook: 'Assessment',
  homework: 'Follow-up activity', differentiation: 'Supporting different learners',
}

function friendlyError(value: unknown, fallback: string): string {
  const message = value instanceof Error ? value.message : ''
  if (/lesson_plan_drafts|schema cache|PGRST205/i.test(message)) {
    return 'Prepared lessons are temporarily unavailable. Your teaching assignments are unchanged. Please retry.'
  }
  if (/DRAFT_ASSIGNMENT|DRAFT_SCHEDULE_SCOPE|42501/i.test(message)) {
    return 'Your assigned school, class or subject no longer permits this action. Refresh your teaching assignments.'
  }
  if (/OCCURRENCE_ALREADY_HAS_DIFFERENT_PLAN/i.test(message)) {
    return 'This date already has a different lesson plan. Your prepared lesson was not attached.'
  }
  if (/DRAFT_CURRICULUM_REVIEW_REQUIRED/i.test(message)) {
    return 'This lesson outcome is no longer verified. Reconnect the Scheme before attaching.'
  }
  if (/DRAFT_SCHEME|DRAFT_OUTCOME/i.test(message)) {
    return 'The selected Scheme must have a current learning outcome. Reconnect it before saving.'
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

interface SchemeWeekRange {
  startDate: string
  endDate: string
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(date + 'T12:00:00+03:00'))
}

export default function PrepareLessonPage() {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<OperatingClass[]>([])
  const [slots, setSlots] = useState<CanonicalTimetableSlot[]>([])
  const [drafts, setDrafts] = useState<LessonPlanDraft[]>([])
  const [archivedDrafts, setArchivedDrafts] = useState<LessonPlanDraft[]>([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [draftSearch, setDraftSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [schemeError, setSchemeError] = useState<string | null>(null)
  const [schemeLoading, setSchemeLoading] = useState(false)
  const [schemeChoices, setSchemeChoices] = useState<SchemeChoice[]>([])
  const [schemeId, setSchemeId] = useState('')
  const [jumpingDraft, setJumpingDraft] = useState<JumpingContentSelection | null>(null)
  const [contentNotice, setContentNotice] = useState<string | null>(null)
  const [requestedSchemeId, setRequestedSchemeId] = useState('')
  const [draftsLoaded, setDraftsLoaded] = useState(false)
  const hydratedSchemeRef = useRef<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [existingPlanTarget, setExistingPlanTarget] = useState<DraftTarget | null>(null)
  const [scopeKey, setScopeKey] = useState('')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [body, setBody] = useState('')
  const [duration, setDuration] = useState('40')
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [schemeWeekRanges, setSchemeWeekRanges] = useState<Record<string, SchemeWeekRange>>({})
  const [schemeWeekError, setSchemeWeekError] = useState<string | null>(null)

  const matchesDraftSearch = (draft: LessonPlanDraft) => {
    const query = draftSearch.trim().toLocaleLowerCase()
    if (!query) return true
    const match = assignments.find(row => row.class_id === draft.class_id && row.subject_id === draft.subject_id)
    return [draft.title, draft.topic, draft.body, draft.scheme_id, match?.subject_name, match?.class_name]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(query))
  }
  const visibleDrafts = drafts.filter(matchesDraftSearch)
  const visibleArchivedDrafts = archivedDrafts.filter(matchesDraftSearch)

  async function refreshArchived(uid: string, sid: string) {
    setArchiveLoading(true)
    setArchiveError(null)
    try { setArchivedDrafts(await loadLessonPlanDrafts(uid, sid, 'archived')) }
    catch (cause) { setArchiveError(friendlyError(cause, 'Could not load archived preparations.')) }
    finally { setArchiveLoading(false) }
  }

  async function toggleArchived() {
    const next = !archiveOpen
    setArchiveOpen(next)
    if (next && teacherId && schoolId) await refreshArchived(teacherId, schoolId)
  }

  async function restoreArchived(id: string) {
    if (!teacherId || !schoolId || busy) return
    setBusy(true)
    setArchiveError(null)
    try {
      await restoreLessonPlanDraft(id, teacherId, schoolId)
      await Promise.all([refreshDrafts(teacherId, schoolId), refreshArchived(teacherId, schoolId)])
      setSaveNotice('Archived preparation restored to Prepared lessons without creating another lesson.')
    } catch (cause) {
      setArchiveError(friendlyError(cause, 'Could not restore this archived preparation.'))
    } finally { setBusy(false) }
  }

  async function refreshDrafts(uid: string, sid: string) {
    setDrafts(await loadLessonPlanDrafts(uid, sid))
    setDraftsLoaded(true)
    setDraftError(null)
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
        // A Scheme deep link must resolve to the teacher's actual assignment,
        // never merely to a display label or an arbitrary URL-supplied class.
        const link = new URLSearchParams(window.location.search)
        const linkClass = link.get('classId')
        const linkSubject = link.get('subjectId')
        const linkScheme = link.get('schemeId')
        if (linkScheme) {
          const assignment = rows.find(row =>
            row.class_id === linkClass && row.subject_id === linkSubject)
          if (!assignment) throw new Error('This Scheme lesson is not part of your current teaching assignments.')
          setScopeKey('class:' + assignment.assignment_id)
          setRequestedSchemeId(linkScheme)
          setSchemeId(linkScheme)
        }
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
          setDraftsLoaded(true)
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
  const structuredBody = useMemo(() => parseLessonPlanBody(body), [body])

  // Reopen the same teacher-owned unscheduled draft for a Scheme item instead
  // of creating another plan whenever the teacher taps Prepare lesson again.
  useEffect(() => {
    if (!requestedSchemeId || !draftsLoaded || schemeLoading || !selectedScope?.classId) return
    const source = schemeChoices.find(item => item.id === requestedSchemeId)
    if (!source) return
    const key = selectedScope.key + ':' + requestedSchemeId
    if (hydratedSchemeRef.current === key) return
    hydratedSchemeRef.current = key
    const existing = drafts.find(draft =>
      draft.scheme_id === requestedSchemeId &&
      draft.class_id === selectedScope.classId &&
      draft.subject_id === selectedScope.subjectId)
    setSchemeId(source.id)
    if (existing) {
      setEditingDraftId(existing.id)
      setTitle(existing.title ?? source.topic)
      setTopic(existing.topic ?? source.topic)
      setBody(existing.body ?? '')
      setDuration(String(existing.duration_minutes ?? 40))
    } else {
      setEditingDraftId(null)
      setTitle(source.topic)
      setTopic(source.topic)
      setBody('')
    }
  }, [requestedSchemeId, draftsLoaded, schemeLoading, selectedScope, schemeChoices, drafts])
  const selectedAssignment = selectedScope
    ? assignments.find(row => row.class_id === selectedScope.classId && row.subject_id === selectedScope.subjectId)
    : null
  const isGrade1English = Boolean(selectedAssignment
    && /^Grade\s*1$/i.test(selectedAssignment.class_name.trim())
    && /^English$/i.test(selectedAssignment.subject_name.trim()))


  useEffect(() => {
    let cancelled = false
    async function loadSchemeOptions() {
      setSchemeChoices([])
      setSchemeError(null)
      if (!schoolId || !teacherId || !selectedScope?.classId) return
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
        const activeTermId = terms?.[0]?.id ?? null
        if (!activeTermId && !requestedSchemeId) {
          if (!cancelled) setSchemeError('No active academic term is configured for this school.')
          return
        }
        let candidates: Array<Omit<SchemeChoice, 'outcome_status'>> = []
        if (activeTermId) {
          const { data, error: schemeLoadError } = await supabase
            .from('scheme_of_work')
            .select(SCHEME_CHOICE_FIELDS)
            .eq('school_id', schoolId)
            .eq('teacher_id', teacherId)
            .eq('class_id', selectedScope.classId)
            .eq('subject_id', selectedScope.subjectId)
            .eq('academic_term_id', activeTermId)
            .not('curriculum_outcome_id', 'is', null)
            .order('week', { ascending: true })
            .limit(120)
          if (schemeLoadError) throw schemeLoadError
          candidates = (data ?? []) as Array<Omit<SchemeChoice, 'outcome_status'>>
        }
        // Explicitly selected lessons retain their stored term/week even when
        // an administrator has moved the active term to the next period.
        if (requestedSchemeId && !candidates.some(row => row.id === requestedSchemeId)) {
          const { data, error: requestedError } = await supabase
            .from('scheme_of_work')
            .select(SCHEME_CHOICE_FIELDS)
            .eq('id', requestedSchemeId)
            .eq('school_id', schoolId)
            .eq('teacher_id', teacherId)
            .eq('class_id', selectedScope.classId)
            .eq('subject_id', selectedScope.subjectId)
            .maybeSingle()
          if (requestedError) throw requestedError
          if (!data) throw new Error('The selected Scheme item is no longer available for this teaching assignment.')
          candidates = [...candidates, data as Omit<SchemeChoice, 'outcome_status'>]
        }
        const ids = candidates
          .map(item => item.curriculum_outcome_id)
          .filter((id): id is string => typeof id === 'string')
        const statusById = new Map<string, 'active' | 'verified'>()
        if (ids.length) {
          const [verified, active] = await Promise.all([
            supabase.from('curriculum_learning_outcomes').select('id').in('id', ids).eq('status', 'verified'),
            supabase.from('curriculum_learning_outcomes').select('id').in('id', ids).eq('status', 'active'),
          ])
          if (verified.error) throw verified.error
          if (active.error) throw active.error
          for (const outcome of active.data ?? []) statusById.set(outcome.id, 'active')
          for (const outcome of verified.data ?? []) statusById.set(outcome.id, 'verified')
        }
        if (!cancelled) {
          setSchemeChoices(candidates.flatMap(item => {
            const status = statusById.get(item.curriculum_outcome_id)
            return status ? [{ ...item, outcome_status: status } as SchemeChoice] : []
          }))
          if (requestedSchemeId && !statusById.has(
            candidates.find(item => item.id === requestedSchemeId)?.curriculum_outcome_id ?? ''
          )) setSchemeError('The selected Scheme learning outcome is not active or verified. It cannot be used until reviewed.')
        }
      } catch {
        if (!cancelled) setSchemeError('Could not check Scheme learning outcomes. Save as a draft and reconnect later.')
      } finally {
        if (!cancelled) setSchemeLoading(false)
      }
    }
    void loadSchemeOptions()
    return () => { cancelled = true }
  }, [schoolId, teacherId, requestedSchemeId, selectedScope?.classId, selectedScope?.subjectId])


  // A prepared Scheme lesson can only be attached within its *own* school
  // instructional week. Never offer a future slot merely because its subject
  // and class happen to match; the canonical attach RPC enforces the same rule.
  useEffect(() => {
    let cancelled = false
    const schemeIds = [...new Set(drafts.map(draft => draft.scheme_id)
      .filter((id): id is string => typeof id === 'string'))]
    // Capture and narrow the identity before the asynchronous lookup.
    const authorizedSchoolId = schoolId
    const authorizedTeacherId = teacherId
    setSchemeWeekRanges({})
    setSchemeWeekError(null)
    if (!authorizedSchoolId || !authorizedTeacherId || schemeIds.length === 0) return () => { cancelled = true }

    async function loadSchemeWeeks(sid: string, uid: string) {
      try {
        const { data: schemeRows, error: schemeError } = await supabase
          .from('scheme_of_work')
          .select('id,school_id,academic_term_id,week')
          .eq('school_id', sid)
          .eq('teacher_id', uid)
          .in('id', schemeIds)
        if (schemeError) throw schemeError

        const termIds = [...new Set((schemeRows ?? [])
          .map(row => row.academic_term_id)
          .filter((id): id is string => typeof id === 'string'))]
        if (termIds.length === 0) return

        const { data: weekRows, error: weekError } = await supabase
          .from('term_weeks')
          .select('school_id,term_id,week_number,start_date,end_date')
          .in('term_id', termIds)
        if (weekError) throw weekError

        const ranges: Record<string, SchemeWeekRange> = {}
        for (const scheme of schemeRows ?? []) {
          const matchingWeek = (weekRows ?? [])
            .filter(week => week.term_id === scheme.academic_term_id &&
              week.week_number === scheme.week &&
              (week.school_id === sid || week.school_id === null))
            .sort((left, right) =>
              Number(right.school_id === sid) - Number(left.school_id === sid))[0]
          if (matchingWeek?.start_date && matchingWeek?.end_date) {
            ranges[scheme.id] = {
              startDate: matchingWeek.start_date,
              endDate: matchingWeek.end_date,
            }
          }
        }
        if (!cancelled) setSchemeWeekRanges(ranges)
      } catch {
        if (!cancelled) setSchemeWeekError(
          'The Scheme calendar could not be verified. Prepared lessons are still saved; dated attachment is unavailable.')
      }
    }
    void loadSchemeWeeks(authorizedSchoolId, authorizedTeacherId)
    return () => { cancelled = true }
  }, [drafts, schoolId, teacherId])

  const targetMap = useMemo(() => {
    const result = new Map<string, DraftTarget[]>()
    const start = nairobiWeekStart()

    for (const draft of drafts) {
      const targets: DraftTarget[] = []
      const schemeWindow = draft.scheme_id ? schemeWeekRanges[draft.scheme_id] : null
      if (draft.scheme_id && !schemeWindow) {
        result.set(draft.id, targets)
        continue
      }
      for (let offset = 0; offset < 28 && targets.length < 6; offset += 1) {
        const date = nairobiDateAdd(start, offset)
        if (schemeWindow && (date < schemeWindow.startDate || date > schemeWindow.endDate)) continue
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
  }, [drafts, slots, assignments, schemeWeekRanges])

  async function buildFromScheme() {
    if (!selectedScheme || !selectedAssignment || busy) return
    setSaveNotice(null)
    if (body.trim() && !window.confirm('Replace the current notes with a Scheme-grounded lesson plan?')) return
    setBusy(true)
    setError(null)
    setContentNotice(null)
    try {
      // One certified source resolver powers both scheduled and independent
      // preparation. Do not require a timetable occurrence to read content.
      const approved = await loadCertifiedContentForSource({
        schemeId: selectedScheme.id,
        lessonNumber: selectedScheme.lesson_number,
        id: selectedScheme.curriculum_id,
        strandId: selectedScheme.sub_strand_id,
      })
      const chosenDraft = jumpingDraft?.schemeId === selectedScheme.id ? jumpingDraft : null
      let sections

      if (approved.length > 0 && selectedScheme.sub_strand_id) {
        const { data: { session } } = await supabase.auth.getSession()
        const generated = await generateCanonicalLessonPlan(session?.access_token ?? '', {
          curriculumId: selectedScheme.curriculum_id,
          subjectId: selectedAssignment.subject_id,
          subjectName: selectedAssignment.subject_name,
          grade: selectedAssignment.class_name,
          subStrandId: selectedScheme.sub_strand_id,
          topicTitle: selectedScheme.topic,
          curriculumStrand: selectedScheme.strand ?? undefined,
          curriculumSubStrand: selectedScheme.sub_strand ?? undefined,
          duration: String(duration) + ' minutes',
          schemeId: selectedScheme.id,
          schemeObjectives: selectedScheme.objectives,
          keyInquiryQuestion: selectedScheme.key_inquiry_question,
          learningResources: selectedScheme.learning_resources,
          learningExperiences: selectedScheme.learning_experiences,
          assessmentMethods: selectedScheme.assessment_methods,
          reference: selectedScheme.reference,
          certifiedContent: approved,
        })
        if (!generated.ok) throw new Error(generated.message)
        sections = generated.sections
        setContentNotice('Prepared from certified VibeSchool content. Review and save your lesson draft.')
      } else if (chosenDraft) {
        // The Jumping pilot is an authorised editorial preview only. Never
        // classify candidate manuscripts as published or licensed content.
        sections = buildJumpingDraftSections(chosenDraft, {
          objectives: selectedScheme.objectives,
          keyInquiryQuestion: selectedScheme.key_inquiry_question,
          learningResources: selectedScheme.learning_resources,
          assessmentMethods: selectedScheme.assessment_methods,
        })
        sections = timeOriginalLessonSections(sections, Number(duration))
        setContentNotice('Selected VibeSchool Jumping content. Review the lesson before classroom delivery.')
      } else if (selectedAssignment.class_name.trim().toLowerCase() === 'grade 1' && selectedScheme.sub_strand?.trim().toLowerCase() === 'jumping') {
        throw new Error('Choose one of the 14 Jumping lessons to use its original content. No lesson number is saved in this Scheme, so VibeSchool cannot select one automatically.')
      } else {
        // Preserve existing independent Scheme preparation if production has
        // no certified content; do not invent an approval or choose lesson N.
        const generated = await generateLessonPlan({
          accessToken: '',
          teacherName: '',
          schoolName: '',
          subject: selectedAssignment.subject_name,
          className: selectedAssignment.class_name,
          studentCount: 0,
          duration,
          topic: selectedScheme.topic,
          previousTopics: [],
          curriculumStrand: selectedScheme.strand ?? undefined,
          curriculumSubStrand: selectedScheme.sub_strand ?? undefined,
          curriculumObjectives: selectedScheme.objectives,
          keyInquiryQuestion: selectedScheme.key_inquiry_question,
          learningResources: selectedScheme.learning_resources,
          learningExperiences: selectedScheme.learning_experiences,
          assessmentMethods: selectedScheme.assessment_methods,
          reference: selectedScheme.reference,
        })
        if (!generated.ok) throw new Error(generated.message)
        sections = generated.sections
        setContentNotice(approved.length > 0
          ? 'Certified assets exist, but this Scheme has no complete canonical identity. This is a Scheme-only draft.'
          : 'No certified content is available for this Scheme lesson. This is a Scheme-only preparation draft.')
      }
      setTitle(current => current.trim() || selectedScheme.topic)
      setTopic(selectedScheme.topic)
      setBody(serializeLessonPlanBody(sections))
    } catch (e) {
      setError(friendlyError(e, 'Could not prepare a content-grounded lesson plan.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!teacherId || !schoolId || !selectedScope || busy) return
    setSaveNotice(null)
    // Do not silently discard an attached Scheme while its verified outcome
    // is temporarily unavailable or being fetched.
    if (schemeId && !selectedScheme) {
      setError('The linked Scheme item is no longer available or verified. Reconnect it before saving changes.')
      return
    }
    if (!body.trim()) {
      setError('Build the lesson plan from the Scheme, or add teaching notes, before saving.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const matchingDraft = selectedScheme && drafts.find(draft =>
        draft.scheme_id === selectedScheme.id &&
        draft.class_id === selectedScope.classId &&
        draft.subject_id === selectedScope.subjectId)
      if (matchingDraft && editingDraftId && matchingDraft.id !== editingDraftId) {
        throw new Error('A prepared lesson already exists for this Scheme item. Open and edit the existing lesson.')
      }
      const saved = await saveLessonPlanDraft({
        id: editingDraftId ?? matchingDraft?.id ?? null,
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
      setSaveNotice((saved.title || saved.topic || 'Lesson') +
        ' saved under Prepared lessons. You can reopen it here or attach it to a matching scheduled lesson.')
      document.getElementById('prepared-lessons')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
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
    setExistingPlanTarget(null)
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
      const message = e instanceof Error ? e.message : ''
      if (/OCCURRENCE_ALREADY_HAS_DIFFERENT_PLAN/i.test(message)) {
        setExistingPlanTarget(target)
      }
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
      if (archiveOpen) await refreshArchived(teacherId, schoolId)
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
    // The edit action can reopen a Scheme from an older term.
    setRequestedSchemeId(draft.scheme_id ?? '')
    hydratedSchemeRef.current = matching.key + ':' + (draft.scheme_id ?? '')
    setSchemeId(draft.scheme_id ?? '')
    setTitle(draft.title ?? '')
    setTopic(draft.topic ?? '')
    setBody(draft.body ?? '')
    setDuration(String(draft.duration_minutes ?? 40))
    setError(null)
    setSaveNotice(null)
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
        .lp-prepare__print{display:none}
        @media print{
          body *{visibility:hidden!important}
          .lp-prepare__print,.lp-prepare__print *{visibility:visible!important}
          .lp-prepare__print{display:block!important;position:absolute;left:0;top:0;width:100%;padding:16px;background:white;color:#111;font:12pt/1.5 Georgia,serif}
          .lp-prepare__print h1{font-size:22pt}
          .lp-prepare__print section{break-inside:avoid;margin:16px 0}
          .lp-prepare__print h2{font-size:13pt;margin:0 0 6px}
          .lp-prepare__print p{white-space:pre-wrap}
        }
        @media(max-width:760px){.lp-prepare{padding:14px 16px 106px}.lp-prepare__grid{grid-template-columns:1fr}.lp-prepare h1{font-size:25px}.lp-prepare__panel{padding:14px;border-radius:17px}}
      `}</style>
      <button type="button" className="lp-prepare__back" onClick={() => router.push('/teacher/lessonplan')}>← Lesson plans</button>
      <header className="lp-prepare__header">
        <div className="lp-prepare__eyebrow">Teacher workspace · lesson preparation</div>
        <h1>Prepare ahead</h1>
        <p className="lp-prepare__sub">Build your teaching plan now. Attach it to a dated lesson when the timetable is ready.</p>
      </header>
      {error && <div className="lp-prepare__notice lp-prepare__notice--red" role="alert">{error}{existingPlanTarget && (
        <div style={{marginTop:10}}>
          <button type="button" className="lp-prepare__btn" onClick={() => {
            const params = new URLSearchParams({
              timetableSlotId:existingPlanTarget.slotId,
              date:existingPlanTarget.date,
              classId:existingPlanTarget.classId,
              subjectId:existingPlanTarget.subjectId,
            })
            router.push('/teacher/lessonplan?' + params.toString())
          }}>Open existing lesson →</button>
        </div>
      )}</div>}
      <div className="lp-prepare__grid">
        <section className="lp-prepare__panel" id="prepared-editor" aria-label="Prepare lesson">
          <div className="lp-prepare__paneltop"><h2>{editingDraftId ? 'Edit prepared lesson' : 'New prepared lesson'}</h2><span className="lp-prepare__chip">Unscheduled draft</span></div>
          {loading ? <div role="status" className="lp-prepare__empty">Loading your teaching assignments…</div> :
            scopeOptions.length === 0 ? (
              <div className="lp-prepare__empty"><strong>No class and subject assignment</strong>Connect a teaching assignment in My Classes before preparing a lesson.<button className="lp-prepare__btn" type="button" onClick={() => router.push('/teacher/classes')}>Open My Classes</button></div>
            ) : (
              <>
                <label className="lp-prepare__label" htmlFor="draft-class">Class and subject</label>
                <select id="draft-class" className="lp-prepare__field" value={scopeKey} onChange={e=>{setScopeKey(e.target.value);setSchemeId('');setJumpingDraft(null);setContentNotice(null)}}>
                  <option value="">Choose assigned class or subject</option>
                  {scopeOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
                <label className="lp-prepare__label" htmlFor="draft-scheme">Scheme & learning outcome</label>
                <select id="draft-scheme" className="lp-prepare__field" value={schemeId} onChange={e=>{setSchemeId(e.target.value);setJumpingDraft(null);setContentNotice(null)}}
                  disabled={!selectedScope?.classId || schemeLoading || schemeChoices.length===0}>
                  <option value="">Not linked · keep as draft</option>
                  {schemeChoices.map(s=><option key={s.id} value={s.id}>Week {s.week} · {s.topic}{s.outcome_status === 'active' ? ' · review pending' : ''}</option>)}
                </select>
                {!selectedScope?.classId ? (
                  <p className="lp-prepare__hint">Select a specific class to link a Scheme item. Subject-wide drafts can be saved without a Scheme.</p>
                ) : schemeLoading ? (
                  <p className="lp-prepare__hint">Checking current-term learning outcomes…</p>
                ) : schemeError || schemeChoices.length === 0 ? (
                  <div className="lp-prepare__notice" role="status">
                    {schemeError ?? 'No Scheme item with an active or verified learning outcome is available. You can still save an independent draft.'}
                    {isGrade1English && (
                      <div style={{marginTop:9}}>
                        <a href="https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-English-Activities-Revised-Sept.pdf"
                          target="_blank" rel="noopener noreferrer" style={{color:'#087255',fontWeight:760}}>
                          View revised KICD Grade 1 English design ↗
                        </a>
                        <p className="lp-prepare__hint">Official reference only. Its outcomes are not yet verified in VibeSchool or scheduled into this school's Scheme.</p>
                      </div>
                    )}
                  </div>
                ) : selectedScheme ? (
                  <div className="lp-prepare__notice lp-prepare__notice--subtle">{selectedScheme.outcome_status === 'verified' ? 'Linked to a verified Scheme learning outcome.' : 'Linked to the saved Scheme; this outcome is active but not verified. The lesson remains a draft until reviewed.'}</div>
                ) : <p className="lp-prepare__hint">Choose a verified Scheme item to preserve outcome authority.</p>}
                {selectedScheme?.sub_strand === 'Jumping' && selectedAssignment?.class_name === 'Grade 1' && (
                  <JumpingSchemeContent schemeId={selectedScheme.id} onUse={selection => {
                    setJumpingDraft(selection)
                    setContentNotice('Jumping lesson ' + selection.lessonNumber + ' selected for private editorial review.')
                  }} />
                )}
                {selectedScheme && <button type="button" className="lp-prepare__btn" disabled={busy} onClick={()=>void buildFromScheme()}>Build lesson plan from Scheme & content</button>}
                {contentNotice && <div className="lp-prepare__notice" role="status">{contentNotice}</div>}
                <label className="lp-prepare__label" htmlFor="draft-title">Lesson title</label>
                <input id="draft-title" className="lp-prepare__field" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Reading and responding" />
                <label className="lp-prepare__label" htmlFor="draft-topic">Specific focus <span style={{fontWeight:400}}>(optional)</span></label>
                <input id="draft-topic" className="lp-prepare__field" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Teaching focus or note" />
                <label className="lp-prepare__label" htmlFor="draft-body">Teaching notes</label>
                {structuredBody ? (
                  <div>{LESSON_PLAN_SECTION_KEYS.map(key=><div key={key}>
                    <label className="lp-prepare__label" htmlFor={'draft-section-'+key}>{SECTION_LABELS[key]}</label>
                    <textarea id={'draft-section-'+key} className="lp-prepare__field" rows={4}
                      value={structuredBody[key]}
                      onChange={e=>setBody(serializeLessonPlanBody({...structuredBody,[key]:e.target.value}))} />
                  </div>)}</div>
                ) : <textarea id="draft-body" className="lp-prepare__field" rows={5} style={{resize:'vertical'}} value={body} onChange={e=>setBody(e.target.value)} placeholder="Key explanations, worked examples, questions, activities and resources…" />}
                <label className="lp-prepare__label" htmlFor="draft-duration">Duration (minutes)</label>
                <input id="draft-duration" className="lp-prepare__field" type="number" min={10} max={240} value={duration} onChange={e=>setDuration(e.target.value)} />
                <p className="lp-prepare__hint">Saving a draft does not mark a lesson taught, create attendance or record progress.</p>
                {!body.trim() && <p className="lp-prepare__hint">To save a prepared lesson, build it from your Scheme or write teaching notes first.</p>}
                <div className="lp-prepare__row">
                  <button type="button" className="lp-prepare__btn lp-prepare__btn--main" disabled={!selectedScope || busy || !body.trim()} onClick={()=>void saveDraft()}>{busy ? 'Saving…' : editingDraftId ? 'Save changes' : 'Save prepared lesson'}</button>
                  {body.trim() && <button type="button" className="lp-prepare__btn" onClick={()=>window.print()}>Print lesson plan</button>}
                  {editingDraftId && <button type="button" className="lp-prepare__btn" onClick={()=>{setEditingDraftId(null);setTitle('');setTopic('');setBody('');setSchemeId('')}}>Cancel edit</button>}
                </div>
              </>
            )}
        </section>
        <section className="lp-prepare__panel" id="prepared-lessons" aria-label="Prepared lessons">
          <div className="lp-prepare__paneltop"><h2>Prepared lessons</h2><span className="lp-prepare__count">{drafts.length} saved</span></div>
          <label className="lp-prepare__label" htmlFor="prepared-search">Find a prepared or archived lesson</label>
          <input className="lp-prepare__field" id="prepared-search" type="search" placeholder="Search topic, subject, class or notes" value={draftSearch} onChange={event => setDraftSearch(event.target.value)}/>
          <button className="lp-prepare__btn" type="button" aria-expanded={archiveOpen} onClick={()=>void toggleArchived()}>{archiveOpen ? 'Hide archived lessons' : 'Find archived lessons'}</button>
          {saveNotice && <div className="lp-prepare__notice lp-prepare__notice--subtle" role="status">{saveNotice}</div>}
          {schemeWeekError && <div className="lp-prepare__notice" role="status">{schemeWeekError}</div>}
          {draftError && <div className="lp-prepare__notice lp-prepare__notice--red" role="alert">{draftError}</div>}
          {scheduleError && <div className="lp-prepare__notice" role="status">{scheduleError}</div>}
          {loading ? <div className="lp-prepare__empty" role="status">Loading saved lessons…</div> :
            visibleDrafts.length === 0 ? (
              <div className="lp-prepare__empty"><strong>{draftSearch.trim() ? 'No matching prepared lessons' : 'No prepared lessons yet'}</strong>{draftSearch.trim() ? 'Try another topic or search archived preparations.' : 'Save your first draft on this page. Your lesson can be linked to a timetable slot later.'}</div>
            ) : visibleDrafts.map(draft=>{
              const assignment=assignments.find(row=>row.subject_id===draft.subject_id && (!draft.class_id || row.class_id===draft.class_id))
              const targets=targetMap.get(draft.id) ?? []
              return <article className="lp-prepare__item" key={draft.id}>
                <div className="lp-prepare__row lp-prepare__row--between"><span className="lp-prepare__itemtitle">{draft.title || draft.topic || 'Prepared lesson'}</span><span className="lp-prepare__chip">{draft.curriculum_outcome_id ? 'Outcome linked' : 'Draft only'}</span></div>
                <div className="lp-prepare__meta">{assignment?.subject_name ?? 'Subject'} · {draft.class_id ? (assignment?.class_name ?? 'Class') + (assignment?.stream ? ' ' + assignment.stream : '') : 'Any assigned class'}{draft.duration_minutes ? ' · '+draft.duration_minutes+' min' : ''}</div>
                {draft.body && <p className="lp-prepare__preview">{draft.body}</p>}
                <div className="lp-prepare__row">
                  <button className="lp-prepare__btn" type="button" disabled={busy} onClick={()=>editDraft(draft)}>Edit</button>
                  {draft.class_id && draft.scheme_id && <button className="lp-prepare__btn lp-prepare__btn--main" type="button" disabled={busy} onClick={()=>router.push('/teacher/lessonplan/teach-unscheduled?draftId='+encodeURIComponent(draft.id))}>Teach now · no timetable</button>}
                  <button className="lp-prepare__btn" type="button" disabled={busy} onClick={()=>void archive(draft.id)}>Archive</button>
                </div>
                <div className="lp-prepare__targets">
                  <div className="lp-prepare__label" style={{marginTop:0}}>Attach to a dated lesson</div>
                  {targets.length>0?targets.map(target=><button type="button" className="lp-prepare__target" key={target.slotId+':'+target.date} disabled={busy} onClick={()=>void attach(draft,target)}>{target.label} →</button>) :
                    <p className="lp-prepare__hint">{scheduleError ? 'Schedule unavailable; retry later.' :
                      draft.scheme_id ? 'No matching timetable lesson in this Scheme\'s saved week. Your draft stays saved.' :
                      'No matching timetable lesson in the next four weeks. Your draft stays saved.'}</p>}
                </div>
              </article>
            })}
          {archiveOpen && <section aria-label="Archived prepared lessons" style={{borderTop:'1px solid #dee8e1',marginTop:20,paddingTop:15}}>
            <h3 style={{fontSize:17,margin:'0 0 10px'}}>Archived preparations</h3>
            {archiveError && <p role="alert" className="lp-prepare__notice lp-prepare__notice--red">{archiveError}</p>}
            {archiveLoading ? <p role="status">Loading archived lessons…</p> : visibleArchivedDrafts.length === 0 ?
              <p className="lp-prepare__hint">{draftSearch.trim() ? 'No archived lessons match this search.' : 'No archived preparations found.'}</p> :
              visibleArchivedDrafts.map(draft => {
                const assignment = assignments.find(row=>row.subject_id===draft.subject_id && row.class_id===draft.class_id)
                return <article className="lp-prepare__item" key={draft.id}>
                  <div className="lp-prepare__itemtitle">{draft.title || draft.topic || 'Prepared lesson'}</div>
                  <div className="lp-prepare__meta">{assignment?.subject_name || 'Subject'} · {assignment?.class_name || 'Saved class'} · Archived</div>
                  {draft.body && <details><summary>Preview archived teaching notes</summary><p className="lp-prepare__preview">{draft.body}</p></details>}
                  <button type="button" className="lp-prepare__btn" disabled={busy || archiveLoading} onClick={()=>void restoreArchived(draft.id)}>Restore preparation</button>
                </article>
              })}
          </section>}
        </section>
      </div>
      <div className="lp-prepare__print" aria-label="Printable prepared lesson">
        <h1>{title || topic || 'Prepared lesson'}</h1>
        <p>{selectedAssignment?.class_name ?? ''} · {selectedAssignment?.subject_name ?? ''} · {selectedScheme ? 'Week '+selectedScheme.week : 'Unscheduled'} · {duration} min</p>
        {structuredBody ? LESSON_PLAN_SECTION_KEYS.map(key=><section key={key}>
          <h2>{SECTION_LABELS[key]}</h2><p>{structuredBody[key]}</p>
        </section>) : <section><h2>Teaching notes</h2><p>{body}</p></section>}
        <p>Prepared lesson · Not a record of teaching or attendance</p>
      </div>
    </main>
  )
}

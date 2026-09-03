'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

import {
  EMPTY_LESSON_PLAN_SECTIONS,
  parseLessonPlanBody,
  serializeLessonPlanBody,
} from '@/lib/teaching/lessonPlanCodec'
import type {
  LessonPlanSections,
} from '@/lib/teaching/lessonPlanCodec'
import {
  saveGeneratedLessonPlan,
  updateLessonPlanBody,
} from '@/lib/teaching/lessonRepository'
import {
  generateLessonPlan,
} from '@/lib/teaching/lessonGeneration'
import {
  generateCanonicalLessonPlan,
} from '@/lib/teaching/canonicalLessonGeneration'
import {
  pinCanonicalLessonResource,
} from '@/lib/teaching/canonicalLessonResource'
import {
  lessonDeliveryErrorMessage,
  publishLessonToStudents,
  shareLessonToParents,
} from '@/lib/teaching/lessonDelivery'
import { evaluateLessonReadiness } from '@/lib/teaching/lessonReadiness'
import {
  loadLessonWorkspace,
} from '@/lib/teaching/lessonWorkspace'
import type {
  LessonCanonicalSourceIdentity,
} from '@/lib/teaching/lessonWorkspace'
import type {
  LessonContext,
  LessonContextStudent,
} from '@/lib/teaching/lessonContext'
import { C } from '@/components/teacher/ui'
import type { TimetableSlot } from '@/lib/types'
import type { LessonSourceSuggestion } from '@/lib/teaching/lessonSource'
import { refreshPulse } from "@/lib/pulse/refresh";
import {
  StartOccurrenceError,
  CompleteOccurrenceError,
  MarkSchemeCoveredError,
} from '@/lib/teaching/occurrence'
import {
  buildLessonAttendanceUrl,
  completeLessonOccurrence,
  loadLessonOccurrence,
  markLessonSchemeCovered,
  startLessonOccurrence,
} from '@/lib/teaching/lessonLifecycle'
import type { StartOccurrenceErrorCode, CompleteOccurrenceErrorCode, MarkCoveredErrorCode } from '@/lib/teaching/occurrence'
import { deriveTeachingWorkspace } from '@/lib/teaching/workspace'
import type { TeachingOccurrence } from '@/lib/teaching/types'
import ReflectionSheet from '@/components/teacher/ReflectionSheet'
import CoverageSheet from '@/components/teacher/CoverageSheet'
import LessonPlanHistorySheet from '@/components/teacher/LessonPlanHistorySheet'
import EvidenceCaptureSheet from '@/components/teacher/EvidenceCaptureSheet'
import LessonTeachMode from '@/components/teacher/LessonTeachMode'
import {
  listOccurrenceResourceUsage,
  markOccurrenceResourceUsed,
} from '@/lib/content-engine/resourceUsage'

// TOS-002: human-facing text for starting the exact occurrence from
// the lesson workspace. The RPC remains the lifecycle authority.
function startLessonErrorMessage(code: StartOccurrenceErrorCode): string {
  switch (code) {
    case 'not_authenticated':
      return 'Your session expired. Please sign in again.'
    case 'slot_not_found':
      return 'This lesson slot no longer exists.'
    case 'slot_not_owned':
      return 'This lesson belongs to a different teacher.'
    case 'invalid_occurrence_date':
      return 'This date no longer matches the lesson schedule.'
    case 'lesson_plan_required':
      return 'Save the lesson plan before starting the lesson.'
    case 'occurrence_completed':
      return 'This lesson was already completed.'
    case 'occurrence_cancelled':
      return 'This lesson was cancelled.'
    case 'occurrence_rescheduled':
      return 'This lesson was rescheduled.'
    default:
      return 'Could not start the lesson. Please try again.'
  }
}

// Fix 18D: human-facing text for each stable complete_teaching_occurrence
// error code. Same convention as startErrorMessage in app/teacher/timetable/page.tsx.
function completeErrorMessage(code: CompleteOccurrenceErrorCode): string {
  switch (code) {
    case 'not_authenticated':
      return 'Your session expired. Please sign in again.'
    case 'slot_not_found':
      return 'This lesson slot no longer exists.'
    case 'slot_not_owned':
      return 'This lesson belongs to a different teacher.'
    case 'occurrence_not_found':
    case 'occurrence_not_started':
      return 'This lesson has not been started yet.'
    case 'occurrence_cancelled':
      return 'This lesson was cancelled.'
    case 'occurrence_rescheduled':
      return 'This lesson was rescheduled.'
    case 'invalid_occurrence_date':
      return 'This date no longer matches the lesson schedule.'
    default:
      return 'Could not complete the lesson. Please try again.'
  }
}

// Fix 18E-D: human-facing text for each stable mark_scheme_item_covered error code.
function coveredErrorMessage(code: MarkCoveredErrorCode): string {
  switch (code) {
    case 'not_authenticated':
      return 'Your session expired. Please sign in again.'
    case 'occurrence_not_found':
      return 'This lesson could not be found.'
    case 'occurrence_not_owned':
      return 'This lesson belongs to a different teacher.'
    case 'occurrence_not_completed':
      return 'Complete the lesson before marking coverage.'
    case 'lesson_plan_not_found':
      return 'No lesson plan is linked to this lesson.'
    case 'scheme_item_not_found':
      return 'No scheme item is linked to this lesson.'
    case 'scheme_item_not_ready':
      return "This scheme item isn't in a state that can be marked covered."
    default:
      return 'Could not update the scheme. Please try again.'
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

type Student = LessonContextStudent
type Ctx = LessonContext

interface Props {
  slot:               TimetableSlot
  weekStart:          string
  taughtDate:         string
  requestedSchemeId?: string | null
  onClose:            () => void
}

type Phase  = 'loading' | 'form' | 'generating' | 'view' | 'edit'
type Status = 'draft' | 'published' | 'shared_to_parents'
type Busy   = 'idle' | 'publishing' | 'sharing' | 'saving' | 'generating'

interface LessonTeachingResource {
  linkId: string
  resourceId: string
  sourceType: string
  title: string
  description: string | null
  publicationId: string | null
  chapterId: string | null
  contentId: string | null
  usageRole: string
  sequence: number
  pageStart: number | null
  pageEnd: number | null
  sectionRefs: unknown[]
  exerciseRefs: unknown[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY: LessonPlanSections = EMPTY_LESSON_PLAN_SECTIONS

const SECTION_LABELS: { key: keyof LessonPlanSections; label: string; icon: string }[] = [
  { key: 'objectives',      label: 'Learning Objectives',      icon: '🎯' },
  { key: 'resources',       label: 'VibeSchool & Scheme Resources', icon: '🗂️' },
  { key: 'introduction',    label: 'Introduction',                  icon: '🔥' },
  { key: 'development',     label: 'Teaching & Learning Sequence',  icon: '📖' },
  { key: 'consolidation',   label: 'Consolidation',                 icon: '✅' },
  { key: 'assessmentHook',  label: 'Assessment & Exit Check',       icon: '📊' },
  { key: 'homework',        label: 'Homework',                 icon: '🏠' },
  { key: 'differentiation', label: 'Differentiation',          icon: '⚡' },
]

const STATUS_BADGE = {
  draft:             { label: 'Draft',             bg: '#f3f4f6', color: '#6b7280' },
  published:         { label: 'Published',         bg: '#d1fae5', color: '#065f46' },
  shared_to_parents: { label: 'Shared to Parents', bg: '#dbeafe', color: '#1e40af' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

export default function LessonPlanModal({
  slot,
  weekStart,
  taughtDate,
  requestedSchemeId = null,
  onClose,
}: Props) {
  const router = useRouter()
  const [phase,    setPhase]    = useState<Phase>('loading')
  const [sections, setSections] = useState<LessonPlanSections>(EMPTY)
  const [draft,    setDraft]    = useState<LessonPlanSections>(EMPTY)
  const [status,   setStatus]   = useState<Status>('draft')
  const [busy,     setBusy]     = useState<Busy>('idle')
  const [toast,    setToast]    = useState('')
  const [error,    setError]    = useState('')
  const [topic,    setTopic]    = useState('')
  const [focus,    setFocus]    = useState('')
  const [suggestion,      setSuggestion]      = useState<LessonSourceSuggestion | null>(null)
  const [suggestionLinked,  setSuggestionLinked]  = useState(false)
  const [canonicalIdentity, setCanonicalIdentity] = useState<LessonCanonicalSourceIdentity | null>(null)
  const [ctx,      setCtx]      = useState<Ctx>({
    teacherName: '', schoolName: '', schoolId: '',
    studentCount: 0, previousTopics: [], students: [], grade: null,
  })

  // G4: ref mirrors state so async actions always read current value
  const planIdRef = useRef<string | null>(null)
  const [planId, _setPlanId] = useState<string | null>(null)
  function setPlanId(id: string) { planIdRef.current = id; _setPlanId(id) }

  // Fix 18E-D correction: the persisted lesson plan's own scheme_id — never
  // derived from suggestion?.schemeId, which is transient UI input and may
  // not reflect the plan that was actually saved/completed. Populated from
  // the loaded plan row and from the row returned after insert/update.
  // Reset whenever boot() reruns for a different slot/date, or stays null
  // when no persisted plan exists.
  const planSchemeIdRef = useRef<string | null>(null)

  // Fix 18D: teacherId is required — ReflectionSheet's real prop signature
  // demands `teacherId: string` (confirmed against components/teacher/
  // ReflectionSheet.tsx), and boot()'s auth.getUser() result isn't otherwise
  // exposed outside its own closure.
  const [teacherId,      setTeacherId]      = useState<string | null>(null)
  // TOS-006B: retain the complete authoritative occurrence rather than
  // maintaining a second lifecycle-only interpretation in this component.
  const [teachingOccurrence, setTeachingOccurrence] =
    useState<TeachingOccurrence | null>(null)

  const workspace = teachingOccurrence
    ? deriveTeachingWorkspace(teachingOccurrence)
    : null

  const [startingLesson, setStartingLesson] = useState(false)
  const [startLessonError, setStartLessonError] = useState<string | null>(null)
  const [completing,     setCompleting]     = useState(false)
  const [completeError,  setCompleteError]  = useState<string | null>(null)
  const [showReflection, setShowReflection] = useState(false)
  const [showEvidence,   setShowEvidence]   = useState(false)
  const [showHistory,    setShowHistory]    = useState(false)
  const [teachMode,      setTeachMode]      = useState(false)
  // Fix 18E-D: set from the RPC-returned completed occurrence's own id —
  // never a slot id or plan id — so the coverage prompt always targets the
  // exact occurrence that was just completed, not a stale/derived key.
  const [coveragePromptOccurrenceId, setCoveragePromptOccurrenceId] = useState<string | null>(null)
  const [markingCovered, setMarkingCovered] = useState(false)
  const [coverageError, setCoverageError] = useState<string | null>(null)

  const [
    lessonResources,
    setLessonResources,
  ] = useState<LessonTeachingResource[]>([])

  const [
    lessonResourcesLoading,
    setLessonResourcesLoading,
  ] = useState(false)

  const [
    lessonResourcesError,
    setLessonResourcesError,
  ] = useState<string | null>(null)

  const [
    usedResourceIds,
    setUsedResourceIds,
  ] = useState<Set<string>>(
    () => new Set(),
  )

  const [
    markingResourceId,
    setMarkingResourceId,
  ] = useState<string | null>(null)

  const [
    resourceUsageError,
    setResourceUsageError,
  ] = useState<string | null>(null)

  const [
    homeworkCreatedForOccurrence,
    setHomeworkCreatedForOccurrence,
  ] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // TOS-006B: every consumer refresh goes through resolveOccurrence(), which
  // joins the persisted lifecycle with plan, attendance, evidence, homework
  // and reflection state for this exact slot/date.
  async function loadLessonResources(
    lessonPlanId: string,
  ): Promise<void> {
    setLessonResourcesLoading(true)
    setLessonResourcesError(null)

    try {
      const {
        data: resourceResult,
        error: resourceError,
      } = await supabase.rpc(
        'list_teaching_resources',
        {
          p_target_type: 'lesson_plan',
          p_target_id: lessonPlanId,
        },
      )

      if (resourceError) {
        throw resourceError
      }

      const payload =
        resourceResult as {
          ok?: boolean
          error?: string | null
          resources?: Array<{
            link_id?: string
            resource_id?: string
            source_type?: string
            title?: string
            description?: string | null
            publication_id?: string | null
            chapter_id?: string | null
            content_id?: string | null
            usage_role?: string
            sequence?: number
            page_start?: number | null
            page_end?: number | null
            section_refs?: unknown[]
            exercise_refs?: unknown[]
          }>
        } | null

      if (!payload?.ok) {
        throw new Error(
          payload?.error ??
          'lesson_resource_load_failed',
        )
      }

      const resources =
        (payload.resources ?? [])
          .flatMap(resource => {
            if (
              !resource.link_id ||
              !resource.resource_id
            ) {
              return []
            }

            return [{
              linkId: resource.link_id,
              resourceId:
                resource.resource_id,
              sourceType:
                resource.source_type ??
                'resource',
              title:
                resource.title ??
                'Untitled resource',
              description:
                resource.description ?? null,
              publicationId:
                resource.publication_id ??
                null,
              chapterId:
                resource.chapter_id ??
                null,
              contentId:
                resource.content_id ??
                null,
              usageRole:
                resource.usage_role ??
                'source',
              sequence:
                resource.sequence ?? 1,
              pageStart:
                resource.page_start ??
                null,
              pageEnd:
                resource.page_end ??
                null,
              sectionRefs:
                Array.isArray(
                  resource.section_refs,
                )
                  ? resource.section_refs
                  : [],
              exerciseRefs:
                Array.isArray(
                  resource.exercise_refs,
                )
                  ? resource.exercise_refs
                  : [],
            }]
          })
          .sort(
            (left, right) =>
              left.sequence -
              right.sequence,
          )

      setLessonResources(resources)
    } catch (resourceLoadError) {
      console.error(
        '[LessonPlanModal] load resources',
        resourceLoadError,
      )
      setLessonResources([])
      setLessonResourcesError(
        'Attached teaching resources could not be loaded.',
      )
    } finally {
      setLessonResourcesLoading(false)
    }
  }

  async function loadUsedResources(
    occurrenceId: string,
  ): Promise<void> {
    setResourceUsageError(null)

    try {
      const items =
        await listOccurrenceResourceUsage(
          occurrenceId,
        )

      setUsedResourceIds(
        new Set(
          items.map(
            item => item.resourceId,
          ),
        ),
      )
    } catch (usageLoadError) {
      console.error(
        '[LessonPlanModal] load used resources',
        usageLoadError,
      )
      setUsedResourceIds(new Set())
      setResourceUsageError(
        'Actual resource usage could not be loaded.',
      )
    }
  }

  async function handleMarkResourceUsed(
    resource: LessonTeachingResource,
  ): Promise<void> {
    const occurrenceId =
      teachingOccurrence?.occurrenceId

    const lessonPlanId = planId

    if (
      !occurrenceId ||
      !lessonPlanId ||
      markingResourceId
    ) {
      return
    }

    setMarkingResourceId(
      resource.resourceId,
    )
    setResourceUsageError(null)

    try {
      await markOccurrenceResourceUsed({
        occurrenceId,
        lessonPlanId,
        resourceId:
          resource.resourceId,
      })

      setUsedResourceIds(current => {
        const next = new Set(current)
        next.add(resource.resourceId)
        return next
      })

      showToast(
        'Resource marked used ✓',
      )
    } catch (usageError) {
      console.error(
        '[LessonPlanModal] mark resource used',
        usageError,
      )

      setResourceUsageError(
        usageError instanceof Error
          ? usageError.message
          : 'Resource usage could not be recorded.',
      )
    } finally {
      setMarkingResourceId(null)
    }
  }

  function openLessonResource(
    resource: LessonTeachingResource,
  ): void {
    if (resource.publicationId) {
      const params = new URLSearchParams()

      if (resource.chapterId) {
        params.set(
          'chapterId',
          resource.chapterId,
        )
      }

      if (resource.pageStart !== null) {
        params.set(
          'page',
          String(resource.pageStart),
        )
      }

      const query = params.toString()

      router.push(
        `/read/textbook/${resource.publicationId}${
          query ? `?${query}` : ''
        }`,
      )
      return
    }

    if (resource.contentId) {
      router.push(
        `/teacher/vibelearn?tab=discover&contentId=${resource.contentId}`,
      )
      return
    }

    setLessonResourcesError(
      'This resource does not have an available reader.',
    )
  }

  async function refreshTeachingWorkspace(): Promise<void> {
    if (!taughtDate) {
      setTeachingOccurrence(null)
      return
    }

    const occurrence = await loadLessonOccurrence({
      timetableSlotId: slot.id,
      occurrenceDate: taughtDate,
    })

    setTeachingOccurrence(occurrence)
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


  useEffect(() => {
    const occurrenceId =
      teachingOccurrence?.occurrenceId

    if (!occurrenceId) {
      setUsedResourceIds(new Set())
      setResourceUsageError(null)
      return
    }

    void loadUsedResources(
      occurrenceId,
    )
  }, [teachingOccurrence?.occurrenceId])

  useEffect(() => {
    const occurrenceId =
      teachingOccurrence?.occurrenceId

    const lessonPlanId = planId

    if (!occurrenceId || !lessonPlanId) {
      setHomeworkCreatedForOccurrence(false)
      return
    }

    let cancelled = false

    async function loadHomeworkLineage(
      resolvedOccurrenceId: string,
      resolvedLessonPlanId: string,
    ) {
      const {
        data,
        error: homeworkError,
      } = await supabase
        .from('homework')
        .select('id')
        .eq(
          'teaching_occurrence_id',
          resolvedOccurrenceId,
        )
        .eq(
          'lesson_plan_id',
          resolvedLessonPlanId,
        )
        .limit(1)

      if (cancelled) return

      if (homeworkError) {
        console.error(
          '[LessonPlanModal] Homework lineage load failed',
          homeworkError,
        )
        setHomeworkCreatedForOccurrence(false)
        return
      }

      setHomeworkCreatedForOccurrence(
        Array.isArray(data) &&
        data.length > 0,
      )
    }

    void loadHomeworkLineage(
      occurrenceId,
      lessonPlanId,
    )

    return () => {
      cancelled = true
    }
  }, [
    teachingOccurrence?.occurrenceId,
    planId,
  ])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        planSchemeIdRef.current = null
        setSuggestionLinked(false)
        setCanonicalIdentity(null)
        setLessonResources([])
        setLessonResourcesError(null)
        setTopic('')
        setFocus('')
        setError('')

        const loaded = await loadLessonWorkspace({
          timetableSlotId: slot.id,
          occurrenceDate: taughtDate,
          classId: slot.class_id,
          subjectId: slot.subject_id,
          subjectName: slot.subject,
          requestedSchemeId,
        })

        if (cancelled) return

        if (!loaded) {
          setError('Not signed in.')
          setPhase('form')
          return
        }

        setTeacherId(loaded.teacherId)
        setCtx(loaded.context)
        setSuggestion(loaded.source)
        setSuggestionLinked(loaded.sourceLinked)
        setCanonicalIdentity(loaded.canonicalIdentity)
        setTeachingOccurrence(loaded.occurrence)
        setCompleteError(loaded.occurrenceError)
        setError(loaded.sourceError ?? '')

        const existing = loaded.existingPlan

        if (existing && existing.body) {
          const parsed = parseLessonPlanBody(
            existing.body,
          )

          setSections(
            parsed ?? {
              ...EMPTY,
              development: existing.body,
            },
          )

          if (existing.topic) {
            setTopic(existing.topic)
          }

          if (existing.status) {
            setStatus(existing.status as Status)
          }

          setPlanId(existing.id)
          planSchemeIdRef.current =
            existing.scheme_id ?? null

          await loadLessonResources(
            existing.id,
          )

          if (cancelled) return

          setPhase('view')
        } else {
          // New plans inherit the authoritative Scheme/curriculum topic by
          // default. The teacher may explicitly switch to a custom topic, but
          // must never retype information VibeSchool already resolved.
          if (loaded.source) {
            setTopic(loaded.source.topic)
          }
          setPhase('form')
        }
      } catch (bootError) {
        if (cancelled) return

        console.error(
          '[LessonPlanModal] boot',
          bootError,
        )
        setError(
          'Failed to load. Please close and retry.',
        )
        setPhase('form')
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [
    slot.id,
    slot.class_id,
    slot.subject_id,
    slot.subject,
    taughtDate,
    requestedSchemeId,
  ])

  async function inheritSchemeResources({
    schemeId,
    lessonPlanId,
  }: {
    schemeId: string
    lessonPlanId: string
  }): Promise<void> {
    const {
      data: schemeResourceResult,
      error: schemeResourceError,
    } = await supabase.rpc(
      'list_scheme_lesson_resources',
      {
        p_scheme_lesson_id: schemeId,
      },
    )

    if (schemeResourceError) {
      throw new Error(
        `Could not load Scheme resources: ${schemeResourceError.message}`,
      )
    }

    const schemePayload =
      schemeResourceResult as {
        ok?: boolean
        reason?: string | null
        resources?: Array<{
          resource_id?: string
          resource_role?: string
          sequence?: number
          page_start?: number | null
          page_end?: number | null
          exercise_refs?: Json
        }>
      } | null

    if (!schemePayload?.ok) {
      throw new Error(
        `Could not load Scheme resources: ${
          schemePayload?.reason ??
          'unknown_error'
        }`,
      )
    }

    const resources =
      schemePayload.resources ?? []

    for (const resource of resources) {
      if (!resource.resource_id) {
        continue
      }

      const {
        data: linkResult,
        error: linkError,
      } = await supabase.rpc(
        'link_learning_resource',
        {
          p_resource_id:
            resource.resource_id,
          p_target_type:
            'lesson_plan',
          p_target_id:
            lessonPlanId,
          p_usage_role:
            resource.resource_role ??
            'source',
          p_sequence:
            resource.sequence ?? 1,
          p_page_start:
            resource.page_start ??
            undefined,
          p_page_end:
            resource.page_end ??
            undefined,
          p_section_refs: [],
          p_exercise_refs:
            resource.exercise_refs ?? [],
        },
      )

      const linkPayload =
        linkResult as {
          ok?: boolean
          error?: string | null
          existing?: boolean
        } | null

      if (linkError || !linkPayload?.ok) {
        throw new Error(
          `Could not attach a Scheme resource to the lesson plan: ${
            linkError?.message ??
            linkPayload?.error ??
            'unknown_error'
          }`,
        )
      }
    }
  }

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

      let parsed: LessonPlanSections
      let canonicalResource: {
        resourceId: string
        resourceVersionId: string
      } | null = null

      if (suggestionLinked && canonicalIdentity) {
        const generation = await generateCanonicalLessonPlan(
          token,
          {
            ...canonicalIdentity,
            subjectName: slot.subject,
            // The authoritative curriculum topic informs the reusable payload.
            // A teacher-edited topic label remains contextual to this lesson.
            topicTitle: suggestion?.topic ?? topic.trim(),
            curriculumStrand: suggestion?.strand,
            curriculumSubStrand: suggestion?.subStrand,
            duration: calcDuration(slot.start, slot.end),
            languageCode: 'en',
          },
        )

        if (!generation.ok) {
          setError(generation.message)
          setPhase('form')
          return
        }

        if (!generation.resourceVersionId) {
          throw new Error(
            'LessonPlanModal: canonical generation returned no exact resource version.',
          )
        }

        canonicalResource = {
          resourceId: generation.resourceId,
          resourceVersionId: generation.resourceVersionId,
        }

        // Teacher focus is contextual/private. Apply it only to the local
        // lesson-plan copy after canonical retrieval/generation; never send it
        // into the reusable family or candidate payload.
        parsed = focus.trim()
          ? {
              ...generation.sections,
              differentiation: `${generation.sections.differentiation}\n\nTeacher focus: ${focus.trim()}`,
            }
          : generation.sections
      } else {
        // Legacy Scheme/curriculum rows may not yet have the stable sub-strand
        // identity required for reusable canonical assets. They are still
        // authoritative educational sources: generate a contextual plan from
        // their Scheme grounding and persist their scheme/curriculum linkage.
        // Truly custom topics follow the same generator without grounding.
        const generation = await generateLessonPlan({
          accessToken: token,
          teacherName: ctx.teacherName,
          schoolName: ctx.schoolName,
          subject: slot.subject,
          className: slot.class,
          studentCount: ctx.studentCount,
          duration: calcDuration(slot.start, slot.end),
          topic: topic.trim(),
          focus: focus.trim() || undefined,
          previousTopics: ctx.previousTopics,
          curriculumStrand: suggestionLinked ? suggestion?.strand : undefined,
          curriculumSubStrand: suggestionLinked ? suggestion?.subStrand : undefined,
          curriculumObjectives: suggestionLinked ? suggestion?.objectives : undefined,
          keyInquiryQuestion: suggestionLinked ? suggestion?.keyInquiryQuestion : undefined,
          learningResources: suggestionLinked ? suggestion?.learningResources : undefined,
          learningExperiences: suggestionLinked ? suggestion?.learningExperiences : undefined,
          assessmentMethods: suggestionLinked ? suggestion?.assessmentMethods : undefined,
          reference: suggestionLinked ? suggestion?.reference : undefined,
        })

        if (!generation.ok) {
          setError(generation.message)
          setPhase('form')
          return
        }

        parsed = generation.sections
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
      const { data: prof, error: profileError } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const schoolId = prof?.school_id ?? null
      if (!schoolId) {
        throw new Error(
          'LessonPlanModal: school identity is required before saving a lesson plan.',
        )
      }

      // FND-002A: text editing and curriculum identity are separate concerns.
      // Resolve the intended persisted identity once, validate it, then use the
      // same immutable values for both the write and returned-row verification.
      if (suggestionLinked && !suggestion) {
        throw new Error(
          'LessonPlanModal: a linked curriculum source is missing.',
        )
      }

      let curriculumId: string | null = null
      let strandId: string | null = null
      let schemeId: string | null = null

      if (suggestionLinked && suggestion) {
        curriculumId = suggestion.id ?? null
        strandId = suggestion.strandId ?? null
        schemeId = suggestion.schemeId ?? null

        if (schemeId) {
          const { data: schemeRow, error: schemeError } = await supabase
            .from('scheme_of_work')
            .select(
              'id, curriculum_id, sub_strand_id, teacher_id, school_id, class_id, subject_id',
            )
            .eq('id', schemeId)
            .single()

          if (schemeError) throw schemeError

          const schemeMatchesOccurrence =
            schemeRow.teacher_id === user.id &&
            schemeRow.school_id === schoolId &&
            schemeRow.class_id === slot.class_id &&
            schemeRow.subject_id === slot.subject_id

          if (!schemeMatchesOccurrence) {
            throw new Error(
              'LessonPlanModal: the selected scheme item does not belong to this teaching assignment.',
            )
          }

          // The persisted scheme row is authoritative for its curriculum and
          // sub-strand identity. A stale client suggestion must never write a
          // conflicting identity.
          curriculumId = schemeRow.curriculum_id ?? curriculumId
          strandId = schemeRow.sub_strand_id ?? strandId
        }

        if (
          canonicalResource &&
          (
            !curriculumId ||
            !strandId ||
            curriculumId !== canonicalIdentity?.curriculumId ||
            strandId !== canonicalIdentity?.subStrandId
          )
        ) {
          throw new Error(
            'LessonPlanModal: canonical source identity changed before save. Please reopen the lesson and try again.',
          )
        }
      }

      const payload = {
        teacher_id:         user.id,
        school_id:          schoolId,
        class_id:           slot.class_id,
        subject_id:         slot.subject_id,
        timetable_slot_id:  slot.id,
        week_start:         weekStart,
        day_of_week:        slot.day_of_week,
        taught_date:        taughtDate,
        topic:              topic.trim(),
        title:              slot.subject + ' — ' + slot.class + ' — ' + topic.trim(),
        body:               serializeLessonPlanBody(parsed),
        status:             'draft' as const,
        generated_by:       'twin',
        curriculum_id:      curriculumId,
        strand_id:          strandId,
        scheme_id:          schemeId,
      }

      const currentId = planIdRef.current

      const savedPlan = await saveGeneratedLessonPlan({
        planId: currentId,
        payload,
        expectedIdentity: {
          curriculumId,
          strandId,
          schemeId,
        },
      })

      if (currentId == null) {
        setPlanId(savedPlan.id)
      }

      if (canonicalResource) {
        await pinCanonicalLessonResource({
          lessonPlanId: savedPlan.id,
          resourceId: canonicalResource.resourceId,
          resourceVersionId: canonicalResource.resourceVersionId,
        })
      }

      if (savedPlan.scheme_id) {
        await inheritSchemeResources({
          schemeId:
            savedPlan.scheme_id,
          lessonPlanId:
            savedPlan.id,
        })
      }

      await loadLessonResources(
        savedPlan.id,
      )

      // The database-returned row remains the source of truth for downstream
      // completion and scheme-coverage actions.
      planSchemeIdRef.current = savedPlan.scheme_id ?? null

      // Fix 18E-B: scheme status is no longer set here. Lesson-plan
      // generation is not evidence teaching has started — occurrence
      // start is (see Fix 18E-C). Scheme stays 'planned' until then.

      setStatus('draft')
      await refreshTeachingWorkspace()
      setPhase('view')
    } catch (err) {
      // G7
      console.error(
        '[LessonPlanModal] generate',
        err,
      )
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Check your connection.',
      )
      setPhase('form')
    } finally {
      setBusy('idle')
    }
  }

  async function saveEdit() {
    setBusy('saving')
    try {
      const newBody =
        serializeLessonPlanBody(draft)
      const currentId = planIdRef.current
      if (currentId != null) {
        await updateLessonPlanBody({
          lessonPlanId: currentId,
          body: newBody,
          title:
            slot.subject +
            ' — ' +
            slot.class +
            ' — ' +
            topic,
        })
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
      const result = await publishLessonToStudents({
        lessonPlanId: currentId,
        schoolId: ctx.schoolId,
        topic,
        subject: slot.subject,
        teacherName: ctx.teacherName,
        students: ctx.students,
      })

      setStatus('published')
      setError('')
      showToast(
        result.recipientCount > 0
          ? `Published · ${result.recipientCount} learner${result.recipientCount === 1 ? '' : 's'} notified ✓`
          : 'Published · no linked learner accounts to notify',
      )
    } catch (err) {
      console.error(
        '[LessonPlanModal] publish',
        err,
      )
      setError(lessonDeliveryErrorMessage(err))
    } finally {
      setBusy('idle')
    }
  }

  async function handleShareToParents() {
    const currentId = planIdRef.current
    if (currentId == null) return

    const token = await getToken()
    if (token == null) return

    if (!teacherId) {
      setError('Teacher context is unavailable.')
      return
    }

    if (!ctx.schoolId) {
      setError('School context is unavailable.')
      return
    }

    setBusy('sharing')

    try {
      const result = await shareLessonToParents({
        lessonPlanId: currentId,
        classId: slot.class_id,
        teacherId,
        schoolId: ctx.schoolId,
        subject: slot.subject,
        topic,
        sections,
      })

      setStatus('shared_to_parents')
      setError('')
      showToast(
        `Shared with ${result.recipientCount} parent recipient${result.recipientCount === 1 ? '' : 's'} · lesson work synced ✓`,
      )
    } catch (err) {
      console.error(
        '[LessonPlanModal] shareToParents',
        err,
      )
      setError(lessonDeliveryErrorMessage(err))
    } finally {
      setBusy('idle')
    }
  }

  // TOS-002: start the exact timetable occurrence without forcing the
  // teacher back through the timetable drawer. This uses the same guarded
  // RPC and exact (slot, date) identity as the timetable flow.
  async function handleStartLesson() {
    if (!taughtDate || !planIdRef.current || startingLesson) return

    setStartingLesson(true)
    setStartLessonError(null)

    try {
      await startLessonOccurrence({
        timetableSlotId: slot.id,
        occurrenceDate: taughtDate,
      })
      await refreshTeachingWorkspace()
      showToast('Lesson started ✓')
      refreshPulse('lesson')

      // TOS-003: attendance belongs to this exact teaching occurrence. The
      // attendance page already validates and saves by timetable slot + date,
      // so carry those identities immediately after the lifecycle transition.
      const attendanceUrl = buildLessonAttendanceUrl({
        classId: slot.class_id,
        timetableSlotId: slot.id,
        occurrenceDate: taughtDate,
        subjectId: slot.subject_id,
        subjectName: slot.subject,
      })

      router.push(attendanceUrl)
    } catch (err) {
      const code = err instanceof StartOccurrenceError ? err.code : 'unknown'
      console.error('[LessonPlanModal] startLesson', err)
      setStartLessonError(startLessonErrorMessage(code))
    } finally {
      setStartingLesson(false)
    }
  }

  // TOS-006B: completion availability is derived from the shared
  // TeachingWorkspace. The RPC remains the sole mutation authority and
  // performs the final transition validation.
  //
  // Product rule: completing a lesson occurrence is a teaching-workflow
  // event only. It never writes to scheme_of_work or curriculum progress —
  // that update path is separate and explicit. Do not extend this handler
  // to touch it. Reflection/evidence stay pending after this call; only
  // lifecycle + completed_at change.
  async function handleCompleteLesson() {
    if (!taughtDate || completing) return

    setCompleting(true)
    setCompleteError(null)

    try {
      const row = await completeLessonOccurrence({
        timetableSlotId: slot.id,
        occurrenceDate: taughtDate,
      })
      await refreshTeachingWorkspace()
      showToast('Lesson marked complete ✓')
      // Fix 18E-D: use the RPC-returned occurrence's own id — never a slot
      // id or plan id — so the coverage prompt always targets the exact
      // occurrence that was just completed. Rendered only once the
      // reflection sheet (if any) has closed — see render below.
      // Gated on planSchemeIdRef (the persisted plan's own scheme_id), never
      // on suggestion?.schemeId. Lessons with no scheme link (custom/manual
      // plans, scheme_id null) must never trigger this prompt.
      if (planSchemeIdRef.current) {
        setCoverageError(null)
        setCoveragePromptOccurrenceId(row.id)
      } else {
        setCoveragePromptOccurrenceId(null)
      }
      // Only offer reflection if a plan is actually persisted — otherwise
      // ReflectionSheet would render with lessonId={null} and silently fail.
      if (planIdRef.current) {
        setShowReflection(true)
      }
    } catch (err) {
      const code = err instanceof CompleteOccurrenceError ? err.code : 'unknown'
      console.error('[LessonPlanModal] completeLesson', err)
      setCompleteError(completeErrorMessage(code))
    } finally {
      setCompleting(false)
    }
  }

  // Fix 18E-D: guarded occurrence-based path for marking the linked scheme
  // item done. Runs the guarded mark_scheme_item_covered RPC — never a
  // direct .from('scheme_of_work').update() here. The Scheme page's manual
  // updateStatus(...) remains a separate valid path. A failure here shows
  // inline and never reverses the already-successful lesson completion
  // above.
  async function handleMarkCovered() {
    if (!coveragePromptOccurrenceId || markingCovered) return

    setMarkingCovered(true)
    setCoverageError(null)

    try {
      await markLessonSchemeCovered(
        coveragePromptOccurrenceId,
      )
      setCoveragePromptOccurrenceId(null)
      showToast('Marked covered in scheme ✓')
      refreshPulse('lesson')
    } catch (err) {
      const code = err instanceof MarkSchemeCoveredError ? err.code : 'unknown'
      console.error('[LessonPlanModal] markCovered', err)
      setCoverageError(coveredErrorMessage(code))
    } finally {
      setMarkingCovered(false)
    }
  }

  function handleDismissCoverage() {
    if (markingCovered) return
    setCoverageError(null)
    setCoveragePromptOccurrenceId(null)
  }

  const isbusy      = busy !== 'idle'
  const deliveryReadiness = planId
    ? evaluateLessonReadiness(serializeLessonPlanBody(sections))
    : null
  const deliveryReady = deliveryReadiness?.ready === true
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
                  background: suggestionLinked ? '#eef2ff' : '#fafafa',
                  border: '1.5px solid ' + (suggestionLinked ? '#c7d2fe' : C.border),
                  borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: suggestionLinked ? '#4338ca' : C.textMuted,
                    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    📘 From {suggestion.schemeId ? 'Scheme of Work' : 'Curriculum'}
                    {' · '}Week {suggestion.week}, Term {suggestion.term}
                  </div>
                  <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>{suggestion.topic}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {suggestion.strand}{suggestion.subStrand ? ' → ' + suggestion.subStrand : ''}
                  </div>
                  {suggestion.lessonNumber != null && (
                    <div style={{ fontSize: 10, color: '#4338ca', marginTop: 5, fontWeight: 700 }}>
                      Lesson {suggestion.lessonNumber}{suggestion.period != null ? ' · Period ' + suggestion.period : ''}
                    </div>
                  )}
                  {suggestion.objectives && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 7, lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 700 }}>Objectives: </span>{suggestion.objectives}
                    </div>
                  )}
                  {suggestion.keyInquiryQuestion && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5, lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 700 }}>Inquiry: </span>{suggestion.keyInquiryQuestion}
                    </div>
                  )}
                  {!suggestionLinked && (
                    <button
                      onClick={() => { setTopic(suggestion.topic); setSuggestionLinked(true) }}
                      style={{
                        marginTop: 8, padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: C.accent, color: '#fff', fontSize: 12, fontWeight: 800,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >Use This Topic</button>
                  )}
                  {suggestionLinked && (
                    <div style={{
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#4338ca',
                      }}>
                        ✓ Linked to this {suggestion.schemeId
                          ? 'Scheme of Work item'
                          : 'curriculum item'} — topic wording can be edited
                      </span>
                      <button
                        type="button"
                        onClick={() => setSuggestionLinked(false)}
                        style={{
                          flexShrink: 0,
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: '1px solid #c7d2fe',
                          background: '#fff',
                          color: '#4338ca',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Use custom topic
                      </button>
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
                  value={topic} onChange={e => setTopic(e.target.value)}
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
              {suggestionLinked && !canonicalIdentity && (
                <p style={{ fontSize: 11, color: '#b45309', marginBottom: 12 }}>
                  Scheme linked. This legacy source is not yet eligible for reusable canonical assets, so this lesson will be generated from its authoritative Scheme data instead.
                </p>
              )}
              {error !== '' && <p style={{ fontSize: 12, color: C.error, marginBottom: 12 }}>{error}</p>}
              <button onClick={generate} disabled={isbusy} style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: C.accent, color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: isbusy ? 'not-allowed' : 'pointer',
                opacity: isbusy ? 0.7 : 1,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, fontFamily: 'inherit',
              }}>
                <span>✦</span> Build Lesson Plan
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: suggestionLinked && suggestion ? 8 : 16, fontSize: 12, color: C.textMuted }}>
                <span style={{ color: C.accent }}>✦</span>
                <span>{canonicalIdentity ? 'Built from Scheme + VibeSchool Content · KICD aligned · No AI' : 'Built from authoritative Scheme data · No AI'}</span>
                {topic !== '' && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                    background: C.accentLight, color: '#065f46', borderRadius: 20, padding: '2px 10px',
                  }}>{topic}</span>
                )}
              </div>
              {suggestionLinked && suggestion && (
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
              <div style={{
                marginBottom: 20,
                borderRadius: 12,
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
                padding: '14px 16px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  gap: 10,
                  marginBottom:
                    lessonResources.length > 0 ||
                    lessonResourcesLoading ||
                    lessonResourcesError
                      ? 10
                      : 0,
                }}>
                  <div>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#4338ca',
                      letterSpacing: 1,
                      textTransform:
                        'uppercase',
                    }}>
                      📚 Teaching Resources
                    </div>

                    <div style={{
                      fontSize: 11,
                      color: C.textMuted,
                      marginTop: 3,
                    }}>
                      Attached to this exact
                      lesson plan
                    </div>
                  </div>

                  {planId && (
                    <button
                      type="button"
                      onClick={() =>
                        loadLessonResources(
                          planId,
                        )
                      }
                      disabled={
                        lessonResourcesLoading
                      }
                      style={{
                        padding: '5px 9px',
                        borderRadius: 8,
                        border:
                          '1px solid #c7d2fe',
                        background: '#fff',
                        color: '#4338ca',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor:
                          lessonResourcesLoading
                            ? 'not-allowed'
                            : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {lessonResourcesLoading
                        ? 'Loading…'
                        : 'Refresh'}
                    </button>
                  )}
                </div>

                {resourceUsageError && (
                  <div style={{
                    marginBottom: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#fef2f2',
                    border:
                      '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: 10,
                    fontWeight: 600,
                  }}>
                    ⚠ {resourceUsageError}
                  </div>
                )}

                {lessonResourcesLoading && (
                  <div style={{
                    fontSize: 12,
                    color: '#4338ca',
                    padding: '8px 0',
                  }}>
                    Loading attached resources…
                  </div>
                )}

                {lessonResourcesError && (
                  <div style={{
                    padding: '9px 10px',
                    borderRadius: 9,
                    background: '#fef2f2',
                    border:
                      '1px solid #fca5a5',
                    color: '#b91c1c',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    ⚠ {lessonResourcesError}
                  </div>
                )}

                {!lessonResourcesLoading &&
                  !lessonResourcesError &&
                  lessonResources.length === 0 && (
                  <div style={{
                    fontSize: 12,
                    color: C.textMuted,
                    lineHeight: 1.5,
                  }}>
                    No teaching resources are
                    attached to this lesson.
                  </div>
                )}

                {!lessonResourcesLoading &&
                  lessonResources.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    {lessonResources.map(
                      resource => {
                        const pageLabel =
                          resource.pageStart !==
                            null &&
                          resource.pageEnd !==
                            null
                            ? `Pages ${resource.pageStart}–${resource.pageEnd}`
                            : resource.pageStart !==
                                null
                              ? `Page ${resource.pageStart}`
                              : null

                        return (
                          <div
                            key={resource.linkId}
                            style={{
                              padding:
                                '10px 11px',
                              borderRadius: 10,
                              background: '#fff',
                              border:
                                '1px solid #c7d2fe',
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems:
                                'flex-start',
                              justifyContent:
                                'space-between',
                              gap: 10,
                            }}>
                              <div style={{
                                minWidth: 0,
                                flex: 1,
                              }}>
                                <div style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color:
                                    C.textPrimary,
                                  lineHeight: 1.35,
                                }}>
                                  {resource.title}
                                </div>

                                <div style={{
                                  display: 'flex',
                                  gap: 5,
                                  flexWrap: 'wrap',
                                  marginTop: 5,
                                }}>
                                  <span style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    borderRadius: 20,
                                    padding: '2px 7px',
                                    background:
                                      '#ede9fe',
                                    color:
                                      '#6d28d9',
                                  }}>
                                    {resource
                                      .sourceType
                                      .replaceAll(
                                        '_',
                                        ' ',
                                      )}
                                  </span>

                                  <span style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    borderRadius: 20,
                                    padding: '2px 7px',
                                    background:
                                      '#f3f4f6',
                                    color:
                                      '#4b5563',
                                  }}>
                                    {resource
                                      .usageRole
                                      .replaceAll(
                                        '_',
                                        ' ',
                                      )}
                                  </span>

                                  {pageLabel && (
                                    <span style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      borderRadius: 20,
                                      padding:
                                        '2px 7px',
                                      background:
                                        '#dbeafe',
                                      color:
                                        '#1d4ed8',
                                    }}>
                                      {pageLabel}
                                    </span>
                                  )}
                                </div>

                                {resource.description && (
                                  <div style={{
                                    fontSize: 11,
                                    color:
                                      C.textMuted,
                                    lineHeight: 1.45,
                                    marginTop: 6,
                                  }}>
                                    {
                                      resource.description
                                    }
                                  </div>
                                )}
                              </div>

                              <div style={{
                                display: 'flex',
                                flexDirection:
                                  'column',
                                gap: 6,
                                flexShrink: 0,
                              }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openLessonResource(
                                      resource,
                                    )
                                  }
                                  style={{
                                    padding:
                                      '7px 10px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background:
                                      '#4338ca',
                                    color: '#fff',
                                    fontSize: 10,
                                    fontWeight: 800,
                                    cursor:
                                      'pointer',
                                    fontFamily:
                                      'inherit',
                                  }}
                                >
                                  Open
                                </button>

                                {teachingOccurrence &&
                                  workspace &&
                                  (
                                    workspace.lifecycle ===
                                      'in_progress' ||
                                    workspace.lifecycle ===
                                      'completed'
                                  ) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMarkResourceUsed(
                                        resource,
                                      )
                                    }
                                    disabled={
                                      usedResourceIds.has(
                                        resource.resourceId,
                                      ) ||
                                      markingResourceId ===
                                        resource.resourceId
                                    }
                                    style={{
                                      padding:
                                        '7px 10px',
                                      borderRadius: 8,
                                      border:
                                        '1px solid #10b981',
                                      background:
                                        usedResourceIds.has(
                                          resource.resourceId,
                                        )
                                          ? '#d1fae5'
                                          : '#fff',
                                      color:
                                        '#065f46',
                                      fontSize: 10,
                                      fontWeight: 800,
                                      cursor:
                                        usedResourceIds.has(
                                          resource.resourceId,
                                        ) ||
                                        markingResourceId ===
                                          resource.resourceId
                                          ? 'default'
                                          : 'pointer',
                                      fontFamily:
                                        'inherit',
                                    }}
                                  >
                                    {usedResourceIds.has(
                                      resource.resourceId,
                                    )
                                      ? 'Used ✓'
                                      : markingResourceId ===
                                          resource.resourceId
                                        ? 'Saving…'
                                        : 'Mark used'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      }
                    )}
                  </div>
                )}
              </div>

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

              {deliveryReadiness && !deliveryReadiness.ready && (
                <div style={{
                  marginBottom: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  color: '#92400e',
                  fontSize: 11,
                  lineHeight: 1.55,
                }}>
                  <div style={{ fontWeight: 800, marginBottom: 5 }}>
                    Complete this draft before publishing or sharing
                  </div>
                  {deliveryReadiness.reasons.slice(0, 4).map(reason => (
                    <div key={reason}>• {reason}</div>
                  ))}
                </div>
              )}

              <div style={{
                marginTop: 8,
                marginBottom: 16,
                padding: '14px 12px',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
              }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.textMuted,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  Teaching Lifecycle
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(3, minmax(0, 1fr))',
                  gap: 7,
                }}>
                  {[
                    {
                      label: 'Planned',
                      done: Boolean(planId),
                      icon: '📘',
                    },
                    {
                      label: 'Started',
                      done:
                        workspace?.lifecycle ===
                          'in_progress' ||
                        workspace?.lifecycle ===
                          'completed',
                      icon: '▶',
                    },
                    {
                      label: 'Resources',
                      done:
                        usedResourceIds.size > 0,
                      icon: '📚',
                    },
                    {
                      label: 'Evidence',
                      done:
                        workspace?.evidenceCaptured ??
                        false,
                      icon: '📷',
                    },
                    {
                      label: 'Homework',
                      done:
                        homeworkCreatedForOccurrence,
                      icon: '📝',
                    },
                    {
                      label: 'Completed',
                      done:
                        workspace?.lifecycle ===
                        'completed',
                      icon: '✓',
                    },
                  ].map(step => (
                    <div
                      key={step.label}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 9,
                        textAlign: 'center',
                        background: step.done
                          ? '#d1fae5'
                          : '#fff',
                        border:
                          step.done
                            ? '1px solid #6ee7b7'
                            : '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{
                        fontSize: 14,
                        marginBottom: 3,
                      }}>
                        {step.done
                          ? '✓'
                          : step.icon}
                      </div>
                      <div style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: step.done
                          ? '#065f46'
                          : C.textMuted,
                      }}>
                        {step.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid ' + C.border, marginTop: 8 }}>
                {startLessonError && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: '#fef2f2', border: '1px solid #fca5a5',
                    fontSize: 12, fontWeight: 600, color: '#b91c1c',
                  }}>
                    ⚠ {startLessonError}
                  </div>
                )}
                {workspace?.lifecycle ===
                  'in_progress' &&
                  lessonResources.length > 0 && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#eef2ff',
                    border:
                      '1px solid #c7d2fe',
                    fontSize: 12,
                    color: '#4338ca',
                    fontWeight: 700,
                  }}>
                    📚 {lessonResources.length}{' '}
                    teaching resource{
                      lessonResources.length === 1
                        ? ''
                        : 's'
                    } ready for this lesson.
                    Open them above while teaching.
                  </div>
                )}

                {planId && workspace?.canStart && (
                  <button onClick={handleStartLesson} disabled={startingLesson} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: C.accent, color: '#fff', fontSize: 13, fontWeight: 800,
                    cursor: startingLesson ? 'not-allowed' : 'pointer',
                    opacity: startingLesson ? 0.7 : 1, fontFamily: 'inherit',
                  }}>
                    {startingLesson ? 'Starting lesson…' : '▶ Start Lesson'}
                  </button>
                )}
                {completeError && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: '#fef2f2', border: '1px solid #fca5a5',
                    fontSize: 12, fontWeight: 600, color: '#b91c1c',
                  }}>
                    ⚠ {completeError}
                  </div>
                )}
                {workspace?.canCaptureEvidence &&
                  planId &&
                  teachingOccurrence?.occurrenceId && (
                  <button
                    onClick={() => setShowEvidence(true)}
                    style={{
                      width: '100%',
                      padding: '13px',
                      borderRadius: 12,
                      border: '1.5px solid #047857',
                      background: workspace.evidenceCaptured
                        ? '#d1fae5'
                        : '#ecfdf5',
                      color: '#047857',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {workspace.evidenceCaptured
                      ? '✓ Add More Learning Evidence'
                      : '📷 Capture Learning Evidence'}
                  </button>
                )}
                {workspace?.lifecycle === 'in_progress' && (
                  <button type="button" onClick={() => setTeachMode(true)} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: '1.5px solid #4338ca',
                    background: '#eef2ff', color: '#4338ca', fontSize: 13, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>🎓 Teach from Plan</button>
                )}
                {workspace?.canComplete && (
                  <button onClick={handleCompleteLesson} disabled={completing} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: '#059669', color: '#fff', fontSize: 13, fontWeight: 800,
                    cursor: completing ? 'not-allowed' : 'pointer', opacity: completing ? 0.7 : 1, fontFamily: 'inherit',
                  }}>
                    {completing ? 'Completing lesson…' : '✅ Complete Lesson'}
                  </button>
                )}
                {workspace?.lifecycle === 'completed' && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12, background: '#d1fae5',
                    color: '#065f46', fontSize: 13, fontWeight: 700, textAlign: 'center',
                  }}>
                    ✓ Lesson completed
                  </div>
                )}
                {planId && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                  }}>
                    {[
                      { type: 'exercise', label: 'Exercise', icon: '✍️' },
                      { type: 'quiz', label: 'Quiz', icon: '📊' },
                      { type: 'homework', label: 'Homework', icon: '📝' },
                      { type: 'test', label: 'CAT', icon: '📋' },
                    ].map(action => (
                      <button
                        key={action.type}
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams({
                            lessonPlanId: planId,
                            topic,
                            assessmentHook: sections.assessmentHook,
                            type: action.type,
                          })

                          const occurrenceId =
                            teachingOccurrence?.occurrenceId

                          if (occurrenceId) {
                            params.set(
                              'occurrenceId',
                              occurrenceId,
                            )
                          }

                          router.push(
                            `/teacher/assessment/new?${params.toString()}`,
                          )
                        }}
                        disabled={isbusy}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 12,
                          border: '1.5px solid #4338ca',
                          background: '#eef2ff',
                          color: '#4338ca',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: isbusy
                            ? 'not-allowed'
                            : 'pointer',
                          opacity: isbusy ? 0.7 : 1,
                          fontFamily: 'inherit',
                        }}
                      >
                        {action.icon} Open {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {status !== 'published' && (
                  <button onClick={handlePublish} disabled={isbusy || !deliveryReady} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: C.accent, color: '#fff', fontSize: 13, fontWeight: 800,
                    cursor: isbusy ? 'not-allowed' : 'pointer', opacity: isbusy ? 0.7 : 1, fontFamily: 'inherit',
                  }}>
                    {busy === 'publishing' ? 'Publishing…' : '📤 Publish to Students'}
                  </button>
                )}
                {status !== 'shared_to_parents' && (
                  <button onClick={handleShareToParents} disabled={isbusy || !deliveryReady} style={{
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
                  <button onClick={() => setShowHistory(true)} disabled={isbusy} style={{
                    flex: 1, padding: '12px', borderRadius: 10,
                    border: '1.5px solid ' + C.border, background: '#fff',
                    fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer', fontFamily: 'inherit',
                  }}>History</button>
                  <button onClick={() => setPhase('form')} disabled={isbusy} style={{
                    flex: 1, padding: '12px', borderRadius: 10,
                    border: '1.5px solid ' + C.border, background: '#fff',
                    fontSize: 13, fontWeight: 700, color: C.textPrimary, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Create another version</button>
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

      {teachMode && (
        <LessonTeachMode
          subject={slot.subject}
          className={slot.class}
          topic={topic}
          sections={sections}
          onClose={() => setTeachMode(false)}
        />
      )}

      {showEvidence &&
        teacherId &&
        planId &&
        teachingOccurrence?.occurrenceId && (
        <EvidenceCaptureSheet
          lessonId={planId}
          occurrenceId={
            teachingOccurrence.occurrenceId
          }
          classId={slot.class_id}
          teacherId={teacherId}
          defaultTitle={topic || slot.subject}
          onClose={() => setShowEvidence(false)}
          onSaved={() => {
            setShowEvidence(false)
            showToast('Learning evidence saved ✓')

            void refreshTeachingWorkspace()
              .then(() => {
                refreshPulse('lesson')
              })
              .catch((refreshError) => {
                console.error(
                  '[LessonPlanModal] evidence refresh failed',
                  refreshError,
                )
              })
          }}
        />
      )}

      {showReflection &&
        teacherId &&
        planId &&
        teachingOccurrence?.occurrenceId && (
        <ReflectionSheet
          lessonId={planId}
          occurrenceId={
            teachingOccurrence.occurrenceId
          }
          classId={slot.class_id}
          subjectId={slot.subject_id}
          teacherId={teacherId}
          onClose={() => setShowReflection(false)}
          onSaved={() => showToast('Reflection saved ✓')}
        />
      )}

      {/* Fix 18E-D: gated on !showReflection so the coverage prompt only
          appears once the reflection sheet has closed (save or dismiss) —
          never stacked on top of it. If there's no lesson plan to reflect
          on, showReflection never opens and this shows immediately. */}
      {!showReflection &&
        !showEvidence &&
        coveragePromptOccurrenceId && (
        <CoverageSheet
          marking={markingCovered}
          error={coverageError}
          onMarkCovered={handleMarkCovered}
          onDismiss={handleDismissCoverage}
        />
      )}

      {showHistory && planId && (
        <LessonPlanHistorySheet
          lessonPlanId={planId}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )
}

"use client";
export const dynamic = "force-dynamic";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  useRouter,
  useSearchParams,
} from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  nairobiDateAdd,
  nairobiDateStr,
} from '@/lib/time'
import {
  loadTeacherTimetableForRange,
} from '@/lib/timetable/engine'
import type {
  CanonicalTimetableSlot,
} from '@/lib/timetable/engine'

interface OccurrenceCandidate {
  slot: CanonicalTimetableSlot
  occurrenceDate: string
}

interface ExistingPlan {
  id: string
  timetable_slot_id: string
  taught_date: string
  scheme_id: string | null
}

const C = {
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
  indigo: '#4f46e5',
  indigoLight: '#e0e7ff',
  red: '#be123c',
  redLight: '#fff1f2',
}

function isoDayOfWeek(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  const utcDay = parsed.getUTCDay()

  return utcDay === 0 ? 7 : utcDay
}

function buildCandidates(
  slots: CanonicalTimetableSlot[],
  rangeStart: string,
  rangeEnd: string,
): OccurrenceCandidate[] {
  const candidates: OccurrenceCandidate[] = []

  for (const slot of slots) {
    const startDay = isoDayOfWeek(rangeStart)
    let daysAhead = Number(slot.day_of_week) - startDay

    if (daysAhead < 0) {
      daysAhead += 7
    }

    let occurrenceDate = nairobiDateAdd(
      rangeStart,
      daysAhead,
    )

    while (occurrenceDate <= rangeEnd) {
      const effective =
        slot.effective_from <= occurrenceDate &&
        (
          slot.effective_until === null ||
          slot.effective_until >= occurrenceDate
        )

      if (effective) {
        candidates.push({
          slot,
          occurrenceDate,
        })
      }

      occurrenceDate = nairobiDateAdd(
        occurrenceDate,
        7,
      )
    }
  }

  candidates.sort((left, right) => {
    const dateOrder =
      left.occurrenceDate.localeCompare(
        right.occurrenceDate,
      )

    if (dateOrder !== 0) {
      return dateOrder
    }

    const timeOrder =
      left.slot.start_time.localeCompare(
        right.slot.start_time,
      )

    if (timeOrder !== 0) {
      return timeOrder
    }

    return left.slot.id.localeCompare(
      right.slot.id,
    )
  })

  return candidates
}

function occurrenceKey(
  slotId: string,
  occurrenceDate: string,
): string {
  return `${slotId}:${occurrenceDate}`
}

function SchemeLessonLauncherInner() {
  const params = useSearchParams()
  const router = useRouter()

  const classId = params.get('classId') ?? ''
  const subjectId = params.get('subjectId') ?? ''
  const schemeId = params.get('schemeId') ?? ''
  const curriculumId =
    params.get('curriculumId') ?? ''
  const grade = params.get('grade') ?? ''
  const subject = params.get('subject') ?? ''
  const strand = params.get('strand') ?? ''
  const subStrand = params.get('subStrand') ?? ''
  const topic = params.get('topic') ?? ''
  const week = params.get('week') ?? ''
  const term = params.get('term') ?? ''

  const [error, setError] =
    useState<string | null>(null)
  const [resolving, setResolving] =
    useState(true)
  const [retryKey, setRetryKey] =
    useState(0)

  const resolveAndOpen = useCallback(
    async (cancelled: () => boolean) => {
      setResolving(true)
      setError(null)

      if (!classId || !subjectId || !schemeId) {
        setError(
          'This Scheme lesson is missing its class, subject or Scheme identity.',
        )
        setResolving(false)
        return
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError(
            'Please sign in to prepare this lesson.',
          )
          setResolving(false)
          return
        }

        const [
          memberRes,
          teacherRes,
          profileRes,
          schemeRes,
        ] = await Promise.all([
          supabase
            .from('school_members')
            .select('school_id')
            .eq('profile_id', user.id)
            .maybeSingle(),
          supabase
            .from('teacher_profiles')
            .select('school_id')
            .eq('profile_id', user.id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('scheme_of_work')
            .select(
              'id, teacher_id, school_id, class_id, subject_id',
            )
            .eq('id', schemeId)
            .maybeSingle(),
        ])

        if (cancelled()) return

        const schoolId =
          memberRes.data?.school_id ??
          teacherRes.data?.school_id ??
          profileRes.data?.school_id ??
          null

        if (!schoolId) {
          setError(
            'Your teacher profile is not connected to a school.',
          )
          setResolving(false)
          return
        }

        if (schemeRes.error) {
          throw schemeRes.error
        }

        const scheme = schemeRes.data

        const validScheme =
          scheme !== null &&
          scheme.teacher_id === user.id &&
          scheme.school_id === schoolId &&
          scheme.class_id === classId &&
          scheme.subject_id === subjectId

        if (!validScheme) {
          setError(
            'This Scheme item does not belong to your selected class and subject.',
          )
          setResolving(false)
          return
        }

        const rangeStart = nairobiDateStr()
        const rangeEnd = nairobiDateAdd(
          rangeStart,
          55,
        )

        const timetable =
          await loadTeacherTimetableForRange({
            teacherId: user.id,
            schoolId,
            rangeStart,
            rangeEnd,
          })

        if (cancelled()) return

        const matchingSlots = timetable.filter(
          slot =>
            slot.class_id === classId &&
            slot.subject_id === subjectId,
        )

        const candidates = buildCandidates(
          matchingSlots,
          rangeStart,
          rangeEnd,
        )

        if (candidates.length === 0) {
          setError(
            'No upcoming timetable occurrence exists for this Scheme lesson in the next eight weeks.',
          )
          setResolving(false)
          return
        }

        const slotIds = Array.from(
          new Set(
            candidates.map(
              candidate => candidate.slot.id,
            ),
          ),
        )

        const { data: planRows, error: plansError } =
          await supabase
            .from('lesson_plans')
            .select(
              'id, timetable_slot_id, taught_date, scheme_id',
            )
            .eq('teacher_id', user.id)
            .eq('class_id', classId)
            .eq('subject_id', subjectId)
            .gte('taught_date', rangeStart)
            .lte('taught_date', rangeEnd)
            .in('timetable_slot_id', slotIds)

        if (plansError) {
          throw plansError
        }

        if (cancelled()) return

        const plans = (
          planRows ?? []
        ) as ExistingPlan[]

        const planByOccurrence = new Map(
          plans.map(plan => [
            occurrenceKey(
              plan.timetable_slot_id,
              plan.taught_date,
            ),
            plan,
          ]),
        )

        // OS authority order:
        // 1. Resume an occurrence already linked to this Scheme.
        // 2. Use the earliest empty occurrence.
        // 3. Never overwrite an occurrence linked elsewhere.
        const alreadyLinked =
          candidates.find(candidate => {
            const existing = planByOccurrence.get(
              occurrenceKey(
                candidate.slot.id,
                candidate.occurrenceDate,
              ),
            )

            return existing?.scheme_id === schemeId
          })

        const emptyOccurrence =
          candidates.find(candidate => {
            const existing = planByOccurrence.get(
              occurrenceKey(
                candidate.slot.id,
                candidate.occurrenceDate,
              ),
            )

            return existing === undefined
          })

        const selected =
          alreadyLinked ?? emptyOccurrence

        if (!selected) {
          setError(
            'All upcoming timetable occurrences already have lesson plans linked to other Scheme items. Open the timetable and choose another week.',
          )
          setResolving(false)
          return
        }

        const target = new URLSearchParams({
          classId,
          subjectId,
          timetableSlotId: selected.slot.id,
          date: selected.occurrenceDate,
          schemeId,
        })

        if (curriculumId) {
          target.set(
            'curriculumId',
            curriculumId,
          )
        }

        if (grade) target.set('grade', grade)
        if (subject) target.set('subject', subject)
        if (strand) target.set('strand', strand)
        if (subStrand) {
          target.set('subStrand', subStrand)
        }
        if (topic) target.set('topic', topic)
        if (week) target.set('week', week)
        if (term) target.set('term', term)

        router.replace(
          `/teacher/lessonplan?${target.toString()}`,
        )
      } catch (resolutionError) {
        console.error(
          '[SchemeLessonLauncher] resolution failed',
          resolutionError,
        )

        if (!cancelled()) {
          setError(
            'Could not open this Scheme lesson in the lesson workspace.',
          )
          setResolving(false)
        }
      }
    },
    [
      classId,
      curriculumId,
      grade,
      router,
      schemeId,
      strand,
      subStrand,
      subject,
      subjectId,
      term,
      topic,
      week,
      retryKey,
    ],
  )

  useEffect(() => {
    let cancelled = false

    void resolveAndOpen(() => cancelled)

    return () => {
      cancelled = true
    }
  }, [resolveAndOpen])

  return (
    <main style={{
      minHeight: '100vh',
      background: C.bg,
      padding: '24px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <section style={{
        width: '100%',
        maxWidth: 520,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 24,
        textAlign: 'center',
        boxShadow:
          '0 16px 40px rgba(15,23,42,0.08)',
      }}>
        {resolving && !error && (
          <>
            <div style={{
              width: 48,
              height: 48,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: C.indigoLight,
              color: C.indigo,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 800,
            }}>
              ✦
            </div>

            <h1 style={{
              margin: 0,
              color: C.text,
              fontSize: 19,
              fontWeight: 800,
            }}>
              Opening Lesson Workspace
            </h1>

            <p style={{
              margin: '8px 0 0',
              color: C.muted,
              fontSize: 13,
              lineHeight: 1.6,
            }}>
              Finding the next available timetable
              occurrence for {topic || 'this Scheme lesson'}.
            </p>
          </>
        )}

        {error && (
          <>
            <div style={{
              padding: 14,
              borderRadius: 12,
              background: C.redLight,
              color: C.red,
              fontSize: 13,
              lineHeight: 1.6,
              fontWeight: 600,
              marginBottom: 16,
            }}>
              {error}
            </div>

            <div style={{
              display: 'flex',
              gap: 10,
            }}>
              <button
                type="button"
                onClick={() =>
                  router.push('/teacher/timetable')
                }
                style={{
                  flex: 1,
                  padding: '11px 12px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Open Timetable
              </button>

              <button
                type="button"
                onClick={() =>
                  setRetryKey(value => value + 1)
                }
                style={{
                  flex: 1,
                  padding: '11px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: C.indigo,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default function SchemeLessonLauncherPage() {
  return (
    <Suspense fallback={
      <div style={{
        padding: 24,
        color: C.muted,
      }}>
        Opening lesson workspace…
      </div>
    }>
      <SchemeLessonLauncherInner />
    </Suspense>
  )
}

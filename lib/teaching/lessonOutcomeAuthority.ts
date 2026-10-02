import { supabase } from '@/lib/supabase'

export interface LessonOutcomeRef {
  id: string
  text: string
}

export type LessonOutcomeAuthorityCode =
  | 'grounded'
  | 'lesson_plan_not_found'
  | 'lesson_plan_not_owned'
  | 'lesson_plan_scheme_required'
  | 'scheme_item_not_found'
  | 'lesson_scheme_mismatch'
  | 'scheme_curriculum_required'
  | 'lesson_outcomes_required'
  | 'authority_unavailable'

export type LessonOutcomeAuthority =
  | {
      grounded: true
      code: 'grounded'
      schemeId: string
      curriculumId: string
      outcomes: LessonOutcomeRef[]
      message: null
    }
  | {
      grounded: false
      code: Exclude<LessonOutcomeAuthorityCode, 'grounded'>
      schemeId: null
      curriculumId: null
      outcomes: []
      message: string
    }

function authorityFailure(
  code: Exclude<LessonOutcomeAuthorityCode, 'grounded'>,
  message: string,
): LessonOutcomeAuthority {
  return {
    grounded: false,
    code,
    schemeId: null,
    curriculumId: null,
    outcomes: [],
    message,
  }
}

function errorCode(message: string): Exclude<LessonOutcomeAuthorityCode, 'grounded'> {
  const known: Array<Exclude<LessonOutcomeAuthorityCode, 'grounded'>> = [
    'lesson_plan_not_found',
    'lesson_plan_not_owned',
    'lesson_plan_scheme_required',
    'scheme_item_not_found',
    'lesson_scheme_mismatch',
    'scheme_curriculum_required',
  ]
  return known.find(code => message.includes(code)) ?? 'authority_unavailable'
}

function authorityMessage(code: Exclude<LessonOutcomeAuthorityCode, 'grounded'>): string {
  switch (code) {
    case 'lesson_plan_scheme_required':
      return 'This lesson is not linked to a Scheme of Work objective yet. Link the lesson to the Scheme before generating or delivering outcome-grounded work.'
    case 'scheme_item_not_found':
      return 'The Scheme item linked to this lesson no longer exists. Reconnect the lesson to an authoritative Scheme item.'
    case 'lesson_scheme_mismatch':
      return 'The linked Scheme item no longer matches this lesson’s teacher, class or subject.'
    case 'scheme_curriculum_required':
      return 'The linked Scheme item has no curriculum authority yet. Complete the Scheme curriculum connection first.'
    case 'lesson_plan_not_found':
      return 'This lesson plan no longer exists.'
    case 'lesson_plan_not_owned':
      return 'This lesson belongs to a different teacher.'
    default:
      return 'Authoritative lesson outcomes could not be verified. Try again from the saved lesson.'
  }
}

/**
 * One client boundary for the server-authoritative lesson outcome chain.
 * The RPC validates ownership, Scheme identity, Scheme curriculum identity and
 * resolves only active curriculum outcomes that are actually present in the
 * saved lesson body. Callers must never infer authority from free-text sections.
 */
export async function resolveLessonOutcomeAuthority(
  lessonPlanId: string,
): Promise<LessonOutcomeAuthority> {
  const { data, error } = await supabase.rpc(
    'exq_resolve_lesson_assessment_outcomes' as never,
    { p_lesson_plan_id: lessonPlanId } as never,
  )

  if (error) {
    const code = errorCode(error.message ?? '')
    return authorityFailure(code, authorityMessage(code))
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return authorityFailure(
      'authority_unavailable',
      'Authoritative lesson outcomes returned an invalid result.',
    )
  }

  const payload = data as Record<string, unknown>
  const schemeId = typeof payload.scheme_id === 'string' ? payload.scheme_id : null
  const curriculumId =
    typeof payload.curriculum_id === 'string' ? payload.curriculum_id : null

  const outcomes = (Array.isArray(payload.outcomes) ? payload.outcomes : [])
    .flatMap(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return []
      const row = value as Record<string, unknown>
      return typeof row.id === 'string' && typeof row.outcome_text === 'string'
        ? [{ id: row.id, text: row.outcome_text.trim() }]
        : []
    })
    .filter(outcome => outcome.text.length > 0)

  if (!schemeId || !curriculumId) {
    return authorityFailure(
      'authority_unavailable',
      'The lesson authority chain is incomplete.',
    )
  }

  if (outcomes.length === 0) {
    return authorityFailure(
      'lesson_outcomes_required',
      'No active curriculum outcome is grounded in this saved lesson yet. Add or reconnect authoritative lesson outcomes before generating or delivering assessed work.',
    )
  }

  return {
    grounded: true,
    code: 'grounded',
    schemeId,
    curriculumId,
    outcomes,
    message: null,
  }
}

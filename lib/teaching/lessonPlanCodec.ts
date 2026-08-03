/**
 * Canonical lesson_plans.body contract.
 *
 * Every lesson-plan generator and editor must use this codec. The database
 * column stores the tagged text produced by serializeLessonPlanBody().
 */

export const LESSON_PLAN_SECTION_KEYS = [
  'objectives',
  'resources',
  'introduction',
  'development',
  'consolidation',
  'assessmentHook',
  'homework',
  'differentiation',
] as const

export type LessonPlanSectionKey =
  typeof LESSON_PLAN_SECTION_KEYS[number]

export type LessonPlanSections = Record<
  LessonPlanSectionKey,
  string
>

export const EMPTY_LESSON_PLAN_SECTIONS: LessonPlanSections = {
  objectives: '',
  resources: '',
  introduction: '',
  development: '',
  consolidation: '',
  assessmentHook: '',
  homework: '',
  differentiation: '',
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

/**
 * Validates the structured object returned by an AI generator.
 *
 * All eight canonical keys must exist and contain strings. Empty strings are
 * allowed here because the UI may permit editing, but missing or renamed keys
 * are rejected.
 */
export function parseGeneratedLessonPlan(
  value: unknown,
): LessonPlanSections | null {
  if (!isRecord(value)) return null

  const result = {
    ...EMPTY_LESSON_PLAN_SECTIONS,
  }

  for (const key of LESSON_PLAN_SECTION_KEYS) {
    if (typeof value[key] !== 'string') {
      return null
    }

    result[key] = value[key].trim()
  }

  return result
}

/**
 * Parses the canonical tagged lesson_plans.body value.
 *
 * At least three recognised sections must exist to preserve the established
 * rejection behaviour for malformed or unrelated text.
 */
export function parseLessonPlanBody(
  raw: string,
): LessonPlanSections | null {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null
  }

  const result = {
    ...EMPTY_LESSON_PLAN_SECTIONS,
  }

  let filled = 0

  for (const key of LESSON_PLAN_SECTION_KEYS) {
    const escapedKey = key.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    )

    const match = raw.match(
      new RegExp(
        `<${escapedKey}>([\\s\\S]*?)</${escapedKey}>`,
      ),
    )

    if (match) {
      result[key] = match[1].trim()
      filled += 1
    }
  }

  return filled >= 3 ? result : null
}

/**
 * Produces the only supported persisted lesson_plans.body format.
 */
export function serializeLessonPlanBody(
  sections: LessonPlanSections,
): string {
  return LESSON_PLAN_SECTION_KEYS
    .map(
      key =>
        `<${key}>\n${sections[key].trim()}\n</${key}>`,
    )
    .join('\n\n')
}

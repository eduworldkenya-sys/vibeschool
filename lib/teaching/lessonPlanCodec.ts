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

const MAX_SECTION_LENGTH = 24_000
const CANONICAL_TAG_PATTERN = new RegExp(
  `<\\/?(?:${LESSON_PLAN_SECTION_KEYS.join('|')})\\b[^>]*>`,
  'i',
)

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function normalizeSection(value: string): string | null {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length > MAX_SECTION_LENGTH) return null

  // Canonical tags are transport delimiters, never valid section content.
  // Rejecting them prevents one edited/generated field from terminating its
  // own section and smuggling or corrupting a neighbouring section.
  if (CANONICAL_TAG_PATTERN.test(normalized)) return null

  return normalized
}

/**
 * Validates the structured object returned by a generator/editor boundary.
 *
 * All eight canonical keys must exist and contain strings. Empty strings stay
 * representable while a teacher is editing, but malformed, oversized or
 * delimiter-injecting values are rejected before persistence.
 */
export function parseGeneratedLessonPlan(
  value: unknown,
): LessonPlanSections | null {
  if (!isRecord(value)) return null

  const result = {
    ...EMPTY_LESSON_PLAN_SECTIONS,
  }

  for (const key of LESSON_PLAN_SECTION_KEYS) {
    if (typeof value[key] !== 'string') return null

    const normalized = normalizeSection(value[key])
    if (normalized === null) return null
    result[key] = normalized
  }

  return result
}

/**
 * Parses the canonical tagged lesson_plans.body value.
 *
 * Exactly one occurrence of every canonical section is required. Older
 * partially-tagged/malformed bodies intentionally fail closed instead of being
 * treated as teach-ready merely because three tags happened to parse.
 */
export function parseLessonPlanBody(
  raw: string,
): LessonPlanSections | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null

  const result = {
    ...EMPTY_LESSON_PLAN_SECTIONS,
  }

  for (const key of LESSON_PLAN_SECTION_KEYS) {
    const escapedKey = key.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    )
    const pattern = new RegExp(
      `<${escapedKey}>([\\s\\S]*?)</${escapedKey}>`,
      'g',
    )
    const matches = [...raw.matchAll(pattern)]
    if (matches.length !== 1) return null

    const normalized = normalizeSection(matches[0][1])
    if (normalized === null) return null
    result[key] = normalized
  }

  // Reject unknown text outside the canonical envelope. This catches broken
  // closing tags, duplicate transport fragments and accidental free-form
  // persistence while allowing normal whitespace between sections.
  const canonical = serializeLessonPlanBody(result)
  const normalizeEnvelope = (value: string) => value.replace(/\r\n?/g, '\n').trim()
  if (normalizeEnvelope(raw) !== normalizeEnvelope(canonical)) return null

  return result
}

/**
 * Produces the only supported persisted lesson_plans.body format.
 */
export function serializeLessonPlanBody(
  sections: LessonPlanSections,
): string {
  const normalized: LessonPlanSections = { ...EMPTY_LESSON_PLAN_SECTIONS }

  for (const key of LESSON_PLAN_SECTION_KEYS) {
    const value = normalizeSection(sections[key])
    if (value === null) {
      throw new Error(`Invalid lesson plan section: ${key}`)
    }
    normalized[key] = value
  }

  return LESSON_PLAN_SECTION_KEYS
    .map(
      key =>
        `<${key}>\n${normalized[key]}\n</${key}>`,
    )
    .join('\n\n')
}

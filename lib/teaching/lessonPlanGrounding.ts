import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'

export interface LessonPlanGroundingInput {
  sections: LessonPlanSections
  schemeObjectives?: string | null
  allowedContentFragments?: string[]
}

export type LessonPlanGroundingResult =
  | { ok: true }
  | { ok: false; message: string }

function clean(value?: string | null): string {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

function objectiveParts(value?: string | null): string[] {
  const normalized = clean(value)
  if (!normalized) return []

  return normalized
    .split(/\s*[|;]\s*|\n+/)
    .map(clean)
    .filter(Boolean)
}

function includesNormalized(haystack: string, needle: string): boolean {
  return clean(haystack)
    .toLocaleLowerCase()
    .includes(clean(needle).toLocaleLowerCase())
}

/**
 * Deterministic pre-save grounding gate.
 *
 * It proves the invariants that do not require semantic model judgment:
 * - every authoritative Scheme objective is copied into the objectives block;
 * - every Scheme objective is explicitly named by the assessment block;
 * - all eight canonical plan sections are non-empty.
 *
 * The builder itself is constrained to Scheme fields, certified payloads and
 * template prose, so no web/model content can enter this path.
 */
export function validateLessonPlanGrounding({
  sections,
  schemeObjectives,
}: LessonPlanGroundingInput): LessonPlanGroundingResult {
  for (const [key, value] of Object.entries(sections)) {
    if (!clean(value)) {
      return {
        ok: false,
        message: `Grounding validation failed: ${key} is empty.`,
      }
    }
  }

  const objectives = objectiveParts(schemeObjectives)

  for (const objective of objectives) {
    if (!includesNormalized(sections.objectives, objective)) {
      return {
        ok: false,
        message:
          'Grounding validation failed: a Scheme objective is missing from the lesson objectives.',
      }
    }

    if (!includesNormalized(sections.assessmentHook, objective)) {
      return {
        ok: false,
        message:
          'Grounding validation failed: assessment is not explicitly tied to every Scheme objective.',
      }
    }
  }

  return { ok: true }
}

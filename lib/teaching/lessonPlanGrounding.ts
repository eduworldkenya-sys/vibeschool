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
  return normalized.split(/\s*[|;]\s*|\n+/).map(clean).filter(Boolean)
}

function includesNormalized(haystack: string, needle: string): boolean {
  return clean(haystack).toLocaleLowerCase().includes(clean(needle).toLocaleLowerCase())
}

/**
 * Deterministic pre-save grounding/readiness gate for invariants that can be
 * proven without semantic model judgment.
 */
export function validateLessonPlanGrounding({
  sections,
  schemeObjectives,
}: LessonPlanGroundingInput): LessonPlanGroundingResult {
  for (const [key, value] of Object.entries(sections)) {
    if (!clean(value)) {
      return { ok: false, message: `Grounding validation failed: ${key} is empty.` }
    }
  }

  for (const objective of objectiveParts(schemeObjectives)) {
    if (!includesNormalized(sections.objectives, objective)) {
      return { ok: false, message: 'Grounding validation failed: a Scheme objective is missing from the lesson objectives.' }
    }
    if (!includesNormalized(sections.assessmentHook, objective)) {
      return { ok: false, message: 'Grounding validation failed: assessment is not explicitly tied to every Scheme objective.' }
    }
  }

  if (!/Total lesson time:\s*\d+\/\d+ min/i.test(sections.assessmentHook)) {
    return { ok: false, message: 'Readiness validation failed: lesson timing total is missing.' }
  }

  if (!/Learner activities/i.test(sections.development)) {
    return { ok: false, message: 'Readiness validation failed: learner activities are missing.' }
  }

  return { ok: true }
}

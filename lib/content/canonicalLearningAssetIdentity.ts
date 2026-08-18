export const CANONICAL_LEARNING_ASSET_KEY_VERSION = 1 as const

export type CanonicalLearningAssetKind =
  | 'lesson_plan'
  | 'teacher_notes'
  | 'learner_notes'
  | 'homework'
  | 'quiz'
  | 'exercise'
  | 'revision'
  | 'worksheet'
  | 'assessment'
  | 'worked_example'
  | 'project'
  | 'practical'
  | 'remedial'
  | 'enrichment'
  | 'marking_scheme'
  | 'rubric'
  | 'content_block'

export type CanonicalLearningAssetPurpose =
  | 'teach'
  | 'practise'
  | 'assess'
  | 'revise'
  | 'remediate'
  | 'enrich'
  | 'reference'

export interface CanonicalLearningAssetIdentityInput {
  /** ISO-style jurisdiction key. Kenya defaults to `ke`. */
  jurisdiction?: string
  /** Stable curriculum row ID/version authority, never a display label alone. */
  curriculumId: string
  /** Stable subject authority ID. */
  subjectId: string
  /** Grade/form/stage identity used by the curriculum authority. */
  grade: string
  /** Stable strand/sub-strand authority when available. */
  strandId?: string | null
  /** Stable learning-outcome IDs; ordering does not affect identity. */
  outcomeIds?: readonly string[] | null
  /**
   * Stable curriculum topic key used only when neither strand nor outcome IDs
   * are available. This must be an authority-backed key, not arbitrary title
   * text supplied by a teacher.
   */
  topicKey?: string | null
  assetKind: CanonicalLearningAssetKind
  purpose: CanonicalLearningAssetPurpose
  /** BCP-47-ish language key; defaults to English. */
  language?: string
  /**
   * Optional material variant that legitimately changes reusable educational
   * substance (for example `foundation`, `core`, `extension`). Do not put
   * teacher, school, class, learner, date, timetable or delivery data here.
   */
  variant?: string | null
}

export interface CanonicalLearningAssetIdentity {
  keyVersion: typeof CANONICAL_LEARNING_ASSET_KEY_VERSION
  familyKey: string
  normalized: {
    jurisdiction: string
    curriculumId: string
    subjectId: string
    grade: string
    strandId: string | null
    outcomeIds: string[]
    topicKey: string | null
    assetKind: CanonicalLearningAssetKind
    purpose: CanonicalLearningAssetPurpose
    language: string
    variant: string | null
  }
}

function normalizeRequired(value: string, field: string): string {
  const normalized = normalizeDimension(value)

  if (!normalized) {
    throw new Error(`canonicalLearningAssetIdentity: ${field} is required.`)
  }

  return normalized
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) return null
  const normalized = normalizeDimension(value)
  return normalized || null
}

/**
 * Normalizes a stable authority dimension into a key-safe representation.
 * This is intentionally deterministic, locale-independent and conservative.
 */
export function normalizeCanonicalAssetDimension(value: string): string {
  return normalizeDimension(value)
}

function normalizeDimension(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeOutcomeIds(values: readonly string[] | null | undefined): string[] {
  const normalized = Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeDimension(value))
        .filter(Boolean),
    ),
  )

  normalized.sort()
  return normalized
}

/**
 * Builds the stable family identity used by lookup-before-generation.
 *
 * Deliberately absent from the input contract: teacher, school, class,
 * learner, timetable slot, teaching date, learner count, deadlines and other
 * delivery context. Those belong to adoption/occurrence records, never the
 * global reusable educational identity.
 */
export function buildCanonicalLearningAssetIdentity(
  input: CanonicalLearningAssetIdentityInput,
): CanonicalLearningAssetIdentity {
  const jurisdiction = normalizeRequired(input.jurisdiction ?? 'ke', 'jurisdiction')
  const curriculumId = normalizeRequired(input.curriculumId, 'curriculumId')
  const subjectId = normalizeRequired(input.subjectId, 'subjectId')
  const grade = normalizeRequired(input.grade, 'grade')
  const strandId = normalizeOptional(input.strandId)
  const outcomeIds = normalizeOutcomeIds(input.outcomeIds)
  const topicKey = normalizeOptional(input.topicKey)
  const language = normalizeRequired(input.language ?? 'en', 'language')
  const variant = normalizeOptional(input.variant)

  if (!strandId && outcomeIds.length === 0 && !topicKey) {
    throw new Error(
      'canonicalLearningAssetIdentity: strandId, outcomeIds or an authority-backed topicKey is required.',
    )
  }

  const dimensions = [
    `cla:v${CANONICAL_LEARNING_ASSET_KEY_VERSION}`,
    `jurisdiction=${jurisdiction}`,
    `curriculum=${curriculumId}`,
    `grade=${grade}`,
    `subject=${subjectId}`,
    `strand=${strandId ?? '-'}`,
    `outcomes=${outcomeIds.length ? outcomeIds.join(',') : '-'}`,
    `topic=${topicKey ?? '-'}`,
    `kind=${input.assetKind}`,
    `purpose=${input.purpose}`,
    `language=${language}`,
    `variant=${variant ?? '-'}`,
  ]

  return {
    keyVersion: CANONICAL_LEARNING_ASSET_KEY_VERSION,
    familyKey: dimensions.join('|'),
    normalized: {
      jurisdiction,
      curriculumId,
      subjectId,
      grade,
      strandId,
      outcomeIds,
      topicKey,
      assetKind: input.assetKind,
      purpose: input.purpose,
      language,
      variant,
    },
  }
}

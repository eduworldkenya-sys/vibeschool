/**
 * Canonical outcome-package assembly (v1).
 * This produces a manifest for learning_resource_versions.payload; it does not
 * create a second inventory, certify anything or publish learner content.
 * Postgres cla_audit_outcome_package is the authoritative readiness check.
 */
export const OUTCOME_PACKAGE_SCHEMA = 'vibeschool.outcome-package.v1' as const

export type OutcomeExperience = 'core' | 'activities' | 'revision'
export type OutcomeReleaseState = 'draft' | 'ready' | 'released'
export type OutcomeAssetRole = OutcomeExperience | 'teacher_guidance' | 'visual_assets'

export type PinnedLearningResource = Readonly<{
  resource_id: string
  resource_version_id: string
}>

export type OutcomePackageManifest = Readonly<{
  schema: typeof OUTCOME_PACKAGE_SCHEMA
  outcome_id: string
  curriculum_outcome_aliases: readonly string[]
  requirements: Readonly<{ teacher_guidance: boolean; visual_assets: boolean }>
  assets: Readonly<Record<OutcomeAssetRole, readonly PinnedLearningResource[]>>
  question_ids: Readonly<Record<'activities' | 'revision', readonly string[]>>
  release: Readonly<Record<OutcomeExperience, OutcomeReleaseState>>
}>

export type OutcomePackageInput = {
  outcomeId: string
  outcomeAliases?: readonly string[]
  assets?: Partial<Record<OutcomeAssetRole, readonly PinnedLearningResource[]>>
  questionIds?: Partial<Record<'activities' | 'revision', readonly string[]>>
  requirements?: Partial<{ teacherGuidance: boolean; visualAssets: boolean }>
  release?: Partial<Record<OutcomeExperience, OutcomeReleaseState>>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES: readonly OutcomeAssetRole[] =
  ['core', 'activities', 'revision', 'teacher_guidance', 'visual_assets']
const EXPERIENCES: readonly OutcomeExperience[] = ['core', 'activities', 'revision']

function normalizedId(raw: string, label: string): string {
  if (typeof raw !== 'string' || !UUID.test(raw)) {
    throw new Error(`outcomePackage: invalid ${label}`)
  }
  return raw.toLowerCase()
}

function pinsFor(role: OutcomeAssetRole, entries: readonly PinnedLearningResource[] = []): PinnedLearningResource[] {
  if (!Array.isArray(entries)) throw new Error(`outcomePackage: ${role} must be an array`)
  const seen = new Set<string>()
  const values = entries.map((entry) => {
    const resource_id = normalizedId(entry?.resource_id, `${role}.resource_id`)
    const resource_version_id = normalizedId(entry?.resource_version_id, `${role}.resource_version_id`)
    if (seen.has(resource_version_id)) throw new Error(`outcomePackage: duplicate ${role} version`)
    seen.add(resource_version_id)
    return { resource_id, resource_version_id }
  })
  if (role === 'core' && values.length > 1) {
    throw new Error('outcomePackage: core must contain at most one pinned unit')
  }
  return values
}

function questionsFor(role: 'activities' | 'revision', ids: readonly string[] = []): string[] {
  if (!Array.isArray(ids)) throw new Error(`outcomePackage: ${role} question IDs must be an array`)
  const values = ids.map((id) => normalizedId(id, `${role} question ID`))
  if (new Set(values).size !== values.length) {
    throw new Error(`outcomePackage: duplicate ${role} question ID`)
  }
  return values
}

export function buildOutcomePackageManifest(input: OutcomePackageInput): OutcomePackageManifest {
  const outcome_id = normalizedId(input.outcomeId, 'outcome ID')
  const aliases = input.outcomeAliases ?? []
  if (!Array.isArray(aliases) || aliases.some((alias) =>
    typeof alias !== 'string' || !alias.trim() || alias !== alias.trim()) ||
    new Set(aliases).size !== aliases.length) {
    throw new Error('outcomePackage: invalid or duplicate curriculum aliases')
  }
  const assets = {} as Record<OutcomeAssetRole, PinnedLearningResource[]>
  for (const role of ROLES) assets[role] = pinsFor(role, input.assets?.[role])
  const question_ids = {
    activities: questionsFor('activities', input.questionIds?.activities),
    revision: questionsFor('revision', input.questionIds?.revision),
  }
  if (input.requirements?.teacherGuidance != null
      && typeof input.requirements.teacherGuidance !== 'boolean') {
    throw new Error('outcomePackage: teacher guidance requirement must be boolean')
  }
  if (input.requirements?.visualAssets != null
      && typeof input.requirements.visualAssets !== 'boolean') {
    throw new Error('outcomePackage: visual requirement must be boolean')
  }
  const release = {} as Record<OutcomeExperience, OutcomeReleaseState>
  for (const experience of EXPERIENCES) {
    const state = input.release?.[experience] ?? 'draft'
    if (!(['draft', 'ready', 'released'] as readonly string[]).includes(state)) {
      throw new Error(`outcomePackage: invalid ${experience} release state`)
    }
    if (state !== 'draft') {
      const contentCount = assets[experience].length
        + (experience === 'core' ? 0 : question_ids[experience].length)
      if (contentCount === 0) {
        throw new Error(`outcomePackage: ${experience} cannot be ${state} without content`)
      }
    }
    release[experience] = state
  }
  return {
    schema: OUTCOME_PACKAGE_SCHEMA,
    outcome_id,
    curriculum_outcome_aliases: [...aliases],
    requirements: {
      teacher_guidance: input.requirements?.teacherGuidance ?? false,
      visual_assets: input.requirements?.visualAssets ?? false,
    },
    assets,
    question_ids,
    release,
  }
}

/**
 * DB output is always consulted before release. It re-checks outcome authority,
 * version pins, visibility, question approval and required attachments.
 */
export type OutcomePackageAudit = {
  valid: boolean
  issues: string[]
  curriculum_reconciled: boolean
  asset_counts: Record<OutcomeAssetRole, number>
  experiences: Record<OutcomeExperience, {
    completeness: 'complete' | 'incomplete'
    release: OutcomeReleaseState
    releasable: boolean
  }>
}

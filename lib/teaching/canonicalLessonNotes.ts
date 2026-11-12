/**
 * A read-only projection of the existing certified learning-resource authority.
 *
 * A resource linked only to a sub-strand must never be claimed as an exact
 * learning-outcome match. This protects Grade 4 Time's unresolved aliases.
 */
export type CanonicalNoteRoot = {
  id: string
  title: string
  asset_kind: string | null
  status: string
  visibility: string
  curriculum_outcome_id: string | null
  sub_strand_id: string | null
}

export type CanonicalNoteVersion = {
  id: string
  resource_id: string
  version: number
  lifecycle_status: string
  certified_at: string | null
}

export type CanonicalNoteLink = {
  resourceId: string
  resourceVersionId: string
  title: string
  kind: 'teacher_notes' | 'learner_notes'
  version: number
  scope: 'exact_outcome' | 'related_sub_strand'
}

/** Accept released roots and exact certified versions only; never upgrade a draft. */
export function selectCanonicalLessonNotes(
  roots: CanonicalNoteRoot[],
  versions: CanonicalNoteVersion[],
  outcomeId: string | null,
  subStrandId: string | null,
): CanonicalNoteLink[] {
  const newest = new Map<string, CanonicalNoteVersion>()
  for (const version of versions) {
    if (
      version.lifecycle_status !== 'certified' ||
      !version.certified_at ||
      !Number.isSafeInteger(version.version) ||
      version.version < 1
    ) continue
    const previous = newest.get(version.resource_id)
    if (!previous || version.version > previous.version) newest.set(version.resource_id, version)
  }
  const seen = new Set<string>()
  return roots.flatMap(root => {
    if (seen.has(root.id)) return []
    seen.add(root.id)
    if (root.status !== 'active' || root.visibility !== 'public') return []
    if (root.asset_kind !== 'learner_notes' && root.asset_kind !== 'teacher_notes') return []
    const exact = Boolean(outcomeId && root.curriculum_outcome_id === outcomeId)
    const related = Boolean(
      subStrandId &&
      root.sub_strand_id === subStrandId &&
      root.curriculum_outcome_id === null,
    )
    if (!exact && !related) return []
    const version = newest.get(root.id)
    if (!version) return []
    return [{
      resourceId: root.id,
      resourceVersionId: version.id,
      title: root.title,
      kind: root.asset_kind as 'teacher_notes' | 'learner_notes',
      version: version.version,
      scope: exact ? 'exact_outcome' as const : 'related_sub_strand' as const,
    }]
  }).sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'exact_outcome' ? -1 : 1
    if (a.kind !== b.kind) return a.kind === 'teacher_notes' ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}

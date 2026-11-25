/** One resource identity per lesson; explicit canonical pins outrank unpinned
 * compatibility/curriculum candidates. Conflicting explicit pins are omitted,
 * never resolved by recency or fallback. */
export interface PinCandidate {
  id: string
  pinnedVersionId?: string | null
  pinConflict?: boolean
}

export function mergePinnedCandidates<T extends PinCandidate>(items: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of items) {
    const previous = byId.get(item.id)
    if (!previous) { byId.set(item.id, { ...item }); continue }
    const first = previous.pinnedVersionId
    const next = item.pinnedVersionId
    const conflict = Boolean(previous.pinConflict || item.pinConflict || (first && next && first !== next))
    byId.set(item.id, { ...previous, pinnedVersionId: first ?? next ?? null, pinConflict: conflict })
  }
  return [...byId.values()]
}

export function selectPinnedVersion<T extends { id: string; resource_id: string }>(
  candidate: PinCandidate,
  byVersionId: ReadonlyMap<string, T>,
  newestByResource: ReadonlyMap<string, T>,
): T | undefined {
  if (candidate.pinConflict) return undefined
  const version = candidate.pinnedVersionId
    ? byVersionId.get(candidate.pinnedVersionId)
    : newestByResource.get(candidate.id)
  return version?.resource_id === candidate.id ? version : undefined
}

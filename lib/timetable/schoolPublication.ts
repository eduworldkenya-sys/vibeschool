/**
 * Stage 3 school publication projection. The existing school releases are
 * authoritative; a sample, draft or reviewed timetable is not official.
 * Only pass rows returned by membership-filtered server RLS.
 */
export interface SchoolPublicationRow {
  id: string
  school_id: string
  label: string
  status: string
  effective_from: string
  published_at?: string | null
}

export function effectivePublishedSchoolReleases(
  releases: readonly SchoolPublicationRow[],
  verifiedSchoolIds: readonly string[],
  throughDate: string,
): Record<string, SchoolPublicationRow> {
  const verified = new Set(verifiedSchoolIds)
  const selected: Record<string, SchoolPublicationRow> = {}
  for (const row of releases) {
    if (!verified.has(row.school_id) || row.status !== 'published'
      || !row.published_at || !row.id || row.effective_from > throughDate) continue
    const prior = selected[row.school_id]
    if (!prior || prior.effective_from < row.effective_from
       || (prior.effective_from === row.effective_from && (prior.published_at ?? '') < (row.published_at ?? ''))) {
      selected[row.school_id] = row
    }
  }
  return selected
}

export function belongsToPublishedSchoolSlot(
  schoolId: string, releaseId: string | null,
  publications: Readonly<Record<string, SchoolPublicationRow>>,
): boolean {
  return !!releaseId && publications[schoolId]?.id === releaseId
}

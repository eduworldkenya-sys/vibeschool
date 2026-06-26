import { supabase } from '@/lib/supabase'

export interface StrandRow {
  id:   string
  name: string
}

/**
 * Ensures the per-school `strands` table has a row for every distinct
 * strand name found in the master `curriculum` table (KICD reference data)
 * for a given grade + subject.
 *
 * `strands` is the shared backbone for Scheme of Work (strand_progress),
 * Assessment (cbc_assessments.strand_id), and Report Cards — but nothing
 * in the app ever created rows in it, so it sat empty until someone
 * seeded it manually via SQL. This makes it self-populating instead.
 *
 * Safe to call repeatedly: only inserts names that don't already exist,
 * and falls back to a re-fetch if a concurrent insert collides.
 */
export async function ensureStrandsForSubject(params: {
  schoolId:     string
  subjectId:    string
  subjectLabel: string
  grade:        string
}): Promise<StrandRow[]> {
  const { schoolId, subjectId, subjectLabel, grade } = params

  const [existingRes, curriculumRes] = await Promise.all([
    supabase.from('strands').select('id,name').eq('subject_id', subjectId).eq('school_id', schoolId),
    supabase.from('curriculum').select('strand').eq('grade', grade).eq('subject', subjectLabel),
  ])

  const existing: StrandRow[] = existingRes.data ?? []
  const existingNames = new Set(existing.map(s => s.name))

  const curriculumNames = Array.from(
    new Set(
      (curriculumRes.data ?? [])
        .map((c: { strand: string }) => c.strand)
        .filter((name: string | null | undefined): name is string => !!name)
    )
  )

  const missing = curriculumNames.filter(name => !existingNames.has(name))
  if (missing.length === 0) return existing

  const { data: inserted, error } = await supabase
    .from('strands')
    .insert(missing.map(name => ({ name, subject_id: subjectId, school_id: schoolId })))
    .select('id,name')

  if (error) {
    // Another tab / teacher likely inserted the same names concurrently.
    // Re-fetch rather than surface a failure for what is a non-fatal race.
    const { data: refreshed } = await supabase
      .from('strands').select('id,name').eq('subject_id', subjectId).eq('school_id', schoolId)
    return refreshed ?? existing
  }

  return [...existing, ...((inserted ?? []) as StrandRow[])]
}

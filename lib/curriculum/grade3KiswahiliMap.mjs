/**
 * Grade 3 Kiswahili: read-only projection of EXISTING canonical records.
 * No source-exact KICD wording is bundled in this module.
 * This is a navigation adapter, not another curriculum authority or Scheme writer.
 */
export const GRADE3_KISWAHILI_WEEKLY_PERIODS = 4;
export const GRADE3_KISWAHILI_SOURCE_CATALOGUE = 'https://kicd.ac.ke/cbc-materials/curriculum-designs/lower-primary-designs/';
export const GRADE3_KISWAHILI_SOURCE_DOCUMENT = 'https://drive.google.com/file/d/1xVa-cvQ3jSlfR4yNEL3DIXGmU-U7tHXk/preview';

/** Only active VibeSchool-authored outcomes can be shown to teachers. */
export function projectGrade3KiswahiliRows(strands, outcomes, globalSubjectId) {
  if (!globalSubjectId || !Array.isArray(strands) || !Array.isArray(outcomes)) return [];
  const ids = new Set();
  const eligible = strands.filter(row => {
    if (!row?.id || ids.has(row.id) ||
        row.grade !== 'Grade 3' || row.subject_id !== globalSubjectId ||
        !row.name || !row.sub_strand) return false;
    ids.add(row.id);
    return true;
  });
  const grouped = new Map(eligible.map(row => [row.id, []]));
  for (const outcome of outcomes) {
    if (!grouped.has(outcome?.sub_strand_id) ||
        outcome.status !== 'active' ||
        outcome.source_type !== 'creator_claimed' ||
        typeof outcome.source_ref !== 'string' ||
        !outcome.source_ref.startsWith('VS-CUR-G03-SW-2026#') ||
        !outcome.outcome_text?.trim()) continue;
    grouped.get(outcome.sub_strand_id).push({
      id: outcome.id,
      text: outcome.outcome_text,
      code: outcome.outcome_code || null
    });
  }
  return eligible.map(row => ({
    id: row.id,
    strand: row.name,
    subStrand: row.sub_strand,
    sourceLinked: Boolean(row.source_ref),
    outcomes: grouped.get(row.id).sort((a, b) => (a.code || '').localeCompare(b.code || ''))
  })).sort((a, b) => a.strand.localeCompare(b.strand, 'sw') || a.subStrand.localeCompare(b.subStrand, 'sw'));
}

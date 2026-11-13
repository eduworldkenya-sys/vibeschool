/**
 * Grade 3 Kiswahili: project existing canonical curriculum identities into
 * the teacher's Curriculum Map and the same authenticated Scheme workflow.
 * No KICD full-text, authorisation decision or Scheme write is performed here.
 */
export const GRADE3_KISWAHILI_WEEKLY_PERIODS = 4;
export const GRADE3_KISWAHILI_SOURCE_CATALOGUE = 'https://kicd.ac.ke/cbc-materials/lower-primary/';
export const GRADE3_KISWAHILI_SOURCE_DOCUMENT = 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-Kiswahili-Revised.pdf';
export const GRADE3_KISWAHILI_ORIGINAL_PREFIX = 'VS-CUR-G03-SW-2026#';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const hasText = list => Array.isArray(list) && list.some(nonempty);

export function isGrade3KiswahiliSchemeEligible(unit) {
  return Boolean(
    unit &&
    /^VS-CUR-G03-SW-2026#[a-zA-Z0-9._-]+$/.test(unit.sourceRef || '') &&
    unit.sourceLinked &&
    unit.outcomes?.length > 0 &&
    hasText(unit.inquiries) && hasText(unit.experiences) &&
    unit.guidanceStatus === 'active' &&
    nonempty(unit.learningResources) && nonempty(unit.assessmentMethods)
  );
}

/** Fail closed if an outcome is not an active, original, exactly source-linked record. */
export function projectGrade3KiswahiliRows(strands, outcomes, globalSubjectId, guidanceRows = []) {
  if (!globalSubjectId || !Array.isArray(strands) || !Array.isArray(outcomes) ||
      !Array.isArray(guidanceRows)) return [];
  const ids = new Set();
  const eligible = strands.filter(row => {
    if (!row?.id || ids.has(row.id) ||
        row.grade !== 'Grade 3' || row.subject_id !== globalSubjectId ||
        !nonempty(row.name) || !nonempty(row.sub_strand)) return false;
    ids.add(row.id);
    return true;
  });
  const byId = new Map(eligible.map(row => [row.id, row]));
  const grouped = new Map(eligible.map(row => [row.id, []]));
  const seenOutcomes = new Set();
  for (const outcome of outcomes) {
    const row = byId.get(outcome?.sub_strand_id);
    if (!row || !outcome?.id || seenOutcomes.has(outcome.id) ||
        !/^VS-CUR-G03-SW-2026#[a-zA-Z0-9._-]+$/.test(row.source_ref || '') ||
        outcome.status !== 'active' || outcome.source_type !== 'creator_claimed' ||
        outcome.source_ref?.startsWith(row.source_ref + '/') !== true ||
        !nonempty(outcome.outcome_text)) continue;
    seenOutcomes.add(outcome.id);
    grouped.get(row.id).push({
      id: outcome.id,
      text: outcome.outcome_text,
      code: outcome.outcome_code || null
    });
  }
  const guidanceById = new Map(guidanceRows
    .filter(item => item?.sub_strand_id && item.content_status === 'active')
    .map(item => [item.sub_strand_id, item]));
  return eligible.map(row => {
    const guide = guidanceById.get(row.id);
    const unit = {
      id: row.id,
      strand: row.name,
      subStrand: row.sub_strand,
      sourceLinked: Boolean(row.source_ref),
      sourceRef: row.source_ref || null,
      inquiries: row.key_inquiry_questions || [],
      experiences: row.suggested_experiences || [],
      guidanceStatus: guide?.content_status || null,
      learningResources: guide?.learning_resources || '',
      assessmentMethods: guide?.assessment_methods || '',
      outcomes: grouped.get(row.id).sort((a,b)=>(a.code || '').localeCompare(b.code || ''))
    };
    return {...unit, schemeReady:isGrade3KiswahiliSchemeEligible(unit)};
  }).sort((a,b)=>a.strand.localeCompare(b.strand, 'sw') || a.subStrand.localeCompare(b.subStrand, 'sw'));
}

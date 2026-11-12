// Fail-closed structural regression guard for the observed KICD April 2024
// Grade 9 Mathematics summary. This does NOT certify the July 2024 revision.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, '../../content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json');
const candidate = JSON.parse(readFileSync(path, 'utf8'));
const april = candidate.april_2024_summary;
const rows = april.sub_strands;

test('Grade 9 Maths keeps the five source strands and nineteen sub-strands in order', () => {
  assert.equal(candidate.status, 'candidate_cross_version_reconciliation_only');
  assert.equal(candidate.strands.length, 5);
  assert.deepEqual(candidate.strands.map(x => x.code), ['1.0', '2.0', '3.0', '4.0', '5.0']);
  const hierarchy = candidate.strands.flatMap(s =>
    s.sub_strands.map(([code, title]) => ({ code, strand: s.name, sub_strand: title }))
  );
  assert.equal(hierarchy.length, 19);
  assert.deepEqual(rows.map(({ code, strand, sub_strand }) => ({code, strand, sub_strand})), hierarchy);
  assert.equal(new Set(rows.map(x => x.code)).size, 19);
});

test('April printed summary records 150 suggested lessons, without inventing weekly term pacing', () => {
  assert.equal(april.summary_suggested_lessons, 150);
  assert.equal(rows.reduce((sum, r) => sum + r.suggested_lessons, 0), 150);
  assert.equal(april.weekly_mathematics_lessons, 5);
  assert.equal(april.minutes_per_lesson, 40);
  assert.ok(rows.every(r => Number.isInteger(r.suggested_lessons) && r.suggested_lessons > 0));
  assert.ok(rows.every(r => r.source_locator.includes('printed page x')));
  assert.ok(rows.every(r => r.evidence_status === 'APRIL_SUMMARY_OBSERVED_JULY_NOT_RECONCILED'));
});

test('copyright, source edition and approval gates remain fail-closed', () => {
  assert.equal(candidate.registered_source_version, 'July 2024 Revised');
  assert.equal(candidate.april_2024_summary.source_url.includes('kicd.ac.ke'), true);
  assert.equal(candidate.live_2026_11_12_reconciliation.classification, 'BLOCKED_CURRICULUM_RECONCILIATION');
  assert.equal(candidate.live_2026_11_12_reconciliation.existing_verified_outcome_records_linked_to_grade9_math, 0);
  assert.equal(candidate.live_2026_11_12_reconciliation.preserve_existing_cbc_strands_ids, true);
  assert.equal(candidate.live_2026_11_12_reconciliation.do_not_promote_from_this_candidate, true);
  assert.equal(april.source_internal_discrepancies.length, 3);
  assert.ok(april.source_internal_discrepancies.every(x => x.summary_lessons !== x.sub_strand_page_lessons));
  assert.ok(april.source_internal_discrepancies.every(x => x.disposition === 'HOLD_FOR_SOURCE_RECONCILIATION'));
});

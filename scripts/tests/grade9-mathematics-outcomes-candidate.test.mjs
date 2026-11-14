// Editorial-only coverage gate for the 2024 Grade 9 Mathematics source crosswalk.
// The full official KICD PDF artifact and authenticated owner promotion remain mandatory.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manuscript = JSON.parse(readFileSync(resolve(root, 'content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json'), 'utf8'));
const july = manuscript.july_2024_editorial_crosswalk;
const targetCounts = {
  '1.1':4,'1.2':6,'1.3':5,'1.4':5,'2.1':6,'2.2':8,'2.3':5,
  '3.1':7,'3.2':6,'3.3':5,'3.4':8,'3.5':7,'3.6':4,
  '4.1':7,'4.2':9,'4.3':6,'4.4':6,'5.1':6,'5.2':7,
};

function validateUnreleasedCrosswalk(candidate) {
  const overlay = candidate.july_2024_editorial_crosswalk;
  assert.equal(candidate.status,'candidate_cross_version_reconciliation_only');
  assert.equal(overlay.authority_state,'BLOCKED_CURRICULUM_RECONCILIATION');
  assert.equal(overlay.certification_state,'NOT_CERTIFIED');
  assert.equal(overlay.publication_state,'NOT_RELEASED');
  assert.equal(overlay.registered_edition,'July 2024 Revised');
  assert.equal(overlay.official_source_url,candidate.registered_source_url);
  assert.equal(overlay.registered_source_id,candidate.registered_source_id);
  assert.equal(candidate.live_2026_11_12_reconciliation.do_not_promote_from_this_candidate,true);
  assert.equal(overlay.units.length,19);
  const expected = candidate.strands.flatMap(s => s.sub_strands.map(([code,title])=>({code,strand:s.name,sub_strand:title})));
  assert.deepEqual(overlay.units.map(({code,strand,sub_strand})=>({code,strand,sub_strand})),expected);
  const aliases=[];
  for (const u of overlay.units) {
    assert.ok(Number.isInteger(u.source_printed_page) && u.source_printed_page>0);
    assert.equal(u.editorial_status,'CANDIDATE_ONLY_UNVERIFIED');
    assert.equal(u.manuscript_outcomes.length,targetCounts[u.code],u.code);
    assert.ok(u.vibeschool_inquiry_questions.some(x=>x.length>=20),u.code+' inquiry missing');
    assert.ok(u.vibeschool_suggested_learning_experiences.length>=3,u.code+' experiences incomplete');
    assert.ok(u.vibeschool_suggested_learning_experiences.every(x=>x.length>=40),u.code+' experience too shallow');
    assert.equal(u.experience_wording_status,'VIBESCHOOL_ORIGINAL_DRAFT');
    assert.equal(u.inquiry_wording_status,'VIBESCHOOL_ORIGINAL_DRAFT');
    assert.ok(u.vibeschool_assessment_evidence.some(x=>x.length>=40),u.code+' assessment evidence missing');
    assert.ok(u.vibeschool_competencies?.length>=2,u.code+' competencies missing');
    assert.ok(u.vibeschool_values?.length>=1,u.code+' values missing');
    assert.ok(u.vibeschool_pertinent_contemporary_issues?.length>=1,u.code+' contemporary-issue connection missing');
    assert.ok(u.vibeschool_assessment_dimensions?.length>=3,u.code+' assessment scope incomplete');
    for(const field of ['vibeschool_competencies','vibeschool_values','vibeschool_pertinent_contemporary_issues','vibeschool_assessment_dimensions']) {
      assert.ok(u[field].every(x=>typeof x==='string'&&x.length>=4),u.code+' '+field+' contains blank or invalid entries');
    }
    assert.equal(u.source_verification_status,'EDITORIAL_REVIEW_NOT_OFFICIAL_PDF_VERIFIED');
    for (const [i,item] of u.manuscript_outcomes.entries()) {
      assert.equal(item.source_outcome_ordinal,i+1);
      assert.equal(item.manuscript_alias,`VS-G09-MA-${u.code}-${String.fromCharCode(97+i)}`);
      assert.equal(item.canonical_outcome_id,null,'MUST NOT invent canonical UUID');
      assert.equal(item.source_verification,'AWAITING_OFFICIAL_ARTIFACT_AND_OWNER_PROMOTION');
      assert.ok(item.paraphrased_learning_target.length>=45,u.code+' target too shallow');
      aliases.push(item.manuscript_alias);
    }
  }
  assert.equal(new Set(aliases).size,aliases.length,'duplicate manuscript aliases');
  assert.equal(aliases.length,117,'source coverage count changed unexpectedly');
  assert.equal(overlay.total_candidate_learning_targets,aliases.length);
  assert.equal(overlay.total_original_learning_experiences,overlay.units.reduce((n,u)=>n+u.vibeschool_suggested_learning_experiences.length,0));
  assert.equal(overlay.total_original_inquiry_questions,overlay.units.reduce((n,u)=>n+u.vibeschool_inquiry_questions.length,0));
  assert.ok(overlay.known_source_ambiguities.length>=5,'source ambiguity ledger incomplete');
  return aliases;
}

test('all July-derived manuscript outcomes, experiences, inquiry, and assessment criteria are represented',()=>{
  assert.equal(validateUnreleasedCrosswalk(manuscript).length,117);
});

test('missing outcome or duplicate alias fails editorial coverage',()=>{
  const gap=structuredClone(manuscript);
  gap.july_2024_editorial_crosswalk.units[0].manuscript_outcomes.pop();
  assert.throws(()=>validateUnreleasedCrosswalk(gap));
  const duplicate=structuredClone(manuscript);
  duplicate.july_2024_editorial_crosswalk.units[1].manuscript_outcomes[0].manuscript_alias='VS-G09-MA-1.1-a';
  assert.throws(()=>validateUnreleasedCrosswalk(duplicate));
});

test('missing core competencies and assessment coverage fails closed',()=>{
  const missing=structuredClone(manuscript);
  missing.july_2024_editorial_crosswalk.units[0].vibeschool_competencies=[];
  assert.throws(()=>validateUnreleasedCrosswalk(missing));
  const missingAssessment=structuredClone(manuscript);
  missingAssessment.july_2024_editorial_crosswalk.units[8].vibeschool_assessment_dimensions=[];
  assert.throws(()=>validateUnreleasedCrosswalk(missingAssessment));
});

test('false source certification, publication and fake UUID are rejected',()=>{
  for (const prop of ['authority_state','certification_state','publication_state']) {
    const altered=structuredClone(manuscript);
    altered.july_2024_editorial_crosswalk[prop]='VERIFIED';
    assert.throws(()=>validateUnreleasedCrosswalk(altered));
  }
  const forged=structuredClone(manuscript);
  forged.july_2024_editorial_crosswalk.units[0].manuscript_outcomes[0].canonical_outcome_id='fake-record';
  assert.throws(()=>validateUnreleasedCrosswalk(forged));
});

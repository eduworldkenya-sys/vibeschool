import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const path = new URL('../../content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json', import.meta.url)
const source = JSON.parse(readFileSync(path,'utf8'))
const reader = readFileSync(new URL('../../components/teacher/curriculum/Grade9MathematicsMap.tsx',import.meta.url),'utf8')
const route = readFileSync(new URL('../../app/teacher/scheme/AuthoritySchemePage.jsx',import.meta.url),'utf8')

const summary = source.april_2024_summary
const units = summary.sub_strands
assert.equal(source.status,'candidate_cross_version_reconciliation_only','Do not mislabel the April outline as a verified July source')
assert.equal(source.live_2026_11_12_reconciliation.do_not_promote_from_this_candidate,true)
assert.equal(units.length,19,'Keep all 19 April reference sub-strands')
assert.equal(new Set(units.map(u=>u.code)).size,19,'Every sub-strand needs a unique code')
assert.equal(units.reduce((sum,u)=>sum+u.suggested_lessons,0),150,'Do not silently change suggested lesson counts')
assert.equal(source.strands.length,5)
assert.equal(summary.weekly_mathematics_lessons,5)
assert.ok(units.every(u=>u.evidence_status==='APRIL_SUMMARY_OBSERVED_JULY_NOT_RECONCILED'))
for (const token of [
 'GRADE9_MATHEMATICS_UNITS',
 'Grade 9 Mathematics curriculum reference',
 'Reference outline — not yet certified',
 'have not yet been verified in VibeSchool',
 'No outcome or Scheme link has been created',
 'showExisting',
 'onToggleExisting',
 'onOpenScheme',
]) assert.ok(reader.includes(token),'Curriculum map contract missing: '+token)
assert.ok(!reader.includes('supabase.from('),'Read-only reference must not insert or update canonical data')
assert.ok(!reader.includes('commit_mapped_scheme_lesson'),'Reference must not create a teacher scheme lesson')
assert.ok(route.includes("isGrade9Mathematics = /^grade\\s*9$/i"),'Grade 9 subject routing must be exact')
assert.ok(route.includes('<Grade9MathematicsMap'),'Grade 9 Mathematics must be rendered in existing teacher Curriculum')
assert.ok(route.includes('isGrade9Mathematics&&!showEnglishLegacy'),'Prior canonical curriculum headings must remain discoverable')
assert.ok(route.includes('commit_curriculum_scheme'),'Preserve existing Scheme of Work authority')
assert.ok(route.includes('unitId:unitId||mapUnitId'),'Carry chosen Grade 9 sub-strand into the existing Scheme route')
assert.ok(route.includes('Grade 9 Mathematics planning reference'),'Selected Grade 9 sub-strand must show a fail-closed reference')
assert.ok(route.includes('July 2024 revised learning outcomes are not yet verified'),'Do not present April reference as a July-certified Scheme')
assert.ok(reader.includes('onOpenScheme(selectedUnitId)'),'Do not lose the selected Mathematics sub-strand on navigation')
assert.ok(reader.includes('reference.registered_source_url'),'Provide the official revised source alongside the April-only reference')
assert.ok(route.includes('curriculumOutcomes[row.id]'),'Preserve canonical outcome access')

// A map-to-Scheme navigation is not a saved Scheme lesson; show exact reconciliation state.
assert.ok(reader.includes('grade9-mathematics-scheme-crosswalk-20261113.json'),'Map must use the audited crosswalk, not guess by title')
assert.ok(reader.includes('Existing heading matches · outcomes not connected'),'Show accurate matched-heading status')
assert.ok(reader.includes('Possible earlier topic match · review needed'),'Keep alias candidates out of automatic Scheme links')
assert.ok(reader.includes('Curriculum mapping pending'),'Missing mappings must be visible, not silently hidden')
assert.ok(reader.includes('View selected sub-strand in Scheme'),'Navigation must not imply a saved Scheme lesson')
assert.ok(route.includes('A Scheme lesson cannot yet be saved from this reference'),'Scheme must explain why source-only selection cannot commit')
assert.ok(route.includes('no exact canonical sub-strand mapping'),'Scheme must not auto-link missing source units')

console.log('Grade 9 Mathematics read-only Curriculum Map and authority boundary: PASS')

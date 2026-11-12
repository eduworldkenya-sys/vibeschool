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
assert.ok(route.includes('curriculumOutcomes[row.id]'),'Preserve canonical outcome access')
console.log('Grade 9 Mathematics read-only Curriculum Map and authority boundary: PASS')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('../components/teacher/curriculum/Grade1CreativeActivitiesMap.tsx', import.meta.url), 'utf8')
const mapPage = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url), 'utf8')
const subjectHub = readFileSync(new URL('../app/teacher/subjecthub/page.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20261110194600_grade1_creative_curriculum_scheme_links.sql', import.meta.url), 'utf8')

const entries = [...reader.matchAll(/id: '(\d\.\d)', title: '([^']+)', strand: ([123]), lessons: (\d+)/g)]
assert.equal(entries.length, 16, 'The native curriculum must contain all 16 Grade 1 Creative Activities sub-strands')
assert.equal(new Set(entries.map(match => match[1])).size, 16, 'Every sub-strand ID must be unique')
assert.equal(entries.reduce((sum, match) => sum + Number(match[4]), 0), 210, 'Annual lesson allocation must remain 210')
assert.deepEqual([1, 2, 3].map(strand => entries.filter(match => Number(match[3]) === strand).length), [7, 7, 2])

const outcomeLists = reader.split(/\s*outcomes: \[/).slice(1).map(section => section.split('],')[0])
assert.equal(outcomeLists.length, 16, 'Every sub-strand must have outcome descriptions')
const outcomeCount = outcomeLists.reduce((sum, outcomes) => sum + (outcomes.match(/'[^']*'/g) ?? []).length, 0)
assert.equal(outcomeCount, 68, 'Expected 68 authored outcome descriptions')
for (const token of [
  'Specific learning outcomes', 'Suggested learning experiences', 'Key inquiry questions',
  'Assessment guidance', 'Learning resources', 'Safety and inclusion',
  'View original KICD source', 'source-to-outcome certification is pending',
  'All 16 topics', 'Next topic', 'Find a sub-strand or outcome',
]) assert.ok(reader.includes(token), 'Missing native reader content: ' + token)

assert.ok(mapPage.includes('isGrade1Creative'), 'Curriculum must resolve assigned Grade 1 Creative Activities')
assert.ok(mapPage.includes('<Grade1CreativeActivitiesMap selectedUnitId='), 'Canonical teacher curriculum route must offer the contextual scheme planning action')
assert.ok(reader.includes('onPlanUnit(unit.id)'), 'The selected Grade 1 sub-strand must flow to the scheme planner')
assert.ok(reader.includes('onOpenSchemeUnit(unit.id)'), 'Subject Hub must expose a selected-unit action for Scheme of Work')
assert.ok(subjectHub.includes('onOpenSchemeUnit={(unitId) => {'), 'Subject Hub must connect selected Grade 1 Creative Activities units to Scheme')
assert.ok(subjectHub.includes("router.push('/teacher/scheme?' + params.toString())"), 'Subject Hub must preserve class and subject context in the Scheme link')
assert.ok(mapPage.includes("unitId:searchParams.get('unitId')"), 'Scheme must restore the selected curriculum unit')
assert.ok(mapPage.includes("if(!curriculumView&&draftUnitId)p.set('unitId',draftUnitId)"), 'Selected unit must survive week selection')
assert.ok(mapPage.includes('mappedDraftRecord?.outcomes||[]'), 'Teacher must select persisted outcome records')
assert.ok(mapPage.includes("supabase.rpc('commit_mapped_scheme_lesson'"), 'Mapped lesson must call the atomic identity-checked server function')
assert.ok(migration.includes('v_scheme:=public.commit_custom_scheme_item('), 'Mapped RPC must reuse teacher assignment/calendar/ordering authority')
assert.ok(migration.includes('security invoker'), 'Mapped RPC must retain invoker security and RLS')
assert.ok(migration.includes('insert into public.scheme_lesson_outcomes'), 'Persist each outcome FK atomically with a scheme lesson')
assert.ok(migration.includes('KICD reconciliation pending'), 'Mapped curriculum must remain identified as VibeSchool-authored')
assert.ok(mapPage.includes('Plan mapped Grade 1 curriculum lesson'), 'Scheme must show mapped curriculum content before save')
assert.ok(mapPage.includes("reference,sub_strand_id,curriculum_outcome_id').eq('teacher_id'"), 'Scheme must read persisted sub-strand and outcome FKs')
assert.ok(mapPage.includes('View curriculum map</button>'), 'Saved Grade 1 lessons must link back to the curriculum map')
assert.ok(mapPage.includes("expected 68 outcomes"), 'Teacher must fail closed on incomplete outcome coverage')
assert.ok(reader.includes('linkedUnit.outcomes.map'), 'Curriculum Map must display actual persisted outcomes when connected')
assert.ok(reader.includes('catalogLoading'), 'Curriculum Map must not allow saving before the mapped curriculum loads')
assert.ok(migration.includes('primary key (scheme_lesson_id,curriculum_outcome_id)'), 'One lesson may link multiple outcomes without duplicates')
assert.ok(migration.includes("where source_ref like 'VS-CUR-G01-CA-2026#%'"), 'Source and outcome records must carry an explicit provenance')
assert.equal((migration.match(/\$vs_g1\$/g)||[]).length, 6, 'All seeded source snapshots must be explicitly delimited')
assert.ok(reader.includes('selectedUnitId'), 'Return link must open the original mapped curriculum sub-strand')
assert.ok(mapPage.includes("commit_curriculum_scheme"), 'Do not replace the existing canonical scheme engine')
assert.ok(mapPage.includes('curriculumOutcomes[row.id]'), 'Existing canonical outcome records must remain available')
assert.ok(mapPage.includes("display:isGrade1Creative||isGrade8Mathematics||((isGrade1Mathematics||isGrade1English)&&!allCurriculumRows.length)||(isGrade4English&&!showEnglishLegacy)||(isGrade8Kiswahili&&!showEnglishLegacy)||isGrade9English?'none':undefined"), 'Preserve existing Grade 1, Grade 4, Grade 8 Mathematics and Grade 9 English readers alongside Grade 8 Kiswahili')

assert.ok(subjectHub.includes('grade1CreativeClass'), 'SubjectHub must scope the reader to an assigned Grade 1 class')
assert.ok(mapPage.includes('creative arts and sports'), 'Existing Grade 1 subject label must resolve to the VibeSchool curriculum reader')
assert.ok(subjectHub.includes('creative arts and sports'), 'Mumbi2 Grade 1 Bluezzz existing subject label must open the curriculum')
assert.ok(subjectHub.includes('<Grade1CreativeActivitiesMap compact'), 'Subject page must show the native curriculum inline')
assert.ok(subjectHub.includes("'/teacher/curriculum?classId='"), 'Full curriculum link must pass the assigned class identity')
assert.ok(subjectHub.includes("'&subjectId='"), 'Full curriculum link must pass the actual subject identity')
assert.ok(!reader.includes("supabase.from("), 'Annual reference reader must not insert duplicate canonical records')
console.log('Grade 1 Creative Activities native curriculum and teacher subject mapping: PASS')

await import('./test-grade1-creative-auto-scheme.mjs')

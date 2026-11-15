import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(resolve(root, 'supabase/migrations/20261115134500_seed_kasneb_cpa_cs_learner_catalog.sql'), 'utf8')

const expected = {
  'kasneb-cpa': {
    Foundation: ['CA11','CA12','CA13','CA14','CA15','CA16'],
    Intermediate: ['CA21','CA22','CA23','CA24','CA25','CA26'],
    Advanced: ['CA31','CA32','CA33','CA34','CA35S1','CA35S2','CA35S3','CA36P','CA37WE','CA38WP'],
  },
  'kasneb-cs': {
    Foundation: ['CS11','CS12','CS13','CS14','CS15','CS16'],
    Intermediate: ['CS21','CS22','CS23','CS24','CS25','CS26'],
    Advanced: ['CS31','CS32','CS33','CS34','CS35R1','CS35R2'],
  },
}

function validatePaperInventory(sql) {
  const rows = [...sql.matchAll(/\('(kasneb-(?:cpa|cs))', '([A-Z0-9]+)', '([^']+)', '(Foundation|Intermediate|Advanced)', '([a-z_]+)', (\d+)\)/g)]
    .map(([, course, code, title, level, requirement, seq]) => ({ course, code, title, level, requirement, seq: Number(seq) }))
  assert.equal(rows.length, 40, 'exactly 40 KASNEB catalogue entries are required')
  assert.equal(new Set(rows.map(x => x.course + ':' + x.code)).size, 40, 'no duplicate paper identifiers')
  for (const [course, levels] of Object.entries(expected)) {
    const courseRows = rows.filter(row => row.course === course)
    assert.deepEqual(courseRows.map(x => x.seq), courseRows.map((_, i) => i + 1), course + ' ordered unique positions')
    for (const [level, codes] of Object.entries(levels)) {
      assert.deepEqual(courseRows.filter(x => x.level === level).map(x => x.code), codes, course + ' ' + level + ' must match April 2026 KASNEB booklet')
    }
  }
  assert.deepEqual(rows.filter(x => x.course === 'kasneb-cpa' && x.requirement === 'specialisation_choice').map(x => x.code), ['CA35S1','CA35S2','CA35S3'])
  assert.deepEqual(rows.filter(x => x.course === 'kasneb-cpa' && x.requirement === 'conditional_workshop').map(x => x.code), ['CA38WP'])
  assert.deepEqual(rows.filter(x => x.course === 'kasneb-cs' && x.requirement === 'research_route_choice').map(x => x.code), ['CS35R1','CS35R2'])
  return rows
}

test('CPA/CS catalogue paper codes, ordering, alternatives and labels match versioned KASNEB 2026 booklet', () => {
  validatePaperInventory(migration)
})

test('catalogue must remain unpublished with provenance and fail-closed SQL checks', () => {
  assert.match(migration, /'coming_soon'/)
  assert.doesNotMatch(migration, /set\s+status\s*=\s*'live'/i)
  assert.match(migration, /QUALIFICATIONS%20BOOKLET\.pdf/)
  assert.match(migration, /syllabus_checked_on date/)
  assert.match(migration, /if cpa_count <> 22 or cs_count <> 18/)
  assert.match(migration, /published topics/)
  assert.match(migration, /on conflict \(course_id, slug\) do nothing/i)
  assert.doesNotMatch(migration, /delete\s+from\s+(?:public\.)?(?:curriculum|learner_profiles|course_enrollments)/i)
})

test('test detects the known conflicting CPA website code in place of the dated booklet code', () => {
  const changed = migration.replace("'CA34', 'Advanced Management Accounting'", "'CA34S3', 'Advanced Management Accounting'")
  assert.notEqual(changed, migration, 'mutation actually alters the source fixture')
  assert.throws(() => validatePaperInventory(changed), /must match April 2026/)
})

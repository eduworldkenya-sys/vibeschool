import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260830190000_governed_teacher_school_onboarding.sql')
const schoolPage = read('app/teacher/onboarding/school/page.tsx')
const classPage = read('app/teacher/onboarding/class/page.tsx')
const middleware = read('middleware.ts')
const teacherLayout = read('app/teacher/layout.tsx')
const login = read('app/login/page.tsx')
const schoolResolver = read('lib/school.ts')

const submitClaim = migration.match(/create or replace function public\.submit_teacher_school_claim[\s\S]*?create or replace function public\.get_my_teacher_school_claim/i)?.[0] ?? ''
function validateClaimSubmission(source) {
  assert.ok(source, 'claim submission function missing')
  assert.equal(/insert into public\.school_members/i.test(source), false, 'claim submission must not grant membership')
  assert.equal(/insert into public\.school_levels/i.test(source), false, 'teacher claim must not classify canonical school')
}
validateClaimSubmission(submitClaim)
assert.throws(() => validateClaimSubmission(`${submitClaim}\ninsert into public.school_members default values;`), /must not grant membership/, 'regression test must detect the protected bypass')
assert.match(migration, /review_teacher_school_claim/)
assert.match(migration, /public\.is_platform_owner\(\).*public\.is_school_admin\(v_school\)/s)
assert.match(migration, /insert into public\.notifications/)
assert.match(migration, /TEACHER_SCHOOL_CLAIM_PENDING/)
assert.match(migration, /\/teacher\/provisional/)
assert.doesNotMatch(migration, /TEACHER_CLASS_REQUIRED/)

for (const county of ['Elgeyo-Marakwet', 'Garissa', 'Homa Bay', 'Isiolo', 'Nyamira']) assert.match(schoolPage, new RegExp(county))
assert.match(schoolPage, /Use my location/)
assert.match(schoolPage, /Step 1 of 3/)
assert.match(schoolPage, /School name or code/)
assert.match(schoolPage, /aria-label="County"/)
assert.match(schoolPage, /submit_teacher_school_claim/)
assert.match(classPage, /'Form 4'/)
assert.match(classPage, /'Grade 12'/)
assert.match(classPage, /create_provisional_teacher_class/)
assert.match(middleware, /PROVISIONAL_TEACHER_ROUTES/)
assert.match(teacherLayout, /isLimitedOnboardingPath/)
assert.match(teacherLayout, /if \(isLimitedOnboardingPath\) return/)
assert.match(login, /encodeURIComponent\(redirect\)/)
assert.doesNotMatch(schoolResolver, /teacher_profiles|profiles'\)/, 'legacy identity fields must not establish school scope')

console.log('teacher onboarding contract: PASS')

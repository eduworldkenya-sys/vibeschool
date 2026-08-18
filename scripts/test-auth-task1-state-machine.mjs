import fs from 'node:fs'
import assert from 'node:assert/strict'

const base = fs.readFileSync('supabase/migrations/20260819013800_auth_canonical_journey_state.sql', 'utf8')
const repair = fs.readFileSync('supabase/migrations/20260819014900_auth_student_uuid_resolution_repair.sql', 'utf8')
const callback = fs.readFileSync('app/auth/callback/route.ts', 'utf8')
const middleware = fs.readFileSync('middleware.ts', 'utf8')
const journey = repair.match(/create or replace function public\.get_my_auth_journey_state\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? ''
assert.ok(journey)
assert.match(journey,/security definer/i)
assert.match(journey,/set search_path = public, auth, pg_temp/i)
for (const role of ['student','teacher','parent','admin','global_user']) assert.ok(journey.includes(`p.role='${role}'`) || journey.includes(`p.role = '${role}'`), `missing ${role}`)
assert.doesNotMatch(journey,/min\s*\(\s*s\.id\s*\)/i)
assert.doesNotMatch(journey,/teacher_classes[\s\S]{0,180}is_active/i)
assert.match(repair,/create or replace function public\.current_student_id\(\)/i)
assert.doesNotMatch(repair,/min\s*\(\s*s\.id\s*\)/i)
assert.match(repair,/order by s\.id limit 1/i)
assert.match(base,/get_my_auth_journey_state/i)
for (const wrapper of ['get_my_onboarding_state','get_my_auth_access_state','get_my_role']) assert.match(base,new RegExp(`create or replace function public\\.${wrapper}\\([\\s\\S]*?get_my_auth_journey_state`,'i'))
assert.doesNotMatch(callback,/teacher_classes'[\s\S]{0,220}\.eq\('is_active'/i)
assert.match(middleware,/roleCanVisit/)
assert.match(middleware,/authError\('onboarding_invalid'\)/)
console.log('Task 1 canonical auth state-machine contract: PASS')

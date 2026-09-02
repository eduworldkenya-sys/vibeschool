import fs from 'node:fs'
import assert from 'node:assert/strict'

const sql=fs.readFileSync('supabase/migrations/20260902104000_governed_teacher_school_claims_current.sql','utf8')
const review=sql.match(/create or replace function public\.review_teacher_school_claim[\s\S]*?\n\$\$;/i)?.[0]??''
const queue=sql.match(/create or replace function public\.hq_list_teacher_school_claims[\s\S]*?\n\$\$;/i)?.[0]??''

assert.match(sql,/teacher_school_claim_has_target/)
assert.match(sql,/status in \('matched','new'\)/)
assert.match(sql,/filter \(where x is not null\)/)
assert.match(review,/on conflict\(school_id,profile_id\) do nothing/,'approval must preserve existing admin\/owner membership')
assert.doesNotMatch(review,/do update set role='teacher'/,'approval must not downgrade stronger roles')
assert.match(queue,/is_platform_owner\(\)/,'HQ queue must be owner-gated')
assert.match(queue,/owner_authorization_required/)
assert.match(sql,/revoke all on function public\.hq_list_teacher_school_claims\(text,integer\) from public,anon,authenticated/i)
assert.match(sql,/grant execute on function public\.hq_list_teacher_school_claims\(text,integer\) to authenticated/i)
console.log('governed teacher-school SQL edge contract: PASS')

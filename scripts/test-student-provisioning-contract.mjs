import fs from 'node:fs'

const api = fs.readFileSync('app/api/create-student-account/route.ts', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260816182000_student_provisioning_atomic_finalize.sql', 'utf8')
const signup = fs.readFileSync('app/signup/student/page.tsx', 'utf8')

const failures = []
const requireMatch = (source, pattern, message) => { if (!pattern.test(source)) failures.push(message) }
const forbidMatch = (source, pattern, message) => { if (pattern.test(source)) failures.push(message) }

requireMatch(api, /rpc\(['"]finalize_student_provisioning['"]/, 'Student account API must delegate relational finalization to the atomic database finalizer.')
forbidMatch(api, /\.from\(['"]students['"]\)[\s\S]*?\.update\(\{\s*profile_id:/, 'Student account API must not directly bind students.profile_id.')
forbidMatch(api, /\.from\(['"]profiles['"]\)[\s\S]*?\.update\(\{\s*role:/, 'Student account API must not directly elevate the profile role.')
forbidMatch(api, /\.from\(['"]school_members['"]\)[\s\S]*?\.upsert\(/, 'Student account API must not directly write school membership.')
forbidMatch(api, /\.from\(['"]student_claim_codes['"]\)[\s\S]*?\.update\(\{\s*claimed:/, 'Student account API must not directly claim the code.')

requireMatch(migration, /for update/i, 'Atomic finalizer must lock the claim/student state.')
requireMatch(migration, /current_user not in \('postgres','service_role'\)/, 'Atomic finalizer must be service-role only.')
requireMatch(migration, /revoke execute .* from public,anon,authenticated/i, 'Atomic finalizer must not be client-callable.')
requireMatch(migration, /update public\.students[\s\S]*profile_id = p_user_id/, 'Atomic finalizer must bind the canonical learner profile.')
requireMatch(migration, /insert into public\.school_members/, 'Atomic finalizer must establish membership in the same transaction.')
requireMatch(migration, /update public\.student_claim_codes[\s\S]*claimed = true/, 'Atomic finalizer must consume the claim in the same transaction.')

forbidMatch(signup, /localStorage\.setItem\(['"]vs_role['"]/, 'Student signup must not persist role authority in localStorage.')
forbidMatch(signup, /vibe_role=student/, 'Student signup must not persist role authority in a legacy cookie.')

if (failures.length) {
  console.error(failures.map(x => `- ${x}`).join('\n'))
  process.exit(1)
}

console.log('Student provisioning contract passed.')

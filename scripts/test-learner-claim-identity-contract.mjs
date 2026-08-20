import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8')
const signup = read('app/signup/student/page.tsx')
const api = read('app/api/create-student-account/route.ts')
const classhub = read('app/teacher/classhub/[id]/page.tsx')
const migration = read('supabase/migrations/20260820201000_learner_claim_identity_contract_v2.sql')

const checks = [
  ['signup does not collect learner name', !signup.includes('setName(') && !signup.includes('Full name') && !signup.includes('full_name:')],
  ['signup submits learner code and PIN only', signup.includes('claim_code: claimCode') && signup.includes('password: pin')],
  ['API resolves canonical shared claim', api.includes("rpc('lookup_student_claim'") && !api.includes("eq('role', 'student')")],
  ['API uses canonical student name', api.includes('full_name: studentName')],
  ['API handles replaced code', api.includes("case 'replaced'")],
  ['API handles enrollment conflict', api.includes("case 'enrollment_conflict'")],
  ['teacher roster delegates code generation to RPC', classhub.includes("rpc('teacher_generate_shared_claim_code'")],
  ['teacher roster never generates claim codes client-side', !classhub.includes('Math.random().toString(36)')],
  ['teacher roster reads active shared non-revoked codes', classhub.includes("eq('role', 'shared')") && classhub.includes("is('revoked_at', null)")],
  ['migration preserves revoked claim history', migration.includes('revoked_at') && migration.includes("set revoked_at=coalesce(revoked_at,now())")],
  ['migration enforces one active shared claim per learner', migration.includes('uq_student_claim_codes_active_shared_per_student')],
  ['claim lookup uses current enrollment', migration.includes('from public.student_classes sc') && migration.includes('sc.is_current=true')],
  ['finalizer keeps school-authored canonical name', migration.includes('full_name=v_student.name')],
  ['claim resolver is not browser executable', migration.includes('revoke all on function public.lookup_student_claim(text) from public, anon, authenticated')],
  ['finalizer is service-role only', migration.includes("current_user not in ('postgres','service_role')")],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
if (failed) {
  console.error(`Learner claim identity contract failed: ${failed}/${checks.length}`)
  process.exit(1)
}
console.log(`Learner claim identity contract passed: ${checks.length}/${checks.length}`)

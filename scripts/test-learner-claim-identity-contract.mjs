import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8')
const signup = read('app/signup/student/page.tsx')
const parent = read('app/parent/link-child/page.tsx')
const api = read('app/api/create-student-account/route.ts')
const classhub = read('app/teacher/classhub/[id]/page.tsx')
const identityMigration = read('supabase/migrations/20260820201000_learner_claim_identity_contract_v2.sql')
const activationMigration = read('supabase/migrations/20260820224500_learner_activation_parent_decoupling.sql')

const checks = [
  ['signup does not collect learner name', !signup.includes('setName(') && !signup.includes('Full name') && !signup.includes('full_name:')],
  ['signup submits normalized learner code and PIN only', signup.includes('claim_code: normalizedCode') && signup.includes('password: pin')],
  ['signup no longer requires parent as step one', !signup.includes('Parent or guardian connects') && signup.includes('can connect separately')],
  ['parent page accepts canonical 8-character claims', parent.includes('MAX_CODE_LENGTH = 12') && parent.includes('placeholder="e.g. 9FFA0680"') && !parent.includes('6-character claim code')],
  ['parent page handles replaced and expired claims', parent.includes("case 'replaced'") && parent.includes("case 'expired'")],
  ['parent page treats already_linked as success', parent.includes("case 'already_linked'")],
  ['API resolves canonical shared claim', api.includes("rpc('lookup_student_claim'") && !api.includes("eq('role', 'student')")],
  ['API uses canonical student name', api.includes('full_name: studentName')],
  ['API does not require parent link before activation', !api.includes("from('parent_student_links')") && !api.includes("code: 'guardian_required'")],
  ['API handles class and school absence explicitly', api.includes("code: 'class_required'") && api.includes("code: 'school_required'")],
  ['teacher roster delegates code generation to RPC', classhub.includes("rpc('teacher_generate_shared_claim_code'")],
  ['teacher roster never generates claim codes client-side', !classhub.includes('Math.random().toString(36)')],
  ['teacher roster reads active shared non-revoked codes', classhub.includes("eq('role', 'shared')") && classhub.includes("is('revoked_at', null)")],
  ['identity migration generates canonical eight-char claim', identityMigration.includes("substr(encode(extensions.gen_random_bytes(8),'hex'),1,8)")],
  ['claim lookup uses current enrollment', identityMigration.includes('from public.student_classes sc') && identityMigration.includes('sc.is_current=true')],
  ['activation finalizer requires current class and school', activationMigration.includes("'class_not_found'") && activationMigration.includes("'school_not_found'")],
  ['activation finalizer deliberately decouples parent linking', activationMigration.includes('Parent/guardian linkage is intentionally NOT checked here') && !activationMigration.includes("return jsonb_build_object('status','guardian_required')")],
  ['activation finalizer remains service-role only', activationMigration.includes("current_user not in ('postgres','service_role')")],
  ['activation finalizer keeps school-authored canonical name', activationMigration.includes('full_name=v_student.name')],
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

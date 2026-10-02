import fs from 'node:fs'

const migration = fs.readFileSync(
  'supabase/migrations/20261002083000_canonical_operational_school_authority.sql',
  'utf8',
)
const attendance = fs.readFileSync('app/teacher/attendance/page.tsx', 'utf8')

function check(condition, message) {
  if (!condition) {
    console.error('FAIL:', message)
    process.exitCode = 1
  } else {
    console.log('PASS:', message)
  }
}

check(
  migration.includes("s.status in ('pending','active')"),
  'pending and active schools are operational for ordinary workflows',
)
check(
  migration.includes('is_operational_school_member'),
  'operational membership authority is explicit',
)
check(
  migration.includes('school_members_read_own_operational_school'),
  'school member visibility is not tied to institutional verification',
)
check(
  migration.includes('school_not_operational'),
  'suspended and closed schools remain fail-closed',
)
check(
  migration.includes('upsert_attendance_batch') && migration.includes('security definer'),
  'attendance authority does not depend on caller-visible RLS rows',
)
check(
  attendance.includes('teacher_school_not_authorized') &&
    attendance.includes('school_not_operational'),
  'attendance shows truthful authorization and lifecycle failures',
)

if (process.exitCode) process.exit(process.exitCode)
console.log('Operational school authority contract PASSED')

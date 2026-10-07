import fs from 'node:fs'
import assert from 'node:assert/strict'

const sql = fs.readFileSync('supabase/migrations/20261007150000_teacher_weekly_delivery_authority.sql', 'utf8')

for (const needle of [
  'get_teacher_weekly_delivery_authority',
  'teacher_classes',
  'class_subject_allocations',
  'timetable_slots',
  'teaching_occurrences',
  "o.lifecycle = 'completed'",
  "o.lifecycle = 'missed'",
  'recovered_from_id',
  "'RECOVERY_NEEDED'",
  "'DELIVERED'",
  "is_active_school_member",
  'revoke all on function',
  'grant execute on function',
]) {
  assert.ok(sql.includes(needle), `delivery authority missing contract: ${needle}`)
}

assert.ok(
  sql.indexOf('class_subject_allocations') < sql.indexOf('teaching_occurrences'),
  'effective allocation must remain upstream of actual delivery'
)
assert.ok(
  sql.includes("recovery.lifecycle = 'completed'"),
  'a missed occurrence must stop counting as unresolved after completed recovery'
)
assert.ok(
  sql.includes("greatest(a.required_units - coalesce(ou.delivered_units, 0), 0)"),
  'remaining delivery must derive from required minus delivered units'
)

console.log('Teacher weekly delivery authority contract: PASS')

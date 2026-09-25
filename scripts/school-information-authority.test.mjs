import fs from 'node:fs'
import assert from 'node:assert/strict'

const migration=fs.readFileSync('supabase/migrations/20260925162000_school_information_authority.sql','utf8')
const hub=fs.readFileSync('app/teacher/schoolhub/page.tsx','utf8')

for (const token of [
  'public.school_events',
  'public.can_read_school_event',
  'public.admin_publish_school_event',
  'public.admin_cancel_school_event',
  'public.get_my_teacher_school_information',
  'public.school_calendar_exceptions',
  'public.vc_circular_recipients',
]) assert.ok(migration.includes(token), 'missing '+token)

assert.ok(/enable row level security/i.test(migration))
assert.ok(/EVENT_CLASS_OUTSIDE_SCHOOL/.test(migration))
assert.ok(/EVENT_PROFILE_OUTSIDE_SCHOOL/.test(migration))
assert.ok(/calendar_exception_id/.test(migration))
assert.ok(!/const POLICIES\s*=/.test(hub), 'School Hub must not own hard-coded policies')
assert.ok(!/const CALENDAR\s*=/.test(hub), 'School Hub must not own hard-coded calendar')

console.log('school information authority contract: PASS')

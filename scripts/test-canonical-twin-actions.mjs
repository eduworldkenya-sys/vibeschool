import fs from 'node:fs'

const read = p => fs.readFileSync(p, 'utf8')
const migration = read('supabase/migrations/20261003124000_teacher_twin_canonical_action_layer.sql')
const client = read('lib/teacher/twin-actions.ts')
const drawer = read('components/teacher/TwinDrawer.tsx')

function must(haystack, needle, why) {
  if (!haystack.includes(needle)) throw new Error(`${why}: missing ${needle}`)
}

must(migration, 'teacher_twin_resolve_exam_mark_action', 'Twin must resolve academic targets on the server')
must(migration, 'teacher_twin_apply_exam_mark_action', 'Twin must execute through a server-authorized RPC')
must(migration, 'teacher_get_operating_context(null)', 'Twin action must inherit the canonical active school')
must(migration, 'teacher_can_access_class(p_class_id,p_subject_id,false)', 'Twin action must re-check class/subject authority')
must(migration, 'sc.is_current=true', 'Twin action must require current learner enrollment')
must(migration, 'not e.is_locked', 'Twin must not write locked exams')
must(migration, "p_marks<0 or p_marks>100", 'Marks must remain bounded')
must(migration, 'on conflict(exam_id,student_id,subject_id)', 'Marks must use the canonical exam result identity')
must(migration, 'returning * into v_result', 'Twin must read back the authoritative saved result')
must(migration, 'teacher_twin_action_receipts', 'Twin mutations must be idempotent and auditable')
must(migration, 'twin_action_request_conflict', 'A request id must not be reusable with changed payload')
must(migration, 'enable row level security', 'Twin audit receipts must use RLS')
must(client, 'parseTeacherTwinExamMarkCommand', 'Teacher Twin needs deterministic natural-language parsing')
must(client, 'resolveTeacherTwinAction', 'Teacher Twin needs explicit target resolution')
must(client, 'applyTeacherTwinAction', 'Teacher Twin needs a bounded executor')
must(client, 'crypto.randomUUID()', 'Every confirmed mutation needs an idempotency key')
must(drawer, 'pendingAction', 'Consequential Twin changes must be staged before execution')
must(drawer, 'Confirm change', 'Teacher must explicitly confirm an academic mark mutation')
must(drawer, 'applyTeacherTwinAction', 'Drawer confirmation must invoke the bounded executor')

console.log('Canonical Twin action contract passed')

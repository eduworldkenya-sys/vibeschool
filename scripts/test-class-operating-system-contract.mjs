import fs from 'node:fs'

const failures = []
const read = path => fs.readFileSync(path, 'utf8')
const must = (condition, message) => {
  if (!condition) {
    failures.push(message)
    console.error('FAIL:', message)
  } else {
    console.log('PASS:', message)
  }
}

const migration = read('supabase/migrations/20261002103000_class_operating_system_foundation.sql')
const classHub = read('app/teacher/classhub/[id]/page.tsx')
const groups = read('app/teacher/classhub/[id]/groups/page.tsx')
const learner = read('app/teacher/classhub/[id]/student/[studentId]/page.tsx')
const homework = read('app/teacher/classhub/[id]/homework/page.tsx')
const games = read('app/teacher/classhub/[id]/games/page.tsx')

must(migration.includes('teacher_can_access_class'), 'class/list mutations share one server-authoritative teacher scope helper')
must(migration.includes('teacher_learner_events'), 'operational learner events have one canonical auditable ledger')
must(migration.includes("event_kind in ("), 'learner event kinds are constrained')
must(migration.includes("visibility in ("), 'learner event visibility is constrained')
must(migration.includes('learner_not_in_class'), 'learner event writes require current class membership')
must(migration.includes('class_school_mismatch'), 'class/list and event writes bind school to canonical class')
must(migration.includes('teacher_resolve_class_group_members'), 'smart list membership resolves server-side')
must(!migration.includes('execute(') && !migration.includes('EXECUTE '), 'smart list engine stores no arbitrary SQL predicates')
for (const rule of ['attendance_below','absence_count_at_least','missing_homework_at_least','assessment_below','no_participation_since']) {
  must(migration.includes(rule), `smart list allowlist contains ${rule}`)
}
must(migration.includes("mode in ('static','smart','temporary')"), 'group lifecycle mode is constrained')
must(migration.includes("references public.teaching_occurrences(id)"), 'lesson-scoped class actions link to canonical teaching occurrence')
must(migration.includes('teacher_add_student_v2'), 'roster creation supports request-idempotent optional admission')
must(migration.includes('p_request_id uuid'), 'roster creation requires a stable request identifier')
must(!/if v_admission is null then raise exception 'admission_identifier_required/.test(migration), 'new roster RPC does not require admission number')
must(migration.includes('admission_identifier_conflict'), 'real admission-number collisions still fail closed')
must(migration.includes('revoke all on function public.teacher_add_student_v2'), 'new roster RPC blocks public/anonymous execution')

must(classHub.includes("teacher_get_operating_context"), 'ClassHub uses canonical teacher operating context')
must(!classHub.includes(".from('teacher_classes')\n        .select('class_id')"), 'ClassHub no longer uses legacy direct assignment authorization')
must(classHub.includes(".eq('school_id', activeSchoolId).eq('class_id', classId).eq('is_current', true)"), 'ClassHub roster is current enrollment scoped to active school and class')
must(classHub.includes(".eq('date', nairobiDateStr())"), 'ClassHub attendance summary uses canonical date column')
must(!classHub.includes(".gte('timestamp'"), 'ClassHub never queries nonexistent attendance timestamp')
must(classHub.includes('teacher_add_student_v2'), 'ClassHub single-add uses idempotent optional-admission provisioning')
must(classHub.includes('prepareBulkRows') && classHub.includes('saveBulkRows'), 'ClassHub has bulk paste preview and save')
must(classHub.includes('selectedIds') && classHub.includes('openGroupsForSelection'), 'ClassHub roster supports mobile multi-select and action handoff')
must(classHub.includes('attentionItems'), 'ClassHub surfaces deterministic needs-attention learners')
must(classHub.includes('overdue task') && classHub.includes('Absent today') && classHub.includes('Follow-up is due'), 'class attention explains its evidence sources')

must(groups.includes("teacher_get_operating_context"), 'Groups & Lists uses canonical operating context')
must(!groups.includes(".from('classes').select('teacher_id')"), 'Groups & Lists does not authorize through legacy classes.teacher_id')
must(groups.includes('.from("student_classes")') && groups.includes('.from("students")'), 'Groups & Lists resolves roster IDs separately from learner identities')
must(!groups.includes('students('), 'Groups & Lists avoids nested learner joins that can create false empty rosters')
must(groups.includes('"static" | "smart" | "temporary"'), 'Groups & Lists supports saved, smart and temporary modes')
must(groups.includes('teacher_resolve_class_group_members'), 'smart lists resolve against canonical server rules')
must(groups.includes('Create random teams'), 'random classroom teams are usable')
must(groups.includes('recordEvent("participation")') && groups.includes('recordEvent("observation")') && groups.includes('recordEvent("recognition")'), 'selected learners support persisted classroom actions')
must(groups.includes('selected') && groups.includes('searchParams.get("selected")'), 'roster selections propagate into Groups & Lists')
must(groups.includes('createAbilityGroups("mixed")') && groups.includes('createAbilityGroups("similar")'), 'evidence-backed mixed and similar grouping helpers are exposed')
must(groups.includes('Not enough assessment evidence to balance by performance.'), 'ability grouping refuses unsupported intelligence')
must(groups.includes('teacher_snapshot_class_group'), 'smart groups snapshot before downstream assignment')
must(groups.includes('/games'), 'Groups & Lists links to the classroom scoreboard')
must(homework.includes('target_group_id: sourceGroupId'), 'homework persists canonical target group authority')
must(homework.includes('Targeted group:'), 'teacher sees the targeted homework cohort before assigning')
must(games.includes('teacher_adjust_game_score'), 'classroom scoreboard changes score through guarded RPC')
must(games.includes('never converted into mastery') || games.includes('not academic evidence'), 'game UI explicitly separates scores from academic mastery')
must(!groups.includes('Math.random() - 0.5') || groups.includes('Random'), 'randomization is explicit classroom utility, not hidden intelligence')

must(learner.includes('teacher_learner_events'), 'learner workspace reads operational teacher events')
must(learner.includes('saveTeacherEvent'), 'learner workspace can persist factual teacher actions')
must(learner.includes('TEACHER NOTES & ACTIONS'), 'learner workspace exposes teacher notes/actions in simple language')
must(/teacherEvents(?:\.filter\([^\n]+\))?\.map/.test(learner), 'learner story timeline includes teacher actions')
must(learner.includes('buildLearnerTruthSummary'), 'learner intelligence remains evidence-backed')
must(learner.includes('VibeSchool will not invent'), 'learner workspace preserves no-fake-intelligence boundary')
must(migration.includes('teacher_snapshot_class_group'), 'smart list assignment snapshots historical membership')
must(migration.includes('classroom_games') && migration.includes('classroom_game_teams'), 'classroom game scoring reuses canonical class groups')
must(migration.includes('teacher_adjust_game_score'), 'classroom game scoring uses a bounded server-authoritative RPC')
must(classHub.includes('assignments.find(item => item.is_class_teacher)'), 'class-wide ClassHub requires class-teacher authority')
must(groups.includes('matches.find(item => item.is_class_teacher)'), 'class-wide groups require class-teacher authority')
must(learner.includes('classAssignments.find((item) => item.is_class_teacher)'), 'class-wide learner history requires class-teacher authority')

if (failures.length) {
  console.error(`\nClass Operating System contract FAILED: ${failures.length} issue(s)`)
  process.exit(1)
}
console.log('\nClass Operating System contract PASSED')

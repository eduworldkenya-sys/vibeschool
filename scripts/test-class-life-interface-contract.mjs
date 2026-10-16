#!/usr/bin/env node
// Fast structural regression check for the connected Class Life user journeys.
// Database authorization and behavior are tested separately against PGlite.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const classOps = read('app/teacher/classhub/[id]/operations/page.tsx');
const groups = read('app/teacher/classhub/[id]/groups/page.tsx');
const learner = read('app/teacher/classhub/[id]/student/[studentId]/page.tsx');
const related = read('components/teacher/LearnerRelatedRecords.tsx');
const admin = read('app/admin/resources/page.tsx');
const component = read('components/teacher/ClassLeadershipPanel.tsx');
const history = read('components/teacher/LearnerLeadershipHistoryPanel.tsx');
const adapter = read('lib/class-life/leadership.ts');
const rootLayout = read('app/layout.tsx');

assert.match(classOps, /<ClassLeadershipPanel\s+classId=\{classId\}[^>]+scope="class"/,
  'canonical class leadership must remain in existing class operations');
assert.match(classOps, /dutySearch/,'preserve the searchable mobile duty picker from PR #749');
assert.match(classOps, /showPastDuties/,'preserve historic duty visibility');
assert.match(groups, /leadershipGroupId === group\.id/,
  'group leadership RPC UI must mount only on demand, not once per group');
assert.match(groups, /<ClassLeadershipPanel\s+classId=\{classId\}\s+scope="group"/,
  'group leader must be edited via canonical group scope');
assert.match(groups, /learners=\{savedIds\.map/,
  'group leader candidates must originate in current canonical group membership');
assert.match(related, /<LearnerLeadershipHistoryPanel\s+classId=\{classId\}\s+studentId=\{studentId\}/,
  'individual learner history must project the same appointment ledger');
assert.match(component, /getClassLeadership\(classId\)/);
assert.match(component, /appointClassLearner/);
assert.match(related, /focusedStudentId=\{studentId\}/, 'in-place learner roles must be limited to that learner');
assert.match(history, /getLearnerLeadershipHistory\(classId, studentId\)/);
assert.match(adapter, /school_appoint_class_learner/);
assert.match(adapter, /school_get_learner_leadership/);
assert.match(admin, /school_issue_library_book/);
assert.match(admin, /school_archive_library_book/);
assert.doesNotMatch([classOps,groups,learner,related,component,history].join('\n'), /\.from\(['"]class_learner_appointments['"]\)\.(?:insert|update|delete)/,
  'UI must not write leadership ledger directly');
assert.match(rootLayout, /from 'next\/font\/local'/, 'production build must use bundled fonts');
assert.doesNotMatch(rootLayout, /next\/font\/google/, 'reintroducing remote font fetching breaks deterministic build');
for (const name of ['manrope-latin.woff2','dm-sans-latin.woff2']) {
  assert.ok(fs.existsSync('public/fonts/teacher-studio/'+name),name+' must be included in the repository');
}
console.log('Class Life UI contracts and offline-font build dependency: PASS');

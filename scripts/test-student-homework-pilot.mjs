import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const feed = read('lib/homework/useHomeworkFeed.ts');
const learner = read('app/student/homework/[id]/page.tsx');
const teacher = read('app/teacher/classhub/[id]/homework/[hwId]/page.tsx');
const access = read('lib/homework/photoAccess.ts');
const migration = read('supabase/migrations/20261022171900_student_pilot_enrollment_visibility_hardening.sql');

function sourceFunction(name) {
  const sf = ts.createSourceFile('feed.ts', feed, ts.ScriptTarget.Latest, true);
  const node = sf.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === name);
  assert.ok(node, name + ' must exist');
  return node.getText(sf).replace(/^export\\s+/, '');
}

const js = ts.transpileModule(
  sourceFunction('daysUntil') + '\n' + sourceFunction('lifecycleOf'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }
).outputText;
const sandbox = { Date, Math };
const status = vm.runInNewContext(js + '\n lifecycleOf;', sandbox);
const tomorrow = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

assert.equal(status(tomorrow, 'received'), 'submitted');
assert.equal(status(tomorrow, 'submitted'), 'submitted');
assert.equal(status(tomorrow, 'under_review'), 'under_review');
assert.equal(status(tomorrow, 'returned'), 'returned');
assert.equal(status(tomorrow, 'draft'), 'draft');
assert.equal(status(tomorrow, 'marked'), 'under_review');
assert.equal(status(tomorrow, 'marked', true), 'marked');
assert.equal(status(tomorrow, 'pending'), 'upcoming');
assert.equal(status(new Date(Date.now() - 2 * 86400000).toISOString(), 'pending'), 'overdue');

assert.match(feed, /feedback_released_at/);
assert.match(feed, /feedbackReleased \? sub\?\.mark/);
assert.match(feed, /setError\("Could not refresh homework/);
assert.match(learner, /"received", "under_review", "marked"\]\.includes\(submission\.status\)/);
assert.match(learner, /released && submission\.mark/);
assert.match(learner, /getHomeworkPhotoViewUrl/);
assert.doesNotMatch(learner, /60 \* 60 \* 24 \* 365/);
assert.match(teacher, /getHomeworkPhotoViewUrl/);
assert.match(access, /createSignedUrl\(reference, 5 \* 60\)/);

assert.match(migration, /student_id = \(select public\.current_student_id\(\)\)/);
assert.match(migration, /sm\.role::text in \('owner','admin'\)/);
assert.match(migration, /psl\.parent_id = \(select auth\.uid\(\)\)/);

console.log('Student homework pilot regression contracts passed (not an authenticated browser test).');

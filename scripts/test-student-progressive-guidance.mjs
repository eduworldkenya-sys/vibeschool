import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');
const guide = read('components/student/StudentIntro.tsx');
test('optional guidance stays closed until requested and resets for a different learner or feature', () => {
  assert.match(guide, /identity\?\.studentId/);
  assert.match(guide, /useState\(false\)/);
  assert.match(guide, /setOpen\(false\).*studentId, feature/);
  assert.match(guide, /Got it/);
  assert.match(guide, /setOpen\(true\)/);
  assert.match(guide, /!open/);
});
test('feature guidance is not used to hide real assignment instructions', () => {
  for (const path of ['app/student/assessment/[assignmentId]/page.tsx', 'app/student/homework/[id]/page.tsx']) {
    assert.doesNotMatch(read(path), /StudentIntro/, path);
  }
});
test('returning learners can collapse repeated explanations across core screens', () => {
  const paths = [
    'app/student/study/page.tsx',
    'app/student/vibelearn/exams/page.tsx',
    'app/student/vibelearn/topic-practice/page.tsx',
    'app/student/exercises/page.tsx',
    'app/student/projects/page.tsx',
    'app/student/assessment/page.tsx',
    'app/student/tutoring/page.tsx',
    'app/student/settings/page.tsx',
    'app/student/marks/page.tsx',
    'app/student/vibelearn/kcse/page.tsx',
    'app/student/profile/page.tsx',
    'app/student/vibelearn/recovery/page.tsx',
  ];
  for (const path of paths) {
    const content = read(path);
    assert.match(content, /import StudentIntro from/);
    assert.match(content, /<StudentIntro feature=/);
  }
});

test('advanced learning evidence stays accessible but not always expanded', () => {
  const twin = read('app/student/twin/page.tsx');
  assert.match(twin, /<details[^>]*><summary[^>]*>Detailed learning evidence and Twin insights<\/summary>/);
  assert.match(twin, /REVISION TIMELINE/);
  const profile = read('app/student/profile/page.tsx');
  assert.match(profile, /<details[^>]*><summary[^>]*>Learning insights and achievements<\/summary>/);
  assert.match(profile, /My school identity/);
  assert.match(profile, /My support network/);
});
test('Learn puts key shortcuts first and retains optional tools and reading', () => {
  const learn = read('app/student/study/page.tsx');
  assert.match(learn, /<summary[^>]*>More reading tools<\/summary>/);
  assert.match(learn, /aria-label="Learning tools"/);
  assert.match(learn, /href="\/student\/vibelearn\/exams"/);
  assert.match(learn, /continueLearning/);
  assert.match(learn, /Assigned reading/);
});
test('remaining guidance and optional explanation surfaces have compact defaults', () => {
  for (const path of [
    'app/student/vibelearn/mistakes/page.tsx',
    'app/student/vibelearn/revision/page.tsx',
    'app/student/workspace/page.tsx',
    'app/student/tasks/page.tsx',
    'app/student/twin/page.tsx',
    'app/student/projects/independent/page.tsx',
  ]) {
    assert.match(read(path), /StudentIntro feature=/, path);
  }
  assert.match(read('app/student/vibelearn/exams/page.tsx'), /How averages are calculated/);
  assert.match(read('app/student/tasks/page.tsx'), /About reminders/);
});

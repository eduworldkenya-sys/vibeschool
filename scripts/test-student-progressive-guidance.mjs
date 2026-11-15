import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');
const guide = read('components/student/StudentIntro.tsx');
test('first-use guidance is learner-scoped, dismissible and recoverable', () => {
  assert.match(guide, /identity\?\.studentId/);
  assert.match(guide, /localStorage\.getItem/);
  assert.match(guide, /localStorage\.setItem/);
  assert.match(guide, /Got it/);
  assert.match(guide, /setOpen\(true\)/);
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

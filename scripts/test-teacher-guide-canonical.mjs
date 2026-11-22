import fs from 'node:fs';

const page = fs.readFileSync('app/teacher/teacher-guide/page.tsx','utf8');
const shell = fs.readFileSync('app/teacher/layout.tsx','utf8');
const picker = fs.readFileSync('components/teacher/TeacherGuideSelector.tsx','utf8');
const navigation = fs.readFileSync('components/teacher/navigation.ts','utf8');

const required = [
  ['canonical workspace authority', 'loadLessonWorkspace'],
  ['canonical plan codec', 'parseLessonPlanBody'],
  ['assigned-lesson selector', 'TeacherGuideSelector'],
  ['scheme/curriculum position', 'Curriculum position'],
  ['certified resources', 'certifiedContent'],
  ['lesson plan handoff', '/teacher/lessonplan?'],
  ['lesson notes handoff', '/teacher/lesson-notes?'],
  ['failure state', 'Teacher Guide needs attention'],
  ['retry state', 'Retry'],
  ['provenance', 'Authority & provenance'],
];
for (const [label, token] of required) {
  if (!page.includes(token)) throw new Error(`Teacher Guide contract missing ${label}: ${token}`);
}
if (!shell.includes('TeacherNavigation') || !navigation.includes("href: '/teacher/teacher-guide'")) throw new Error('Teacher Guide is not discoverable in Teacher OS navigation.');
if (!navigation.includes('teacherTabForPath') || !navigation.includes("teach: [")) throw new Error('Teacher Guide is not mapped to the Teach navigation authority.');
if (/\.from\(['"`]teacher_guides['"`]\)/.test(page)) throw new Error('Teacher Guide must not introduce a duplicate teacher_guides persistence authority.');
if (/supabase\.(from|rpc)/.test(page)) throw new Error('Teacher Guide page must compose through the canonical lesson workspace, not bypass it with direct data authority.');

for (const token of [
  'teacher_get_operating_context',
  'supabase.auth.getUser()',
  '<SubjectLessonHandoff',
  'validRecent(stored)',
  'item.class_id === stored.classId && item.subject_id === stored.subjectId',
  'setRetry(n => n + 1)',
]) {
  if (!picker.includes(token)) throw new Error(`Teacher Guide selector contract missing: ${token}`);
}
if (/\.from\(['"`]teacher_guides['"`]\)/.test(picker)) throw new Error('Picker must not create a second guide authority.');
console.log('Teacher Guide canonical composition and selection contract: PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(path, 'utf8');
const transpiled = ts.transpileModule(read('lib/vibetutor/lessonLifecycle.ts'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { tuitionLessonState, tuitionLessonCanCancel } = await import('data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64'));
const t = Date.parse('2026-11-11T16:00:00Z');
const lesson = { status: 'scheduled', starts_at: new Date(t).toISOString(), ends_at: new Date(t + 3600000).toISOString() };
assert.equal(tuitionLessonState(lesson, t - 900001), 'upcoming');
assert.equal(tuitionLessonState(lesson, t - 900000), 'joinable');
assert.equal(tuitionLessonState(lesson, t + 1), 'joinable');
assert.equal(tuitionLessonState(lesson, t + 3600000), 'ended');
assert.equal(tuitionLessonCanCancel(lesson, t - 1), true);
assert.equal(tuitionLessonCanCancel(lesson, t), false);
assert.equal(tuitionLessonCanCancel(lesson, t + 3600000), false);
assert.equal(tuitionLessonState({ ...lesson, status: 'completed' }, t + 3600000), 'completed');
assert.equal(tuitionLessonState({ ...lesson, status: 'cancelled' }, t + 3600000), 'cancelled');
assert.equal(tuitionLessonState({ ...lesson, starts_at: 'bad' }, t), 'unavailable');
assert.equal(tuitionLessonState({ ...lesson, ends_at: lesson.starts_at }, t), 'unavailable');

const dashboard = read('app/teacher/tutoring/page.tsx');
const privateTools = read('components/vibetutor/PrivateTuitionTools.tsx');
const classroom = read('components/vibetutor/PrivateVideoClassroom.tsx');
const api = read('app/api/vibetutor/video/[lessonId]/route.ts');
const cards = read('components/vibetutor/Cards.tsx');
const listings = read('components/vibetutor/listings.ts');
const editor = read('app/vibetutor/become-tutor/page.tsx');
assert.match(dashboard, /professionalName\.split/, 'dashboard greeting uses teacher identity');
assert.match(dashboard, /Africa\/Nairobi/, 'greeting uses Nairobi time');
assert.doesNotMatch(dashboard, />Good morning, \{firstName\}/, 'no fixed morning greeting');
assert.match(dashboard, /vibetutor_my_lesson_messages/, 'message summary uses connection-scoped RPC');
assert.match(dashboard, /joinableLesson\.id/, 'live classroom deep link uses live lesson ID');
assert.match(privateTools, /tuitionLessonCanCancel\(l, now\)/, 'cancel button uses actual eligibility');
assert.match(privateTools, /state === "joinable"/, 'join is time gated');
assert.match(privateTools, /This lesson has ended/, 'past lessons clearly marked');
assert.match(api, /error: error\.message, role/, 'ended lesson returns authenticated role');
assert.match(classroom, /returnRole === 'teacher'/, 'expired classroom respects tutor role');
assert.match(cards, /t\.real \?/, 'real tutor never described as a sample');
assert.match(cards, /r\.real \?/, 'real request never described as a sample');
assert.match(cards, /Available days/, 'nonholiday availability wording clarified');
assert.match(listings, /display_name: officialName/, 'public name comes from canonical account');
assert.match(editor, /readOnly=\{signedIn && !!professionalName\}/, 'verified public name cannot drift through editor');
console.log('PASS: tutor identity, Nairobi greeting, lesson expiry, classroom links, messaging, public listing labels');

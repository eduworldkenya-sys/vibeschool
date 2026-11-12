import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getNotebookGuidance } from '../lib/learning/notebookGuidance.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

const maths = getNotebookGuidance('Grade 4 Mathematics', 'practice')
assert.match(maths.invitation, /before checking/i)
assert.match(maths.task, /each calculation step/i)
assert.match(maths.task, /units/i)
assert.match(getNotebookGuidance('English', 'learn').task, /sentence/i)
assert.match(getNotebookGuidance('Kiswahili', 'revision').task, /spelling/i)
assert.match(getNotebookGuidance('Science', 'learn').task, /observation/i)
assert.match(getNotebookGuidance('Creative Arts and Sports', 'practice').task, /perform/i)
assert.match(getNotebookGuidance('Mathematics', 'recovery').invitation, /correct your earlier mistake/i)
assert.match(getNotebookGuidance(null, 'revision').invitation, /before looking at the explanation/i)
assert.match(getNotebookGuidance(null, 'teacher').invitation, /Invite learners/i)
assert.match(maths.alternative, /say the answer aloud/i)
assert.match(maths.alternative, /never automatically counted as marks, completion or mastery/i)

const ui = read('../components/learn/LearningNotebookPrompt.tsx')
assert.match(ui, /aria-label="Learning notebook guidance"/)
assert.match(ui, /getNotebookGuidance\(subject, stage\)/)
assert.doesNotMatch(ui, /supabase|\.rpc\(|onClick=|onChange=|localStorage|sessionStorage|setState|useState/i,
  'Notebook encouragement must not record self-reported learning or score anything')

const placements = [
  ['../components/learn/Grade4TimeContentReader.tsx', /<LearningNotebookPrompt subject="Mathematics" stage="learn"/],
  ['../components/learn/Grade4TimeOutcomePackage.tsx', /<LearningNotebookPrompt subject="Mathematics" stage="practice"/],
  ['../components/learn/Grade4TimeOutcomePackage.tsx', /stage=\{audience === 'teacher' \? 'teacher' : 'learn'\}/],
  ['../app/student/vibelearn/practice/page.tsx', /<LearningNotebookPrompt.*stage="practice"/],
  ['../app/student/vibelearn/revision/page.tsx', /<LearningNotebookPrompt stage="revision"/],
  ['../app/student/vibelearn/recovery/page.tsx', /<LearningNotebookPrompt stage="recovery"/],
  ['../app/student/vibelearn/topic-practice/page.tsx', /<LearningNotebookPrompt subject=\{session.subject\} stage="practice"/],
  ['../components/student/CanonicalTopicPractice.tsx', /<LearningNotebookPrompt subject=\{workspace.title\} stage="practice"/],
  ['../app/student/vibelearn/topic/page.tsx', /<LearningNotebookPrompt subject=\{subject\} stage="revision"/],
  ['../app/student/exercises/page.tsx', /<LearningNotebookPrompt stage="practice"/],
]
for (const [path, pattern] of placements) {
  const code = read(path)
  assert.match(code, /import LearningNotebookPrompt from/)
  assert.match(code, pattern, 'Expected real learning surface wiring: ' + path)
}
for (const path of [
  '../docs/curriculum/CONTENT_GENERATION.md',
  '../docs/curriculum/CONTENT_PRODUCTION_STANDARD.md',
  '../docs/curriculum/CONTENT_PACKAGE_TEMPLATE.md',
  '../docs/curriculum/CONTENT_OPERATING_MODEL.md',
]) {
  assert.match(read(path), /notebook|exercise.book|learner-produced work/i,
    'Content production architecture must specify learner-produced work')
}

console.log('Canonical learner notebook guidance, placements and evidence separation: PASS')

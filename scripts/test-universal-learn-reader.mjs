import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseGrade4TimeLessonSections } from '../lib/content/grade4TimeSections.mjs'
import { formatGrade4TimeLessonBody } from '../lib/content/grade4TimePresentation.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const universal = read('../components/learn/UniversalLearnReader.tsx')
const universalCss = read('../components/learn/UniversalLearnReader.module.css')
const full = read('../components/learn/Grade4TimeContentReader.tsx')
const outcome = read('../components/learn/Grade4TimeOutcomePackage.tsx')

test('one renderer serves both certified lesson and outcome route', () => {
  assert.match(full, /<UniversalLearnReader/)
  assert.match(outcome, /<UniversalLearnReader/)
  assert.match(full, /parseGrade4TimeLessonSections/)
  assert.match(outcome, /parseGrade4TimeLessonSections\(formatGrade4TimeLessonBody\(selected\.body\)\)/)
  assert.match(full, /vs_public_grade4_math_time_learner_lessons/)
  assert.match(outcome, /vs_published_grade4_time_outcome/)
  assert.match(outcome, /vs_published_grade4_time_practice/)
  assert.match(outcome, /audience === 'teacher'/)
})

test('section navigation is content-driven, accessible, and scoped', () => {
  assert.match(universal, /sections\.map\(\(section, index\)/)
  assert.match(universal, /aria-label="Lesson sections"/)
  assert.match(universal, /section\.id\.replace/)
  assert.match(universal, /section\.title/)
  assert.match(universal, /scroll-margin-top:20px|anchorPrefix/)
  assert.match(universal, /<VisualRichText body=\{section\.body\}/)
  assert.match(universal, /Review all explanations/)
  assert.match(universalCss, /@media\(max-width:600px\)/)
  assert.match(universalCss, /@media print/)
})

test('maths working and all five subject modes reuse canonical visual resolver', () => {
  for (const category of ['math', 'language', 'science', 'creative', 'general']) {
    assert.ok(universal.includes(category))
  }
  assert.match(universal, /function MathsWorking/)
  assert.match(universal, /Show next step/)
  assert.match(universal, /Show all steps/)
  assert.match(universal, /VisualLearningAsset/)
  assert.match(full, /<Grade4TimeWorkedSteps/)
  assert.match(full, /<Grade4TimePracticeCards/)
  assert.match(full, /<Grade4TimeLearningAid/)
  assert.match(outcome, /<Grade4TimeVisualModels/)
  assert.match(outcome, /inlineVisualPresent=\{\/\\\[visual:/)
})

test('published grade four Time sections survive full and outcome view without exposing author IDs', () => {
  const manuscript = [
    'LESSON 4 • Changing hours and minutes',
    'I CAN: Change hours into minutes.',
    "LET'S LEARN",
    'An hour contains sixty minutes.',
    'WORKED EXAMPLE',
    '1. Count the hours.',
    '2. Multiply by sixty.',
    '[visual:123e4567-e89b-42d3-a456-426614174000]',
    'EXERCISE • TRY YOURSELF',
    'VS-G04-MA-TIME-L04-E1: Change 3 hours to minutes.',
    'ANSWERS & HELPFUL FEEDBACK',
    'Answer: 180 minutes.',
  ].join('\n')
  const sections = parseGrade4TimeLessonSections(formatGrade4TimeLessonBody(manuscript))
  assert.equal(sections.sections.length, 4)
  assert.equal(sections.title, 'Changing hours and minutes')
  assert.match(sections.sections[1].body, /\[visual:/)
  assert.ok(sections.sections.some(section => section.id === 'feedback'))
  assert.ok(!JSON.stringify(sections).includes('VS-G04-MA-TIME'))
})

test('presentation stays read-only and cannot invent scores or access private assets', () => {
  for (const risky of ['supabase.from(', 'supabase.rpc(', 'student_outcome_mastery', 'service_role', 'localStorage', 'document.cookie']) {
    assert.ok(!universal.includes(risky), 'unexpected reader side effect: ' + risky)
  }
  assert.match(outcome, /Revealing an answer does not record completion, marks or mastery/)
  assert.match(outcome, /lifecycle_status', 'certified'/)
  assert.match(outcome, /UUID\.test\(row\.resource_version_id\)/)
  assert.match(universal, /renderBody\?\./)
})

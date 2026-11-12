import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { formatGrade4TimeLessonBody } from '../lib/content/grade4TimePresentation.mjs'
import { parseGrade4TimeLessonSections, TIME_SECTION_LABELS } from '../lib/content/grade4TimeSections.mjs'

const read=(path)=>readFileSync(path,'utf8')

test('legacy published Time questions display without authoring IDs',()=>{
  const source=[
    'PRACTISE TOGETHER',
    'VS-G04-MA-TIME-L04-G1: How many minutes are in 3 hours?',
    'Answer: 180 minutes',
    'VS-G04-MA-TIME-L04-G2: How long is 75 minutes?',
    'VS-G04-MA-TIME-L04-E1: Change 4 hours to minutes.',
    'VS-G04-MA-TIME-L04-Q1: How many minutes in 1 hour 40 minutes?',
  ].join('\n')
  const display=formatGrade4TimeLessonBody(source)
  assert.ok(display.includes('How many minutes are in 3 hours?'))
  assert.ok(display.includes('Answer: 180 minutes'))
  assert.ok(display.includes('Change 4 hours to minutes.'))
  assert.doesNotMatch(display,/VS-G04-MA-TIME-L\d{2}-/)
  assert.equal(display.split('\n').length,source.split('\n').length)
})

test('edits only recognized prefixes, preserves visual tokens and calculations',()=>{
  const original='2 × 60 = 120 minutes.\n[visual:123e4567-e89b-42d3-a456-426614174000]\nExample: 145 minutes.\nOther-ID: keep\nA VS-G04-MA-TIME-L04-G1: is inside a sentence.'
  assert.equal(formatGrade4TimeLessonBody(original),original)
  assert.equal(formatGrade4TimeLessonBody('  VS-G04-MA-TIME-L10-Q12: Try this.'),'  Try this.')
})

test('no claims of certification or source edits from presentation formatting',()=>{
  assert.equal(formatGrade4TimeLessonBody(''), '')
  assert.equal(formatGrade4TimeLessonBody(null), '')
  const shared=read('components/learn/Grade4TimeContentReader.tsx')
  const outcome=read('components/learn/Grade4TimeOutcomePackage.tsx')
  assert.match(shared,/formatGrade4TimeLessonBody\(current\.body\)/)
  assert.match(outcome,/formatGrade4TimeLessonBody\(selected\.body\)/)
  assert.doesNotMatch(shared,/aligned to the KICD/)
  assert.doesNotMatch(outcome,/>\{outcome\?\.source_locator\}/)
  assert.match(shared,/vs_public_grade4_math_time_learner_lessons/)
  assert.match(outcome,/vs_published_grade4_time_outcome/)
})

test('certified Grade 4 Time lesson text becomes a truthful readable sequence', () => {
  const text = [
    'LESSON 2 • Reading analogue and digital clocks',
    '',
    'I CAN: Read an analogue clock and write the same time on a digital clock.',
    '',
    "LET'S LEARN",
    '',
    'The short hand gives the hour and the long hand gives the minutes.',
    '',
    'WORKED EXAMPLE',
    '',
    'Find the time.',
    '1. Five groups of five make 25 minutes.',
    '2. The short hand points to eight.',
    '3. The time is 8:25.',
    '',
    'EXPLORE • TRY IT',
    '',
    'You need: A paper clock or pencil.',
    '[visual:123e4567-e89b-42d3-a456-426614174000]',
    '',
    'PRACTISE TOGETHER',
    '',
    'VS-G04-MA-TIME-L02-G1: What time is it?',
    'Answer: 8:25',
    'Why: The long hand points to 5.',
    '',
    'EXERCISE • TRY YOURSELF',
    '',
    'VS-G04-MA-TIME-L02-E1: Write 9:15.',
    '',
    'CHECK YOUR LEARNING',
    '',
    'VS-G04-MA-TIME-L02-Q1: What is a quarter-hour?',
    '',
    'ANSWERS & HELPFUL FEEDBACK',
    '',
    'VS-G04-MA-TIME-L02-E1: Write 9:15.',
    'Answer: Nine fifteen.',
    'Why: A quarter is fifteen minutes.',
    '',
    'IF YOU NEED HELP',
    '',
    'Use a paper clock.',
    '',
    'TRY A CHALLENGE',
    '',
    'How would you read a 24-hour time?',
    '',
    'REFLECT',
    '',
    'Explain what you learnt.',
  ].join('\\n')
  const display = formatGrade4TimeLessonBody(text)
  const parsed = parseGrade4TimeLessonSections(display)
  assert.equal(parsed.title, 'Reading analogue and digital clocks')
  assert.match(parsed.goal, /analogue clock/)
  assert.equal(parsed.sections.length, Object.keys(TIME_SECTION_LABELS).length)
  assert.deepEqual(parsed.sections.map(s => s.id), ['understand','example','explore','guided','exercise','check','feedback','support','challenge','reflect'])
  assert.ok(parsed.sections.find(s=>s.id === 'example')?.body.includes('3. The time is 8:25.'))
  assert.ok(parsed.sections.find(s=>s.id === 'explore')?.body.includes('[visual:123e4567-e89b-42d3-a456-426614174000]'))
  assert.ok(parsed.sections.find(s=>s.id === 'guided')?.body.includes('Answer: 8:25'))
  assert.ok(parsed.sections.find(s=>s.id === 'feedback')?.body.includes('Answer: Nine fifteen.'))
  assert.ok(!parsed.sections.find(s=>s.id === 'exercise')?.body.includes('Answer: Nine fifteen.'))
  assert.ok(!JSON.stringify(parsed).includes('VS-G04-MA-TIME-L02'), 'Do not display manuscript question IDs')
})

test('unknown or malformed manuscript lines are preserved, not silently deleted', () => {
  const odd = 'Unexpected heading\\nA formula: 5 × 60 = 300\\nAnother line'
  const parsed = parseGrade4TimeLessonSections(odd)
  assert.equal(parsed.title, '')
  assert.equal(parsed.goal, '')
  assert.equal(parsed.sections.length, 1)
  assert.equal(parsed.sections[0].body, odd)
  assert.equal(parseGrade4TimeLessonSections(null).sections.length, 0)
})

test('new learner reader makes exercise feedback optional without making fake progress claims', () => {
  const reader = read('components/learn/Grade4TimeContentReader.tsx')
  const styles = read('components/learn/Grade4TimeContentReader.module.css')
  assert.match(reader, /parseGrade4TimeLessonSections/)
  assert.match(reader, /<details className={styles.answerReveal}>/)
  assert.match(reader, /Show answers and explanations/)
  assert.match(reader, /Lesson position, not completion/)
  assert.match(reader, /VisualRichText body={section.body}/)
  assert.match(reader, /vs_public_grade4_math_time_learner_lessons/)
  assert.match(reader, /vs_published_grade4_time_outcomes/)
  assert.match(reader, /key={current.id}/, 'Answer reveal state must reset when changing lessons')
  assert.match(reader, /aria-current={current.id === lesson.id \? 'step' : undefined}/)
  assert.match(styles, /@media\\(max-width:700px\\)/, 'Real lesson body must be responsive')
  assert.doesNotMatch(reader, /supabase\\.from\\(['"]assessment_questions['"]\\)/, 'No second assessment API')
})

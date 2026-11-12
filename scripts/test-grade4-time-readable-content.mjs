import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { formatGrade4TimeLessonBody } from '../lib/content/grade4TimePresentation.mjs'

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

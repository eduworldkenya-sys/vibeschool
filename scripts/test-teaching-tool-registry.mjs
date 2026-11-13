import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { learnSubjectMode, selectTeachingTool, TEACHING_TOOL_REGISTRY } from '../lib/learn/teachingToolRegistry.ts'
import { parseGrade4TimeLessonSections } from '../lib/content/grade4TimeSections.mjs'

const section = (id, body, teachingTool) => ({ id, body, teachingTool })

test('registry supports reusable grade-neutral mathematics, language and science tools', () => {
  assert.deepEqual(Object.keys(TEACHING_TOOL_REGISTRY).sort(),
    ['language-reading', 'math-worked-steps', 'rich-text', 'science-observation'].sort())
  assert.equal(learnSubjectMode('Grade 8 Mathematics'), 'math')
  assert.equal(learnSubjectMode('English'), 'language')
  assert.equal(learnSubjectMode('Kiswahili'), 'language')
  assert.equal(learnSubjectMode('Integrated Science'), 'science')
  assert.equal(learnSubjectMode('Creative Arts'), 'creative')
  assert.equal(learnSubjectMode('Social Studies'), 'general')
})

test('explicit versioned content metadata selects the correct reusable tool', () => {
  assert.equal(selectTeachingTool('Mathematics', section('solve','2 + 2 = 4',{id:'math-worked-steps',version:1})).id,'math-worked-steps')
  assert.equal(selectTeachingTool('English', section('story','Once upon a time.',{id:'language-reading',version:1})).id,'language-reading')
  assert.equal(selectTeachingTool('Kiswahili', section('story','Hadithi.', 'language-reading')).source,'requested')
  assert.equal(selectTeachingTool('Science', section('observe','[visual:123e4567-e89b-42d3-a456-426614174000]', 'science-observation')).id,'science-observation')
  assert.equal(selectTeachingTool('Mathematics', section('explain','Simple content','rich-text')).id,'rich-text')
})

test('unknown, future-version and cross-subject tools fail closed to full readable text', () => {
  for(const requested of ['fake-tool', 'constructor', {id:'science-observation',version:2}, {id:'language-reading',version:0}]) {
    const selected=selectTeachingTool('Science',section('reading','Do not discard me',requested))
    assert.deepEqual([selected.id,selected.source], ['rich-text','fallback'])
  }
  assert.equal(selectTeachingTool('English',section('story','Keep passage','science-observation')).id,'rich-text')
  assert.equal(selectTeachingTool('Creative Arts',section('drawing','Keep drawing','math-worked-steps')).id,'rich-text')
})

test('existing published Grade 4 Time worked steps select automatically without altering body', () => {
  const published=[
    'LESSON 2 • Reading clocks',
    "LET'S LEARN",
    'Clocks tell time.',
    'WORKED EXAMPLE',
    '1. Look at the hour hand.',
    '2. Look at the minute hand.',
    'EXERCISE • TRY YOURSELF',
    'Read 9:10.',
  ].join('\n')
  const parsed=parseGrade4TimeLessonSections(published)
  assert.equal(selectTeachingTool('Mathematics', parsed.sections[1]).id,'math-worked-steps')
  assert.equal(selectTeachingTool('Mathematics', parsed.sections[1]).source,'automatic')
  assert.equal(selectTeachingTool('Mathematics', parsed.sections[2]).id,'rich-text')
  assert.match(parsed.sections[1].body,/1\. Look at the hour hand/)
  assert.equal(selectTeachingTool('Mathematics',section('example','An example without steps')).id,'rich-text')
})

test('language and science prose is not silently transformed into a different activity', () => {
  assert.equal(selectTeachingTool('English',section('learn','Read this prose.')).id,'rich-text')
  assert.equal(selectTeachingTool('Science',section('explore','A written explanation.')).id,'rich-text')
})

test('display tool host reuses certified visual renderer and contains no publication or assessment authority', () => {
  const host=readFileSync('components/learn/TeachingToolHost.tsx','utf8')
  const reader=readFileSync('components/learn/UniversalLearnReader.tsx','utf8')
  assert.match(host,/VisualRichText/)
  assert.match(reader,/renderBody\?\.\(section, index\)/)
  assert.match(reader,/<TeachingToolHost subject=\{subject\} section=\{section\}/)
  assert.match(reader,/Review all explanations/)
  for(const forbidden of ['supabase.rpc(', 'supabase.from(', 'service_role', 'localStorage', 'fetch(', 'grade4TimePractice', 'assessment_attempts']) {
    assert.ok(!host.includes(forbidden), 'tool host should not have '+forbidden)
  }
})

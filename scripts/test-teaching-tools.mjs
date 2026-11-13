import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { TEACHING_TOOL_CATALOG, isTeachingToolId, resolveTeachingTools, suggestTeachingTools } from '../lib/learn/teachingToolCatalog.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const reader = read('../components/learn/UniversalLearnReader.tsx')
const shelf = read('../components/learn/tools/TeachingToolShelf.tsx')
const math = read('../components/learn/tools/MathTeachingTools.tsx')
const languageScience = read('../components/learn/tools/LanguageScienceTeachingTools.tsx')
const css = read('../components/learn/tools/TeachingTools.module.css')
const grade4 = read('../components/learn/Grade4TimeContentReader.tsx')
const outcome = read('../components/learn/Grade4TimeOutcomePackage.tsx')

test('exactly twelve distinct, runnable tools cover three core subject groups', () => {
  assert.equal(TEACHING_TOOL_CATALOG.length, 12)
  assert.equal(new Set(TEACHING_TOOL_CATALOG.map(x => x.id)).size, 12)
  for (const [subject, count] of [['math', 6], ['language', 3], ['science', 3]]) {
    assert.equal(TEACHING_TOOL_CATALOG.filter(x => x.subject === subject).length, count)
  }
  for (const tool of TEACHING_TOOL_CATALOG) {
    assert.ok(isTeachingToolId(tool.id))
    assert.ok((math + languageScience).includes("case '" + tool.id + "'"), tool.id + ' missing implementation')
  }
})

test('recommendations are topic-aware and opt-in configurations replace defaults', () => {
  assert.deepEqual(suggestTeachingTools('Mathematics', 'Time').map(x => x.id), ['clock', 'unit-converter', 'number-line'])
  assert.equal(suggestTeachingTools('Mathematics', 'fractions')[0].id, 'fraction-bars')
  assert.equal(suggestTeachingTools('English').length, 3)
  assert.equal(suggestTeachingTools('Kiswahili').length, 3)
  assert.equal(suggestTeachingTools('Integrated Science').length, 3)
  assert.equal(suggestTeachingTools('Creative Arts').length, 0)
  const userSupplied = [{ id: 'sentence-order', sentence: 'We all love reading.' }, { id: 'sentence-order' }, { id: 'unknown-tool' }]
  assert.deepEqual(resolveTeachingTools('English', 'Sentence', userSupplied).map(x => x.id), ['sentence-order'])
  assert.equal(resolveTeachingTools('English', 'Sentence', []).length, 0)
  assert.equal(isTeachingToolId('unknown-tool'), false)
})

test('reader attaches tools after lesson content without changing publication or question authority', () => {
  assert.match(reader, /<TeachingToolShelf/)
  assert.match(reader, /showTeachingTools &&/)
  assert.match(reader, /tools\s*\?\?\s*\(sectionTools\.length/)
  assert.match(reader, /section\.tools \?\? \[\]/)
  assert.match(reader, /<VisualRichText body=\{section\.body\}/)
  assert.match(grade4, /topic="time"/)
  assert.match(outcome, /topic="time"/)
  assert.match(grade4, /vs_public_grade4_math_time_learner_lessons/)
  assert.match(outcome, /vs_published_grade4_time_outcome/)
})

test('interactive examples remain ephemeral and require an explicit click for checks', () => {
  for (const id of ['Check word', 'Check order', 'Check matches', 'Check groups']) {
    assert.ok(languageScience.includes(id), id)
  }
  assert.match(math, /type="range"/)
  assert.match(math, /role="img"/)
  assert.match(languageScience, /disabled=\{!complete\}/)
  assert.match(languageScience, /setChecked\(true\)/)
  for (const source of [shelf, math, languageScience, read('../lib/learn/teachingToolCatalog.ts')]) {
    for (const prohibited of ['supabase.', 'localStorage', 'service_role', '/api/', 'fetch(', 'document.cookie', 'student_outcome_mastery']) {
      assert.ok(!source.includes(prohibited), 'side-effect boundary violated by: ' + prohibited)
    }
  }
  assert.match(shelf, /not graded or saved/)
  assert.match(css, /focus-visible/)
  assert.match(css, /@media\(max-width:600px\)/)
})

test('empty and invalid author activities do not open unapproved tool surfaces', () => {
  assert.deepEqual(resolveTeachingTools('Science', '', []), [])
  assert.deepEqual(resolveTeachingTools('Geography', ''), [])
  assert.deepEqual(resolveTeachingTools('Maths', '', [{ id: 'untrusted' }, { id: 'number-line' }]).map(x => x.id), ['number-line'])
})

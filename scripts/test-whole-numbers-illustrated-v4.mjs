import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const old = JSON.parse(read('../content/curriculum/production/grade4-mathematics-whole-numbers-1.1.v2.editorial.json'))
const edition = JSON.parse(read('../content/curriculum/production/grade4-mathematics-whole-numbers-1.1.v4.illustrated.editorial.json'))

test('illustrated edition remains a separate unreleased original draft', () => {
  assert.match(edition.status, /NOT_IMPORTED_NOT_PUBLISHED/)
  assert.deepEqual(edition.target, old.target)
  assert.deepEqual(edition.source, old.source)
  assert.deepEqual(edition.practice, old.practice)
  assert.deepEqual(edition.practiceFeedback, old.practiceFeedback)
  assert.deepEqual(edition.assessment, old.assessment)
  assert.deepEqual(edition.assessmentMarkingGuide, old.assessmentMarkingGuide)
  assert.equal(edition.reader.length, 11)
  assert.deepEqual(edition.reader.map(s => s.id), old.reader.map(s => s.id))
  edition.reader.forEach((section, index) => {
    assert.deepEqual(section.sourceOutcomeCodes, old.reader[index].sourceOutcomeCodes)
    assert.ok(section.markdown.length >= 650, section.id + ' needs enough mathematical explanation')
    assert.match(section.markdown, /Check your thinking|Discover it yourself/)
    assert.ok(section.illustrationIds.length > 0, section.id + ' needs visual linkage')
  })
})

test('visuals cover the mathematics and carry alternatives', () => {
  const ids = edition.visualCandidates.map(x => x.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.length >= 10)
  for (const visual of edition.visualCandidates) {
    assert.ok(visual.alt && visual.alt.length >= 40, visual.id + ' requires accessible text')
  }
  for (const section of edition.reader) {
    for (const id of section.illustrationIds) assert.ok(ids.includes(id), 'unknown visual ' + id)
  }
})

test('existing reader receives native offline visual and discovery modes without leaking assessment keys', () => {
  const component = read('../components/global/publish/WholeNumbersInteractiveBlock.tsx')
  const stylesheet = read('../app/globals.css')
  for (const mode of ['place', 'round', 'factors', 'pairs', 'patterns', 'roman']) {
    assert.match(component, new RegExp("mode === '" + mode + "'"))
  }
  assert.match(component, /Factor arrays of/)
  assert.match(component, /counters grouped into pairs/)
  assert.match(component, /Pattern:/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /className="vs-whole-numbers-lab"/)
  assert.match(stylesheet, /html\[data-vs-theme='light'\] \.vs-whole-numbers-lab/)
  assert.doesNotMatch(component, /answer_key|markingGuide|fetch\(|supabase\.|localStorage\./)
})

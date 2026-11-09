import fs from 'node:fs'

const modal = fs.readFileSync(
  'components/teacher/LessonPlanModal.tsx',
  'utf8',
)
const workspace = fs.readFileSync(
  'lib/teaching/lessonWorkspace.ts',
  'utf8',
)
const source = fs.readFileSync(
  'lib/teaching/lessonSource.ts',
  'utf8',
)
const generator = fs.readFileSync(
  'lib/teaching/lessonGeneration.ts',
  'utf8',
)

const assertions = [
  [
    modal.includes('setTopic(loaded.source.topic)'),
    'New lesson plans must prefill the resolved source topic.',
  ],
  [
    workspace.includes('sourceLinked = source !== null'),
    'Resolved Scheme/curriculum sources must be linked by default.',
  ],
  [
    source.includes('occurrenceDate'),
    'Lesson source resolution must carry the dated occurrence.',
  ],
  [
    source.includes('objectives') &&
      source.includes('keyInquiryQuestion') &&
      source.includes('learningResources'),
    'Lesson source resolution must preserve Scheme pedagogy.',
  ],
  [
    generator.includes('curriculumObjectives') &&
      generator.includes('keyInquiryQuestion') &&
      generator.includes('learningResources'),
    'Contextual generation must accept authoritative Scheme grounding.',
  ],
  [
    !modal.includes([".from('homework')", 'as', 'any'].join(' ')),
    'LessonPlanModal must not restore the legacy homework type escape hatch.',
  ],
  [
    !source.includes(['as', 'unknown'].join(' ')),
    'Lesson source parsing must not use an unknown-cast escape hatch.',
  ],
  [
    source.includes("progression unavailable; trying dated sources") &&
      source.includes("if (progressionScheme)") &&
      source.includes("resolveInstructionalWeekForDate("),
    'Transient progression errors must preserve dated timetable and curriculum fallback.',
  ],
  [
    source.indexOf('if (!occurrenceDate) {') > source.indexOf('loadSchemeSourceForOccurrenceFallback({') &&
      source.indexOf('if (!occurrenceDate) {') < source.indexOf('const curriculumWeek = occurrenceWeek ?? currentWeekOf(term)') &&
      source.includes('if (progressionScheme)'),
    'Dated timetable occurrences must not prefill from global Scheme progression; undated flows may retain progression.',
  ],
  [
    source.includes("curriculum enrichment unavailable") &&
      source.includes("if (!data) return source") &&
      source.includes("return source"),
    'Missing authority enrichment must preserve the teacher-authored source without inventing outcomes.',
  ],
  [
    source.includes("assignment_not_found|academic_term_not_found") &&
      source.includes("throw progressionError"),
    'Progression recovery must not bypass authorization failures.',
  ],
]

const failures = assertions
  .filter(([ok]) => !ok)
  .map(([, message]) => message)

if (failures.length > 0) {
  console.error('Lesson plan prefill contract FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Lesson plan prefill contract PASSED')

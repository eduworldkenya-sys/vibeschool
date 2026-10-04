import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function requireText(label, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${label}: missing ${JSON.stringify(needle)}`)
  }
}

function forbidText(label, text, needle) {
  if (text.includes(needle)) {
    throw new Error(`${label}: forbidden ${JSON.stringify(needle)}`)
  }
}

const page = read('app/teacher/vibelearn/page.tsx')
const adoption = read('lib/content-engine/vibelearnClassAdoption.ts')
const indexer = read('app/teacher/vibelearn/indexer/page.tsx')
const more = read('app/teacher/more/page.tsx')
const today = read('app/teacher/teach-today/page.tsx')

requireText('teacher VibeLearn identity', page, 'VibeLearn · Learning Library')
requireText('teacher VibeLearn identity', page, 'Find. Use. Follow learning.')
forbidText('teacher VibeLearn identity', page, 'Publish. Earn. Grow.')

requireText('class context', page, 'params.get("classId")')
requireText('class context', page, 'preferredClassId')
requireText('class context', page, 'loadSubjectAdoptionClasses(\n              resolvedSubjectId,\n              requestedClassId')

requireText('search contract', page, '.textSearch(')
requireText('search contract', page, '"search_vector"')
forbidText('search contract', page, '.ilike("title"')

requireText('canonical subject match', page, 'registry?.subjectId === subjectId')
requireText('canonical subject map', adoption, 'subjectId: row.subject_id')

for (const role of [
  'supplementary',
  'teacher_reference',
  'learner_reading',
  'exercise',
  'remedial',
  'enrichment',
  'assessment_source',
]) {
  requireText('class resource use contract', page + adoption, role)
}
requireText('class resource use contract', page, 'How do you want to use this?')
requireText('class resource use contract', adoption, "p_usage_role: input.usageRole ?? 'supplementary'")

requireText('studio authority', page, '/teacher/studio/editor?format=vibetextbook')
requireText('studio authority', page, '/teacher/studio/editor?format=ebook')
forbidText('studio authority', page, '/global/create/textbook')

requireText('truthful publishing metrics', indexer, 'Publishing Health')
requireText('truthful publishing metrics', indexer, 'This is not a learning-quality score.')
forbidText('truthful publishing metrics', indexer, 'Tagged content appears 3× more')
forbidText('truthful publishing metrics', indexer, 'Views signal quality to the ranking engine.')

requireText('teacher navigation', more, 'Learning library for your classes and subjects')
requireText('teaching desk', today, 'Curriculum-aware learning library')

console.log('VibeLearn Teacher Learning OS contract: PASS')

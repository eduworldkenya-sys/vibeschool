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
const studentPage = read('app/student/vibelearn/page.tsx')
const studentLib = read('lib/student/vibelearn.ts')
const sequenceLib = read('lib/vibelearn/lessonLearningSequence.ts')
const sequenceUi = read('components/teacher/VibeLearnLessonSequence.tsx')
const lessonModal = read('components/teacher/LessonPlanModal.tsx')
const graphRepair = read('supabase/migrations/20261004123000_vibelearn_learning_graph_production_reconcile.sql')
const verifiedOutcomeFix = read('supabase/migrations/20261004153000_vibelearn_lesson_verified_outcome_status.sql')

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

requireText('student assigned reading', studentLib, 'getAssignedReading')
requireText('student assigned reading', studentLib, "from('vibe_chapter_assignments')")
requireText('student assigned reading', studentLib, "from('vibe_reading_progress')")
requireText('student assigned reading', studentPage, 'Reading and learning material')
requireText('student assigned reading', studentPage, 'Teacher-assigned learning')

requireText('adaptive learning path', studentLib, 'getAdaptiveLearningPath')
requireText('adaptive learning path', studentLib, "student_get_adaptive_learning_path")
requireText('adaptive learning path', studentPage, 'Your learning path')
requireText('adaptive learning path', studentPage, 'Build foundation first')
requireText('adaptive learning path', studentPage, 'VibeLearn does not invent a weakness when evidence is missing.')

requireText('graph production reconcile', graphRepair, 'create table if not exists public.curriculum_concepts')
requireText('graph production reconcile', graphRepair, 'create table if not exists public.curriculum_misconceptions')
requireText('graph production reconcile', graphRepair, 'teacher_get_vibelearn_lesson_recommendations')
requireText('graph authorization', graphRepair, 'revoke all on table public.curriculum_concepts from public,anon,authenticated')
requireText('graph authorization', graphRepair, 'grant all on table public.curriculum_concepts to service_role')
requireText('evidence-safe differentiation', graphRepair, "'missing_evidence_is_not_weakness',true")
requireText('teacher controls differentiation', graphRepair, "'teacher_controls_assignment',true")
requireText('graph fallback', graphRepair, "'graph_is_enrichment_not_invention',true")
requireText('verified lesson outcome authority', verifiedOutcomeFix, "clo.status in ('active','verified')")
forbidText('verified lesson outcome authority', verifiedOutcomeFix, "clo.status = 'active'")

requireText('lesson sequence client', sequenceLib, "teacher_get_vibelearn_lesson_recommendations")
requireText('lesson sequence client', sequenceLib, "link_learning_resource")
requireText('lesson sequence client', sequenceLib, "p_target_type: 'lesson_plan'")
requireText('lesson sequence builder', sequenceUi, 'VibeLearn lesson sequence')
requireText('lesson sequence builder', sequenceUi, 'Missing evidence is not treated as weakness.')
requireText('lesson sequence builder', sequenceUi, 'You choose what becomes part of the plan.')
requireText('lesson workspace integration', lessonModal, "import VibeLearnLessonSequence")
requireText('lesson workspace integration', lessonModal, '<VibeLearnLessonSequence')

console.log('VibeLearn Learning OS contract: PASS')

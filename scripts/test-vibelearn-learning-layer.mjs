import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
}

function must(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`VibeLearn contract failed: ${label}`)
}

function mustNot(text, needle, label) {
  if (text.includes(needle)) throw new Error(`VibeLearn contract failed: ${label}`)
}

const page = read('app/teacher/vibelearn/page.tsx')
const workspace = read('components/teacher/VibeLearnWorkspace.tsx')
const service = read('lib/vibelearn/teacherWorkspace.ts')
const subject = read('components/teacher/SubjectCompanion.tsx')
const more = read('app/teacher/more/page.tsx')
const indexer = read('app/teacher/vibelearn/indexer/page.tsx')

must(page, 'useState<Tab>("discover")', 'learning library must be the default teacher VibeLearn surface')
must(page, '<VibeLearnWorkspace />', 'teacher VibeLearn must render the canonical learning workspace')
must(page, 'Learning Library', 'teacher-facing product language must describe the learning library')
mustNot(page, 'Publish. Earn. Grow.', 'publisher messaging must not define Teacher VibeLearn')
mustNot(page, 'Drop Your First Vibe', 'teacher UI must avoid creator jargon')

must(workspace, "searchParams.get('classId')", 'class context must survive navigation into VibeLearn')
must(workspace, "searchParams.get('subjectId')", 'subject context must survive navigation into VibeLearn')
must(workspace, 'How do you want to use this?', 'resource use must be expressed in natural teacher language')
must(workspace, 'Results are ranked by curriculum, subject, grade, certification and your current teaching context—not popularity.', 'ranking explanation must be truthful')
must(workspace, 'What learners should master', 'curriculum outcomes must be visible in the learning workspace')
must(workspace, 'Learning needing attention', 'existing intervention evidence must feed VibeLearn')

must(service, ".from('curriculum_outcome_prerequisites')", 'VibeLearn must reuse the canonical prerequisite graph')
must(service, ".from('assessment_interventions')", 'VibeLearn must reuse the existing mastery-derived intervention evidence')
must(service, ".from('learning_resource_versions')", 'certified resource versions must influence recommendations')
must(service, "p_target_type: 'lesson_plan'", 'class resources must be able to link into the prepared lesson')
must(service, "p_usage_role: CLASS_ROLE_BY_INTENT[input.intent]", 'natural teacher intent must map to canonical class-library roles')

must(subject, 'VibeLearn Library', 'SubjectHub should name the learning library consistently')
must(more, 'Learning library for your classes', 'Teacher More should explain VibeLearn in natural language')
must(indexer, 'Publishing Reach', 'legacy publisher analytics should be presented as publishing reach')
mustNot(indexer, 'appears 3× more', 'unsupported search-ranking claims must be removed')
mustNot(indexer, 'How VibeLearn ranks your content for student discovery', 'publisher score must not claim to be the learning recommendation rank')

console.log('VibeLearn teacher learning-layer contract: PASS')

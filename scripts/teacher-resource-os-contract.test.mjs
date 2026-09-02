import fs from 'node:fs'
import assert from 'node:assert/strict'

const resourcePage = fs.readFileSync('app/teacher/resources/page.tsx', 'utf8')
const lessonModal = fs.readFileSync('components/teacher/LessonPlanModal.tsx', 'utf8')
const teachMode = fs.readFileSync('components/teacher/LessonTeachMode.tsx', 'utf8')

const mustContain = [
  "resolve_instructional_week_for_date",
  "list_scheme_lesson_resources_batch",
  ".from('learning_resources')",
  ".eq('status', 'active')",
  ".eq('visibility', 'public')",
  ".from('teacher_classes')",
  ".from('scheme_of_work')",
  "Ready this week",
  "My teaching library",
  "Teacher-added resources stay class-scoped",
  "assignments.some(row => row.class_id === form.class_id && row.subject_id === form.subject_id)",
  "if (!form.external_url.trim() && !form.content.trim())",
  "isSafeUrl(form.external_url.trim())",
  "is_school_wide: false",
  "class_id: form.class_id",
  "/read/textbook/${publicationId}/${chapterId}",
]

for (const needle of mustContain) {
  assert.ok(resourcePage.includes(needle), `Teacher Resource OS contract missing: ${needle}`)
}

const forbidden = [
  "const isSchoolWide = !form.class_id",
  "No class selected — resource will be school-wide",
  "-- School-wide (all classes) --",
  "is_school_wide: form.school_wide",
  "class_id: form.school_wide ? null : form.class_id",
]
for (const needle of forbidden) {
  assert.ok(!resourcePage.includes(needle), `Unsafe legacy Resources behavior reintroduced: ${needle}`)
}

assert.ok(resourcePage.indexOf(".from('scheme_of_work')") < resourcePage.indexOf("list_scheme_lesson_resources_batch"), 'Scheme authority must be resolved before resource links')
assert.ok(resourcePage.indexOf("list_scheme_lesson_resources_batch") < resourcePage.indexOf(".from('learning_resources')"), 'Exact Scheme links must be resolved before canonical resource hydration')
assert.ok(resourcePage.indexOf(".from('teacher_classes')") < resourcePage.indexOf(".from('resources').insert"), 'Teacher assignment authority must be loaded before resource mutation')

for (const needle of [
  "list_teaching_resources",
  "listOccurrenceResourceUsage",
  "markOccurrenceResourceUsed",
  "lessonResources.map",
  "Used ✓",
  "<LessonTeachMode",
]) {
  assert.ok(lessonModal.includes(needle), `Lesson workspace resource continuity missing: ${needle}`)
}

for (const needle of [
  "type PackView = 'notes' | 'resources' | 'assessment' | 'homework'",
  'PreparedNotes',
  'Opening notes',
  'Core teaching notes',
  'Closure notes',
  'Ready beside you',
  'No extra preparation',
  'Use the prepared lesson pack without leaving Teach Now.',
  'This saved plan has no authoritative timing metadata.',
  "sections.resources",
  "sections.assessmentHook",
  "sections.homework",
]) {
  assert.ok(teachMode.includes(needle), `Teach Now resource-pack contract missing: ${needle}`)
}

assert.ok(!teachMode.includes("return '40 minutes'"), 'Teach Now must not invent a conventional duration when timing authority is missing')

console.log('Teacher Resource OS contract: PASS')

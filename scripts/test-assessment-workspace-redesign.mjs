import fs from 'node:fs'

const page = fs.readFileSync('app/teacher/assessment/page.tsx', 'utf8')
const css = fs.readFileSync('app/teacher/assessment/assessment.module.css', 'utf8')

function check(condition, message) {
  if (!condition) throw new Error(`assessment workspace contract: ${message}`)
}

check(page.includes("supabase.rpc('teacher_get_operating_context')"), 'uses canonical teacher operating context')
check(page.includes(".from('student_classes')") && page.includes(".from('cbc_assessments')"), 'preserves canonical roster and CBC evidence stores')
check(page.includes('aria-label="Assessment context"'), 'exposes one compact accessible context control')
check(page.includes('subjectsForClass(assignments, loadedClasses[ci]?.id)') && page.includes('setSubjects(subjectsForClass(teachingContexts, nextClassId))'), 'keeps subjects scoped to the selected teaching class')
check(page.includes('aria-label="Assessment tools"'), 'exposes primary tools as navigation')
check(page.includes("router.push('/teacher/assessment/cat/new')"), 'CAT has a direct working route')
check(page.includes("router.push('/teacher/results')"), 'Exam entry remains connected')
check(page.includes("router.push('/teacher/assessment/bank')") && page.includes("router.push('/teacher/progress')"), 'secondary assessment tools remain connected')
check(page.includes('aria-label="Find learner"') && page.includes('Filter learners'), 'learner search and filtering remain accessible')
check(page.includes('Record together') && page.includes('saveBulk(): Promise<boolean>'), 'bulk entry is a guarded selection workflow')
check(page.includes('Assessment could not load') && page.includes('Try again'), 'load failure has recovery')
check(page.includes("students.length===0?'No learners yet':'No matches'"), 'empty roster and empty filter states are distinct')
check(css.includes('min-height:44px') && css.includes('@media(max-width:420px)'), 'mobile touch targets and narrow viewport behavior are explicit')
check(css.includes('@media(prefers-reduced-motion:reduce)'), 'reduced motion is respected')
check(!page.includes('Pick strand + type + performance'), 'long instructional bulk copy is removed')
check(!page.includes('Add TPAD Evidence'), 'secondary evidence action no longer crowds the primary page')

console.log('assessment workspace redesign contract: ok')

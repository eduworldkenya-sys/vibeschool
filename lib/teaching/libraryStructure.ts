/**
 * Navigation-only teaching resource taxonomy.
 *
 * The 15 slots are stable descriptors, NOT seeded content. A slot must stay
 * empty until an actual resource is stored or linked through the canonical
 * teaching resource pipeline. Never synthesize lesson materials here.
 */
export type TeachingLibraryCategoryId =
  | 'teach-explain'
  | 'explore-participate'
  | 'practise-apply'
  | 'check-learning'
  | 'support-improve'

export type TeachingLibrarySlot = {
  id: string
  categoryId: TeachingLibraryCategoryId
  label: string
  purpose: string
  // Existing resources.type values only; never reclassify unrelated content.
  existingPersonalResourceType?: 'notes' | 'quiz'
}

export const TEACHING_LIBRARY_CATEGORIES: ReadonlyArray<{
  id: TeachingLibraryCategoryId
  label: string
  description: string
}> = [
  { id: 'teach-explain', label: 'Teach & Explain', description: 'Help learners understand ideas and skills.' },
  { id: 'explore-participate', label: 'Explore & Participate', description: 'Learn through investigation, conversation and play.' },
  { id: 'practise-apply', label: 'Practise & Apply', description: 'Apply learning independently and at home.' },
  { id: 'check-learning', label: 'Check Learning', description: 'Find out what learners have understood.' },
  { id: 'support-improve', label: 'Support & Improve', description: 'Review progress and meet different learning needs.' },
]

export const TEACHING_LIBRARY_SLOTS: ReadonlyArray<TeachingLibrarySlot> = [
  { id: 'lesson-notes', categoryId: 'teach-explain', label: 'Lesson Notes', purpose: 'Explain what the learner needs to know.', existingPersonalResourceType: 'notes' },
  { id: 'worked-examples', categoryId: 'teach-explain', label: 'Worked Examples', purpose: 'Show solutions step by step.' },
  { id: 'illustrations-diagrams', categoryId: 'teach-explain', label: 'Illustrations & Diagrams', purpose: 'Explain concepts visually.' },
  { id: 'demonstrations', categoryId: 'teach-explain', label: 'Demonstrations', purpose: 'Show how something is done.' },
  { id: 'experiments', categoryId: 'explore-participate', label: 'Experiments', purpose: 'Investigate and discover.' },
  { id: 'discussions', categoryId: 'explore-participate', label: 'Discussions', purpose: 'Share ideas and explanations.' },
  { id: 'projects', categoryId: 'explore-participate', label: 'Projects', purpose: 'Create something using new knowledge.' },
  { id: 'educational-games', categoryId: 'explore-participate', label: 'Educational Games', purpose: 'Reinforce skills through play.' },
  { id: 'assignments', categoryId: 'practise-apply', label: 'Assignments', purpose: 'Complete independent class work.' },
  { id: 'homework', categoryId: 'practise-apply', label: 'Homework', purpose: 'Practise learning outside the lesson.' },
  { id: 'quizzes', categoryId: 'check-learning', label: 'Quizzes', purpose: 'Check understanding with short questions.', existingPersonalResourceType: 'quiz' },
  { id: 'tests-exams', categoryId: 'check-learning', label: 'Tests & Exams', purpose: 'Assess achievement across learning outcomes.' },
  { id: 'revision', categoryId: 'support-improve', label: 'Revision', purpose: 'Review earlier learning.' },
  { id: 'reflection', categoryId: 'support-improve', label: 'Reflection', purpose: 'Think about what has been learned.' },
  { id: 'remedial-enrichment', categoryId: 'support-improve', label: 'Remedial & Enrichment', purpose: 'Provide extra support and new challenges.' },
]

export function filterTeachingLibrarySlots(
  query: string,
  category: TeachingLibraryCategoryId | 'all' = 'all',
): TeachingLibrarySlot[] {
  const normalized = query.trim().toLocaleLowerCase()
  return TEACHING_LIBRARY_SLOTS.filter(slot => {
    if (category !== 'all' && slot.categoryId !== category) return false
    const group = TEACHING_LIBRARY_CATEGORIES.find(item => item.id === slot.categoryId)
    return !normalized || [slot.label, slot.purpose, group?.label ?? '']
      .some(value => value.toLocaleLowerCase().includes(normalized))
  })
}

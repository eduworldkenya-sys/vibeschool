// Canonical registration choices. The grade and post-secondary pathways remain
// separate: selecting a qualification never masquerades as a school grade.
export const LEARNING_LEVELS = [
  { id: 'pre-primary', label: 'Pre-primary', choices: ['PP1', 'PP2'] },
  { id: 'primary', label: 'Primary School', choices: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
  { id: 'junior', label: 'Junior School', choices: ['Grade 7','Grade 8','Grade 9'] },
  { id: 'senior', label: 'Senior School', choices: ['Grade 10','Grade 11','Grade 12'] },
  { id: 'secondary', label: 'Secondary (8-4-4)', choices: ['Form 1','Form 2','Form 3','Form 4'] },
  { id: 'college', label: 'College / TVET', choices: ['Certificate','Diploma','Higher Diploma'] },
  { id: 'university', label: 'University', choices: ['Undergraduate','Postgraduate'] },
  { id: 'professional', label: 'Professional Studies', choices: ['CPA','CS'] },
] as const

export type LearningLevel = typeof LEARNING_LEVELS[number]['id']
export type PostSecondaryFamily = 'professional_studies' | 'tvet' | 'university'

export type LearningSelection = {
  gradeLabel: string
  pathway?: { programme_family: PostSecondaryFamily; qualification_code: string; examining_body: string | null }
}

export function resolveLearningSelection(level: unknown, choice: unknown): LearningSelection | null {
  if (typeof level !== 'string' || typeof choice !== 'string') return null
  const group = LEARNING_LEVELS.find(entry => entry.id === level)
  if (!group || !(group.choices as readonly string[]).includes(choice)) return null
  if (level === 'professional') return {
    gradeLabel: 'Professional Studies',
    pathway: { programme_family: 'professional_studies', qualification_code: choice, examining_body: 'KASNEB' },
  }
  if (level === 'college') return {
    gradeLabel: 'College',
    pathway: { programme_family: 'tvet', qualification_code: choice.toUpperCase().replaceAll(' ', '_'), examining_body: null },
  }
  if (level === 'university') return {
    gradeLabel: 'University',
    pathway: { programme_family: 'university', qualification_code: choice.toUpperCase(), examining_body: null },
  }
  return { gradeLabel: choice }
}

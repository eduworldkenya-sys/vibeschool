export const LEARNER_GRADES = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  'Form 1', 'Form 2', 'Form 3', 'Form 4',
] as const

export function validLearnerGrade(value: unknown): value is typeof LEARNER_GRADES[number] {
  return typeof value === 'string' &&
    (LEARNER_GRADES as readonly string[]).includes(value)
}

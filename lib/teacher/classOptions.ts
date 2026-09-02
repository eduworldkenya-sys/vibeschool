export const CLASS_LEVEL_GROUPS = [
  { label: 'Early years', levels: ['PP1', 'PP2'] },
  { label: 'Primary', levels: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'] },
  { label: 'Junior school', levels: ['Grade 7', 'Grade 8', 'Grade 9'] },
  { label: 'Senior school', levels: ['Grade 10', 'Grade 11', 'Grade 12'] },
  { label: 'Legacy secondary', levels: ['Form 1', 'Form 2', 'Form 3', 'Form 4'] },
] as const

export type TeacherClassRole = 'subject_teacher' | 'class_teacher'

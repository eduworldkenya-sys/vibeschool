export const CLASS_LEVEL_GROUPS = [
  { label: 'Pre-primary', levels: ['PP1', 'PP2'] },
  { label: 'Primary CBE', levels: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'] },
  { label: 'Junior School', levels: ['Grade 7', 'Grade 8', 'Grade 9'] },
  { label: 'Senior School CBE', levels: ['Grade 10', 'Grade 11', 'Grade 12'] },
  { label: 'Secondary 8-4-4', levels: ['Form 1', 'Form 2', 'Form 3', 'Form 4'] },
] as const

export const TEACHER_SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili', 'Science and Technology',
  'Social Studies', 'Religious Education', 'Creative Arts and Sports',
  'Agriculture and Nutrition', 'Home Science', 'Indigenous Languages',
  'French', 'German', 'Arabic', 'Kenyan Sign Language',
  'Biology', 'Chemistry', 'Physics', 'History and Government',
  'Geography', 'Business Studies', 'Computer Studies',
  'Christian Religious Education', 'Islamic Religious Education',
  'Hindu Religious Education', 'Music', 'Art and Design',
] as const

export type TeacherClassRole = 'subject_teacher' | 'class_teacher'


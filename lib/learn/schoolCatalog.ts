/**
 * Frontend-only subject catalogue for anonymous discovery.
 * Signed-in learners use grade_subject_authority when available; these labels
 * mirror the existing repository curriculum/timetable registers and are NOT a
 * second curriculum or publication authority.
 */
export const SCHOOL_LEVELS = [
  { id: 'early', label: 'Early Years', grades: ['Playgroup', 'PP1', 'PP2'] },
  { id: 'primary', label: 'Primary School', grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'] },
  { id: 'junior', label: 'Junior School', grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
  { id: 'senior', label: 'Senior School', grades: ['Grade 10', 'Grade 11', 'Grade 12'] },
  { id: 'legacy', label: 'Forms 1–4', grades: ['Form 1', 'Form 2', 'Form 3', 'Form 4'] },
] as const

export type SchoolLevelId = typeof SCHOOL_LEVELS[number]['id']
export type SubjectGroup = { title: string; subjects: string[] }

const religious = ['Christian Religious Education', 'Islamic Religious Education', 'Hindu Religious Education']
const languages = ['Indigenous Language', 'Arabic', 'French', 'German', 'Mandarin']

const prePrimary: SubjectGroup[] = [
  { title: 'Learning activities', subjects: ['Language Activities', 'Mathematical Activities', 'Creative Activities', 'Environmental Activities'] },
  { title: 'Religious education options', subjects: religious },
]
const lowerPrimary: SubjectGroup[] = [
  { title: 'Learning areas', subjects: ['Mathematics', 'English', 'Kiswahili', 'Indigenous Languages', 'Environmental Activities', 'Creative Activities', 'Religious Education'] },
  { title: 'Language and religious options', subjects: ['Kenyan Sign Language', ...religious] },
]
const upperPrimary: SubjectGroup[] = [
  { title: 'Learning areas', subjects: ['Mathematics', 'English', 'Kiswahili', 'Science & Technology', 'Agriculture', 'Social Studies', 'Creative Arts', 'Religious Education'] },
  { title: 'Additional languages and religious options', subjects: ['Kenyan Sign Language', ...languages, ...religious] },
]
const junior: SubjectGroup[] = [
  { title: 'Learning areas', subjects: ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Pre-Technical Studies', 'Agriculture', 'Social Studies', 'Creative Arts', 'Religious Education'] },
  { title: 'Additional languages and religious options', subjects: ['Kenyan Sign Language', ...languages, ...religious] },
]
const senior: SubjectGroup[] = [
  { title: 'Core and language choices', subjects: ['English', 'Kiswahili', 'Kenyan Sign Language', 'Core Mathematics', 'Essential Mathematics', 'Community Service Learning'] },
  { title: 'STEM pathway', subjects: ['Biology', 'Chemistry', 'Physics', 'General Science', 'Agriculture', 'Computer Studies', 'Home Science', 'Aviation', 'Building Construction', 'Electricity', 'Metalwork', 'Power Mechanics', 'Wood Technology', 'Media Technology', 'Marine and Fisheries Technology'] },
  { title: 'Social Sciences pathway', subjects: ['Literature in English', 'Fasihi ya Kiswahili', 'Indigenous Languages', 'Arabic', 'French', 'German', 'Mandarin Chinese', ...religious, 'Business Studies', 'History and Citizenship', 'Geography'] },
  { title: 'Arts and Sports pathway', subjects: ['Sports and Recreation', 'Music and Dance', 'Theatre and Film', 'Fine Arts'] },
]

/** No invented Playgroup or legacy Form national subject lists. */
export function fallbackSubjectGroups(grade: string): SubjectGroup[] {
  if (grade === 'PP1' || grade === 'PP2') return prePrimary
  const number = /^Grade (\d+)$/.exec(grade)?.[1]
  if (number) {
    const n = Number(number)
    if (n <= 3) return lowerPrimary
    if (n <= 6) return upperPrimary
    if (n <= 9) return junior
    if (n <= 12) return senior
  }
  return []
}

export function levelForGrade(grade: string): SchoolLevelId {
  return SCHOOL_LEVELS.find(level => (level.grades as readonly string[]).includes(grade))?.id ?? 'primary'
}

export function recogniseLearnerGrade(value?: string | null): string | null {
  if (!value) return null
  const direct = SCHOOL_LEVELS.flatMap(item => item.grades).find(grade =>
    grade.toLowerCase() === value.trim().toLowerCase())
  if (direct) return direct
  const match = /\b(grade|form)\s*(1[0-2]|[1-9])\b/i.exec(value)
  if (match) return `${match[1].toLowerCase() === 'form' ? 'Form' : 'Grade'} ${Number(match[2])}`
  const early = /\b(pp\s*[12]|playgroup)\b/i.exec(value)
  if (early) return early[1].toLowerCase().startsWith('play') ? 'Playgroup' : `PP${early[1].replace(/\D/g, '')}`
  return null
}

const canonicalAliases: Record<string,string> = {
  scienceandtechnology: 'science&technology',
  creativeartsandsports: 'creativearts',
  agricultureandnutrition: 'agriculture',
  indigenouslanguageactivities: 'indigenouslanguages',
  englishlanguageactivities: 'english',
  mathematicactivities: 'mathematics',
  mathematicalactivities: 'mathematics',
  kiswahililanguageactivities: 'kiswahili',
}

export function subjectKey(value?: string | null): string {
  const key = (value || '').toLowerCase().replace(/[^a-z0-9&]/g, '')
  return canonicalAliases[key] ?? key
}

export function groupsForAvailableSubjects(grade: string, names: string[]): SubjectGroup[] {
  const source = fallbackSubjectGroups(grade)
  if (!names.length) return source
  const keyed = new Set(names.map(subjectKey))
  const matched = new Set<string>()
  const groups = source.map(group => ({
    title: group.title,
    subjects: group.subjects.filter(name => {
      const hit = keyed.has(subjectKey(name))
      if (hit) matched.add(subjectKey(name))
      return hit
    }),
  })).filter(group => group.subjects.length)
  const other = names.filter(name => !matched.has(subjectKey(name)))
  if (other.length) groups.push({ title: source.length ? 'Other registered subjects' : 'Registered subjects', subjects: other })
  return groups
}

/** These routes exist in main; their readers independently enforce release status. */
export const EXISTING_LESSON_READERS = [
  { grade: 'Grade 4', subject: 'Mathematics', title: 'Time', subtitle: 'Clocks, a.m. and p.m., conversions and duration', href: '/learn/grade-4/mathematics/time' },
  { grade: 'Grade 1', subject: 'Creative Activities', title: 'Creative Activities', subtitle: 'Drawing, movement, music and guided exploration', href: '/learn/grade-1/creative-activities' },
] as const

export function readersForSubject(grade: string, subject: string) {
  return EXISTING_LESSON_READERS.filter(reader =>
    reader.grade === grade && subjectKey(reader.subject) === subjectKey(subject))
}

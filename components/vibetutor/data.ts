// Front-end only. These are SAMPLE listings for layout and review.
// They are not real tutors or students. Replace with live data in the backend phase.

export type Mode = 'online' | 'physical' | 'either'

export type TutorListing = {
  id: string
  name: string
  subjects: string[]
  levels: string[]
  mode: Mode
  area: string
  rateKes: number
  holidayAvailable: boolean
}

export type StudentRequest = {
  id: string
  learnerLabel: string
  subject: string
  level: string
  mode: Mode
  area: string
  budgetKes: number
  schedule: string
}

export const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Sciences', 'Chemistry', 'Physics', 'Biology', 'Computer Studies']
export const LEVELS = ['Grade 4-6', 'Grade 7-9', 'Grade 10-12', 'Form 1-4', 'University / college']
export const AREAS = ['Nairobi', 'Nakuru', 'Kisumu', 'Mombasa', 'Eldoret', 'Online (anywhere)']

export const SAMPLE_TUTORS: TutorListing[] = [
  { id: 't1', name: 'Sample Tutor A', subjects: ['Mathematics', 'Physics'], levels: ['Form 1-4'], mode: 'either', area: 'Nairobi', rateKes: 800, holidayAvailable: true },
  { id: 't2', name: 'Sample Tutor B', subjects: ['English', 'Kiswahili'], levels: ['Grade 4-6', 'Grade 7-9'], mode: 'online', area: 'Online (anywhere)', rateKes: 500, holidayAvailable: true },
  { id: 't3', name: 'Sample Tutor C', subjects: ['Chemistry', 'Biology'], levels: ['Form 1-4'], mode: 'physical', area: 'Nakuru', rateKes: 1000, holidayAvailable: false },
]

export const SAMPLE_REQUESTS: StudentRequest[] = [
  { id: 'r1', learnerLabel: 'Sample Form 2 learner', subject: 'Mathematics', level: 'Form 1-4', mode: 'online', area: 'Online (anywhere)', budgetKes: 600, schedule: 'Weekday evenings' },
  { id: 'r2', learnerLabel: 'Sample Grade 6 learner', subject: 'English', level: 'Grade 4-6', mode: 'physical', area: 'Kisumu', budgetKes: 400, schedule: 'Weekends, holiday mornings' },
]

export function modeLabel(m: Mode) {
  return m === 'online' ? 'Online' : m === 'physical' ? 'In person' : 'Online or in person'
}

// DEMO DATA ONLY. Every listing is fictional and labelled "Demo" in the UI.
// Replace with live data in the backend phase.

export type Mode = 'online' | 'physical' | 'either'

export type DemoTutor = {
  id: string
  name: string
  initials: string
  subjects: string[]
  levels: string[]
  mode: Mode
  area: string
  rateKes: number
  rating: number
  reviews: number
  holidayAvailable: boolean
}

export type DemoRequest = {
  id: string
  learnerLabel: string
  subject: string
  level: string
  mode: Mode
  area: string
  budgetKes: number
  schedule: string
  postedDaysAgo: number
}

export const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Chemistry', 'Physics', 'Biology', 'Computer Studies']
export const LEVELS = ['Grade 4–6', 'Grade 7–9', 'Grade 10–12', 'Form 1–4', 'University']
export const AREAS = ['Nairobi', 'Nakuru', 'Kisumu', 'Mombasa', 'Eldoret', 'Online (anywhere)']
export const HOLIDAY_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DEMO_TUTORS: DemoTutor[] = [
  { id: 't1', name: 'Demo Tutor Achieng', initials: 'AA', subjects: ['Mathematics', 'Physics'], levels: ['Form 1–4'], mode: 'either', area: 'Nairobi', rateKes: 800, rating: 4.9, reviews: 46, holidayAvailable: true },
  { id: 't2', name: 'Demo Tutor Brian', initials: 'BM', subjects: ['English', 'Kiswahili'], levels: ['Grade 4–6', 'Grade 7–9'], mode: 'online', area: 'Online (anywhere)', rateKes: 500, rating: 4.7, reviews: 28, holidayAvailable: true },
  { id: 't3', name: 'Demo Tutor Chebet', initials: 'CC', subjects: ['Chemistry', 'Biology'], levels: ['Form 1–4', 'Grade 10–12'], mode: 'physical', area: 'Nakuru', rateKes: 1000, rating: 4.8, reviews: 31, holidayAvailable: false },
  { id: 't4', name: 'Demo Tutor Dennis', initials: 'DO', subjects: ['Computer Studies', 'Mathematics'], levels: ['Grade 10–12', 'University'], mode: 'either', area: 'Kisumu', rateKes: 700, rating: 4.6, reviews: 12, holidayAvailable: true },
]

export const DEMO_REQUESTS: DemoRequest[] = [
  { id: 'r1', learnerLabel: 'Demo learner · Form 2', subject: 'Mathematics', level: 'Form 1–4', mode: 'online', area: 'Online (anywhere)', budgetKes: 600, schedule: 'Weekday evenings', postedDaysAgo: 1 },
  { id: 'r2', learnerLabel: 'Demo learner · Grade 6', subject: 'English', level: 'Grade 4–6', mode: 'physical', area: 'Kisumu', budgetKes: 400, schedule: 'Weekend mornings, holiday weekdays', postedDaysAgo: 2 },
  { id: 'r3', learnerLabel: 'Demo learner · Grade 11', subject: 'Chemistry', level: 'Grade 10–12', mode: 'either', area: 'Nakuru', budgetKes: 900, schedule: 'Two sessions a week', postedDaysAgo: 3 },
]

export function modeLabel(m: Mode) {
  return m === 'online' ? 'Online' : m === 'physical' ? 'In person' : 'Online or in person'
}

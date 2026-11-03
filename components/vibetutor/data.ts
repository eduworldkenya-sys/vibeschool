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
  subjects: string[]
  level: string
  mode: Mode
  area: string
  budgetKes: number
  days: string[]
  dayparts: DayPart[]
  postedDaysAgo: number
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Chemistry', 'Physics', 'Biology', 'Computer Studies']
export const LEVELS = ['Grade 4–6', 'Grade 7–9', 'Grade 10–12', 'Form 1–4', 'University']
export const AREAS = ['Nairobi', 'Nakuru', 'Kisumu', 'Mombasa', 'Eldoret', 'Online (anywhere)']

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const DAYPARTS: { id: DayPart; label: string; hours: string; icon: 'sunrise' | 'sun' | 'sunset' | 'moon' }[] = [
  { id: 'morning', label: 'Morning', hours: '6am – 12pm', icon: 'sunrise' },
  { id: 'afternoon', label: 'Afternoon', hours: '12pm – 5pm', icon: 'sun' },
  { id: 'evening', label: 'Evening', hours: '5pm – 9pm', icon: 'sunset' },
  { id: 'night', label: 'Night', hours: '9pm – 11pm', icon: 'moon' },
]

export const DEMO_TUTORS: DemoTutor[] = [
  { id: 't1', name: 'Tutor A', initials: 'A', subjects: ['Mathematics', 'Physics'], levels: ['Form 1–4'], mode: 'either', area: 'Nairobi', rateKes: 800, rating: 4.9, reviews: 46, holidayAvailable: true },
  { id: 't2', name: 'Tutor B', initials: 'B', subjects: ['English', 'Kiswahili'], levels: ['Grade 4–6', 'Grade 7–9'], mode: 'online', area: 'Online (anywhere)', rateKes: 500, rating: 4.7, reviews: 28, holidayAvailable: true },
  { id: 't3', name: 'Tutor C', initials: 'C', subjects: ['Chemistry', 'Biology'], levels: ['Form 1–4', 'Grade 10–12'], mode: 'physical', area: 'Nakuru', rateKes: 1000, rating: 4.8, reviews: 31, holidayAvailable: false },
  { id: 't4', name: 'Tutor D', initials: 'D', subjects: ['Computer Studies', 'Mathematics'], levels: ['Grade 10–12', 'University'], mode: 'either', area: 'Kisumu', rateKes: 700, rating: 4.6, reviews: 12, holidayAvailable: true },
]

export const DEMO_REQUESTS: DemoRequest[] = [
  { id: 'r1', learnerLabel: 'Learner · Form 2', subjects: ['Mathematics', 'Physics'], level: 'Form 1–4', mode: 'online', area: 'Online (anywhere)', budgetKes: 600, days: ['Mon', 'Wed', 'Thu'], dayparts: ['evening'], postedDaysAgo: 1 },
  { id: 'r2', learnerLabel: 'Learner · Grade 6', subjects: ['English', 'Kiswahili'], level: 'Grade 4–6', mode: 'physical', area: 'Kisumu', budgetKes: 400, days: ['Sat', 'Sun'], dayparts: ['morning', 'afternoon'], postedDaysAgo: 2 },
  { id: 'r3', learnerLabel: 'Learner · Grade 11', subjects: ['Chemistry', 'Biology', 'Mathematics'], level: 'Grade 10–12', mode: 'either', area: 'Nakuru', budgetKes: 900, days: ['Tue', 'Fri'], dayparts: ['afternoon'], postedDaysAgo: 3 },
]

export function modeLabel(m: Mode) {
  return m === 'online' ? 'Online' : m === 'physical' ? 'In person' : 'Online or in person'
}

const DAY_ORDER = DAYS as readonly string[]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const WEEKEND = ['Sat', 'Sun']

// Short, plain summary such as "Weekdays · Evening, Night".
export function summarizeDays(days: string[]) {
  if (days.length === 0) return 'Any day'
  if (days.length === 7) return 'Every day'
  const sorted = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  if (sorted.length === 5 && WEEKDAYS.every(d => sorted.includes(d))) return 'Weekdays'
  if (sorted.length === 2 && WEEKEND.every(d => sorted.includes(d))) return 'Weekends'
  return sorted.join(', ')
}

export function summarizeParts(parts: DayPart[]) {
  if (parts.length === 0) return 'Any time'
  return DAYPARTS.filter(d => parts.includes(d.id)).map(d => d.label).join(', ')
}

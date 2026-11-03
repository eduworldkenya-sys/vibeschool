// DEMO DATA ONLY. Every listing is fictional and labelled "Example" in the UI.
export type Mode = 'online' | 'physical' | 'either'
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export type DemoTutor = {
  id: string; name: string; initials: string; subjects: string[]; levels: string[]
  mode: Mode; area: string; rateKes: number; holidayAvailable: boolean; days: string[]; bio: string; experience: string; formatNote: string
}
export type DemoRequest = {
  id: string; learnerLabel: string; subjects: string[]; level: string; mode: Mode; area: string
  budgetKes: number; days: string[]; dayparts: DayPart[]; postedDaysAgo: number; note: string
}

export const LEVELS = ['Grade 4–6', 'Grade 7–9', 'Grade 10–12', 'Form 1–4', 'University']
export const SUBJECTS_BY_LEVEL: Record<string, string[]> = {
  'Grade 4–6': ['Mathematics', 'English', 'Kiswahili', 'Science & Technology', 'Social Studies', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'Grade 7–9': ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies', 'Pre-Technical Studies', 'Agriculture', 'Creative Arts', 'Religious Education'],
  'Grade 10–12': ['Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'Business Studies', 'Computer Studies', 'Agriculture'],
  'Form 1–4': ['Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'Business Studies', 'Computer Studies', 'Agriculture'],
  University: ['Mathematics', 'Statistics', 'Computer Science', 'Economics', 'Accounting', 'Engineering', 'Biology', 'Chemistry', 'Physics', 'English']
}
export const SUBJECTS = [...new Set(Object.values(SUBJECTS_BY_LEVEL).flat())]
export const AREAS = ['Nairobi', 'Nakuru', 'Kisumu', 'Mombasa', 'Eldoret', 'Online (anywhere)']
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const DAYPARTS: { id: DayPart; label: string; hours: string; icon: 'sunrise' | 'sun' | 'sunset' | 'moon' }[] = [
  { id: 'morning', label: 'Morning', hours: '6am – 12pm', icon: 'sunrise' },
  { id: 'afternoon', label: 'Afternoon', hours: '12pm – 5pm', icon: 'sun' },
  { id: 'evening', label: 'Evening', hours: '5pm – 9pm', icon: 'sunset' },
  { id: 'night', label: 'Night', hours: '9pm – 11pm', icon: 'moon' },
]
export const DEMO_TUTORS: DemoTutor[] = [
  { id:'t1',name:'Tutor A',initials:'A',subjects:['Mathematics','Physics'],levels:['Form 1–4','Grade 10–12'],mode:'either',area:'Nairobi',rateKes:800,holidayAvailable:true,days:['Mon','Wed','Fri','Sat'],bio:'Supports learners with worked examples, revision plans and step-by-step problem solving.',experience:'Sample profile · 4 years teaching',formatNote:'Online or in-person lessons' },
  { id:'t2',name:'Tutor B',initials:'B',subjects:['English','Kiswahili'],levels:['Grade 4–6','Grade 7–9'],mode:'online',area:'Online (anywhere)',rateKes:500,holidayAvailable:true,days:['Tue','Thu','Sat'],bio:'Builds confidence in reading, writing, grammar and language practice.',experience:'Sample profile · 3 years tutoring',formatNote:'Online lessons' },
  { id:'t3',name:'Tutor C',initials:'C',subjects:['Chemistry','Biology'],levels:['Form 1–4','Grade 10–12'],mode:'physical',area:'Nakuru',rateKes:1000,holidayAvailable:false,days:['Mon','Tue','Thu'],bio:'Uses topic summaries, diagrams and exam-style questions to reinforce science concepts.',experience:'Sample profile · 6 years teaching',formatNote:'In-person lessons' },
  { id:'t4',name:'Tutor D',initials:'D',subjects:['Computer Studies','Mathematics'],levels:['Grade 10–12','University'],mode:'either',area:'Kisumu',rateKes:700,holidayAvailable:true,days:['Wed','Fri','Sun'],bio:'Introduces programming and strengthens mathematical reasoning through practical tasks.',experience:'Sample profile · 2 years tutoring',formatNote:'Online or in-person lessons' },
  {id:'t5',name:'Tutor E',initials:'E',subjects:['Science & Technology','Mathematics'],levels:['Grade 4–6'],mode:'physical',area:'Nairobi',rateKes:600,holidayAvailable:true,days:['Mon','Tue','Wed','Thu','Fri'],bio:'Patient primary-level support with homework routines and foundational numeracy.',experience:'Sample profile · 5 years teaching',formatNote:'In-person lessons'},
  {id:'t6',name:'Tutor F',initials:'F',subjects:['Integrated Science','Mathematics'],levels:['Grade 7–9'],mode:'online',area:'Online (anywhere)',rateKes:650,holidayAvailable:true,days:['Tue','Thu','Sat','Sun'],bio:'Helps learners connect science ideas to practical examples and practice questions.',experience:'Sample profile · 3 years tutoring',formatNote:'Online lessons'},
  {id:'t7',name:'Tutor G',initials:'G',subjects:['History','Geography','English'],levels:['Grade 10–12','Form 1–4'],mode:'either',area:'Mombasa',rateKes:750,holidayAvailable:true,days:['Mon','Wed','Sat'],bio:'Focuses on structured notes, essay writing and map-work practice.',experience:'Sample profile · 4 years teaching',formatNote:'Online or in-person lessons'},
  {id:'t8',name:'Tutor H',initials:'H',subjects:['Statistics','Economics','Accounting'],levels:['University'],mode:'online',area:'Online (anywhere)',rateKes:1200,holidayAvailable:false,days:['Fri','Sat','Sun'],bio:'Offers guided practice for quantitative units and introductory business subjects.',experience:'Sample profile · 3 years tutoring',formatNote:'Online lessons'},
  {id:'t9',name:'Tutor I',initials:'I',subjects:['Biology','Chemistry','Mathematics'],levels:['Grade 10–12'],mode:'physical',area:'Eldoret',rateKes:900,holidayAvailable:true,days:['Tue','Wed','Thu','Sat'],bio:'Exam preparation with topic-by-topic revision and short progress checks.',experience:'Sample profile · 5 years teaching',formatNote:'In-person lessons'},
]
export const DEMO_REQUESTS: DemoRequest[] = [
  { id: 'r1', learnerLabel: 'Learner · Form 2', subjects: ['Mathematics', 'Physics'], level: 'Form 1–4', mode: 'online', area: 'Online (anywhere)', budgetKes: 600, days: ['Mon', 'Wed', 'Thu'], dayparts: ['evening'], postedDaysAgo: 1, note: 'Looking for regular support with algebra, equations and introductory physics.' },
  { id: 'r2', learnerLabel: 'Learner · Grade 6', subjects: ['English', 'Kiswahili'], level: 'Grade 4–6', mode: 'physical', area: 'Kisumu', budgetKes: 400, days: ['Sat', 'Sun'], dayparts: ['morning', 'afternoon'], postedDaysAgo: 2, note: 'Would like help with comprehension, composition and language practice.' },
  { id: 'r3', learnerLabel: 'Learner · Grade 11', subjects: ['Chemistry', 'Biology', 'Mathematics'], level: 'Grade 10–12', mode: 'either', area: 'Nakuru', budgetKes: 900, days: ['Tue', 'Fri'], dayparts: ['afternoon'], postedDaysAgo: 3, note: 'Preparing for end-of-term exams and needs a consistent revision routine.' },
  {id:'r4',learnerLabel:'Parent request · Grade 8',subjects:['Integrated Science','Mathematics'],level:'Grade 7–9',mode:'online',area:'Online (anywhere)',budgetKes:550,days:['Mon','Thu','Sat'],dayparts:['evening'],postedDaysAgo:1,note:'Needs help understanding science concepts and improving confidence in maths.'},
  {id:'r5',learnerLabel:'Parent request · Grade 5',subjects:['Science & Technology','Social Studies'],level:'Grade 4–6',mode:'physical',area:'Nairobi',budgetKes:500,days:['Tue','Wed','Fri'],dayparts:['afternoon'],postedDaysAgo:4,note:'Seeking patient support twice a week during the school holiday.'},
  {id:'r6',learnerLabel:'Parent request · Form 3',subjects:['Biology','Chemistry'],level:'Form 1–4',mode:'either',area:'Eldoret',budgetKes:800,days:['Wed','Sat','Sun'],dayparts:['morning'],postedDaysAgo:2,note:'Would like topic revision, practical explanations and exam questions.'},
  {id:'r7',learnerLabel:'Parent request · University',subjects:['Statistics','Economics'],level:'University',mode:'online',area:'Online (anywhere)',budgetKes:1000,days:['Fri','Sat'],dayparts:['evening'],postedDaysAgo:5,note:'Looking for help with introductory statistics and economics assignments.'},
]
export function modeLabel(m: Mode) { return m === 'online' ? 'Online' : m === 'physical' ? 'In person' : 'Online or in person' }
const DAY_ORDER = DAYS as readonly string[]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const WEEKEND = ['Sat', 'Sun']
export function summarizeDays(days: string[]) {
  if (!days.length) return 'Any day'
  if (days.length === 7) return 'Every day'
  const sorted = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  if (sorted.length === 5 && WEEKDAYS.every(d => sorted.includes(d))) return 'Weekdays'
  if (sorted.length === 2 && WEEKEND.every(d => sorted.includes(d))) return 'Weekends'
  return sorted.join(', ')
}
export function summarizeParts(parts: DayPart[]) {
  if (!parts.length) return 'Any time'
  return DAYPARTS.filter(d => parts.includes(d.id)).map(d => d.label).join(', ')
}

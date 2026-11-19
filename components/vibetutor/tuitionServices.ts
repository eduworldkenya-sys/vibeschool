import { SUBJECTS_BY_LEVEL } from './data'

// Request categories, not staffed tutors, physical offices, rates or guaranteed availability.
export const TUITION_AREA_ALLOCATIONS = [
  ['Nairobi', 40], ['Mombasa', 15], ['Nakuru', 15], ['Eldoret', 12], ['Kisumu', 12],
  ['Thika', 6], ['Ruiru', 5], ['Kitengela', 5], ['Ongata Rongai', 5],
  ['Kiambu', 4], ['Machakos', 4], ['Meru', 4], ['Nyeri', 4], ['Kakamega', 4],
  ['Kisii', 4], ['Naivasha', 3], ['Bungoma', 3], ['Kericho', 3], ['Embu', 2],
] as const

const schoolLevels = ['Grade 4–6', 'Grade 7–9', 'Grade 10–12', 'Form 1–4']
const subjectOptions = schoolLevels.flatMap(level =>
  SUBJECTS_BY_LEVEL[level].map(subject => ({ level, subjects: [subject] }))
)
const categories = [...subjectOptions, { level: 'Grade 4–6', subjects: ['Mathematics', 'English'] }]
export type TuitionService = { id: string; area: string; level: string; subjects: string[] }
export const TUITION_SERVICES: TuitionService[] = TUITION_AREA_ALLOCATIONS.flatMap(([area, count], areaIndex) =>
  Array.from({ length: count }, (_, index) => {
    const category = categories[(index + areaIndex * 3) % categories.length]
    return { id: 'tuition-' + area.toLowerCase().replace(/ /g, '-') + '-' + (index + 1), area, ...category }
  })
)
// Add lower-primary options without changing existing request links or area quotas.
export const LOWER_PRIMARY_SERVICES: TuitionService[] = TUITION_AREA_ALLOCATIONS.flatMap(([area], areaIndex) =>
  SUBJECTS_BY_LEVEL['Grade 1–3'].map((subject, subjectIndex) => ({
    id: 'tuition-lower-' + areaIndex + '-' + subjectIndex, area, level: 'Grade 1–3', subjects: [subject],
  }))
)
export const PUBLIC_TUITION_SERVICES = [...TUITION_SERVICES, ...LOWER_PRIMARY_SERVICES]
export function findTuitionService(id: string | null): TuitionService | undefined {
  return PUBLIC_TUITION_SERVICES.find(service => service.id === id)
}

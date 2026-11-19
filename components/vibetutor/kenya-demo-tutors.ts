import type { DemoTutor } from './data'
import { TUITION_AREA_ALLOCATIONS } from './tuitionServices'

// Fictional example profiles only. Never create authentication records,
// bookable tutor identities, contact details or claimed qualifications from these.
export const KENYA_DEMO_COVERAGE = TUITION_AREA_ALLOCATIONS
const GIVEN_NAMES = [
  'Amina', 'Brian', 'Faith', 'David', 'Grace', 'Kevin', 'Mary', 'Peter',
  'Lucy', 'Samuel', 'Mercy', 'Daniel', 'Esther', 'Joseph', 'Jane', 'Martin',
  'Wanjiku', 'Eric', 'Ann', 'Dennis',
] as const
const SURNAMES = ['Mwangi', 'Otieno', 'Kiptoo', 'Wekesa', 'Mutua', 'Ochieng', 'Abdullahi', 'Maina'] as const

const FOCUSES = [
  { levels: ['Grade 4–6'], subjects: ['Mathematics', 'Science & Technology'], rate: 500 },
  { levels: ['Grade 7–9'], subjects: ['Mathematics', 'Integrated Science'], rate: 650 },
  { levels: ['Grade 4–6'], subjects: ['English', 'Kiswahili'], rate: 500 },
  { levels: ['Grade 7–9'], subjects: ['English', 'Kiswahili'], rate: 600 },
  { levels: ['Grade 4–6'], subjects: ['Social Studies', 'Religious Education'], rate: 550 },
  { levels: ['Grade 7–9'], subjects: ['Agriculture', 'Creative Arts'], rate: 600 },
] as const

export const KENYA_DEMO_TUTORS: DemoTutor[] = (() => {
  const examples: DemoTutor[] = []
  for (const [area, count] of KENYA_DEMO_COVERAGE) {
    for (let slot = 0; slot < count; slot++) {
      const i = examples.length
      const given = GIVEN_NAMES[i % GIVEN_NAMES.length]
      const surname = SURNAMES[Math.floor(i / GIVEN_NAMES.length)]
      const focus = FOCUSES[i % FOCUSES.length]
      examples.push({
        id: 'ke-example-' + String(i + 1).padStart(3, '0'),
        name: given + ' ' + surname,
        initials: given[0] + surname[0],
        subjects: [...focus.subjects],
        levels: [...focus.levels],
        mode: 'online', area, rateKes: focus.rate,
        holidayAvailable: false, days: [],
        bio: 'Fictional example of an online tuition profile. No instructor is attached to this listing.',
        experience: 'Fictional example; no teaching history claimed',
        formatNote: 'Online example — not available for booking',
        real: false,
      })
    }
  }
  return examples
})()

import type { DemoTutor } from '@/components/vibetutor/data'
import { SUBJECTS_BY_LEVEL } from '@/components/vibetutor/data'
import { TutorCard } from '@/components/vibetutor/Cards'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fictional tutor examples | VibeTutor',
  robots: { index: false, follow: true },
}

const entries = [
  {
    "id": "example-kenya-001",
    "name": "Amina Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-002",
    "name": "Kamau Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-003",
    "name": "Wanjiku Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-004",
    "name": "Brian Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-005",
    "name": "Atieno Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-006",
    "name": "Otieno Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-007",
    "name": "Njeri Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-008",
    "name": "Musa Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-009",
    "name": "Mwende Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-010",
    "name": "Mutua Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-011",
    "name": "Chebet Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-012",
    "name": "Kiptoo Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-013",
    "name": "Nasimiyu Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-014",
    "name": "Wekesa Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-015",
    "name": "Nyaboke Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-016",
    "name": "Mogaka Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-017",
    "name": "Wambui Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-018",
    "name": "Kariuki Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-019",
    "name": "Akinyi Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-020",
    "name": "Ochieng Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-021",
    "name": "Muthoni Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-022",
    "name": "Mwangi Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-023",
    "name": "Naliaka Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-024",
    "name": "Barasa Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-025",
    "name": "Jemutai Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-026",
    "name": "Kiprotich Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-027",
    "name": "Kanana Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-028",
    "name": "Muriithi Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-029",
    "name": "Zawadi Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-030",
    "name": "Juma Kilonzo",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-031",
    "name": "Amina Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-032",
    "name": "Kamau Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-033",
    "name": "Wanjiku Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-034",
    "name": "Brian Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-035",
    "name": "Atieno Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-036",
    "name": "Otieno Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-037",
    "name": "Njeri Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-038",
    "name": "Musa Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-039",
    "name": "Mwende Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-040",
    "name": "Mutua Maina",
    "area": "Nairobi"
  },
  {
    "id": "example-kenya-041",
    "name": "Chebet Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-042",
    "name": "Kiptoo Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-043",
    "name": "Nasimiyu Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-044",
    "name": "Wekesa Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-045",
    "name": "Nyaboke Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-046",
    "name": "Mogaka Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-047",
    "name": "Wambui Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-048",
    "name": "Kariuki Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-049",
    "name": "Akinyi Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-050",
    "name": "Ochieng Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-051",
    "name": "Muthoni Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-052",
    "name": "Mwangi Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-053",
    "name": "Naliaka Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-054",
    "name": "Barasa Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-055",
    "name": "Jemutai Maina",
    "area": "Mombasa"
  },
  {
    "id": "example-kenya-056",
    "name": "Kiprotich Maina",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-057",
    "name": "Kanana Maina",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-058",
    "name": "Muriithi Maina",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-059",
    "name": "Zawadi Maina",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-060",
    "name": "Juma Maina",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-061",
    "name": "Amina Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-062",
    "name": "Kamau Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-063",
    "name": "Wanjiku Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-064",
    "name": "Brian Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-065",
    "name": "Atieno Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-066",
    "name": "Otieno Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-067",
    "name": "Njeri Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-068",
    "name": "Musa Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-069",
    "name": "Mwende Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-070",
    "name": "Mutua Ouma",
    "area": "Nakuru"
  },
  {
    "id": "example-kenya-071",
    "name": "Chebet Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-072",
    "name": "Kiptoo Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-073",
    "name": "Nasimiyu Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-074",
    "name": "Wekesa Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-075",
    "name": "Nyaboke Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-076",
    "name": "Mogaka Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-077",
    "name": "Wambui Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-078",
    "name": "Kariuki Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-079",
    "name": "Akinyi Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-080",
    "name": "Ochieng Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-081",
    "name": "Muthoni Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-082",
    "name": "Mwangi Ouma",
    "area": "Eldoret"
  },
  {
    "id": "example-kenya-083",
    "name": "Naliaka Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-084",
    "name": "Barasa Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-085",
    "name": "Jemutai Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-086",
    "name": "Kiprotich Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-087",
    "name": "Kanana Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-088",
    "name": "Muriithi Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-089",
    "name": "Zawadi Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-090",
    "name": "Juma Ouma",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-091",
    "name": "Amina Koech",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-092",
    "name": "Kamau Koech",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-093",
    "name": "Wanjiku Koech",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-094",
    "name": "Brian Koech",
    "area": "Kisumu"
  },
  {
    "id": "example-kenya-095",
    "name": "Atieno Koech",
    "area": "Thika"
  },
  {
    "id": "example-kenya-096",
    "name": "Otieno Koech",
    "area": "Thika"
  },
  {
    "id": "example-kenya-097",
    "name": "Njeri Koech",
    "area": "Thika"
  },
  {
    "id": "example-kenya-098",
    "name": "Musa Koech",
    "area": "Thika"
  },
  {
    "id": "example-kenya-099",
    "name": "Mwende Koech",
    "area": "Thika"
  },
  {
    "id": "example-kenya-100",
    "name": "Mutua Koech",
    "area": "Thika"
  },
  {
    "id": "example-kenya-101",
    "name": "Chebet Koech",
    "area": "Ruiru"
  },
  {
    "id": "example-kenya-102",
    "name": "Kiptoo Koech",
    "area": "Ruiru"
  },
  {
    "id": "example-kenya-103",
    "name": "Nasimiyu Koech",
    "area": "Ruiru"
  },
  {
    "id": "example-kenya-104",
    "name": "Wekesa Koech",
    "area": "Ruiru"
  },
  {
    "id": "example-kenya-105",
    "name": "Nyaboke Koech",
    "area": "Ruiru"
  },
  {
    "id": "example-kenya-106",
    "name": "Mogaka Koech",
    "area": "Kitengela"
  },
  {
    "id": "example-kenya-107",
    "name": "Wambui Koech",
    "area": "Kitengela"
  },
  {
    "id": "example-kenya-108",
    "name": "Kariuki Koech",
    "area": "Kitengela"
  },
  {
    "id": "example-kenya-109",
    "name": "Akinyi Koech",
    "area": "Kitengela"
  },
  {
    "id": "example-kenya-110",
    "name": "Ochieng Koech",
    "area": "Kitengela"
  },
  {
    "id": "example-kenya-111",
    "name": "Muthoni Koech",
    "area": "Ongata Rongai"
  },
  {
    "id": "example-kenya-112",
    "name": "Mwangi Koech",
    "area": "Ongata Rongai"
  },
  {
    "id": "example-kenya-113",
    "name": "Naliaka Koech",
    "area": "Ongata Rongai"
  },
  {
    "id": "example-kenya-114",
    "name": "Barasa Koech",
    "area": "Ongata Rongai"
  },
  {
    "id": "example-kenya-115",
    "name": "Jemutai Koech",
    "area": "Ongata Rongai"
  },
  {
    "id": "example-kenya-116",
    "name": "Kiprotich Koech",
    "area": "Kiambu"
  },
  {
    "id": "example-kenya-117",
    "name": "Kanana Koech",
    "area": "Kiambu"
  },
  {
    "id": "example-kenya-118",
    "name": "Muriithi Koech",
    "area": "Kiambu"
  },
  {
    "id": "example-kenya-119",
    "name": "Zawadi Koech",
    "area": "Kiambu"
  },
  {
    "id": "example-kenya-120",
    "name": "Juma Koech",
    "area": "Machakos"
  },
  {
    "id": "example-kenya-121",
    "name": "Amina Wanyonyi",
    "area": "Machakos"
  },
  {
    "id": "example-kenya-122",
    "name": "Kamau Wanyonyi",
    "area": "Machakos"
  },
  {
    "id": "example-kenya-123",
    "name": "Wanjiku Wanyonyi",
    "area": "Machakos"
  },
  {
    "id": "example-kenya-124",
    "name": "Brian Wanyonyi",
    "area": "Meru"
  },
  {
    "id": "example-kenya-125",
    "name": "Atieno Wanyonyi",
    "area": "Meru"
  },
  {
    "id": "example-kenya-126",
    "name": "Otieno Wanyonyi",
    "area": "Meru"
  },
  {
    "id": "example-kenya-127",
    "name": "Njeri Wanyonyi",
    "area": "Meru"
  },
  {
    "id": "example-kenya-128",
    "name": "Musa Wanyonyi",
    "area": "Nyeri"
  },
  {
    "id": "example-kenya-129",
    "name": "Mwende Wanyonyi",
    "area": "Nyeri"
  },
  {
    "id": "example-kenya-130",
    "name": "Mutua Wanyonyi",
    "area": "Nyeri"
  },
  {
    "id": "example-kenya-131",
    "name": "Chebet Wanyonyi",
    "area": "Nyeri"
  },
  {
    "id": "example-kenya-132",
    "name": "Kiptoo Wanyonyi",
    "area": "Kakamega"
  },
  {
    "id": "example-kenya-133",
    "name": "Nasimiyu Wanyonyi",
    "area": "Kakamega"
  },
  {
    "id": "example-kenya-134",
    "name": "Wekesa Wanyonyi",
    "area": "Kakamega"
  },
  {
    "id": "example-kenya-135",
    "name": "Nyaboke Wanyonyi",
    "area": "Kakamega"
  },
  {
    "id": "example-kenya-136",
    "name": "Mogaka Wanyonyi",
    "area": "Kisii"
  },
  {
    "id": "example-kenya-137",
    "name": "Wambui Wanyonyi",
    "area": "Kisii"
  },
  {
    "id": "example-kenya-138",
    "name": "Kariuki Wanyonyi",
    "area": "Kisii"
  },
  {
    "id": "example-kenya-139",
    "name": "Akinyi Wanyonyi",
    "area": "Kisii"
  },
  {
    "id": "example-kenya-140",
    "name": "Ochieng Wanyonyi",
    "area": "Naivasha"
  },
  {
    "id": "example-kenya-141",
    "name": "Muthoni Wanyonyi",
    "area": "Naivasha"
  },
  {
    "id": "example-kenya-142",
    "name": "Mwangi Wanyonyi",
    "area": "Naivasha"
  },
  {
    "id": "example-kenya-143",
    "name": "Naliaka Wanyonyi",
    "area": "Bungoma"
  },
  {
    "id": "example-kenya-144",
    "name": "Barasa Wanyonyi",
    "area": "Bungoma"
  },
  {
    "id": "example-kenya-145",
    "name": "Jemutai Wanyonyi",
    "area": "Bungoma"
  },
  {
    "id": "example-kenya-146",
    "name": "Kiprotich Wanyonyi",
    "area": "Kericho"
  },
  {
    "id": "example-kenya-147",
    "name": "Kanana Wanyonyi",
    "area": "Kericho"
  },
  {
    "id": "example-kenya-148",
    "name": "Muriithi Wanyonyi",
    "area": "Kericho"
  },
  {
    "id": "example-kenya-149",
    "name": "Zawadi Wanyonyi",
    "area": "Embu"
  },
  {
    "id": "example-kenya-150",
    "name": "Juma Wanyonyi",
    "area": "Embu"
  }
] as const

const levels = ['Grade 4–6', 'Grade 7–9', 'Grade 10–12', 'Form 1–4']
const tutors: DemoTutor[] = entries.map((entry, index) => {
  const level = levels[index % levels.length]
  const subjects = SUBJECTS_BY_LEVEL[level]
  return {
    ...entry,
    initials: entry.name.split(' ').map(word => word[0]).join(''),
    subjects: [subjects[Math.floor(index / levels.length) % subjects.length]],
    levels: [level],
    mode: 'online',
    rateKes: [300, 500, 700][index % 3],
    holidayAvailable: true,
    days: ['Mon', 'Wed', 'Sat'],
    bio: 'Fictional profile for demonstrating the directory. No teacher has been assigned.',
    experience: 'Not applicable — example',
    formatNote: 'Illustrative online tuition',
    real: false,
  }
})

export default function ExampleTutorsPage({ searchParams }: { searchParams: { area?: string } }) {
  const areas = [...new Set(tutors.map(tutor => tutor.area))]
  const area = areas.find(value => value === searchParams.area)
  const visible = area ? tutors.filter(tutor => tutor.area === area) : tutors
  return (
    <>
      <h1 className={styles.pageTitle}>Example tutor profiles</h1>
      <p className={styles.hint}>150 fictional examples with illustrative prices and availability. These are not real tutors and cannot be contacted or booked.</p>
      <p><Link href="/vibetutor">Browse real tutors</Link></p>
      <nav aria-label="Example locations" className={styles.tags}>
        <Link className={styles.tag} href="/vibetutor/examples" aria-current={!area ? 'page' : undefined}>All (150)</Link>
        {areas.map(value => <Link key={value} className={styles.tag} href={'/vibetutor/examples?area=' + encodeURIComponent(value)} aria-current={area === value ? 'page' : undefined}>{value} ({tutors.filter(tutor => tutor.area === value).length})</Link>)}
      </nav>
      <p className={styles.meta}>{visible.length} example profiles</p>
      <div className={styles.list}>
        {visible.map(tutor => <TutorCard key={tutor.id} t={tutor} />)}
      </div>
    </>
  )
}

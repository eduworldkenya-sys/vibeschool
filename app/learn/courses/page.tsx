import { redirect } from 'next/navigation'

/** Old course discovery homepage retired in favour of the unified Learn shell. */
export default function LearnCoursesLegacyPage() { redirect('/learn?view=courses') }

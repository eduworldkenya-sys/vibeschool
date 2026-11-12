import { redirect } from 'next/navigation'

/** All published reading is discoverable from the same Learn catalogue. */
export default function GlobalReadLegacyPage() { redirect('/learn?view=reading') }

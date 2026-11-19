import { redirect } from 'next/navigation'

// Preserve old links while consolidating all tutor listings in Browse.
export default function TuitionServicesPage() {
  redirect('/vibetutor/browse')
}

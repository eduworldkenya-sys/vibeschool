import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function CreateChildPage() {
  // Create a separately managed, school-optional learner identity first.
  // This does not mint a child auth session, enrollment, or learning access.
  // School-issued claim-code linking remains available at /parent/link-child.
  redirect('/parent/managed-learners')
}

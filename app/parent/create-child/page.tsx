import { redirect } from 'next/navigation'
import { unifiedIdentityEnabled } from '@/lib/identity/features'

export const dynamic = 'force-dynamic'

export default function CreateChildPage() {
  // Create a separately managed, school-optional learner identity first.
  // This does not mint a child auth session, enrollment, or learning access.
  // School-issued claim-code linking remains available at /parent/link-child.
  redirect(unifiedIdentityEnabled ? '/account/children' : '/parent/link-child')
}

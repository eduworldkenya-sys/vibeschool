import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function CreateChildPage() {
  // Canonical learner identities and parent relationships must be established from
  // verified school/claim evidence. Keep the legacy route as a safe compatibility
  // redirect instead of allowing parents to manufacture canonical learner records.
  redirect('/parent/link-child')
}

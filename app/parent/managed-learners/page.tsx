import { notFound } from 'next/navigation'
import ManagedLearners from '@/app/account/setup/ManagedLearners'
import { unifiedIdentityEnabled } from '@/lib/identity/features'

// A parent workspace may only expose managed-learner creation after the
// identity schema and guardian authorization have been commissioned.
// The creation RPC remains the actual ownership/role boundary.
export default function ParentManagedLearnersPage() {
  if (!unifiedIdentityEnabled) notFound()
  return <ManagedLearners />
}

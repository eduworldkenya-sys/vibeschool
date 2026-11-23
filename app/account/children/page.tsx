import ManagedLearners from '@/app/account/setup/ManagedLearners'
import { notFound } from 'next/navigation'
import { unifiedIdentityEnabled } from '@/lib/identity/features'

// Adult Teacher and Parent accounts share this school-optional entry.
// RLS and guardian RPCs enforce ownership; no role is selected in the browser.
export default function AccountManagedLearnersPage() {
  if (!unifiedIdentityEnabled) notFound()
  return <ManagedLearners />
}

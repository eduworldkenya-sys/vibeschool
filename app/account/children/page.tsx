import ManagedLearners from '@/app/account/setup/ManagedLearners'

// Adult Teacher and Parent accounts share this school-optional entry.
// RLS and guardian RPCs enforce ownership; no role is selected in the browser.
export default function AccountManagedLearnersPage() {
  return <ManagedLearners />
}

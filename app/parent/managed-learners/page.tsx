import ManagedLearners from '@/app/account/setup/ManagedLearners'

// Existing /parent middleware controls page access.
// The creation RPC independently checks canonical parent authorization.
export default function ParentManagedLearnersPage() {
  return <ManagedLearners />
}

import UsernameSetupForm from './UsernameSetupForm'
import { safeReturnPath } from '@/lib/identity/username'

export default async function IdentitySetupPage(props: { searchParams: Promise<{ next?: string }> }) {
  const params = await props.searchParams
  return <UsernameSetupForm next={safeReturnPath(params.next)} />
}

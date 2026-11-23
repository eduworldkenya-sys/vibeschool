import UsernameSetupForm from './UsernameSetupForm'
import { notFound } from 'next/navigation'
import { unifiedIdentityEnabled } from '@/lib/identity/features'
import { safeReturnPath } from '@/lib/identity/username'

export default async function IdentitySetupPage(props: { searchParams: Promise<{ next?: string }> }) {
  if (!unifiedIdentityEnabled) notFound()
  const params = await props.searchParams
  return <UsernameSetupForm next={safeReturnPath(params.next)} />
}

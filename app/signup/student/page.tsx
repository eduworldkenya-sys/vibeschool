import SchoolSignupForm from './SchoolSignupForm'
import { safeInternalPath } from '@/lib/auth-routing'
import { emailPilotEnabled } from './email/config'

export const dynamic = 'force-dynamic'

export default async function StudentSignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams
  return <SchoolSignupForm emailPilot={emailPilotEnabled()} initialNext={safeInternalPath(params.next)} />
}

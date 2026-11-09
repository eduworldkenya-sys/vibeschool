import { notFound } from 'next/navigation'
import EmailSignupForm from './EmailSignupForm'
import { emailPilotEnabled } from './config'

export const dynamic = 'force-dynamic'

export default function EmailSignupPage({ searchParams }: { searchParams: { link?: string } }) {
  if (!emailPilotEnabled()) notFound()
  return <EmailSignupForm linkFailed={searchParams.link === "retry"} />
}

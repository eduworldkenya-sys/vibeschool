import { notFound } from 'next/navigation'
import EmailSignupForm from './EmailSignupForm'
import { emailPilotEnabled } from './config'

export const dynamic = 'force-dynamic'

export default async function EmailSignupPage(props: { searchParams: Promise<{ link?: string }> }) {
  const searchParams = await props.searchParams;
  if (!emailPilotEnabled()) notFound()
  return <EmailSignupForm linkFailed={searchParams.link === "retry"} />
}

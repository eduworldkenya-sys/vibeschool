import SchoolSignupForm from './SchoolSignupForm'
import { emailPilotEnabled } from './email/config'

export const dynamic = 'force-dynamic'

export default function StudentSignupPage() {
  return <SchoolSignupForm emailPilot={emailPilotEnabled()} />
}

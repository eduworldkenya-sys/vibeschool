import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import GuardianConsentForm from '@/components/learner/GuardianConsentForm'
import { consentEnabled } from '@/lib/learner/guardian-consent'
import { independentSignupEnabled, verifiedGoogleEmail } from '@/lib/learner/independent-signup'
import GoogleSignupButton from './GoogleSignupButton'

export const dynamic = 'force-dynamic'

export default async function IndependentLearnerSignupPage() {
  if (!independentSignupEnabled() || !consentEnabled()) notFound()
  const cookieStore = cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user }, error } = await client.auth.getUser()
  if (user && !error) {
    const email = verifiedGoogleEmail(user)
    const { data, error: accessError } = await client.rpc('get_my_auth_access_state')
    if (email && !accessError && data?.reason_code === 'ROLE_UNCLAIMED' &&
        data?.account_status === 'active' && data?.is_anonymized === false) {
      return <main><GuardianConsentForm independentEmail={email} /></main>
    }
  }

  return <main style={{ maxWidth: 440, margin: '40px auto', padding: 24 }}>
    <h1>Learn independently</h1>
    <p>Continue with Google to request guardian approval. If your school gave you a learner code, use school signup.</p>
    <GoogleSignupButton />
    <p><a href="/signup/student">Use a school learner code</a></p>
  </main>
}

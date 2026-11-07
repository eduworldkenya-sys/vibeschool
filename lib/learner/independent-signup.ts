import type { User } from '@supabase/supabase-js'

export const INDEPENDENT_SIGNUP_PATH = '/signup/student/independent'

export function independentSignupEnabled() {
  return process.env.LEARNER_INDEPENDENT_GOOGLE_ENABLED === 'true'
}

export function verifiedGoogleEmail(user: User): string | null {
  const email = user.email?.trim().toLowerCase()
  if (!email || !user.email_confirmed_at || email.endsWith('@vs.internal')) return null
  const google = user.identities?.some(identity =>
    identity.provider === 'google' &&
    identity.identity_data?.email_verified === true &&
    typeof identity.identity_data.email === 'string' &&
    identity.identity_data.email.trim().toLowerCase() === email,
  )
  return google ? email : null
}

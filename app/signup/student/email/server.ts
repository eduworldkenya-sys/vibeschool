import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient, type User } from '@supabase/supabase-js'
import { pilotEmail } from './config'

const path = '/signup/student/email'

function pilotAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function pilotClient() {
  const jar = cookies()
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'vs-independent-email-pilot',
        path,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll: () => [...jar.getAll().filter(cookie => !pending.has(cookie.name)), ...pending.values()],
        setAll: values => values.forEach(cookie => pending.set(cookie.name, cookie)),
      },
    },
  )
  return { client, commit: () => pending.forEach(({ name, value, options }) => jar.set(name, value, options)) }
}

export async function canUsePilot(client: ReturnType<typeof pilotClient>['client'], user: User) {
  if (!user.email_confirmed_at || !pilotEmail(user.email)) return false

  const { data, error } = await client.rpc('get_my_auth_access_state')
  if (error || !data || typeof data !== 'object' || Array.isArray(data)
      || data.authenticated !== true || data.account_status !== 'active'
      || data.reason_code !== 'ROLE_UNCLAIMED' || data.is_anonymized !== false) return false

  const { data: schoolLearner, error: schoolError } = await pilotAdminClient()
    .from('students').select('id').eq('profile_id', user.id).limit(1).maybeSingle()
  return !schoolError && !schoolLearner
}

export async function hasRestrictedIdentity(userId: string) {
  const { data, error } = await pilotAdminClient().from('independent_learner_identities')
    .select('account_state, learner_email_verified_at').eq('user_id', userId).maybeSingle()
  return !error && data?.account_state === 'restricted' && !!data.learner_email_verified_at
}

export async function finishPilotSignup(client: ReturnType<typeof pilotClient>['client'], user: User) {
  if (!await canUsePilot(client, user)) return false
  const { error } = await pilotAdminClient().from('independent_learner_identities').upsert({
    user_id: user.id,
    learner_email_verified_at: user.email_confirmed_at,
  }, { onConflict: 'user_id', ignoreDuplicates: true })
  return !error && await hasRestrictedIdentity(user.id)
}

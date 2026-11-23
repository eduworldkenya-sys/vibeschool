import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Canonical Supabase session cookies; never accept user IDs supplied by a browser. */
export async function identityClient() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: values => values.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    },
  )
}

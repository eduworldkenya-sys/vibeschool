import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function HQLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get('x-vibeschool-pathname') ?? ''
  const isLoginPage = pathname === '/hq/login'
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* Server Component layouts cannot persist refreshed cookies. */ },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (isLoginPage) return <>{children}</>
    redirect('/')
  }

  const { data: isOwner, error } = await supabase.rpc('is_platform_owner')
  if (error || !isOwner) {
    if (!error) {
      await supabase.rpc('record_hq_access_attempt', { p_outcome: 'denied_not_owner' })
    }
    redirect('/')
  }

  if (isLoginPage) redirect('/hq')

  return <>{children}</>
}

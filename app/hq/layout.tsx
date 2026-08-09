import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { HQNavigation, HQStyles } from '@/components/hq/HQShell'

const HQ_PATH_HEADER = 'x-vibeschool-hq-path'

function createHQServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
  )
}

export default async function HQLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get(HQ_PATH_HEADER) ?? '/hq'
  if (pathname === '/hq/login') return <>{children}</>

  const supabase = createHQServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect(`/hq/login?redirect=${encodeURIComponent(pathname)}`)

  const { data: access, error: accessError } = await supabase.rpc('hq_check_owner_access', { p_surface: `${pathname}:server-layout` })
  const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
  if (!allowed) redirect('/?hq=denied')

  return <>
    <HQStyles />
    <HQNavigation />
    {children}
  </>
}

import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

const HQ_PATH_HEADER = 'x-vibeschool-hq-path'

function createHQServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {
          // Server Components cannot persist refreshed cookies. Middleware owns refresh.
        },
      },
    }
  )
}

export default async function HQLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get(HQ_PATH_HEADER) ?? '/hq'

  // The login surface must remain reachable so an unauthorized existing session
  // can be replaced with the platform-owner account.
  if (pathname === '/hq/login') return <>{children}</>

  const supabase = createHQServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect(`/hq/login?redirect=${encodeURIComponent(pathname)}`)

  const { data: access, error: accessError } = await supabase.rpc('hq_check_owner_access', {
    p_surface: `${pathname}:server-layout`,
  })
  const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
  if (!allowed) redirect('/?hq=denied')

  return <>
    <nav aria-label="HQ owner navigation" style={{position:'sticky',top:0,zIndex:80,display:'flex',gap:6,overflowX:'auto',padding:'7px 10px',background:'#07111f',borderBottom:'1px solid rgba(255,255,255,.08)',fontFamily:'Inter,system-ui,sans-serif'}}>
      {[['HQ','/hq'],['Departments','/hq/departments'],['Decisions','/hq/decisions'],['Publishing','/hq/content'],['Analytics','/hq/analytics'],['Content Engine','/hq/curriculum-intelligence/engine']].map(([label,href])=><Link key={href} href={href} style={{whiteSpace:'nowrap',padding:'7px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,.08)',color:'#e2e8f0',background:'rgba(255,255,255,.03)',fontSize:11,fontWeight:800,textDecoration:'none'}}>{label}</Link>)}
    </nav>
    {children}
  </>
}

import { createClient, type User } from "@supabase/supabase-js"

export type HQOwnerRequest = {
  user: User
  accessToken: string
}

export async function requireHQOwner(request: Request, surface: string): Promise<HQOwnerRequest | null> {
  const authorization = request.headers.get("authorization") || ""
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  if (!token) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return null

  const { data: access, error: accessError } = await supabase.rpc("hq_check_owner_access", { p_surface: surface })
  const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
  if (!allowed) return null

  return { user, accessToken: token }
}

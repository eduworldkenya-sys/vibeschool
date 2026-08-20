import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vibeschool.co.ke"
const ALLOWED_ORIGINS = new Set([
  SITE_URL,
  "https://vibeschool.co.ke",
  "https://www.vibeschool.co.ke",
  "https://hq.vibeschool.co.ke",
  "http://localhost:3000",
].filter(Boolean))

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}

function publicAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}

async function requireFounder(req: NextRequest) {
  const authorization = req.headers.get("authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!token) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }

  const supabase = adminClient()
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const caller = userData.user
  if (userError || !caller) return { error: NextResponse.json({ error: "Invalid HQ session" }, { status: 401 }) }

  const { data: owner, error: ownerError } = await supabase
    .from("platform_owners")
    .select("profile_id,note")
    .eq("profile_id", caller.id)
    .maybeSingle()

  if (ownerError || !owner || owner.note === "hq_partner_admin") {
    return { error: NextResponse.json({ error: "Founder authority required" }, { status: 403 }) }
  }
  return { caller, supabase }
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin") || ""
  return origin === "" || ALLOWED_ORIGINS.has(origin)
}

async function findUserByEmail(supabase: ReturnType<typeof adminClient>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find(user => user.email?.toLowerCase() === email.toLowerCase()) || null
}

export async function GET(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const auth = await requireFounder(req)
  if ("error" in auth) return auth.error

  const { supabase } = auth
  const { data: owners, error: ownersError } = await supabase
    .from("platform_owners")
    .select("profile_id,added_by,note,created_at")
    .order("created_at", { ascending: true })

  if (ownersError) return NextResponse.json({ error: ownersError.message }, { status: 500 })

  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })
  const byId = new Map(usersPage.users.map(user => [user.id, user]))

  const members = (owners || []).map(owner => {
    const user = byId.get(owner.profile_id)
    const isPartner = owner.note === "hq_partner_admin"
    const passwordReady = user?.user_metadata?.hq_password_ready === true
    let status = "active"
    if (isPartner) {
      status = passwordReady ? "active" : user?.email_confirmed_at ? "setup_required" : "invited"
    }
    return {
      id: owner.profile_id,
      email: user?.email || null,
      role: isPartner ? "Partner/Admin" : "Founder/Owner",
      status,
      createdAt: owner.created_at,
      lastSignInAt: user?.last_sign_in_at || null,
    }
  })

  return NextResponse.json({ members })
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const auth = await requireFounder(req)
  if ("error" in auth) return auth.error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const email = String((body as Record<string, unknown>)?.email || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })

  const { caller, supabase } = auth
  let user = await findUserByEmail(supabase, email)
  let invited = false

  if (!user) {
    const redirectTo = new URL("/hq/accept-invite", SITE_URL).toString()
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { hq_role: "partner_admin", hq_password_ready: false },
    })
    if (inviteError || !inviteData.user) return NextResponse.json({ error: inviteError?.message || "HQ invitation could not be created" }, { status: 500 })
    user = inviteData.user
    invited = true
  }

  const { error: grantError } = await supabase.from("platform_owners").upsert({
    profile_id: user.id,
    added_by: `hq:${caller.id}`,
    note: "hq_partner_admin",
  }, { onConflict: "profile_id" })
  if (grantError) return NextResponse.json({ error: grantError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    email,
    userId: user.id,
    status: invited ? "invited" : "authorized_existing_account",
    message: invited
      ? "Invitation sent. They must open the email and create their own password before HQ shows Active."
      : "HQ access granted. If they do not know their password, use Send password setup/reset email from their HQ Team row.",
  })
}

export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const auth = await requireFounder(req)
  if ("error" in auth) return auth.error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const record = body as Record<string, unknown>
  const email = String(record.email || "").trim().toLowerCase()
  const action = String(record.action || "")
  if (action !== "password_reset") return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })

  const { supabase } = auth
  const user = await findUserByEmail(supabase, email)
  if (!user) return NextResponse.json({ error: "No VibeSchool Auth account exists for this email" }, { status: 404 })

  const { data: membership } = await supabase.from("platform_owners").select("profile_id,note").eq("profile_id", user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: "This account does not have HQ access" }, { status: 403 })

  const currentMeta = (user.user_metadata || {}) as Record<string, unknown>
  const { error: markError } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...currentMeta, hq_password_ready: false },
  })
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 })

  const { error: resetError } = await publicAuthClient().auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/hq/reset-password", SITE_URL).toString(),
  })
  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: `Secure password setup/reset email sent to ${email}. They choose the password themselves.` })
}

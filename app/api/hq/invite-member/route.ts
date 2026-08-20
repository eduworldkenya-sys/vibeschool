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
    .select("profile_id")
    .eq("profile_id", caller.id)
    .maybeSingle()

  if (ownerError || !owner) return { error: NextResponse.json({ error: "Founder authority required" }, { status: 403 }) }
  return { caller, supabase }
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin") || ""
  return origin === "" || ALLOWED_ORIGINS.has(origin)
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
    return {
      id: owner.profile_id,
      email: user?.email || null,
      role: owner.note === "hq_partner_admin" ? "Partner/Admin" : "Founder/Owner",
      status: user?.email_confirmed_at ? "active" : "invited",
      createdAt: owner.created_at,
    }
  })

  return NextResponse.json({ members })
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const auth = await requireFounder(req)
  if ("error" in auth) return auth.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = String((body as Record<string, unknown>)?.email || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })
  }

  const { caller, supabase } = auth
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  let user = usersPage.users.find(candidate => candidate.email?.toLowerCase() === email) || null
  let invited = false

  if (!user) {
    const redirectTo = new URL("/hq/reset-password", SITE_URL).toString()
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { hq_role: "partner_admin" },
    })
    if (inviteError || !inviteData.user) {
      return NextResponse.json({ error: inviteError?.message || "HQ invitation could not be created" }, { status: 500 })
    }
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
      ? "Invitation sent. The Partner/Admin can set a password from the email and then sign in to HQ."
      : "Existing VibeSchool account authorized for HQ. The user can sign in through HQ with their existing password.",
  })
}

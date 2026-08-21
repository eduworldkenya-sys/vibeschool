import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!token) return NextResponse.json({ allowed: false, reason: "authentication_required" }, { status: 401 })

  const supabase = adminClient()
  const { data, error: userError } = await supabase.auth.getUser(token)
  const user = data.user
  if (userError || !user) return NextResponse.json({ allowed: false, reason: "invalid_session" }, { status: 401 })

  const surface = req.nextUrl.searchParams.get("surface") || "/hq"
  const setup = req.nextUrl.searchParams.get("setup") === "1"
  const { data: member, error: memberError } = await supabase
    .from("hq_human_members")
    .select("role,status,permissions,access_expires_at")
    .eq("profile_id", user.id)
    .maybeSingle()

  if (memberError || !member) return NextResponse.json({ allowed: false, reason: "not_hq_member" }, { status: 403 })
  if (member.status === "suspended" || member.status === "revoked") return NextResponse.json({ allowed: false, reason: member.status }, { status: 403 })
  if (member.access_expires_at && new Date(member.access_expires_at).getTime() <= Date.now()) return NextResponse.json({ allowed: false, reason: "access_expired" }, { status: 403 })

  if (setup && (surface === "/hq/accept-invite" || surface === "/hq/reset-password")) {
    return NextResponse.json({ allowed: true, role: member.role, status: member.status })
  }

  if (member.status !== "active") return NextResponse.json({ allowed: false, reason: "setup_required", role: member.role }, { status: 403 })

  const permissions = Array.isArray(member.permissions) ? member.permissions : []
  const isFounder = member.role === "founder"
  const canView = isFounder || member.role === "partner_admin" || member.role === "hq_admin" || permissions.includes("hq.view")
  if (!canView) return NextResponse.json({ allowed: false, role: member.role, reason: "permission_denied" }, { status: 403 })

  return NextResponse.json({
    allowed: true,
    role: member.role,
    visibility: "hq.full",
    authority: isFounder ? "founder" : "bounded",
    permissions,
  })
}

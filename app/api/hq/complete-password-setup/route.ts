import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

  const supabase = adminClient()
  const { data, error: userError } = await supabase.auth.getUser(token)
  const user = data.user
  if (userError || !user) return NextResponse.json({ error: "Invalid HQ session" }, { status: 401 })

  if (user.user_metadata?.hq_password_ready !== true) {
    return NextResponse.json({ error: "Password setup is not complete" }, { status: 409 })
  }

  const { data: member, error: memberError } = await supabase
    .from("hq_human_members")
    .select("profile_id,role,status")
    .eq("profile_id", user.id)
    .maybeSingle()

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
  if (!member || member.status === "revoked" || member.status === "suspended") {
    return NextResponse.json({ error: "This account does not have active HQ authorization" }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from("hq_human_members")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("profile_id", user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from("hq_human_audit_log").insert({
    actor_id: user.id,
    target_id: user.id,
    action: "member.password_setup_completed",
    before_state: { status: member.status },
    after_state: { status: "active" },
    source: "human",
  })

  return NextResponse.json({ ok: true, status: "active" })
}

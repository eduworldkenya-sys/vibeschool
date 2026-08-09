import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireHQOwner } from "@/lib/hq/serverAuth"
import { getSupabaseServerClient } from "@/lib/supabaseServer"

const MAX_RESULTS = 40

type SecurityAction = "send_recovery" | "revoke_sessions" | "lock" | "unlock"
type ProfileRow = { id: string; full_name: string | null; role: string | null }
type OwnerRow = { profile_id: string }

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function ownerIds(server: ReturnType<typeof getSupabaseServerClient>) {
  const db = server as any
  const { data } = await db.from("platform_owners").select("profile_id") as { data: OwnerRow[] | null }
  return new Set((data ?? []).map(row => row.profile_id))
}

async function audit(server: ReturnType<typeof getSupabaseServerClient>, event: Record<string, unknown>) {
  try {
    await (server as any).from("hq_security_events").insert(event)
  } catch (error) {
    console.error("Security audit write failed", error)
  }
}

export async function GET(request: Request) {
  const owner = await requireHQOwner(request, "/api/hq/security/users:read")
  if (!owner) return jsonError("HQ owner authorization required.", 401)

  const server = getSupabaseServerClient()
  const db = server as any
  const url = new URL(request.url)
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase()

  const { data: listed, error: listError } = await server.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) return jsonError("Could not load Auth users.", 500)

  const filtered = listed.users
    .filter(user => {
      if (!q) return true
      const email = user.email?.toLowerCase() ?? ""
      const phone = user.phone?.toLowerCase() ?? ""
      return email.includes(q) || phone.includes(q) || user.id.toLowerCase().includes(q)
    })
    .slice(0, MAX_RESULTS)

  const ids = filtered.map(user => user.id)
  let profiles: ProfileRow[] = []
  if (ids.length) {
    const { data } = await db.from("profiles").select("id,full_name,role").in("id", ids)
    profiles = (data ?? []) as ProfileRow[]
  }
  const byId = new Map(profiles.map(profile => [profile.id, profile]))
  const owners = await ownerIds(server)

  const { data: recentEvents } = await db
    .from("hq_security_events")
    .select("id,event_type,actor_user_id,subject_user_id,subject_email,surface,outcome,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(80)

  return NextResponse.json({
    ok: true,
    users: filtered.map(user => ({
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      full_name: byId.get(user.id)?.full_name ?? null,
      role: byId.get(user.id)?.role ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      banned_until: user.banned_until ?? null,
      is_platform_owner: owners.has(user.id),
    })),
    events: recentEvents ?? [],
  })
}

export async function POST(request: Request) {
  const owner = await requireHQOwner(request, "/api/hq/security/users:write")
  if (!owner) return jsonError("HQ owner authorization required.", 401)

  const body = await request.json().catch(() => ({})) as { action?: SecurityAction; userId?: string }
  const action = body.action
  const userId = String(body.userId ?? "").trim()
  if (!action || !["send_recovery", "revoke_sessions", "lock", "unlock"].includes(action)) return jsonError("Unsupported security action.")
  if (!userId) return jsonError("User id is required.")

  const server = getSupabaseServerClient()
  const db = server as any
  const { data: targetData, error: targetError } = await server.auth.admin.getUserById(userId)
  const target = targetData.user
  if (targetError || !target) return jsonError("User not found.", 404)

  const owners = await ownerIds(server)
  const isPlatformOwner = owners.has(userId)
  const baseEvent = {
    actor_user_id: owner.user.id,
    subject_user_id: userId,
    subject_email: target.email ?? null,
    surface: "/hq/security",
  }

  if (isPlatformOwner && action !== "send_recovery") {
    await audit(server, { ...baseEvent, event_type: action, outcome: "denied", metadata: { reason: "platform_owner_protected" } })
    return jsonError("Platform-owner lock and session-revocation actions are blocked here. Use the dedicated HQ owner recovery process.", 403)
  }

  try {
    if (action === "send_recovery") {
      if (!target.email) return jsonError("This account has no email address.")
      if (isPlatformOwner) {
        await audit(server, { ...baseEvent, event_type: "password_recovery", outcome: "denied", metadata: { reason: "use_owner_recovery" } })
        return jsonError("Use the dedicated HQ owner recovery flow for the platform owner.", 403)
      }

      const appOrigin = new URL(request.url).origin
      const auth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )

      await audit(server, { ...baseEvent, event_type: "password_recovery", outcome: "requested", metadata: { initiated_by: "hq_security_identity" } })
      const { error } = await auth.auth.resetPasswordForEmail(target.email, { redirectTo: `${appOrigin}/account/reset-password` })
      await audit(server, { ...baseEvent, event_type: "password_recovery", outcome: error ? "failed" : "completed", metadata: error ? { provider_error: error.message } : { provider: "supabase_auth" } })
      if (error) return jsonError("Recovery email could not be sent.", 502)
      return NextResponse.json({ ok: true, message: "Recovery email requested successfully." })
    }

    if (action === "revoke_sessions") {
      const { data, error } = await db.rpc("hq_service_revoke_user_sessions", { p_user_id: userId })
      if (error) throw error
      await audit(server, { ...baseEvent, event_type: "session_revocation", outcome: "completed", metadata: { sessions_deleted: data ?? 0 } })
      return NextResponse.json({ ok: true, message: "Refresh tokens and active sessions revoked.", sessions_deleted: data ?? 0 })
    }

    if (action === "lock") {
      const { error: banError } = await server.auth.admin.updateUserById(userId, { ban_duration: "876000h" })
      if (banError) throw banError
      const { data: revoked, error: revokeError } = await db.rpc("hq_service_revoke_user_sessions", { p_user_id: userId })
      if (revokeError) throw revokeError
      await audit(server, { ...baseEvent, event_type: "account_lock", outcome: "completed", metadata: { sessions_deleted: revoked ?? 0 } })
      return NextResponse.json({ ok: true, message: "Account locked and active sessions revoked." })
    }

    const { error: unbanError } = await server.auth.admin.updateUserById(userId, { ban_duration: "none" })
    if (unbanError) throw unbanError
    await audit(server, { ...baseEvent, event_type: "account_unlock", outcome: "completed", metadata: {} })
    return NextResponse.json({ ok: true, message: "Account unlocked." })
  } catch (error) {
    await audit(server, { ...baseEvent, event_type: action, outcome: "failed", metadata: { reason: error instanceof Error ? error.message : "operation_failed" } })
    console.error("HQ Security & Identity action failed", error)
    return jsonError("Security action could not be completed.", 500)
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/lib/supabaseServer"

const GENERIC = "If this address is authorized for HQ recovery, a secure reset email has been sent."
const COOLDOWN_MS = 60_000

type OwnerRow = { profile_id: string }
type SecurityEventRow = { created_at: string }

export async function POST(request: Request) {
  let normalized = ""
  let subjectUserId: string | null = null

  try {
    const body = await request.json() as { email?: string; redirectTo?: string }
    normalized = String(body.email ?? "").trim().toLowerCase()
    if (!normalized) return NextResponse.json({ ok: true, message: GENERIC })

    const server = getSupabaseServerClient()
    const db = server as any

    // HQ recovery authority comes only from the same platform_owners table used by is_platform_owner().
    const { data: owners, error: ownersError } = await db
      .from("platform_owners")
      .select("profile_id") as { data: OwnerRow[] | null; error: { message?: string } | null }
    if (ownersError) throw new Error(ownersError.message || "Owner authority unavailable")

    for (const owner of owners ?? []) {
      const { data, error } = await server.auth.admin.getUserById(owner.profile_id)
      if (error) continue
      if (data.user?.email?.trim().toLowerCase() === normalized) {
        subjectUserId = owner.profile_id
        break
      }
    }

    if (!subjectUserId) {
      await db.from("hq_security_events").insert({
        event_type: "password_recovery",
        subject_email: normalized,
        surface: "/hq/login",
        outcome: "denied",
        metadata: { reason: "not_platform_owner" },
      })
      return NextResponse.json({ ok: true, message: GENERIC })
    }

    // Prevent repeated requests from flooding the owner's inbox while preserving a generic public response.
    const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()
    const { data: recent } = await db
      .from("hq_security_events")
      .select("created_at")
      .eq("event_type", "password_recovery")
      .eq("subject_user_id", subjectUserId)
      .in("outcome", ["requested", "completed"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1) as { data: SecurityEventRow[] | null; error: unknown }

    if (recent?.length) {
      return NextResponse.json({ ok: true, message: GENERIC })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error("Auth configuration unavailable")

    const safeRedirect = new URL(body.redirectTo || "/hq/reset-password", request.url)
    const requestOrigin = new URL(request.url).origin
    if (safeRedirect.origin !== requestOrigin || safeRedirect.pathname !== "/hq/reset-password") {
      throw new Error("Invalid recovery redirect")
    }

    await db.from("hq_security_events").insert({
      event_type: "password_recovery",
      subject_user_id: subjectUserId,
      subject_email: normalized,
      surface: "/hq/login",
      outcome: "requested",
      metadata: { redirect_path: safeRedirect.pathname },
    })

    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: recoveryError } = await auth.auth.resetPasswordForEmail(normalized, { redirectTo: safeRedirect.toString() })

    await db.from("hq_security_events").insert({
      event_type: "password_recovery",
      subject_user_id: subjectUserId,
      subject_email: normalized,
      surface: "/hq/login",
      outcome: recoveryError ? "failed" : "completed",
      metadata: recoveryError ? { provider_error: recoveryError.message } : { provider: "supabase_auth" },
    })

    if (recoveryError) console.error("HQ recovery provider error", recoveryError.message)
    return NextResponse.json({ ok: true, message: GENERIC })
  } catch (error) {
    console.error("HQ recovery request failed", error)
    try {
      const db = getSupabaseServerClient() as any
      await db.from("hq_security_events").insert({
        event_type: "password_recovery",
        subject_user_id: subjectUserId,
        subject_email: normalized || null,
        surface: "/hq/login",
        outcome: "failed",
        metadata: { reason: "server_error" },
      })
    } catch {
      // Preserve the non-enumerating public response even if audit persistence is unavailable.
    }
    return NextResponse.json({ ok: true, message: GENERIC })
  }
}

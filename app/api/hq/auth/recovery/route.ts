import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const GENERIC = "If this address is authorized for HQ recovery, a secure reset email has been sent."

export async function POST(request: Request) {
  try {
    const { email, redirectTo } = await request.json() as { email?: string; redirectTo?: string }
    const normalized = String(email ?? "").trim().toLowerCase()
    const ownerEmail = (process.env.HQ_OWNER_EMAIL || "gilowincinvestment@gmail.com").trim().toLowerCase()
    if (!normalized || normalized !== ownerEmail) return NextResponse.json({ ok: true, message: GENERIC })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error("Auth configuration unavailable")

    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const safeRedirect = new URL(redirectTo || "/hq/reset-password", request.url)
    const requestOrigin = new URL(request.url).origin
    if (safeRedirect.origin !== requestOrigin || safeRedirect.pathname !== "/hq/reset-password") throw new Error("Invalid recovery redirect")

    const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo: safeRedirect.toString() })
    if (error) console.error("HQ recovery provider error", error.message)
    return NextResponse.json({ ok: true, message: GENERIC })
  } catch (error) {
    console.error("HQ recovery request failed", error)
    return NextResponse.json({ ok: true, message: GENERIC })
  }
}

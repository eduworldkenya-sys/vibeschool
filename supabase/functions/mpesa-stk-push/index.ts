import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const CONSUMER_KEY     = Deno.env.get("MPESA_CONSUMER_KEY") ?? ""
const CONSUMER_SECRET  = Deno.env.get("MPESA_CONSUMER_SECRET") ?? ""
const SHORTCODE        = Deno.env.get("MPESA_SHORTCODE") ?? ""
const PASSKEY          = Deno.env.get("MPESA_PASSKEY") ?? ""
const MPESA_ENV        = Deno.env.get("MPESA_ENV") ?? "sandbox"
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const APP_ORIGIN       = Deno.env.get("APP_ORIGIN") ?? "https://vibeschool.vercel.app"
const CALLBACK_SECRET  = Deno.env.get("MPESA_CALLBACK_SECRET") ?? ""

if (!SHORTCODE || !PASSKEY) {
  console.error("[mpesa-stk-push] CRITICAL: MPESA_SHORTCODE or MPESA_PASSKEY env vars not set")
}

const BASE_URL = MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function timestamp() {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
}

function formatPhone(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, "")
  if (/^\+2547\d{8}$/.test(cleaned)) return cleaned.slice(1)
  if (/^07\d{8}$/.test(cleaned))     return "254" + cleaned.slice(1)
  if (/^2547\d{8}$/.test(cleaned))   return cleaned
  return null
}

async function getToken(): Promise<string> {
  const creds = btoa(CONSUMER_KEY + ":" + CONSUMER_SECRET)
  const res = await fetch(BASE_URL + "/oauth/v1/generate?grant_type=client_credentials", {
    headers: { "Authorization": "Basic " + creds },
  })
  const data = await res.json()
  if (!data.access_token) throw new Error("Failed to get M-Pesa token: " + JSON.stringify(data))
  return data.access_token
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  if (!SHORTCODE || !PASSKEY || !CALLBACK_SECRET) {
    return json({ error: "Payment service misconfigured. Contact support." }, 503)
  }

  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "").trim()
  if (!token) return json({ error: "Missing auth token" }, 401)

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return json({ error: "Unauthorized" }, 401)

  try {
    const { phone, package_id } = await req.json()
    if (!phone || !package_id) return json({ error: "Missing phone or package_id" }, 400)

    const msisdn = formatPhone(phone)
    if (!msisdn) {
      return json({ error: "Invalid phone number. Please enter a Safaricom number (07XXXXXXXX)." }, 400)
    }

    const { data: pkg, error: pkgErr } = await adminClient
      .from("vibe_credit_packages")
      .select("id, name, price_kes, credits")
      .eq("id", package_id)
      .eq("is_active", true)
      .single()
    if (pkgErr || !pkg) return json({ error: "Package not found" }, 404)

    const ts       = timestamp()
    const password = btoa(SHORTCODE + PASSKEY + ts)
    const callbackUrl = SUPABASE_URL + "/functions/v1/mpesa-callback?secret=" + encodeURIComponent(CALLBACK_SECRET)
    const mpesaToken = await getToken()

    const stkRes = await fetch(BASE_URL + "/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + mpesaToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password:          password,
        Timestamp:         ts,
        TransactionType:   "CustomerPayBillOnline",
        Amount:            pkg.price_kes,
        PartyA:            msisdn,
        PartyB:            SHORTCODE,
        PhoneNumber:       msisdn,
        CallBackURL:       callbackUrl,
        AccountReference:  "VibeSchool",
        TransactionDesc:   pkg.name + " — " + pkg.credits + " Vibe Credits",
      }),
    })

    const stkData = await stkRes.json()
    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      console.error("[mpesa-stk-push] STK error:", JSON.stringify(stkData))
      return json({ error: stkData.errorMessage ?? stkData.ResponseDescription ?? "STK push failed" }, 502)
    }

    const { error: pendingErr } = await adminClient.from("vibe_credit_transactions").insert({
      teacher_id:       user.id,
      type:             "purchase",
      feature:          "mpesa",
      amount:           pkg.credits,
      balance_after:    0,
      mpesa_amount_kes: pkg.price_kes,
      notes:            "PENDING — " + pkg.name,
      mpesa_ref:        stkData.CheckoutRequestID,
    })

    if (pendingErr) {
      console.error("[mpesa-stk-push] Failed to persist pending transaction:", pendingErr)
      return json({ error: "Payment could not be initialized. Please try again." }, 500)
    }

    return json({
      success:             true,
      checkout_request_id: stkData.CheckoutRequestID,
      message:             "STK push sent. Enter your M-Pesa PIN.",
    })
  } catch (err) {
    console.error("[mpesa-stk-push] Error:", err)
    return json({ error: String(err) }, 500)
  }
})

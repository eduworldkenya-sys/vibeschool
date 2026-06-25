import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CONSUMER_KEY    = Deno.env.get("MPESA_CONSUMER_KEY") ?? ""
const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET") ?? ""
const SHORTCODE       = Deno.env.get("MPESA_SHORTCODE") ?? "174379"
const PASSKEY         = Deno.env.get("MPESA_PASSKEY") ?? "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
const MPESA_ENV       = Deno.env.get("MPESA_ENV") ?? "sandbox"
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

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

function formatPhone(raw: string): string {
  const cleaned = raw.replace(/\s/g, "")
  if (cleaned.startsWith("+254")) return cleaned.slice(1)
  if (cleaned.startsWith("07") || cleaned.startsWith("01")) return "254" + cleaned.slice(1)
  return cleaned
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

  // Auth
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "").trim()
  if (!token) return json({ error: "Missing auth token" }, 401)

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return json({ error: "Unauthorized" }, 401)

  try {
    const { phone, package_id } = await req.json()
    if (!phone || !package_id) return json({ error: "Missing phone or package_id" }, 400)

    // Get package details
    const { data: pkg, error: pkgErr } = await adminClient
      .from("vibe_credit_packages")
      .select("id, name, price_kes, credits")
      .eq("id", package_id)
      .eq("is_active", true)
      .single()
    if (pkgErr || !pkg) return json({ error: "Package not found" }, 404)

    const ts       = timestamp()
    const password = btoa(SHORTCODE + PASSKEY + ts)
    const msisdn   = formatPhone(phone)

    // Callback URL — Supabase Edge Function
    const callbackUrl = SUPABASE_URL + "/functions/v1/mpesa-callback"

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

    // Store pending transaction
    await adminClient.from("vibe_credit_transactions").insert({
      teacher_id:    user.id,
      type:          "purchase",
      feature:       "mpesa",
      amount:        pkg.credits,
      balance_after: 0, // will be updated by callback
      notes:         "PENDING — " + pkg.name,
      mpesa_ref:     stkData.CheckoutRequestID,
    })

    return json({
      success:            true,
      checkout_request_id: stkData.CheckoutRequestID,
      message:            "STK push sent. Enter your M-Pesa PIN.",
    })

  } catch (err) {
    console.error("[mpesa-stk-push] Error:", err)
    return json({ error: String(err) }, 500)
  }
})

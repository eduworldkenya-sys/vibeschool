import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const CALLBACK_SECRET  = Deno.env.get("MPESA_CALLBACK_SECRET") ?? ""

serve(async (req) => {
  try {
    // Safaricom does not send a Supabase JWT. Authenticate the webhook with a
    // mandatory high-entropy shared secret instead.
    if (!CALLBACK_SECRET) {
      console.error("[mpesa-callback] CRITICAL: MPESA_CALLBACK_SECRET is not configured")
      return new Response("ok", { status: 200 })
    }

    const url = new URL(req.url)
    const suppliedSecret = url.searchParams.get("secret") ?? req.headers.get("x-callback-secret") ?? ""
    if (suppliedSecret !== CALLBACK_SECRET) {
      console.warn("[mpesa-callback] Rejected: invalid secret")
      return new Response("ok", { status: 200 })
    }

    const body = await req.json()
    const cb = body?.Body?.stkCallback
    if (!cb) return new Response("ok", { status: 200 })

    const checkoutId = cb.CheckoutRequestID
    const resultCode = cb.ResultCode
    const items = cb.CallbackMetadata?.Item ?? []
    const mpesaRef = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value ?? null
    const paidAmount = Number(items.find((i: any) => i.Name === "Amount")?.Value ?? 0)

    if (!checkoutId) return new Response("ok", { status: 200 })

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    if (resultCode !== 0) {
      await adminClient
        .from("vibe_credit_transactions")
        .update({ notes: "FAILED — " + (cb.ResultDesc ?? "Payment cancelled"), updated_at: new Date().toISOString() })
        .eq("mpesa_ref", checkoutId)
        .like("notes", "PENDING — %")
      return new Response("ok", { status: 200 })
    }

    if (!mpesaRef || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      console.warn("[mpesa-callback] Missing receipt or amount for", checkoutId)
      return new Response("ok", { status: 200 })
    }

    const { data: settlement, error } = await adminClient.rpc("settle_mpesa_credit", {
      p_checkout_id: checkoutId,
      p_mpesa_ref: mpesaRef,
      p_paid_amount_kes: Math.round(paidAmount),
    })

    if (error) {
      console.error("[mpesa-callback] Settlement error:", error)
    } else if (settlement?.status === "amount_mismatch") {
      console.error("[mpesa-callback] Amount mismatch:", settlement)
    }

    // Always acknowledge the callback. Settlement is idempotent and can be
    // reconciled from the transaction ledger if Safaricom retries.
    return new Response("ok", { status: 200 })
  } catch (err) {
    console.error("[mpesa-callback] Error:", err)
    return new Response("ok", { status: 200 })
  }
})

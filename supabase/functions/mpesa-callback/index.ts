import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
// Set MPESA_CALLBACK_SECRET in Supabase Edge Function secrets.
// Pass the same value as a custom header from mpesa-stk-push via CallBackURL query param
// or embed it as a path segment in the callback URL:
// e.g. callbackUrl = SUPABASE_URL + "/functions/v1/mpesa-callback?secret=" + SECRET
const CALLBACK_SECRET  = Deno.env.get("MPESA_CALLBACK_SECRET") ?? ""

serve(async (req) => {
  try {
    // Verify shared secret — reject requests that don't carry it
    if (CALLBACK_SECRET) {
      const url    = new URL(req.url)
      const secret = url.searchParams.get("secret") ?? req.headers.get("x-callback-secret") ?? ""
      if (secret !== CALLBACK_SECRET) {
        console.warn("[mpesa-callback] Rejected: invalid secret")
        return new Response("ok", { status: 200 }) // always 200 to avoid Safaricom retries leaking info
      }
    }

    const body = await req.json()
    const cb   = body?.Body?.stkCallback

    if (!cb) return new Response("ok", { status: 200 })

    const checkoutId  = cb.CheckoutRequestID
    const resultCode  = cb.ResultCode
    const mpesaRef    = cb.CallbackMetadata?.Item?.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value ?? null

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    if (resultCode !== 0) {
      await adminClient
        .from("vibe_credit_transactions")
        .update({ notes: "FAILED — " + (cb.ResultDesc ?? "Payment cancelled") })
        .eq("mpesa_ref", checkoutId)
      return new Response("ok", { status: 200 })
    }

    // Get the pending transaction — must be in PENDING state to prevent replay
    const { data: txn } = await adminClient
      .from("vibe_credit_transactions")
      .select("teacher_id, amount, notes")
      .eq("mpesa_ref", checkoutId)
      .like("notes", "PENDING — %")
      .single()

    if (!txn) {
      console.warn("[mpesa-callback] No matching PENDING transaction for", checkoutId)
      return new Response("ok", { status: 200 })
    }

    // Credit the wallet
    await adminClient.rpc("purchase_credits", {
      p_teacher_id: txn.teacher_id,
      p_amount:     txn.amount,
      p_notes:      "M-Pesa " + (mpesaRef ?? checkoutId),
    })

    // Update transaction — remove PENDING prefix so replay attempts find no match
    await adminClient
      .from("vibe_credit_transactions")
      .update({
        mpesa_ref: mpesaRef ?? checkoutId,
        notes:     txn.notes.replace("PENDING — ", "") + " [paid]",
      })
      .eq("mpesa_ref", checkoutId)

    return new Response("ok", { status: 200 })

  } catch (err) {
    console.error("[mpesa-callback] Error:", err)
    return new Response("ok", { status: 200 })
  }
})

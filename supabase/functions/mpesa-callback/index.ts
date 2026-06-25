import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

serve(async (req) => {
  try {
    const body = await req.json()
    const cb   = body?.Body?.stkCallback

    if (!cb) return new Response("ok", { status: 200 })

    const checkoutId  = cb.CheckoutRequestID
    const resultCode  = cb.ResultCode
    const mpesaRef    = cb.CallbackMetadata?.Item?.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value ?? null

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    if (resultCode !== 0) {
      // Payment failed — mark transaction as failed
      await adminClient
        .from("vibe_credit_transactions")
        .update({ notes: "FAILED — " + (cb.ResultDesc ?? "Payment cancelled") })
        .eq("mpesa_ref", checkoutId)
      return new Response("ok", { status: 200 })
    }

    // Get the pending transaction
    const { data: txn } = await adminClient
      .from("vibe_credit_transactions")
      .select("teacher_id, amount, notes")
      .eq("mpesa_ref", checkoutId)
      .single()

    if (!txn) return new Response("ok", { status: 200 })

    // Credit the wallet using purchase_credits RPC
    await adminClient.rpc("purchase_credits", {
      p_teacher_id: txn.teacher_id,
      p_amount:     txn.amount,
      p_notes:      "M-Pesa " + (mpesaRef ?? checkoutId),
    })

    // Update transaction with real mpesa ref
    await adminClient
      .from("vibe_credit_transactions")
      .update({
        mpesa_ref:    mpesaRef ?? checkoutId,
        notes:        txn.notes?.replace("PENDING — ", "") ?? "",
      })
      .eq("mpesa_ref", checkoutId)

    return new Response("ok", { status: 200 })

  } catch (err) {
    console.error("[mpesa-callback] Error:", err)
    return new Response("ok", { status: 200 }) // always 200 to Safaricom
  }
})

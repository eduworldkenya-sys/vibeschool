import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ResultCode: 1, ResultDesc: "Method not allowed" }, 405);
  }

  const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET")?.trim();
  const suppliedSecret = new URL(req.url).searchParams.get("secret")?.trim();
  if (!callbackSecret) {
    console.error("[mpesa-callback] MPESA_CALLBACK_SECRET is not configured");
    return json({ ResultCode: 1, ResultDesc: "Webhook unavailable" }, 503);
  }
  if (!suppliedSecret || suppliedSecret !== callbackSecret) {
    console.warn("[mpesa-callback] rejected invalid callback secret");
    return json({ ResultCode: 1, ResultDesc: "Unauthorised callback" }, 401);
  }

  try {
    const SUPABASE_URL = requiredEnv("SUPABASE_URL");
    const SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const payload = await req.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutId = String(callback?.CheckoutRequestID ?? "").trim();
    const merchantRequestId = String(callback?.MerchantRequestID ?? "").trim() || null;
    const resultCode = Number(callback?.ResultCode);
    const resultDesc = String(callback?.ResultDesc ?? "").trim() || null;

    if (!checkoutId || !Number.isFinite(resultCode)) {
      console.error("[mpesa-callback] malformed payload", payload);
      return json({ ResultCode: 1, ResultDesc: "Malformed callback" }, 400);
    }

    const metadata = Array.isArray(callback?.CallbackMetadata?.Item)
      ? callback.CallbackMetadata.Item
      : [];
    const getValue = (name: string) => metadata.find((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      return (item as Record<string, unknown>).Name === name;
    })?.Value;

    const receipt = String(getValue("MpesaReceiptNumber") ?? "").trim() || null;
    const rawAmount = getValue("Amount");
    const amount = rawAmount === undefined || rawAmount === null ? null : Number(rawAmount);
    const safeAmount = amount !== null && Number.isFinite(amount) ? amount : null;
    const eventKey = `${checkoutId}:${Math.trunc(resultCode)}:${receipt ?? "none"}`;

    // P0 invariant: acknowledge successful delivery only after callback evidence is durable.
    const { data: inserted, error: insertErr } = await supabase
      .from("mpesa_callback_events")
      .insert({
        event_key: eventKey,
        checkout_request_id: checkoutId,
        merchant_request_id: merchantRequestId,
        result_code: Math.trunc(resultCode),
        result_desc: resultDesc,
        mpesa_receipt_number: receipt,
        paid_amount_kes: safeAmount,
        raw_payload: payload,
        processing_status: "pending",
      })
      .select("id,processing_status")
      .single();

    let event = inserted;
    if (insertErr) {
      if (insertErr.code !== "23505") {
        console.error("[mpesa-callback] failed to persist callback evidence", insertErr);
        return json({ ResultCode: 1, ResultDesc: "Callback persistence failed" }, 500);
      }
      const { data: existing, error: existingErr } = await supabase
        .from("mpesa_callback_events")
        .select("id,processing_status")
        .eq("event_key", eventKey)
        .single();
      if (existingErr || !existing) {
        console.error("[mpesa-callback] failed to recover duplicate callback", existingErr);
        return json({ ResultCode: 1, ResultDesc: "Callback persistence failed" }, 500);
      }
      event = existing;
    }

    // Successful acknowledgement requires proof that an immutable callback event
    // is now addressable. This is a runtime invariant, not only a type assertion.
    if (!event) {
      console.error("[mpesa-callback] callback persistence returned no durable event", { checkoutId, eventKey });
      return json({ ResultCode: 1, ResultDesc: "Callback persistence failed" }, 500);
    }

    if (event.processing_status !== "processed") {
      const { data: processed, error: processErr } = await supabase.rpc(
        "process_mpesa_callback_event",
        { p_event_id: event.id },
      );
      if (processErr) {
        console.error("[mpesa-callback] callback event processing failed", {
          eventId: event.id,
          checkoutId,
          error: processErr,
        });
        // Evidence is durable. Acknowledge to avoid retry storms; reconciliation can replay it safely.
        return json({ ResultCode: 0, ResultDesc: "Accepted for reconciliation" }, 200);
      }
      if (!processed?.success && processed?.error !== "attempt_not_found") {
        console.error("[mpesa-callback] callback requires reconciliation", { eventId: event.id, processed });
      }
    }

    return json({ ResultCode: 0, ResultDesc: "Accepted" }, 200);
  } catch (e) {
    console.error("[mpesa-callback] unexpected pre-persistence error", e);
    // Unknown exceptions may have happened before evidence was committed. Ask the provider to retry.
    return json({ ResultCode: 1, ResultDesc: "Temporary callback failure" }, 500);
  }
});

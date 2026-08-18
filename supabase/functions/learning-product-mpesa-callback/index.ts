import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

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

  const callbackSecret = Deno.env.get("COMMERCE_MPESA_CALLBACK_SECRET")?.trim();
  const suppliedSecret = new URL(req.url).searchParams.get("secret")?.trim();
  if (!callbackSecret) {
    console.error("[learning-product-mpesa-callback] callback secret not configured");
    return json({ ResultCode: 1, ResultDesc: "Webhook unavailable" }, 503);
  }
  if (!suppliedSecret || suppliedSecret !== callbackSecret) {
    console.warn("[learning-product-mpesa-callback] rejected invalid callback secret");
    return json({ ResultCode: 1, ResultDesc: "Unauthorised callback" }, 401);
  }

  try {
    const SUPABASE_URL = requiredEnv("SUPABASE_URL");
    const SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const payload = await req.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID ?? "").trim();
    const merchantRequestId = String(callback?.MerchantRequestID ?? "").trim() || null;
    const resultCode = Number(callback?.ResultCode);
    const resultDesc = String(callback?.ResultDesc ?? "").trim() || null;

    if (!checkoutRequestId || !Number.isFinite(resultCode)) {
      console.error("[learning-product-mpesa-callback] malformed payload", payload);
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
    const parsedAmount = rawAmount === undefined || rawAmount === null ? null : Number(rawAmount);
    const amount = parsedAmount !== null && Number.isFinite(parsedAmount) ? parsedAmount : null;
    const eventKey = `mpesa:${checkoutRequestId}:${Math.trunc(resultCode)}:${receipt ?? "none"}`;

    // Provider acknowledgement happens only after immutable callback evidence is durable.
    const { data: inserted, error: insertError } = await supabase
      .from("commerce_payment_callback_events")
      .insert({
        provider: "mpesa",
        event_key: eventKey,
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        result_code: Math.trunc(resultCode),
        result_desc: resultDesc,
        provider_receipt: receipt,
        paid_amount_kes: amount,
        raw_payload: payload,
        processing_status: "pending",
      })
      .select("id,processing_status")
      .single();

    let event = inserted;
    if (insertError) {
      if (insertError.code !== "23505") {
        console.error("[learning-product-mpesa-callback] callback persistence failed", insertError);
        return json({ ResultCode: 1, ResultDesc: "Callback persistence failed" }, 500);
      }
      const { data: existing, error: existingError } = await supabase
        .from("commerce_payment_callback_events")
        .select("id,processing_status")
        .eq("event_key", eventKey)
        .single();
      if (existingError || !existing) {
        console.error("[learning-product-mpesa-callback] duplicate recovery failed", existingError);
        return json({ ResultCode: 1, ResultDesc: "Callback persistence failed" }, 500);
      }
      event = existing;
    }

    if (!event) {
      console.error("[learning-product-mpesa-callback] persistence returned no durable event", { checkoutRequestId, eventKey });
      return json({ ResultCode: 1, ResultDesc: "Callback persistence failed" }, 500);
    }

    if (event.processing_status !== "processed") {
      const { data: processed, error: processError } = await supabase.rpc(
        "process_commerce_payment_callback_event",
        { p_event_id: event.id },
      );
      if (processError) {
        console.error("[learning-product-mpesa-callback] processing failed after durable persistence", {
          eventId: event.id,
          checkoutRequestId,
          processError,
        });
        // Evidence is durable, so acknowledge to prevent provider retry storms.
        return json({ ResultCode: 0, ResultDesc: "Accepted for reconciliation" }, 200);
      }
      if (!processed?.success && processed?.error !== "attempt_not_found") {
        console.error("[learning-product-mpesa-callback] reconciliation required", { eventId: event.id, processed });
      }
    }

    return json({ ResultCode: 0, ResultDesc: "Accepted" }, 200);
  } catch (error) {
    console.error("[learning-product-mpesa-callback] pre-persistence failure", error);
    return json({ ResultCode: 1, ResultDesc: "Temporary callback failure" }, 500);
  }
});

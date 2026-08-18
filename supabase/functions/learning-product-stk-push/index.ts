import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

function corsHeaders(req: Request): Record<string, string> {
  const configured = Deno.env.get("APP_ORIGIN")?.trim();
  const origin = req.headers.get("origin")?.trim();
  const allowed = configured && origin === configured ? configured : (configured ?? "null");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  throw new Error("Enter a valid Kenyan Safaricom number.");
}

function uuidOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("Invalid learner identifier.");
  }
  return text;
}

function b64(value: string): string {
  return btoa(value);
}

const ATTEMPT_FIELDS = "id,order_id,payer_profile_id,state,idempotency_key,checkout_request_id,merchant_request_id,expected_amount_kes,phone,created_at";
const OPEN_STATES = ["created", "submitting", "awaiting_customer", "reconciliation_required"];

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405, headers);

  let attemptId: string | null = null;

  try {
    const SUPABASE_URL = requiredEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requiredEnv("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const MPESA_CONSUMER_KEY = requiredEnv("MPESA_CONSUMER_KEY");
    const MPESA_CONSUMER_SECRET = requiredEnv("MPESA_CONSUMER_SECRET");
    const MPESA_SHORTCODE = requiredEnv("MPESA_SHORTCODE");
    const MPESA_PASSKEY = requiredEnv("MPESA_PASSKEY");
    const CALLBACK_SECRET = requiredEnv("COMMERCE_MPESA_CALLBACK_SECRET");
    const MPESA_ENV = (Deno.env.get("MPESA_ENV") ?? "production").toLowerCase();
    if (!new Set(["sandbox", "production"]).has(MPESA_ENV)) throw new Error("Invalid MPESA_ENV server configuration.");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Not authenticated" }, 401, headers);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ success: false, error: "Invalid session" }, 401, headers);

    // Commercial policy is evaluated as the authenticated caller. This does not
    // replace the independent database M-Pesa runtime kill switch enforced when
    // the attempt is claimed immediately before the external side effect.
    const { error: billingError } = await userClient.rpc("hq_assert_product_enabled", {
      p_product_key: "billing",
      p_policy_key: "billing.enabled",
    });
    if (billingError) return json({ success: false, error: "Billing is currently unavailable." }, 503, headers);

    const body = await req.json();
    const offerId = String(body.offer_id ?? "").trim();
    const idempotencyKey = String(body.idempotency_key ?? "").trim();
    const phone = normalizePhone(String(body.phone ?? ""));
    const beneficiaryStudentId = uuidOrNull(body.beneficiary_student_id);
    if (!/^[0-9a-f-]{36}$/i.test(offerId)) throw new Error("Choose a valid learning product offer.");
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) throw new Error("Invalid payment request identifier.");

    const { data: orderResult, error: orderError } = await userClient.rpc("commerce_create_learning_product_order", {
      p_offer_id: offerId,
      p_idempotency_key: idempotencyKey,
      p_beneficiary_student_id: beneficiaryStudentId,
    });
    if (orderError) throw orderError;

    if (orderResult?.already_entitled === true) {
      return json({
        success: true,
        state: "settled",
        fulfilled: true,
        already_entitled: true,
        product_id: orderResult.product_id,
        customer_message: "This learner already has access to this Learning Product. No payment was started.",
      }, 200, headers);
    }

    if (!orderResult?.success) {
      const reconciliation = orderResult?.error === "payment_reconciliation_required";
      return json({
        success: false,
        order_id: orderResult?.order_id ?? null,
        state: reconciliation ? "reconciliation_required" : (orderResult?.status ?? "failed"),
        error: reconciliation
          ? "A previous payment for this learner has an uncertain provider state. Do not pay again until it is reconciled."
          : (orderResult?.error ?? "Unable to create the learning product order."),
      }, reconciliation ? 409 : 400, headers);
    }

    if (!orderResult.order_id) throw new Error("Order creation returned no durable order reference.");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: readOrderError } = await admin
      .from("learning_product_orders")
      .select("id,purchaser_profile_id,amount_kes,status,product_snapshot,offer_snapshot,provider_receipt")
      .eq("id", orderResult.order_id)
      .eq("purchaser_profile_id", user.id)
      .single();
    if (readOrderError || !order) throw readOrderError ?? new Error("Order could not be verified.");

    if (order.status === "fulfilled") {
      return json({
        success: true,
        order_id: order.id,
        state: "settled",
        fulfilled: true,
        receipt: order.provider_receipt,
        customer_message: "This learning product is already unlocked.",
      }, 200, headers);
    }
    if (order.status !== "pending_payment") {
      return json({ success: false, order_id: order.id, state: order.status, error: "This order cannot start a new payment." }, 409, headers);
    }

    const { data: created, error: createError } = await admin
      .from("commerce_payment_attempts")
      .insert({
        order_id: order.id,
        payer_profile_id: user.id,
        provider: "mpesa",
        expected_amount_kes: order.amount_kes,
        phone,
        idempotency_key: idempotencyKey,
        state: "created",
      })
      .select(ATTEMPT_FIELDS)
      .single();

    let attempt = created;
    let ownsAttempt = true;

    if (createError) {
      if (createError.code !== "23505") throw createError;

      const { data: same, error: sameError } = await admin
        .from("commerce_payment_attempts")
        .select(ATTEMPT_FIELDS)
        .eq("payer_profile_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (sameError) throw sameError;

      if (same) {
        attempt = same;
      } else {
        const { data: active, error: activeError } = await admin
          .from("commerce_payment_attempts")
          .select(ATTEMPT_FIELDS)
          .eq("order_id", order.id)
          .in("state", OPEN_STATES)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeError || !active) throw activeError ?? new Error("Unable to recover the active payment request.");
        attempt = active;
        ownsAttempt = false;
      }
    }

    if (!attempt) throw new Error("Unable to create a payment request.");
    attemptId = attempt.id;

    if (!ownsAttempt) {
      return json({
        success: true,
        reused_active: true,
        order_id: order.id,
        attempt_id: attempt.id,
        state: attempt.state,
        checkout_request_id: attempt.checkout_request_id,
        merchant_request_id: attempt.merchant_request_id,
        customer_message: "You already have an unresolved M-Pesa payment for this learning product. VibeSchool will track it instead of sending another request.",
      }, 200, headers);
    }

    if (["awaiting_customer", "settled"].includes(attempt.state)) {
      return json({
        success: true,
        order_id: order.id,
        attempt_id: attempt.id,
        state: attempt.state,
        checkout_request_id: attempt.checkout_request_id,
        merchant_request_id: attempt.merchant_request_id,
        customer_message: attempt.state === "settled" ? "Payment already completed." : "M-Pesa request already sent. Complete it on your phone.",
      }, 200, headers);
    }
    if (attempt.state === "submitting") {
      return json({ success: true, order_id: order.id, attempt_id: attempt.id, state: attempt.state, customer_message: "This M-Pesa request is already being submitted." }, 200, headers);
    }
    if (attempt.state === "reconciliation_required") {
      return json({ success: false, order_id: order.id, attempt_id: attempt.id, state: attempt.state, error: "This payment has an uncertain provider state. Do not retry it; reconciliation is required." }, 409, headers);
    }
    if (["failed", "cancelled", "expired"].includes(attempt.state)) {
      return json({ success: false, order_id: order.id, attempt_id: attempt.id, state: attempt.state, error: "This payment request is closed. Start a new order payment request." }, 409, headers);
    }

    const { data: claimed, error: claimError } = await admin.rpc("claim_commerce_payment_attempt", { p_attempt_id: attempt.id });
    if (claimError) throw claimError;
    if (claimed !== true) {
      const { data: current, error: currentError } = await admin
        .from("commerce_payment_attempts")
        .select(ATTEMPT_FIELDS)
        .eq("id", attempt.id)
        .single();
      if (currentError || !current) throw currentError ?? new Error("Unable to recover payment state.");
      if (current.state === "created") {
        return json({ success: false, order_id: order.id, attempt_id: current.id, state: current.state, error: "M-Pesa checkout is not activated yet." }, 503, headers);
      }
      return json({
        success: ["submitting", "awaiting_customer", "settled"].includes(current.state),
        order_id: order.id,
        attempt_id: current.id,
        state: current.state,
        checkout_request_id: current.checkout_request_id,
        merchant_request_id: current.merchant_request_id,
        error: current.state === "reconciliation_required" ? "Payment requires reconciliation. Do not retry." : undefined,
      }, current.state === "reconciliation_required" ? 409 : 200, headers);
    }

    await admin.from("learning_product_order_events").insert({
      order_id: order.id,
      event_type: "payment_started",
      details: { attempt_id: attempt.id, provider: "mpesa" },
    });

    const host = MPESA_ENV === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";
    const oauthResponse = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${b64(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`)}` },
    });
    const oauth = await oauthResponse.json();
    if (!oauthResponse.ok || !oauth.access_token) {
      await admin.from("commerce_payment_attempts").update({
        state: "failed",
        processing_error: "mpesa_oauth_failed",
        provider_response: oauth,
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      await admin.from("learning_product_order_events").insert({ order_id: order.id, event_type: "payment_failed", details: { reason: "mpesa_oauth_failed" } });
      throw new Error(oauth.errorMessage ?? "Unable to authenticate with M-Pesa.");
    }

    const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const password = b64(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/learning-product-mpesa-callback?secret=${encodeURIComponent(CALLBACK_SECRET)}`;
    const productTitle = String(order.product_snapshot?.title ?? "Learning Product").slice(0, 40);

    let stkResponse: Response;
    try {
      stkResponse = await fetch(`${host}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${oauth.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: attempt.expected_amount_kes,
          PartyA: attempt.phone,
          PartyB: MPESA_SHORTCODE,
          PhoneNumber: attempt.phone,
          CallBackURL: callbackUrl,
          AccountReference: `VS-LP-${attempt.id.replace(/-/g, "").slice(0, 7)}`,
          TransactionDesc: productTitle,
        }),
      });
    } catch (networkError) {
      await admin.from("commerce_payment_attempts").update({
        state: "reconciliation_required",
        processing_error: `stk_network_uncertain:${networkError instanceof Error ? networkError.message : "unknown"}`,
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      await admin.from("learning_product_orders").update({ status: "reconciliation_required", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "pending_payment");
      await admin.from("learning_product_order_events").insert({ order_id: order.id, event_type: "payment_reconciliation_required", details: { reason: "stk_network_uncertain", attempt_id: attempt.id } });
      return json({ success: false, order_id: order.id, attempt_id: attempt.id, state: "reconciliation_required", error: "M-Pesa did not return a definitive response. Do not retry this payment yet." }, 502, headers);
    }

    const stk = await stkResponse.json();
    if (!stkResponse.ok || stk.ResponseCode !== "0" || !stk.CheckoutRequestID) {
      await admin.from("commerce_payment_attempts").update({
        state: "failed",
        provider_response: stk,
        provider_result_desc: stk.errorMessage ?? stk.ResponseDescription ?? stk.CustomerMessage ?? "STK request rejected",
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      await admin.from("learning_product_order_events").insert({ order_id: order.id, event_type: "payment_failed", details: { reason: "stk_rejected", attempt_id: attempt.id } });
      return json({ success: false, order_id: order.id, attempt_id: attempt.id, state: "failed", error: stk.errorMessage ?? stk.ResponseDescription ?? stk.CustomerMessage ?? "M-Pesa request failed." }, 502, headers);
    }

    const checkoutRequestId = String(stk.CheckoutRequestID);
    const merchantRequestId = String(stk.MerchantRequestID ?? "").trim() || null;
    const { data: attached, error: attachError } = await admin.rpc("attach_commerce_mpesa_request", {
      p_attempt_id: attempt.id,
      p_checkout_request_id: checkoutRequestId,
      p_merchant_request_id: merchantRequestId,
      p_provider_response: stk,
    });
    if (attachError || !attached?.success) {
      console.error("[learning-product-stk-push] accepted STK could not be attached", { attemptId: attempt.id, checkoutRequestId, attachError, attached });
      await admin.from("commerce_payment_attempts").update({
        state: "reconciliation_required",
        processing_error: "accepted_stk_tracking_failure",
        provider_response: stk,
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      await admin.from("learning_product_orders").update({ status: "reconciliation_required", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "pending_payment");
      await admin.from("learning_product_order_events").insert({ order_id: order.id, event_type: "payment_reconciliation_required", details: { reason: "accepted_stk_tracking_failure", attempt_id: attempt.id, checkout_request_id: checkoutRequestId } });
      return json({ success: false, order_id: order.id, attempt_id: attempt.id, state: "reconciliation_required", error: "M-Pesa accepted the request but VibeSchool could not safely finalize tracking. Do not retry; reconciliation is required." }, 503, headers);
    }

    await admin.from("learning_product_order_events").insert({
      order_id: order.id,
      event_type: "payment_accepted",
      details: { attempt_id: attempt.id, checkout_request_id: checkoutRequestId },
    });

    const { data: earlyEvents } = await admin
      .from("commerce_payment_callback_events")
      .select("id")
      .eq("checkout_request_id", checkoutRequestId)
      .eq("processing_status", "pending")
      .order("received_at", { ascending: true });
    for (const event of earlyEvents ?? []) {
      const { error: replayError } = await admin.rpc("process_commerce_payment_callback_event", { p_event_id: event.id });
      if (replayError) console.error("[learning-product-stk-push] early callback replay failed", replayError);
    }

    return json({
      success: true,
      order_id: order.id,
      attempt_id: attempt.id,
      state: attached.state ?? "awaiting_customer",
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      customer_message: stk.CustomerMessage ?? "Check your phone and enter your M-Pesa PIN.",
    }, 200, headers);
  } catch (error) {
    console.error("[learning-product-stk-push] error", { attemptId, error });
    return json({ success: false, attempt_id: attemptId, error: error instanceof Error ? error.message : "Unable to start M-Pesa payment." }, 400, headers);
  }
});
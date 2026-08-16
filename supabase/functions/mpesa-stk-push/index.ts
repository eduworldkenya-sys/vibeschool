import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

function corsHeaders(req: Request): Record<string, string> {
  const configured = Deno.env.get("APP_ORIGIN")?.trim();
  const requestOrigin = req.headers.get("origin")?.trim();
  const allowedOrigin = configured && requestOrigin === configured ? configured : (configured ?? "null");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function normalizePhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  throw new Error("Enter a valid Kenyan Safaricom number.");
}

function b64(input: string): string {
  return btoa(input);
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

const ATTEMPT_FIELDS = "id,state,idempotency_key,checkout_request_id,merchant_request_id,credits,expected_amount_kes,package_name,phone,created_at";
const UNRESOLVED_STATES = ["created", "submitting", "awaiting_customer", "reconciliation_required"];

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
    const MPESA_CALLBACK_SECRET = requiredEnv("MPESA_CALLBACK_SECRET");
    const MPESA_ENV = (Deno.env.get("MPESA_ENV") ?? "production").toLowerCase();
    if (!new Set(["sandbox", "production"]).has(MPESA_ENV)) throw new Error("Invalid MPESA_ENV server configuration.");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Not authenticated" }, 401, headers);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Invalid session" }, 401, headers);

    // Canonical company billing authority. This guard intentionally executes in
    // the authenticated user's context; service-role evaluation is rejected by
    // the HQ authority layer and must not be used as a bypass.
    const { error: billingGuardErr } = await userClient.rpc("hq_assert_product_enabled", {
      p_product_key: "billing",
      p_policy_key: "billing.enabled",
    });
    if (billingGuardErr) {
      console.warn("[mpesa-stk-push] billing authority denied request", {
        userId: user.id,
        code: billingGuardErr.code,
      });
      return json({ success: false, error: "Billing is currently unavailable." }, 503, headers);
    }

    const body = await req.json();
    const packageId = String(body.package_id ?? "").trim();
    const idempotencyKey = String(body.idempotency_key ?? "").trim();
    const requestedPhone = normalizePhone(String(body.phone ?? ""));
    if (!packageId) throw new Error("Choose a credit package.");
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) throw new Error("Invalid payment request identifier.");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: pkg, error: pkgErr } = await admin.from("vibe_credit_packages")
      .select("id,name,credits,price_kes,is_active").eq("id", packageId).eq("is_active", true).single();
    if (pkgErr || !pkg || !String(pkg.name ?? "").startsWith("Vibe ")) throw new Error("Credit package is unavailable.");
    if (!Number.isInteger(pkg.price_kes) || pkg.price_kes <= 0) throw new Error("Credit package price is invalid.");
    if (!Number.isInteger(pkg.credits) || pkg.credits <= 0) throw new Error("Credit package amount is invalid.");

    const { error: walletErr } = await admin.from("vibe_credits").upsert(
      { teacher_id: user.id, balance: 0, total_earned: 0, total_spent: 0 },
      { onConflict: "teacher_id", ignoreDuplicates: true },
    );
    if (walletErr) throw walletErr;

    const { data: created, error: createErr } = await admin.from("mpesa_payment_attempts").insert({
      teacher_id: user.id,
      package_id: pkg.id,
      package_name: pkg.name,
      expected_amount_kes: pkg.price_kes,
      credits: pkg.credits,
      phone: requestedPhone,
      idempotency_key: idempotencyKey,
      state: "created",
    }).select(ATTEMPT_FIELDS).single();

    let attempt = created;
    let ownsRequest = true;

    if (createErr) {
      if (createErr.code !== "23505") throw createErr;

      const { data: sameRequest, error: sameErr } = await admin.from("mpesa_payment_attempts")
        .select(ATTEMPT_FIELDS)
        .eq("teacher_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (sameErr) throw sameErr;

      if (sameRequest) {
        attempt = sameRequest;
      } else {
        const { data: active, error: activeErr } = await admin.from("mpesa_payment_attempts")
          .select(ATTEMPT_FIELDS)
          .eq("teacher_id", user.id)
          .in("state", UNRESOLVED_STATES)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeErr || !active) throw activeErr ?? new Error("Unable to recover the active payment request.");
        attempt = active;
        ownsRequest = false;
      }
    }

    if (!attempt) throw new Error("Unable to create payment request.");
    attemptId = attempt.id;

    if (!ownsRequest) {
      return json({
        success: true,
        reused_active: true,
        attempt_id: attempt.id,
        state: attempt.state,
        checkout_request_id: attempt.checkout_request_id,
        merchant_request_id: attempt.merchant_request_id,
        customer_message: "You already have an unresolved M-Pesa payment. VibeSchool will track that payment instead of sending another STK push.",
      }, 200, headers);
    }

    if (["awaiting_customer", "settled"].includes(attempt.state)) {
      return json({
        success: true,
        attempt_id: attempt.id,
        state: attempt.state,
        checkout_request_id: attempt.checkout_request_id,
        merchant_request_id: attempt.merchant_request_id,
        customer_message: attempt.state === "settled" ? "Payment already completed." : "M-Pesa request already sent. Complete it on your phone.",
      }, 200, headers);
    }
    if (attempt.state === "submitting") {
      return json({
        success: true,
        attempt_id: attempt.id,
        state: attempt.state,
        customer_message: "This M-Pesa request is already being submitted. VibeSchool will track the existing attempt.",
      }, 200, headers);
    }
    if (attempt.state === "reconciliation_required") {
      return json({ success: false, attempt_id: attempt.id, state: attempt.state, error: "This payment has an uncertain provider state. Do not retry it; reconciliation is required." }, 409, headers);
    }
    if (["failed", "cancelled", "expired"].includes(attempt.state)) {
      return json({ success: false, attempt_id: attempt.id, state: attempt.state, error: "This payment request is closed. Start a new payment." }, 409, headers);
    }

    const { data: claimed, error: claimErr } = await admin.rpc("claim_mpesa_payment_attempt", { p_attempt_id: attempt.id });
    if (claimErr) throw claimErr;
    if (claimed !== true) {
      const { data: current, error: currentErr } = await admin.from("mpesa_payment_attempts")
        .select(ATTEMPT_FIELDS).eq("id", attempt.id).eq("teacher_id", user.id).single();
      if (currentErr || !current) throw currentErr ?? new Error("Unable to recover payment state.");
      return json({
        success: current.state === "submitting" || current.state === "awaiting_customer" || current.state === "settled",
        attempt_id: current.id,
        state: current.state,
        checkout_request_id: current.checkout_request_id,
        merchant_request_id: current.merchant_request_id,
        error: current.state === "reconciliation_required" ? "Payment requires reconciliation. Do not retry." : undefined,
        customer_message: "VibeSchool is already processing this payment attempt.",
      }, current.state === "reconciliation_required" ? 409 : 200, headers);
    }

    const host = MPESA_ENV === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";
    const credentials = b64(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
    const oauthResp = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${credentials}` } });
    const oauthBody = await oauthResp.json();
    if (!oauthResp.ok || !oauthBody.access_token) {
      await admin.from("mpesa_payment_attempts").update({
        state: "failed",
        processing_error: "mpesa_oauth_failed",
        provider_response: oauthBody,
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      throw new Error(oauthBody.errorMessage ?? "Unable to authenticate with M-Pesa.");
    }

    const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const password = b64(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-callback?secret=${encodeURIComponent(MPESA_CALLBACK_SECRET)}`;

    let stkResp: Response;
    try {
      stkResp = await fetch(`${host}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${oauthBody.access_token}`, "Content-Type": "application/json" },
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
          AccountReference: `VS-${attempt.id.replace(/-/g, "").slice(0, 9)}`,
          TransactionDesc: `${attempt.credits} Vibe Credits`,
        }),
      });
    } catch (networkError) {
      await admin.from("mpesa_payment_attempts").update({
        state: "reconciliation_required",
        processing_error: `stk_network_uncertain:${networkError instanceof Error ? networkError.message : "unknown"}`,
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      return json({ success: false, attempt_id: attempt.id, state: "reconciliation_required", error: "M-Pesa did not return a definitive response. Do not retry this payment yet." }, 502, headers);
    }

    const stk = await stkResp.json();
    if (!stkResp.ok || stk.ResponseCode !== "0" || !stk.CheckoutRequestID) {
      await admin.from("mpesa_payment_attempts").update({
        state: "failed",
        provider_response: stk,
        provider_result_desc: stk.errorMessage ?? stk.ResponseDescription ?? stk.CustomerMessage ?? "STK request rejected",
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      return json({ success: false, attempt_id: attempt.id, state: "failed", error: stk.errorMessage ?? stk.ResponseDescription ?? stk.CustomerMessage ?? "M-Pesa request failed." }, 502, headers);
    }

    const checkoutRequestId = String(stk.CheckoutRequestID);
    const merchantRequestId = String(stk.MerchantRequestID ?? "") || null;
    const { data: attached, error: attachErr } = await admin.rpc("attach_mpesa_provider_request", {
      p_attempt_id: attempt.id,
      p_checkout_request_id: checkoutRequestId,
      p_merchant_request_id: merchantRequestId,
      p_provider_response: stk,
    });

    if (attachErr || !attached?.success) {
      console.error("Failed to attach accepted STK request to durable attempt", { attachErr, attached, attemptId: attempt.id, checkoutRequestId });
      return json({
        success: false,
        attempt_id: attempt.id,
        state: attached?.state ?? "reconciliation_required",
        error: "M-Pesa accepted the request but VibeSchool could not safely finalize tracking. Do not retry; reconciliation is required.",
      }, 503, headers);
    }

    const { data: earlyEvents } = await admin.from("mpesa_callback_events").select("id")
      .eq("checkout_request_id", checkoutRequestId).eq("processing_status", "pending").order("received_at", { ascending: true });
    for (const event of earlyEvents ?? []) {
      const { error: replayErr } = await admin.rpc("process_mpesa_callback_event", { p_event_id: event.id });
      if (replayErr) console.error("Early callback replay failed", replayErr);
    }

    return json({
      success: true,
      attempt_id: attempt.id,
      state: attached.state ?? "awaiting_customer",
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      customer_message: stk.CustomerMessage ?? "Check your phone and enter your M-Pesa PIN.",
    }, 200, headers);
  } catch (e) {
    console.error("mpesa-stk-push error", { attemptId, error: e });
    return json({ success: false, attempt_id: attemptId, error: e instanceof Error ? e.message : "Unable to start M-Pesa payment." }, 400, headers);
  }
});

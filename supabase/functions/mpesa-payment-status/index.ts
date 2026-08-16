import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

function b64(input: string): string {
  return btoa(input);
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

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405, headers);

  try {
    const SUPABASE_URL = requiredEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requiredEnv("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Not authenticated" }, 401, headers);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Invalid session" }, 401, headers);

    const body = await req.json();
    const attemptId = String(body.attempt_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return json({ success: false, error: "Invalid payment attempt." }, 400, headers);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const selectAttempt = async () => admin.from("mpesa_payment_attempts")
      .select("id,state,credits,expected_amount_kes,package_name,checkout_request_id,merchant_request_id,mpesa_receipt_number,provider_result_code,provider_result_desc,processing_error,requested_at,settled_at,created_at,updated_at")
      .eq("id", attemptId).eq("teacher_id", user.id).maybeSingle();

    let { data: attempt, error: attemptErr } = await selectAttempt();
    if (attemptErr) throw attemptErr;
    if (!attempt) return json({ success: false, error: "Payment attempt not found." }, 404, headers);

    // A 'created' attempt has not crossed the provider boundary. If its owning
    // request died before the atomic claim, it can safely expire and unblock a retry.
    const createdAtMs = new Date(attempt.created_at).getTime();
    if (attempt.state === "created" && Date.now() - createdAtMs > 120_000) {
      await admin.from("mpesa_payment_attempts").update({
        state: "expired",
        provider_result_desc: "Local payment request expired before M-Pesa submission.",
        processing_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "created");
      const refreshed = await selectAttempt();
      if (refreshed.data) attempt = refreshed.data;
    }

    // 'submitting' is different: the process may have reached Safaricom before
    // dying. Never assume no charge; quarantine it for reconciliation.
    const requestedAtMsForSubmitting = attempt.requested_at ? new Date(attempt.requested_at).getTime() : 0;
    if (attempt.state === "submitting" && requestedAtMsForSubmitting > 0 && Date.now() - requestedAtMsForSubmitting > 120_000) {
      await admin.from("mpesa_payment_attempts").update({
        state: "reconciliation_required",
        processing_error: "submission_state_stale_provider_outcome_unknown",
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id).eq("state", "submitting");
      const refreshed = await selectAttempt();
      if (refreshed.data) attempt = refreshed.data;
    }

    // Replay durable callbacks that arrived before/while the STK identifiers were being attached.
    if (attempt.checkout_request_id && attempt.state !== "settled") {
      const { data: pendingEvents } = await admin.from("mpesa_callback_events")
        .select("id")
        .eq("checkout_request_id", attempt.checkout_request_id)
        .eq("processing_status", "pending")
        .order("received_at", { ascending: true });
      for (const event of pendingEvents ?? []) {
        const { error: replayErr } = await admin.rpc("process_mpesa_callback_event", { p_event_id: event.id });
        if (replayErr) console.error("[mpesa-payment-status] callback replay failed", { eventId: event.id, replayErr });
      }
      const refreshed = await selectAttempt();
      if (refreshed.error) throw refreshed.error;
      if (refreshed.data) attempt = refreshed.data;
    }

    // If the callback is late, ask Daraja for the STK outcome. This can close failed,
    // cancelled or expired attempts; it never mints credits without the receipt-bearing callback.
    const requestedAtMs = attempt.requested_at ? new Date(attempt.requested_at).getTime() : 0;
    const staleAwaiting = attempt.state === "awaiting_customer" && requestedAtMs > 0 && Date.now() - requestedAtMs > 90_000;
    if (staleAwaiting && attempt.checkout_request_id) {
      try {
        const MPESA_CONSUMER_KEY = requiredEnv("MPESA_CONSUMER_KEY");
        const MPESA_CONSUMER_SECRET = requiredEnv("MPESA_CONSUMER_SECRET");
        const MPESA_SHORTCODE = requiredEnv("MPESA_SHORTCODE");
        const MPESA_PASSKEY = requiredEnv("MPESA_PASSKEY");
        const MPESA_ENV = (Deno.env.get("MPESA_ENV") ?? "production").toLowerCase();
        if (!new Set(["sandbox", "production"]).has(MPESA_ENV)) throw new Error("Invalid MPESA_ENV");
        const host = MPESA_ENV === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";

        const oauthResp = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${b64(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`)}` },
        });
        const oauthBody = await oauthResp.json();
        if (oauthResp.ok && oauthBody.access_token) {
          const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
          const password = b64(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);
          const queryResp = await fetch(`${host}/mpesa/stkpushquery/v1/query`, {
            method: "POST",
            headers: { Authorization: `Bearer ${oauthBody.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              BusinessShortCode: MPESA_SHORTCODE,
              Password: password,
              Timestamp: timestamp,
              CheckoutRequestID: attempt.checkout_request_id,
            }),
          });
          const provider = await queryResp.json();
          const providerResult = Number(provider?.ResultCode);
          if (queryResp.ok && Number.isFinite(providerResult)) {
            if (providerResult === 0) {
              await admin.from("mpesa_payment_attempts").update({
                state: "reconciliation_required",
                provider_result_code: 0,
                provider_result_desc: String(provider?.ResultDesc ?? "Provider reports success"),
                provider_response: provider,
                processing_error: "provider_reports_success_without_receipt_callback",
                updated_at: new Date().toISOString(),
              }).eq("id", attempt.id).neq("state", "settled");
            } else {
              const state = providerResult === 1032 ? "cancelled" : (providerResult === 1037 ? "expired" : "failed");
              await admin.from("mpesa_payment_attempts").update({
                state,
                provider_result_code: Math.trunc(providerResult),
                provider_result_desc: String(provider?.ResultDesc ?? "M-Pesa request did not complete"),
                provider_response: provider,
                processing_error: null,
                updated_at: new Date().toISOString(),
              }).eq("id", attempt.id).eq("state", "awaiting_customer");
            }
            const refreshed = await selectAttempt();
            if (refreshed.data) attempt = refreshed.data;
          }
        }
      } catch (providerErr) {
        console.error("[mpesa-payment-status] provider reconciliation query failed", { attemptId, providerErr });
      }
    }

    return json({
      success: true,
      attempt: {
        id: attempt.id,
        state: attempt.state,
        package_name: attempt.package_name,
        credits: attempt.credits,
        amount_kes: attempt.expected_amount_kes,
        checkout_request_id: attempt.checkout_request_id,
        receipt: attempt.state === "settled" ? attempt.mpesa_receipt_number : null,
        result_code: attempt.provider_result_code,
        result_desc: attempt.provider_result_desc,
        requires_reconciliation: attempt.state === "reconciliation_required",
        settled_at: attempt.settled_at,
        updated_at: attempt.updated_at,
      },
    }, 200, headers);
  } catch (e) {
    console.error("[mpesa-payment-status] error", e);
    return json({ success: false, error: "Unable to read payment status." }, 500, headers);
  }
});

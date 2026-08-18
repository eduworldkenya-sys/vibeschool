"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const BG = "#090D16";
const SURFACE = "#111827";
const CARD = "#1a2235";
const ACCENT = "#CCFF00";
const TEXT = "#ffffff";
const MUTED = "rgba(255,255,255,0.58)";
const BORDER = "rgba(255,255,255,0.09)";

type Offer = {
  id: string;
  offer_key: string;
  pricing_model: string;
  amount_kes: number | null;
  access_days: number | null;
  terms_version: string | null;
};

type Beneficiary = {
  kind: "self" | "student";
  student_id: string | null;
  label: string;
};

type PurchaseContext = {
  ok: boolean;
  saleable: boolean;
  authenticated: boolean;
  already_entitled: boolean;
  product: null | {
    id: string;
    sku: string;
    title: string;
    description: string | null;
    product_type: string;
  };
  offers: Offer[];
  beneficiaries: Beneficiary[];
};

type Publication = {
  id: string;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  cbc_grade: string | null;
  cbc_subject: string | null;
};

type PaymentState =
  | "idle"
  | "starting"
  | "awaiting_customer"
  | "settled"
  | "failed"
  | "cancelled"
  | "expired"
  | "reconciliation_required";

function money(amount: number | null): string {
  if (amount === null) return "—";
  return `KES ${amount.toLocaleString("en-KE")}`;
}

function newIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function paymentMessage(state: PaymentState): string {
  switch (state) {
    case "starting":
      return "Preparing your secure M-Pesa request…";
    case "awaiting_customer":
      return "Check your phone and enter your M-Pesa PIN.";
    case "settled":
      return "Payment confirmed. Unlocking your learning product…";
    case "cancelled":
      return "The M-Pesa request was cancelled.";
    case "expired":
      return "The M-Pesa request expired before completion.";
    case "reconciliation_required":
      return "The provider state is uncertain. Do not pay again until this payment is reconciled.";
    case "failed":
      return "The payment did not complete.";
    default:
      return "";
  }
}

export default function LearningProductPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const publicationId = typeof params.publicationId === "string" ? params.publicationId : "";
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [publication, setPublication] = useState<Publication | null>(null);
  const [context, setContext] = useState<PurchaseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [beneficiary, setBeneficiary] = useState("self");
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const loadContext = useCallback(async () => {
    if (!publicationId) return;
    setLoading(true);
    setError("");

    const [publicationResult, contextResult] = await Promise.all([
      supabase
        .from("vibe_publications")
        .select("id,title,description,cover_url,cbc_grade,cbc_subject")
        .eq("id", publicationId)
        .eq("status", "published")
        .maybeSingle(),
      supabase.rpc("commerce_get_publication_purchase_context", {
        p_publication_id: publicationId,
      }),
    ]);

    if (publicationResult.error || !publicationResult.data) {
      setError("This publication is not currently available.");
      setLoading(false);
      return;
    }
    if (contextResult.error || !contextResult.data) {
      console.error("Purchase context failed", contextResult.error);
      setError("Checkout is not available for this publication yet.");
      setLoading(false);
      return;
    }

    const next = contextResult.data as PurchaseContext;
    setPublication(publicationResult.data as Publication);
    setContext(next);
    const oneTime = next.offers.find(item => item.pricing_model === "one_time");
    setSelectedOfferId(current => current || oneTime?.id || next.offers[0]?.id || "");
    const allowed = next.beneficiaries.some(item => item.kind === "self");
    if (!allowed && next.beneficiaries[0]) {
      setBeneficiary(next.beneficiaries[0].student_id ?? "self");
    }
    setLoading(false);
  }, [publicationId, supabase]);

  useEffect(() => {
    void loadContext();
    return stopPolling;
  }, [loadContext, stopPolling]);

  const selectedOffer = context?.offers.find(item => item.id === selectedOfferId) ?? null;
  const selectedBeneficiaryStudentId = beneficiary === "self" ? null : beneficiary;

  const beginPolling = useCallback((id: string) => {
    stopPolling();
    pollTimer.current = setInterval(async () => {
      const { data, error: readError } = await supabase
        .from("commerce_payment_attempts")
        .select("state")
        .eq("id", id)
        .maybeSingle();
      if (readError || !data) return;

      const state = String(data.state) as PaymentState;
      if (state === "submitting" || state === "created") return;
      setPaymentState(state);

      if (["settled", "failed", "cancelled", "expired", "reconciliation_required"].includes(state)) {
        stopPolling();
      }
      if (state === "settled") {
        await loadContext();
        window.setTimeout(() => router.replace(`/read/textbook/${publicationId}`), 650);
      }
    }, 1800);
  }, [loadContext, publicationId, router, stopPolling, supabase]);

  async function startPayment() {
    if (!selectedOffer || paymentState === "starting" || paymentState === "awaiting_customer") return;
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in first so the purchase can be attached to the correct learner account.");
      return;
    }
    if (!phone.trim()) {
      setError("Enter the Safaricom number that should receive the M-Pesa request.");
      return;
    }

    setPaymentState("starting");
    const { data, error: invokeError } = await supabase.functions.invoke("learning-product-stk-push", {
      body: {
        offer_id: selectedOffer.id,
        phone,
        idempotency_key: idempotencyKey,
        beneficiary_student_id: selectedBeneficiaryStudentId,
      },
    });

    if (invokeError || !data?.success) {
      console.error("Learning product checkout failed", invokeError ?? data);
      const returnedState = String(data?.state ?? "failed") as PaymentState;
      setPaymentState(returnedState === "created" ? "failed" : returnedState);
      setAttemptId(data?.attempt_id ?? null);
      setError(data?.error ?? "M-Pesa checkout could not be started.");
      return;
    }

    const id = String(data.attempt_id ?? "");
    setAttemptId(id || null);
    const state = String(data.state ?? "awaiting_customer") as PaymentState;
    setPaymentState(state === "submitting" ? "awaiting_customer" : state);
    if (id && state !== "settled") beginPolling(id);
    if (state === "settled" || data.fulfilled) {
      await loadContext();
      router.replace(`/read/textbook/${publicationId}`);
    }
  }

  function resetForRetry() {
    stopPolling();
    setAttemptId(null);
    setPaymentState("idle");
    setError("");
    setIdempotencyKey(newIdempotencyKey());
  }

  if (loading) {
    return <main style={{ minHeight: "100dvh", background: BG, color: TEXT, display: "grid", placeItems: "center", padding: 24 }}>Preparing checkout…</main>;
  }

  if (!publication || !context) {
    return (
      <main style={{ minHeight: "100dvh", background: BG, color: TEXT, padding: 24 }}>
        <div style={{ maxWidth: 520, margin: "70px auto", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>Checkout unavailable</h1>
          <p style={{ color: MUTED }}>{error || "This learning product cannot be purchased right now."}</p>
          <button onClick={() => router.back()} style={{ border: 0, borderRadius: 12, padding: "12px 18px", background: ACCENT, color: BG, fontWeight: 850 }}>Go back</button>
        </div>
      </main>
    );
  }

  if (context.already_entitled) {
    return (
      <main style={{ minHeight: "100dvh", background: BG, color: TEXT, padding: 24 }}>
        <div style={{ maxWidth: 520, margin: "54px auto", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 24 }}>
          <div style={{ color: ACCENT, fontWeight: 900, fontSize: 12, letterSpacing: ".08em" }}>ALREADY UNLOCKED</div>
          <h1 style={{ marginBottom: 8 }}>{publication.title}</h1>
          <p style={{ color: MUTED }}>Your account already has access to this Learning Product.</p>
          <button onClick={() => router.replace(`/read/textbook/${publicationId}`)} style={{ width: "100%", border: 0, borderRadius: 12, padding: 14, background: ACCENT, color: BG, fontWeight: 900 }}>Open in VibeLearn</button>
        </div>
      </main>
    );
  }

  const activePayment = paymentState === "starting" || paymentState === "awaiting_customer";
  const retryable = ["failed", "cancelled", "expired"].includes(paymentState);

  return (
    <main style={{ minHeight: "100dvh", background: BG, color: TEXT, padding: "22px 16px 48px", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={() => router.back()} style={{ background: "transparent", color: MUTED, border: 0, padding: "8px 0", fontWeight: 750, cursor: "pointer" }}>← Back</button>

        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden", marginTop: 10 }}>
          {publication.cover_url && <img src={publication.cover_url} alt="" style={{ width: "100%", height: 180, objectFit: "cover" }} />}
          <div style={{ padding: 20 }}>
            <div style={{ color: ACCENT, fontSize: 11, fontWeight: 900, letterSpacing: ".1em" }}>VIBE LEARNING PRODUCT</div>
            <h1 style={{ fontSize: 23, lineHeight: 1.25, margin: "8px 0 6px" }}>{context.product?.title || publication.title || "Learning Product"}</h1>
            <div style={{ color: MUTED, fontSize: 12, marginBottom: 14 }}>
              {[publication.cbc_grade, publication.cbc_subject].filter(Boolean).join(" · ")}
            </div>
            {(context.product?.description || publication.description) && <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6 }}>{context.product?.description || publication.description}</p>}

            {!context.saleable ? (
              <div style={{ marginTop: 18, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, color: MUTED }}>
                This Learning Product is not currently on sale.
              </div>
            ) : !context.authenticated ? (
              <div style={{ marginTop: 18 }}>
                <p style={{ color: MUTED, lineHeight: 1.55 }}>Sign in first. This makes sure the entitlement is attached to the correct learner or family account.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button onClick={() => router.push("/login/parent")} style={{ border: 0, borderRadius: 12, padding: 13, background: ACCENT, color: BG, fontWeight: 900 }}>Parent sign in</button>
                  <button onClick={() => router.push("/login/student")} style={{ borderRadius: 12, padding: 13, background: CARD, color: TEXT, border: `1px solid ${BORDER}`, fontWeight: 850 }}>Learner sign in</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                {context.offers.length > 1 && (
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
                    Access option
                    <select value={selectedOfferId} onChange={event => setSelectedOfferId(event.target.value)} disabled={activePayment} style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 11, padding: 12 }}>
                      {context.offers.map(offer => <option key={offer.id} value={offer.id}>{offer.pricing_model.replace(/_/g, " ")} · {money(offer.amount_kes)}</option>)}
                    </select>
                  </label>
                )}

                {selectedOffer && (
                  <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, background: CARD, border: `1px solid ${BORDER}` }}>
                    <div>
                      <div style={{ color: MUTED, fontSize: 11 }}>One-time unlock</div>
                      <div style={{ fontSize: 25, fontWeight: 950, marginTop: 2 }}>{money(selectedOffer.amount_kes)}</div>
                    </div>
                    <div style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>{selectedOffer.access_days ? `${selectedOffer.access_days} days access` : "No expiry"}</div>
                  </div>
                )}

                {context.beneficiaries.length > 1 && (
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
                    Unlock for
                    <select value={beneficiary} onChange={event => setBeneficiary(event.target.value)} disabled={activePayment} style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 11, padding: 12 }}>
                      {context.beneficiaries.map(item => <option key={`${item.kind}-${item.student_id ?? "self"}`} value={item.student_id ?? "self"}>{item.label}</option>)}
                    </select>
                  </label>
                )}

                <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
                  Safaricom number
                  <input inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} disabled={activePayment} placeholder="07XXXXXXXX" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 11, padding: "13px 12px", fontSize: 16 }} />
                </label>

                {(paymentState !== "idle" || error) && (
                  <div role={error ? "alert" : "status"} style={{ borderRadius: 14, padding: 14, background: paymentState === "settled" ? "rgba(204,255,0,.08)" : CARD, border: `1px solid ${paymentState === "reconciliation_required" ? "rgba(255,170,80,.45)" : BORDER}` }}>
                    <div style={{ fontWeight: 850 }}>{paymentMessage(paymentState) || error}</div>
                    {error && paymentMessage(paymentState) !== error && <div style={{ color: MUTED, fontSize: 12, marginTop: 5 }}>{error}</div>}
                    {attemptId && <div style={{ color: MUTED, fontSize: 10, marginTop: 7 }}>Payment reference: {attemptId.slice(0, 8)}</div>}
                  </div>
                )}

                {retryable ? (
                  <button onClick={resetForRetry} style={{ width: "100%", border: 0, borderRadius: 13, padding: 14, background: ACCENT, color: BG, fontWeight: 950 }}>Try a new M-Pesa request</button>
                ) : (
                  <button disabled={!selectedOffer || activePayment || paymentState === "reconciliation_required" || paymentState === "settled"} onClick={() => void startPayment()} style={{ width: "100%", border: 0, borderRadius: 13, padding: 14, background: activePayment ? "rgba(204,255,0,.3)" : ACCENT, color: BG, fontWeight: 950, cursor: activePayment ? "wait" : "pointer", opacity: paymentState === "reconciliation_required" ? .5 : 1 }}>
                    {activePayment ? "Waiting for M-Pesa…" : `Pay ${money(selectedOffer?.amount_kes ?? null)} with M-Pesa`}
                  </button>
                )}

                <p style={{ margin: 0, color: MUTED, fontSize: 11, lineHeight: 1.55, textAlign: "center" }}>
                  Access is granted only after VibeSchool receives and verifies the provider settlement callback. A successful STK screen alone never unlocks content.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

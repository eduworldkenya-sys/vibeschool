"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, SUPABASE_URL } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

interface Package {
  id: string;
  name: string;
  price_kes: number;
  credits: number;
  is_active: boolean;
}

interface Transaction {
  type: string;
  feature: string;
  amount: number;
  balance_after: number;
  mpesa_ref: string | null;
  notes: string | null;
  created_at: string;
}

interface Wallet {
  balance: number;
  total_earned: number;
  total_spent: number;
  recent_transactions: Transaction[];
}

interface PaymentStatus {
  id: string;
  state: "created" | "submitting" | "awaiting_customer" | "settled" | "failed" | "cancelled" | "expired" | "reconciliation_required";
  credits: number;
  amount_kes: number;
  receipt: string | null;
  result_desc: string | null;
  requires_reconciliation: boolean;
}

function parseWallet(value: unknown): Wallet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.success !== true || typeof row.balance !== "number" || typeof row.total_earned !== "number" || typeof row.total_spent !== "number") return null;

  const recent = Array.isArray(row.recent_transactions) ? row.recent_transactions : [];
  const recentTransactions: Transaction[] = recent
    .filter(item => item && typeof item === "object" && !Array.isArray(item))
    .map(item => {
      const tx = item as Record<string, unknown>;
      return {
        type: typeof tx.type === "string" ? tx.type : "",
        feature: typeof tx.feature === "string" ? tx.feature : "",
        amount: typeof tx.amount === "number" ? tx.amount : 0,
        balance_after: typeof tx.balance_after === "number" ? tx.balance_after : 0,
        mpesa_ref: typeof tx.mpesa_ref === "string" ? tx.mpesa_ref : null,
        notes: typeof tx.notes === "string" ? tx.notes : null,
        created_at: typeof tx.created_at === "string" ? tx.created_at : new Date(0).toISOString(),
      };
    });

  return {
    balance: row.balance,
    total_earned: row.total_earned,
    total_spent: row.total_spent,
    recent_transactions: recentTransactions,
  };
}

const DAILY_COST: Record<string, string> = {
  "Vibe Starter": "",
  "Vibe Weekly": "≈ KES 11/day",
  "Vibe Monthly": "≈ KES 8/day",
  "Vibe Term": "≈ KES 6/day",
  "Vibe Annual": "≈ KES 4/day",
};
const BADGE: Record<string, string> = {
  "Vibe Term": "⭐ Most Popular",
  "Vibe Annual": "Best Value",
};
const OUTCOME: Record<string, string> = {
  "Vibe Starter": "Try more AI features",
  "Vibe Weekly": "Cover this week's teaching",
  "Vibe Monthly": "Relax — sorted for the month",
  "Vibe Term": "Own the entire term",
  "Vibe Annual": "I am a professional teacher",
};

function fmt(ts: string) {
  return new Date(ts).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function MpesaModal({ pkg, onClose, onSuccess }: { pkg: Package; onClose: () => void; onSuccess: (credits: number) => void }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const aliveRef = useRef(true);
  const idempotencyKeyRef = useRef("");

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  function newIdempotencyKey() {
    const key = crypto.randomUUID().replace(/-/g, "");
    idempotencyKeyRef.current = key;
    return key;
  }

  async function getPaymentStatus(attemptId: string, token: string): Promise<PaymentStatus | null> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/mpesa-payment-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ attempt_id: attemptId }),
    });
    const body = await response.json();
    if (!response.ok || !body?.success || !body?.attempt) return null;
    return body.attempt as PaymentStatus;
  }

  async function waitForSettlement(attemptId: string, token: string) {
    // A timeout is never payment success. Poll the exact attempt, not global wallet balance.
    for (let attempt = 0; attempt < 30 && aliveRef.current; attempt++) {
      const payment = await getPaymentStatus(attemptId, token).catch(() => null);
      if (!aliveRef.current) return;

      if (payment?.state === "settled") {
        setLoading(false);
        setStatusText("");
        onSuccess(payment.credits);
        return;
      }
      if (payment?.state === "cancelled") {
        setLoading(false);
        setStatusText("");
        setError("M-Pesa payment was cancelled. No credits were added.");
        newIdempotencyKey();
        return;
      }
      if (payment?.state === "failed" || payment?.state === "expired") {
        setLoading(false);
        setStatusText("");
        setError(payment.result_desc || "M-Pesa payment did not complete. No credits were added.");
        newIdempotencyKey();
        return;
      }
      if (payment?.state === "reconciliation_required") {
        setLoading(false);
        setStatusText("");
        setError("This payment needs reconciliation. Do not pay again; no duplicate charge will be requested from this screen.");
        return;
      }

      setStatusText(attempt < 4 ? "Waiting for M-Pesa confirmation…" : "Still checking this payment…");
      await sleep(4000);
    }

    if (aliveRef.current) {
      setLoading(false);
      setStatusText("");
      setError("Payment is still pending. We have not marked it successful. Do not retry while the same M-Pesa request is still active.");
    }
  }

  async function handlePay() {
    const cleaned = phone.replace(/\s/g, "");
    if (!/^(0[17][0-9]{8}|\+254[17][0-9]{8}|254[17][0-9]{8})$/.test(cleaned)) {
      setError("Enter a valid Kenyan Safaricom number e.g. 0712345678");
      return;
    }

    setLoading(true);
    setError("");
    setStatusText("Creating secure payment request…");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expired. Please refresh.");
        setLoading(false);
        setStatusText("");
        return;
      }

      const idempotencyKey = idempotencyKeyRef.current || newIdempotencyKey();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/mpesa-stk-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: cleaned, package_id: pkg.id, idempotency_key: idempotencyKey }),
      });
      const body = await response.json();
      const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id : null;

      if (!response.ok || !body?.success) {
        setLoading(false);
        setStatusText("");
        setError(body?.error ?? "Payment could not be started.");
        if (["failed", "cancelled", "expired"].includes(String(body?.state ?? ""))) newIdempotencyKey();
        return;
      }
      if (!attemptId) {
        setLoading(false);
        setStatusText("");
        setError("Payment tracking was not created. No success has been recorded.");
        return;
      }

      if (body.state === "settled") {
        setLoading(false);
        setStatusText("");
        onSuccess(pkg.credits);
        return;
      }

      setStatusText("STK sent. Enter your M-Pesa PIN…");
      await waitForSettlement(attemptId, session.access_token);
    } catch {
      setLoading(false);
      setStatusText("");
      setError("Network error. Payment has not been marked successful. Check the same attempt before retrying.");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 480 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb", margin: "0 auto 20px" }} />
        <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 4px" }}>Paying for</p>
        <p style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary, margin: "0 0 4px" }}>{pkg.name}</p>
        <p style={{ fontSize: 14, color: C.accent, fontWeight: 700, margin: "0 0 24px" }}>KES {pkg.price_kes} · {pkg.credits} Vibe Credits</p>

        <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" }}>M-Pesa Number</label>
        <input
          type="tel"
          placeholder="0712 345 678"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          disabled={loading}
          style={{ display: "block", width: "100%", marginTop: 8, marginBottom: 8, padding: "14px 16px", borderRadius: 12, fontSize: 16, border: `1.5px solid ${error ? C.error : C.border}`, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
        />
        {statusText && <p style={{ fontSize: 12, color: C.accent, margin: "0 0 12px", fontWeight: 700 }}>{statusText}</p>}
        {error && <p style={{ fontSize: 12, color: C.error, margin: "0 0 12px" }}>{error}</p>}
        <p style={{ fontSize: 11, color: C.textMuted, margin: "0 0 20px" }}>Credits are added only after VibeSchool verifies this exact M-Pesa payment.</p>

        <button onClick={handlePay} disabled={loading} style={{ width: "100%", padding: "15px", borderRadius: 14, background: loading ? "#9ca3af" : C.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {loading ? "Checking payment…" : `Pay KES ${pkg.price_kes}`}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: "13px", borderRadius: 14, marginTop: 10, background: "none", color: C.textMuted, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          {loading ? "Close and check later" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Package | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const [walletRes, pkgRes] = await Promise.all([
      supabase.rpc("get_credit_balance", { p_teacher_id: user.id }),
      supabase.from("vibe_credit_packages").select("*").eq("is_active", true).order("price_kes"),
    ]);

    const decodedWallet = parseWallet(walletRes.data);
    if (decodedWallet) setWallet(decodedWallet);

    setPackages((pkgRes.data ?? [])
      .filter(row => row.name !== null && row.price_kes !== null && row.credits !== null && String(row.name).startsWith("Vibe "))
      .map(row => ({
        id: row.id,
        name: row.name as string,
        price_kes: row.price_kes as number,
        credits: row.credits as number,
        is_active: row.is_active ?? false,
      })));
    setLoading(false);
  }, [router]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleSuccess(credits: number) {
    setSelected(null);
    showToast(`${credits} Vibe Credits added to your wallet.`);
    await fetchData();
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ padding: "20px 20px 120px", maxWidth: 480, margin: "0 auto", fontFamily: "inherit" }}>
      <div style={{ background: C.dark, borderRadius: 20, padding: "24px 24px 20px", marginBottom: 28, color: "#fff" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 4px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>Vibe Wallet</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 0 16px" }}>
          <span style={{ fontSize: 48, fontWeight: 900, lineHeight: 1 }}>{wallet?.balance ?? 0}</span>
          <span style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>credits</span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div><p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "0 0 2px", textTransform: "uppercase" }}>Earned</p><p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{wallet?.total_earned ?? 0}</p></div>
          <div><p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "0 0 2px", textTransform: "uppercase" }}>Spent</p><p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{wallet?.total_spent ?? 0}</p></div>
          <div><p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "0 0 2px", textTransform: "uppercase" }}>Never Expire</p><p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: C.accent }}>✓</p></div>
        </div>
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 14px" }}>Top Up Credits</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
        {packages.length === 0 && <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No packages available right now.</p>}
        {packages.map(pkg => (
          <div key={pkg.id} onClick={() => setSelected(pkg)} style={{ background: "#fff", borderRadius: 16, padding: "16px 18px", border: `1.5px solid ${pkg.name === "Vibe Term" ? C.accent : C.border}`, cursor: "pointer", position: "relative", boxShadow: pkg.name === "Vibe Term" ? "0 4px 20px rgba(16,185,129,0.15)" : "0 1px 4px rgba(0,0,0,0.06)" }}>
            {BADGE[pkg.name] && <span style={{ position: "absolute", top: -10, right: 16, background: C.accent, color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{BADGE[pkg.name]}</span>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: "0 0 3px" }}>{pkg.name}</p>
                <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 8px" }}>{OUTCOME[pkg.name]}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "rgba(16,185,129,0.08)", color: C.accent, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>🪙 {pkg.credits} credits</span>
                  {DAILY_COST[pkg.name] && <span style={{ fontSize: 11, color: C.textMuted }}>{DAILY_COST[pkg.name]}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: C.textPrimary, margin: "0 0 2px" }}>KES {pkg.price_kes}</p>
                <p style={{ fontSize: 10, color: C.accent, fontWeight: 700, margin: 0 }}>Pay via M-Pesa</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {wallet?.recent_transactions && wallet.recent_transactions.length > 0 && (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 14px" }}>Recent Transactions</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wallet.recent_transactions.map((tx, i) => (
              <div key={`${tx.created_at}-${i}`} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: "0 0 2px", textTransform: "capitalize" }}>{tx.type === "spend" ? `Used · ${tx.feature?.replace(/_/g, " ")}` : tx.notes ?? tx.type}</p>
                  <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{fmt(tx.created_at)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 15, fontWeight: 800, margin: "0 0 2px", color: tx.amount > 0 ? C.accent : C.error }}>{tx.amount > 0 ? "+" : ""}{tx.amount}</p>
                  <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>bal: {tx.balance_after}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selected && <MpesaModal pkg={selected} onClose={() => setSelected(null)} onSuccess={handleSuccess} />}

      {toast && <div style={{ position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "11px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>{toast}</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

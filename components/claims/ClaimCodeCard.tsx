"use client";

import { useState } from "react";

type ClaimCodeCardProps = {
  studentName: string;
  code: string | null;
  expiresAt?: string | null;
  loading?: boolean;
  onGenerate: () => Promise<void>;
  onRegenerate?: () => Promise<void>;
};

export function ClaimCodeCard({ studentName, code, expiresAt, loading = false, onGenerate, onRegenerate }: ClaimCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const busy = loading || working;
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const expired = Boolean(expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() <= Date.now());

  async function copyCode() {
    if (!code || busy || expired) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareCode() {
    if (!code || busy || expired) return;
    const text = `Connect ${studentName} on VibeSchool with claim code ${code}. The same code can be used by the parent or learner.`;
    if (navigator.share) {
      try { await navigator.share({ title: "VibeSchool claim code", text }); } catch { /* cancelled */ }
      return;
    }
    await copyCode();
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setWorking(true);
    try { await action(); } finally { setWorking(false); setConfirming(false); }
  }

  const expiryLabel = expiry && Number.isFinite(expiry.getTime())
    ? `${expired ? "Expired" : "Expires"} ${expiry.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}`
    : "Active until regenerated or expired";

  return (
    <section aria-label="Claim code" style={{ borderRadius: 20, overflow: "hidden", border: "1px solid #dfe7e3", background: "#fff", boxShadow: "0 8px 28px rgba(15,23,42,.06)" }}>
      <div style={{ padding: "18px 18px 14px", background: expired ? "linear-gradient(135deg,#374151 0%,#1f2937 100%)" : "linear-gradient(135deg,#111827 0%,#1e1b4b 72%,#064e3b 100%)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 1.4, textTransform: "uppercase", opacity: .65 }}>Account connection</div>
            <h2 style={{ margin: "5px 0 4px", fontSize: 18, lineHeight: 1.2 }}>Claim code</h2>
            <p style={{ margin: 0, maxWidth: 430, fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,.72)" }}>{expired ? "This code has expired. Generate a new shared code before sharing it." : `One code can connect ${studentName} to both the parent and learner account. One person claiming it does not use it up for the other.`}</p>
          </div>
          <span style={{ flexShrink: 0, borderRadius: 99, padding: "5px 8px", background: expired ? "rgba(255,255,255,.1)" : "rgba(16,185,129,.16)", color: expired ? "#d1d5db" : "#6ee7b7", fontSize: 9, fontWeight: 850 }}>{expired ? "EXPIRED" : "SHARED"}</span>
        </div>
        <div style={{ marginTop: 16, borderRadius: 16, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", padding: "14px 12px" }}>
          {code ? <>
            <div style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 30, lineHeight: 1, fontWeight: 900, letterSpacing: 6, textAlign: "center", opacity: expired ? .55 : 1 }} aria-label={`Claim code ${code}${expired ? ", expired" : ""}`}>{code}</div>
            <div style={{ marginTop: 8, textAlign: "center", fontSize: 9, color: expired ? "#fca5a5" : "rgba(255,255,255,.55)", fontWeight: expired ? 800 : 500 }}>{expiryLabel}</div>
          </> : <div style={{ textAlign: "center", padding: "7px 0", fontSize: 12, color: "rgba(255,255,255,.68)" }}>No claim code yet</div>}
        </div>
      </div>
      <div style={{ padding: 12 }}>
        {code && !expired ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button type="button" onClick={() => void copyCode()} disabled={busy} style={{ minHeight: 42, borderRadius: 11, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 800, fontSize: 11, cursor: busy ? "wait" : "pointer" }}>{copied ? "Copied ✓" : "Copy code"}</button>
          <button type="button" onClick={() => void shareCode()} disabled={busy} style={{ minHeight: 42, borderRadius: 11, border: "none", background: "#10b981", color: "#fff", fontWeight: 850, fontSize: 11, cursor: busy ? "wait" : "pointer" }}>Share code</button>
        </div> : code && expired && onRegenerate ? <button type="button" onClick={() => void run(onRegenerate)} disabled={busy} style={{ width: "100%", minHeight: 44, borderRadius: 11, border: "none", background: busy ? "#9ca3af" : "#10b981", color: "#fff", fontWeight: 850, fontSize: 12, cursor: busy ? "wait" : "pointer" }}>{busy ? "Creating new code…" : "Generate new claim code"}</button> : !code ? <button type="button" onClick={() => void run(onGenerate)} disabled={busy} style={{ width: "100%", minHeight: 44, borderRadius: 11, border: "none", background: busy ? "#9ca3af" : "#111827", color: "#fff", fontWeight: 850, fontSize: 12, cursor: busy ? "wait" : "pointer" }}>{busy ? "Creating code…" : "Generate claim code"}</button> : null}
        {code && !expired && onRegenerate && <div style={{ marginTop: 10 }}>
          {!confirming ? <button type="button" onClick={() => setConfirming(true)} disabled={busy} style={{ width: "100%", minHeight: 36, borderRadius: 10, border: "none", background: "transparent", color: "#6b7280", fontWeight: 750, fontSize: 10, cursor: busy ? "wait" : "pointer" }}>Regenerate claim code</button> : <div style={{ borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", padding: 10 }}><p style={{ margin: "0 0 8px", fontSize: 10, lineHeight: 1.45, color: "#9a3412" }}><strong>Replace this code?</strong> The previous code will stop working for future claims.</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}><button type="button" onClick={() => setConfirming(false)} disabled={busy} style={{ minHeight: 34, borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", fontSize: 10, fontWeight: 800 }}>Keep it</button><button type="button" onClick={() => void run(onRegenerate)} disabled={busy} style={{ minHeight: 34, borderRadius: 9, border: "none", background: "#f97316", color: "#fff", fontSize: 10, fontWeight: 850 }}>{busy ? "Replacing…" : "Replace code"}</button></div></div>}
        </div>}
      </div>
    </section>
  );
}

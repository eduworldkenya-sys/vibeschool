"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LinkChildPage() {
  const router = useRouter();
  const [claimCode, setClaimCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleLink() {
    setError(""); setSuccess("");
    if (claimCode.length !== 6) { setError("Enter the 6-character code from your child's teacher."); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data: result, error: rpcErr } = await supabase.rpc("redeem_parent_claim", { p_code: claimCode, p_user_id: user.id });
      if (rpcErr) { setError("We couldn't connect your child. Please try again."); return; }
      switch (result) {
        case "success": setSuccess("Child connected. Opening your family dashboard…"); setTimeout(() => router.push("/parent"), 1000); break;
        case "not_found": setError("That code isn't valid. Check it with the teacher and try again."); break;
        case "already_claimed": setError("A parent account is already connected with this code. Ask the teacher for a new code if you need to connect another parent account."); break;
        case "expired": setError("That claim code has expired. Ask the teacher to generate a new shared code."); break;
        case "student_not_found": setError("We couldn't find the learner record. Please contact the school."); break;
        default: setError("We couldn't complete the connection. Please try again.");
      }
    } catch { setError("We couldn't reach VibeSchool. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  const ready = claimCode.length === 6;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f7faf9 0%,#eef2f7 100%)", display: "grid", placeItems: "center", padding: 20 }}>
      <section style={{ width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 24, boxShadow: "0 14px 45px rgba(15,23,42,.08)" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: "#ecfdf5", fontSize: 25, marginBottom: 16 }}>👨‍👩‍👧</div>
        <div style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: 850, color: "#059669", textTransform: "uppercase" }}>Family connection</div>
        <h1 style={{ margin: "5px 0 7px", fontSize: 25, lineHeight: 1.15, color: "#111827" }}>Connect your child</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 12, lineHeight: 1.55 }}>Use the shared 6-character code from your child's teacher. You and your child can use the same code independently.</p>
        <div style={{ marginTop: 18, borderRadius: 16, border: "1px solid #d1fae5", background: "#f0fdf4", padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 850, color: "#065f46", marginBottom: 9 }}>How it works</div>
          <div style={{ display: "grid", gap: 9 }}>
            {["Get the shared code from the class teacher.", "Enter it below to connect your child to your parent account.", "Keep the code private and share it only with the child's parent or learner."].map((text, i) => <div key={text} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><span style={{ width: 20, height: 20, borderRadius: "50%", background: "#d1fae5", color: "#047857", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 900, flexShrink: 0 }}>{i + 1}</span><span style={{ color: "#065f46", fontSize: 10, lineHeight: 1.45 }}>{text}</span></div>)}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="parent-claim-code" style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>Claim code</label>
          <input id="parent-claim-code" autoFocus inputMode="text" autoComplete="one-time-code" type="text" value={claimCode} onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} onKeyDown={e => { if (e.key === "Enter" && ready) void handleLink(); }} placeholder="A1B2C3" maxLength={6} disabled={loading} style={{ width: "100%", boxSizing: "border-box", padding: "15px 12px", borderRadius: 13, border: `1.5px solid ${error ? "#fca5a5" : "#d1d5db"}`, background: "#fff", fontSize: 24, fontWeight: 900, letterSpacing: 6, textAlign: "center", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", outline: "none" }} />
          <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9ca3af" }}><span>Letters and numbers only</span><span>{claimCode.length}/6</span></div>
        </div>
        {error && <div role="alert" style={{ marginTop: 12, borderRadius: 13, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, fontSize: 11, lineHeight: 1.5, fontWeight: 650 }}>{error}</div>}
        {success && <div role="status" style={{ marginTop: 12, borderRadius: 13, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", padding: 12, fontSize: 11, lineHeight: 1.5, fontWeight: 750 }}>{success}</div>}
        <button type="button" onClick={() => void handleLink()} disabled={!ready || loading} style={{ width: "100%", marginTop: 12, minHeight: 48, borderRadius: 13, border: "none", background: !ready || loading ? "#d1d5db" : "#10b981", color: "#fff", fontWeight: 850, fontSize: 13, cursor: !ready || loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{loading ? "Connecting…" : "Connect my child"}</button>
        <button type="button" onClick={() => router.push("/parent")} style={{ width: "100%", marginTop: 8, minHeight: 42, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontWeight: 750, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>I'll do this later</button>
      </section>
    </main>
  );
}

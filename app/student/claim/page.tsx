"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StudentClaimResult = { status?: string };

export default function StudentClaimPage() {
  const router = useRouter();
  const [claimCode, setClaimCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleClaim() {
    setError(""); setSuccess("");
    if (claimCode.length !== 6) { setError("Enter the 6-character code from your teacher."); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/?role=student"); return; }
      const { data: result, error: rpcErr } = await supabase.rpc("redeem_student_claim", { p_code: claimCode, p_user_id: user.id });
      if (rpcErr) { setError("We couldn't connect your account. Please try again."); return; }
      switch ((result as StudentClaimResult | null)?.status) {
        case "success": setSuccess("You're all set! Opening your dashboard…"); setTimeout(() => router.push("/student"), 1000); break;
        case "below_grade_requires_parent_opt_in": setError("Ask your parent to enable student access first. Once they do, enter this code again."); break;
        case "not_found": setError("That code isn't valid. Check it with your teacher."); break;
        case "already_claimed": setError("This code has already been used for this account. If you need help, ask your teacher."); break;
        case "expired": setError("This code has expired. Ask your teacher for a new one."); break;
        case "student_not_found": setError("We couldn't find your learner record. Please ask your teacher for help."); break;
        default: setError("We couldn't complete the connection. Please try again.");
      }
    } catch { setError("We couldn't reach VibeSchool. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  const ready = claimCode.length === 6;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f7f8fb 0%,#eef2f7 100%)", display: "grid", placeItems: "center", padding: 20 }}>
      <section style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 24, boxShadow: "0 14px 45px rgba(15,23,42,.08)" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: "#eef2ff", fontSize: 25, marginBottom: 16 }}>🎒</div>
        <div style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: 850, color: "#6366f1", textTransform: "uppercase" }}>Student account</div>
        <h1 style={{ margin: "5px 0 7px", fontSize: 25, lineHeight: 1.15, color: "#111827" }}>Enter your claim code</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 12, lineHeight: 1.55 }}>Your teacher gives you a 6-character code. The same code can also connect your parent.</p>
        <div style={{ marginTop: 20, padding: 14, borderRadius: 16, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
          <label htmlFor="student-claim-code" style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>Claim code</label>
          <input id="student-claim-code" autoFocus inputMode="text" autoComplete="one-time-code" type="text" value={claimCode} onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} onKeyDown={e => { if (e.key === "Enter" && ready) void handleClaim(); }} placeholder="A1B2C3" maxLength={6} disabled={loading} aria-describedby="claim-help" style={{ width: "100%", boxSizing: "border-box", padding: "15px 12px", borderRadius: 13, border: `1.5px solid ${error ? "#fca5a5" : "#d1d5db"}`, background: "#fff", fontSize: 24, fontWeight: 900, letterSpacing: 6, textAlign: "center", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", outline: "none" }} />
          <div id="claim-help" style={{ marginTop: 7, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9ca3af" }}><span>Letters and numbers only</span><span>{claimCode.length}/6</span></div>
        </div>
        {error && <div role="alert" style={{ marginTop: 12, borderRadius: 13, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, fontSize: 11, lineHeight: 1.5, fontWeight: 650 }}>{error}</div>}
        {success && <div role="status" style={{ marginTop: 12, borderRadius: 13, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", padding: 12, fontSize: 11, lineHeight: 1.5, fontWeight: 750 }}>{success}</div>}
        <button type="button" onClick={() => void handleClaim()} disabled={!ready || loading} style={{ width: "100%", marginTop: 12, minHeight: 48, borderRadius: 13, border: "none", background: !ready || loading ? "#d1d5db" : "#6366f1", color: "#fff", fontWeight: 850, fontSize: 13, cursor: !ready || loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{loading ? "Connecting…" : "Activate my account"}</button>
        <p style={{ margin: "14px 0 0", textAlign: "center", color: "#9ca3af", fontSize: 9, lineHeight: 1.5 }}>If your parent needs to enable access first, VibeSchool will tell you exactly what to do.</p>
      </section>
    </main>
  );
}

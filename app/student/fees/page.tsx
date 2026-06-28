"use client";
export const dynamic = "force-dynamic";

export default function FeesPage() {
  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>School Fees</h1>
        <p style={{ fontSize: 12, color: "var(--vs-muted)", marginTop: 2 }}>Your fee balance and payment history</p>
      </div>
      <div style={{ background: "var(--vs-card)", border: "1px dashed var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vs-text)", marginBottom: 8 }}>Coming Soon</div>
        <div style={{ fontSize: 13, color: "var(--vs-muted)", lineHeight: 1.6 }}>
          Fee balance, payment history and M-Pesa payments will be available here.
        </div>
      </div>
    </div>
  );
}

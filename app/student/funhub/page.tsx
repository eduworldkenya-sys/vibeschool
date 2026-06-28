"use client";
export const dynamic = "force-dynamic";

export default function FunHubPage() {
  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>FunHub</h1>
        <p style={{ fontSize: 12, color: "var(--vs-muted)", marginTop: 2 }}>Games, quizzes and challenges</p>
      </div>
      <div style={{ background: "var(--vs-card)", border: "1px dashed var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vs-text)", marginBottom: 8 }}>Coming Soon</div>
        <div style={{ fontSize: 13, color: "var(--vs-muted)", lineHeight: 1.6 }}>
          Quizzes, games and challenges are on the way. Learn while you play.
        </div>
      </div>
    </div>
  );
}

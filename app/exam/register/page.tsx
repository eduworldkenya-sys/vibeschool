"use client"

import { useRouter } from "next/navigation"

export default function ExamRegisterPage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: "100vh", background: "#05050F", color: "#fff", padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#18181b", border: "1px solid #27272a", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
        <div style={{ height: 48, width: 48, background: "rgba(200,168,75,0.1)", border: "1px solid #C8A84B", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
          🎯
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>You are on a Roll!</h2>
          <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.6, margin: 0 }}>
            You have completed 3 exam sessions. Create a free VibeSchool account to save your progress, track your streak, and unlock more subjects.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <button type="button" onClick={() => router.push("/global/signup")} style={{ width: "100%", height: 48, background: "#C8A84B", color: "#05050F", fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 12, border: "none", cursor: "pointer" }}>
            Create Free Account
          </button>
          <button type="button" onClick={() => router.push("/exam")} style={{ width: "100%", height: 48, background: "#09090b", border: "1px solid #27272a", color: "#71717a", fontWeight: 700, fontSize: 14, borderRadius: 12, cursor: "pointer" }}>
            Continue Without Account
          </button>
        </div>
      </div>
    </div>
  )
}

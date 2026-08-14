"use client"

import { useEffect } from "react"

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Teacher workspace render failure", error)
  }, [error])

  return (
    <main style={{ minHeight: "calc(100dvh - 120px)", background: "#f8fafc", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 12px 32px rgba(15,23,42,.08)", textAlign: "center" }}>
        <div style={{ width: 46, height: 46, margin: "0 auto 16px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#fef3c7", color: "#92400e", fontWeight: 900 }}>!</div>
        <h1 style={{ margin: "0 0 8px", color: "#111827", fontSize: 20 }}>This page could not open</h1>
        <p style={{ margin: "0 0 18px", color: "#6b7280", lineHeight: 1.5, fontSize: 14 }}>
          Your teacher session is still protected. Retry the page; if the problem continues, return to Today.
        </p>
        {error.digest && <p style={{ margin: "0 0 18px", color: "#9ca3af", fontSize: 11 }}>Reference: {error.digest}</p>}
        <div style={{ display: "grid", gap: 10 }}>
          <button onClick={reset} style={{ border: 0, borderRadius: 10, padding: "12px 16px", background: "#10b981", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Retry</button>
          <button onClick={() => { window.location.href = "/teacher/pulse" }} style={{ border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 16px", background: "#fff", color: "#374151", fontWeight: 700, cursor: "pointer" }}>Go to Today</button>
        </div>
      </section>
    </main>
  )
}

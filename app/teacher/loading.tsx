export default function TeacherLoading() {
  return (
    <main style={{ minHeight: "calc(100dvh - 120px)", background: "#f8fafc", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, margin: "0 auto 14px", border: "3px solid #e5e7eb", borderTopColor: "#10b981", borderRadius: "50%", animation: "vsRouteSpin .8s linear infinite" }} />
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14, fontWeight: 600 }}>Loading your workspace…</p>
        <style>{`@keyframes vsRouteSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </main>
  )
}

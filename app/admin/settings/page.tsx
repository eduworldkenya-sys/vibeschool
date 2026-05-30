'use client'
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const items = [
    { label: "School Profile", desc: "Name, motto, KNEC code, county, contacts", icon: "🏫", href: "/admin/settings/school" },
    { label: "Finance & Bursar", desc: "Appoint bursar, dual-approval rules", icon: "💰", href: "/admin/settings/finance" },
  ]
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a", marginBottom: "6px" }}>Settings</h1>
      <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Manage your school configuration</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {items.map(item => (
          <button key={item.href} onClick={() => router.push(item.href)}
            style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#ffffff", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: "28px" }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a" }}>{item.label}</div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>{item.desc}</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: "18px" }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

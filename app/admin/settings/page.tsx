"use client"
export const dynamic = "force-dynamic"

import { useRouter } from "next/navigation"

const schoolItems = [
  ["School profile", "Operational school details and protected official identity", "/admin/settings/school"],
  ["Academic terms", "Create and activate the current academic term", "/admin/settings/term"],
  ["Classes & streams", "Canonical classes used by enrollment, timetable and reporting", "/admin/settings/classes"],
  ["Subjects", "Stable subject identities for teaching and assessment", "/admin/settings/subjects"],
  ["Teachers", "School membership and class/subject assignments", "/admin/teachers"],
  ["Timetable", "Current class, teacher, subject and room schedule oversight", "/admin/timetable"],
] as const

export default function AdminSettingsPage() {
  const router = useRouter()
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 18 }}>
      <header><h1 style={{ margin: 0, fontSize: 24 }}>Settings</h1><p style={{ color: "#64748b", margin: "5px 0 0" }}>Personal account, school operations, and platform ownership are deliberately separate authority domains.</p></header>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontSize: 16, margin: "3px 0" }}>Personal account</h2>
        <button onClick={() => router.push("/admin/profile")} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer" }}><strong>My account</strong><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Your name, contact information, session and sign-out. This does not change school authority.</div></button>
        <button onClick={() => router.push("/admin/notifications")} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer" }}><strong>Operational alerts</strong><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Incomplete setup, missing attendance and unresolved school relationships.</div></button>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontSize: 16, margin: "3px 0" }}>School settings</h2>
        {schoolItems.map(([label, desc, href]) => <button key={href} onClick={() => router.push(href)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10 }}><div><strong>{label}</strong><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{desc}</div></div><span style={{ color: "#94a3b8", alignSelf: "center" }}>›</span></button>)}
      </section>

      <section style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 14, padding: 15 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 5px" }}>HQ / platform controls</h2>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: 0 }}>Not available from the School Admin surface. Platform owner, Worker Engine, service-role and HQ controls require separate backend-authoritative ownership and are never granted by school settings.</p>
      </section>
    </main>
  )
}

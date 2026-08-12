import Link from "next/link"

export const dynamic = "force-dynamic"

export default function ContactPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "48px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#4f46e5", fontWeight: 700, textDecoration: "none" }}>
          ← Back to VibeSchool
        </Link>

        <section style={{ background: "white", marginTop: 24, padding: 32, borderRadius: 20, boxShadow: "0 8px 30px rgba(15,23,42,.08)" }}>
          <h1 style={{ margin: 0, fontSize: 32, color: "#111827" }}>Contact VibeSchool</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
            Need help with your account, school setup, teaching tools, student access, or another VibeSchool issue?
            Use the support channels provided by your school or platform administrator and include the affected
            account role, page, and a short description of what happened.
          </p>

          <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
            <div style={{ padding: 18, border: "1px solid #e5e7eb", borderRadius: 14 }}>
              <strong>Account or login problem</strong>
              <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
                Tell support whether you are a teacher, parent, student, or administrator and the exact page where the problem occurs.
              </p>
            </div>
            <div style={{ padding: 18, border: "1px solid #e5e7eb", borderRadius: 14 }}>
              <strong>School or student access</strong>
              <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
                Include the school, class, admission/claim workflow involved, and any error message shown.
              </p>
            </div>
            <div style={{ padding: 18, border: "1px solid #e5e7eb", borderRadius: 14 }}>
              <strong>Privacy or legal request</strong>
              <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
                Review the applicable policies before submitting a privacy or legal request.
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                <Link href="/legal/privacy">Privacy Policy</Link>
                <Link href="/legal/terms">Terms</Link>
                <Link href="/legal/aup">Acceptable Use Policy</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

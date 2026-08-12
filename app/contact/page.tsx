"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function ContactPage() {
  const [category, setCategory] = useState("account")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [ticketId, setTicketId] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault(); setResult(null); setTicketId(null); setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setResult("Please sign in before submitting a support request."); return }
      const { data: caseId, error } = await supabase.rpc("submit_contact_request", { p_category: category, p_subject: subject.trim(), p_message: message.trim() })
      if (error) { setResult(error.message || "We could not submit your request. Please try again."); return }
      setSubject(""); setMessage(""); setTicketId(String(caseId)); setResult("Your support request has been received.")
    } finally { setBusy(false) }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "48px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#4f46e5", fontWeight: 700, textDecoration: "none" }}>← Back to VibeSchool</Link>
        <section style={{ background: "white", marginTop: 24, padding: 32, borderRadius: 20, boxShadow: "0 8px 30px rgba(15,23,42,.08)" }}>
          <h1 style={{ margin: 0, fontSize: 32, color: "#111827" }}>Contact VibeSchool</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.7 }}>Tell us what is wrong. Your authenticated account is attached to the request so support can investigate it without exposing it to other users.</p>
          <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
            <label style={{ color: "#374151", fontWeight: 700 }}>Issue category
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}><option value="account">Account / login</option><option value="school_access">School access</option><option value="student_access">Student access</option><option value="technical">Technical problem</option><option value="privacy">Privacy</option><option value="legal">Legal</option><option value="other">Other</option></select>
            </label>
            <label style={{ color: "#374151", fontWeight: 700 }}>Subject
              <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} minLength={3} required placeholder="e.g. I cannot access my teacher dashboard" style={inputStyle} />
            </label>
            <label style={{ color: "#374151", fontWeight: 700 }}>Describe the problem
              <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={5000} minLength={10} required rows={7} placeholder="Tell us what you expected, what happened, and any error message you saw." style={{ ...inputStyle, resize: "vertical" }} />
            </label>
            {result && <div role="status" style={{ padding: 12, borderRadius: 10, background: "#f3f4f6", color: "#374151" }}>{result}{ticketId && <div style={{ marginTop: 6, fontWeight: 700 }}>Reference: {ticketId}</div>}</div>}
            <button type="submit" disabled={busy} style={{ padding: "13px 18px", border: 0, borderRadius: 10, background: "#111827", color: "white", fontWeight: 700 }}>{busy ? "Submitting…" : "Submit support request"}</button>
          </form>
          <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap" }}><Link href="/legal/privacy">Privacy Policy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/aup">Acceptable Use Policy</Link></div>
        </section>
      </div>
    </main>
  )
}
const inputStyle: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 7, padding: "12px 14px", border: "1px solid #d1d5db", borderRadius: 9, background: "white", color: "#111827", font: "inherit" }

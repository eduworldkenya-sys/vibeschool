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
    e.preventDefault()
    setResult(null); setTicketId(null); setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setResult("Please sign in first. This keeps support requests tied to the right account and protects your information."); return }
      if (subject.trim().length < 3 || message.trim().length < 10) { setResult("Please give us a clear subject and enough detail to understand what happened."); return }
      const { data: caseId, error } = await supabase.rpc("submit_contact_request", { p_category: category, p_subject: subject.trim(), p_message: message.trim() })
      if (error) { setResult("We couldn't send your request right now. Please try again."); return }
      setSubject(""); setMessage(""); setTicketId(String(caseId)); setResult("Received. Your request has been recorded for support follow-up.")
    } finally { setBusy(false) }
  }

  return (
    <main className="contact-page">
      <header className="contact-nav">
        <Link href="/" className="brand">VibeSchool</Link>
        <nav><Link href="/about">About</Link><Link href="/legal/privacy">Privacy</Link></nav>
      </header>
      <section className="contact-hero">
        <div className="eyebrow">WE'RE LISTENING</div>
        <h1>Tell us what you need.</h1>
        <p>Whether something is not working, you are having trouble getting access, or you simply need help understanding what to do next, give us the context. A useful support conversation starts with being heard.</p>
      </section>

      <section className="contact-body">
        <div className="support-card">
          <div className="section-label">SUPPORT REQUEST</div>
          <h2>What can we help you with?</h2>
          <p className="muted">Your request is attached to your signed-in VibeSchool account. Please do not include passwords, payment credentials or other secrets in your message.</p>
          <form onSubmit={submit}>
            <label>Issue category
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}><option value="account">Account / login</option><option value="school_access">School access</option><option value="student_access">Student access</option><option value="technical">Technical problem</option><option value="privacy">Privacy</option><option value="legal">Legal</option><option value="other">Something else</option></select>
            </label>
            <label>Subject
              <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} minLength={3} required placeholder="For example: I cannot access my teacher dashboard" style={inputStyle} />
            </label>
            <label>What happened?
              <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={5000} minLength={10} required rows={7} placeholder="Tell us what you were trying to do, what you expected, what happened, and any error message you saw." style={{ ...inputStyle, resize: "vertical" }} />
            </label>
            <p className="helper">Tip: the page you were on, your role, and the exact error message can help us investigate faster.</p>
            {result && <div role="status" className="result">{result}{ticketId && <div className="reference">Reference: {ticketId}</div>}</div>}
            <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send support request"}</button>
          </form>
        </div>
        <aside className="contact-side">
          <div className="side-card"><span>01</span><h3>Already a VibeSchool user?</h3><p>Sign in before submitting a request so we can connect the issue to the correct account and protect your information.</p><Link href="/">Go to VibeSchool →</Link></div>
          <div className="side-card"><span>02</span><h3>Not sure what to report?</h3><p>That's okay. Explain the situation in your own words. You do not need to know the technical cause.</p></div>
          <div className="side-card"><span>03</span><h3>Privacy matters</h3><p>Only share information needed to understand the issue. Never send your password, one-time code or payment credentials.</p></div>
        </aside>
      </section>

      <section className="contact-trust"><div><div className="section-label">BEHIND THE SCREEN</div><h2>Every support request is about a real person trying to learn, teach or help someone learn.</h2></div><p>We designed this page to make it easier to explain the problem without requiring technical language. Good support starts with context, not blame.</p></section>
      <footer className="contact-footer"><span>© VibeSchool</span><div><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/aup">Acceptable Use</Link></div></footer>
      <style>{styles}</style>
    </main>
  )
}

const inputStyle: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "13px 14px", border: "1px solid #d6d2c7", borderRadius: 9, background: "#fff", color: "#111827", font: "inherit" }

const styles = `
.contact-page{min-height:100vh;background:#f7f6f2;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.7}.contact-page *{box-sizing:border-box}.contact-nav{height:78px;padding:0 max(24px,calc((100vw - 1132px)/2));display:flex;align-items:center;justify-content:space-between;background:#05050f;border-bottom:1px solid rgba(255,255,255,.1)}.brand{font-family:var(--font-display),Arial,sans-serif;color:#fff;text-decoration:none;font-size:24px;font-weight:800}.contact-nav nav{display:flex;gap:25px}.contact-nav nav a{color:rgba(255,255,255,.7);text-decoration:none;font-size:14px}.contact-hero{background:#05050f;color:#fff;padding:70px 24px 90px}.contact-hero>*{max-width:900px;margin-left:auto;margin-right:auto}.eyebrow,.section-label{font-family:var(--font-mono),monospace;letter-spacing:.18em;font-size:11px;font-weight:700}.eyebrow{color:#c8a84b}.contact-hero h1{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(44px,7vw,70px);line-height:1.04;letter-spacing:-.04em;margin-top:18px;margin-bottom:20px}.contact-hero p{color:rgba(255,255,255,.68);font-size:18px;max-width:780px;margin-left:auto;margin-right:auto}.contact-body{max-width:1132px;margin:auto;padding:75px 24px;display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:55px}.support-card{background:#fff;border:1px solid #e1ddd3;border-radius:16px;padding:38px;box-shadow:0 12px 40px rgba(15,23,42,.06)}.section-label{color:#8b6d22}.support-card h2{font-family:var(--font-display),Arial,sans-serif;font-size:34px;line-height:1.1;margin:8px 0 12px}.muted,.helper,.side-card p,.contact-trust>p{color:#68717f}.muted{font-size:14px}.support-card form{display:grid;gap:18px;margin-top:26px}.support-card label{font-weight:700;color:#374151}.support-card button{border:0;border-radius:9px;background:#05050f;color:#fff;padding:14px 18px;font-weight:800;font-size:14px;cursor:pointer}.support-card button:disabled{opacity:.55;cursor:wait}.helper{font-size:13px;margin:-5px 0 0}.result{padding:13px;border-radius:9px;background:#f0ede4;color:#374151;font-size:14px}.reference{margin-top:6px;font-weight:800;color:#705718}.contact-side{display:grid;align-content:start;gap:14px}.side-card{padding:24px;border-top:1px solid #d8d4c9}.side-card span{font-family:var(--font-mono);font-size:11px;color:#9a7b2f}.side-card h3{font-size:19px;margin:8px 0}.side-card p{font-size:14px;margin:0 0 12px}.side-card a{font-size:13px;font-weight:800;color:#80641e;text-decoration:none}.contact-trust{background:#eeece5;padding:80px max(24px,calc((100vw - 1132px)/2));display:grid;grid-template-columns:1fr 1fr;gap:70px}.contact-trust h2{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(30px,4vw,48px);line-height:1.1;margin:10px 0}.contact-trust>p{font-size:18px}.contact-footer{background:#05050f;color:#fff;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:28px max(24px,calc((100vw - 1132px)/2));font-size:13px}.contact-footer div{display:flex;gap:22px}.contact-footer a{color:rgba(255,255,255,.7);text-decoration:none}@media(max-width:800px){.contact-body,.contact-trust{grid-template-columns:1fr;gap:35px}.support-card{padding:25px}.contact-nav nav{gap:14px}.contact-hero{padding-top:55px;padding-bottom:65px}.contact-footer{flex-direction:column}.contact-footer div{flex-wrap:wrap}}
`

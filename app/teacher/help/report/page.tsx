"use client";
export const dynamic = "force-dynamic";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

function makeReference() {
  try {
    return crypto.randomUUID();
  } catch {
    return `teacher-${Date.now().toString(36)}`;
  }
}

export default function TeacherReportProblemPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [category, setCategory] = useState("technical");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [reference] = useState(makeReference);

  const context = useMemo(() => ({
    role: "teacher",
    screen: pathname || "/teacher/help/report",
    timestamp: new Date().toISOString(),
    reference,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
  }), [pathname, reference]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setResult(null);
    setTicketId(null);

    if (subject.trim().length < 3 || details.trim().length < 10) {
      setResult("Add a short subject and tell us what happened so support can investigate.");
      return;
    }

    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResult("Your session expired. Sign in again, then reopen Report a Problem.");
        return;
      }

      const safeContext = `\n\n--- Safe app context ---\nRole: ${context.role}\nScreen: ${context.screen}\nTime: ${context.timestamp}\nReference: ${context.reference}\nNetwork: ${context.online ? "online" : "offline"}`;
      const { data: caseId, error } = await supabase.rpc("submit_contact_request", {
        p_category: category,
        p_subject: subject.trim(),
        p_message: `${details.trim()}${safeContext}`,
      });

      if (error) {
        setResult("We couldn’t send the report. Your description is still on this screen; check your connection and try again.");
        return;
      }

      setTicketId(String(caseId));
      setResult("Report received. You can return to teaching; support now has the safe app context needed to investigate.");
      setSubject("");
      setDetails("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "16px 16px 28px", maxWidth: 680, margin: "0 auto" }}>
      <button type="button" onClick={() => router.back()} aria-label="Go back" style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 12, background: "#fff", color: C.textPrimary, fontSize: 18, cursor: "pointer", marginBottom: 12 }}>←</button>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.textPrimary }}>Report a Problem</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: C.textMuted }}>Describe what you were trying to do. VibeSchool adds the screen, time and a safe reference automatically.</p>
      </div>

      <form onSubmit={submit} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: C.textPrimary }}>
          Problem type
          <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ minHeight: 46, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0 12px", background: "#fff", fontSize: 14 }}>
            <option value="technical">Technical problem</option>
            <option value="account">Account / login</option>
            <option value="school_access">School or class access</option>
            <option value="privacy">Privacy</option>
            <option value="other">Something else</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: C.textPrimary }}>
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={160} required placeholder="For example: Attendance would not save" style={{ minHeight: 46, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0 12px", fontSize: 14 }} />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: C.textPrimary }}>
          What happened?
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} minLength={10} maxLength={5000} required rows={7} placeholder="What were you trying to do? What did you expect? What happened instead?" style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 1.5, resize: "vertical" }} />
        </label>

        <div style={{ borderRadius: 12, background: C.surface, padding: 12, fontSize: 12, lineHeight: 1.5, color: C.textMuted }}>
          Do not include passwords, PINs, one-time codes or payment credentials. Reference: <strong>{reference.slice(0, 8)}</strong>
        </div>

        {result && <div role="status" aria-live="polite" style={{ borderRadius: 12, background: ticketId ? "#ecfdf5" : "#fff7ed", padding: 12, fontSize: 13, lineHeight: 1.5, color: ticketId ? "#065f46" : "#9a3412" }}>{result}{ticketId && <div style={{ marginTop: 4 }}><strong>Support reference:</strong> {ticketId}</div>}</div>}

        <button type="submit" disabled={busy} style={{ minHeight: 48, border: 0, borderRadius: 12, background: busy ? "#9ca3af" : C.accent, color: "#fff", fontSize: 14, fontWeight: 900, cursor: busy ? "not-allowed" : "pointer" }}>
          {busy ? "Sending…" : "Send Report"}
        </button>
      </form>
    </div>
  );
}

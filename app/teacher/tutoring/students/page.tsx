"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, ChevronDown, MessageCircle, UserPlus, Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import PrivateTuitionTools from "@/components/vibetutor/PrivateTuitionTools";

type Invite = { id: string; token: string | null; student: string | null; status: string; created_at: string };
type StudentTool = "lessons" | "messages";
const card: React.CSSProperties = { background: "var(--teacher-surface, #fff)", border: "1px solid var(--teacher-border, #dfe5de)", borderRadius: 16, padding: 16 };
const action: React.CSSProperties = { minHeight: 44, padding: "10px 14px", border: 0, borderRadius: 11, background: "#087451", color: "#fff", fontWeight: 700, cursor: "pointer" };
const muted = { color: "var(--teacher-muted, #536159)", fontSize: 13 };

export default function TuitionStudents() {
  const [rows, setRows] = useState<Invite[]>([]);
  const [notice, setNotice] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expanded, setExpanded] = useState<{ id: string; tool: StudentTool } | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    const db = getSupabaseClient();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError) { setError("Could not verify your account."); setState("error"); return; }
    if (!auth.user) { window.location.assign("/login?redirect=%2Fteacher%2Ftutoring%2Fstudents"); return; }
    const { data, error: rpcError } = await db.rpc("vibetutor_my_student_invites");
    if (rpcError) { setError("Could not load tuition students. Please try again."); setState("error"); return; }
    setRows((data ?? []) as Invite[]);
    setError("");
    setState("ready");
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true); setError("");
    const { error: rpcError } = await getSupabaseClient().rpc("vibetutor_create_student_invite");
    setBusy(false);
    if (rpcError) { setError("Could not create invitation. Check your tutor listing."); return; }
    setNotice("Invitation created. Share the link privately.");
    await load();
  }
  async function revoke(id: string) {
    setBusy(true); setError("");
    const { error: rpcError } = await getSupabaseClient().rpc("vibetutor_revoke_student_invite", { p_id: id });
    setBusy(false);
    if (rpcError) setError("Could not remove the invitation.");
    else { if (expanded?.id === id) setExpanded(null); await load(); }
  }
  function invitationUrl(token: string) {
    return window.location.origin + "/student/tutoring?invite=" + encodeURIComponent(token);
  }
  async function share(token: string) {
    try {
      await navigator.clipboard.writeText(invitationUrl(token));
      setNotice("Invitation link copied.");
    } catch { setError("Copy failed. Use your browser's share options."); }
  }
  function shareWhatsApp(token: string) {
    const message = "You have a private tuition invitation on VibeSchool. Open this link to review and accept: " + invitationUrl(token);
    window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }
  function toggle(id: string, tool: StudentTool) {
    setExpanded(current => current?.id === id && current.tool === tool ? null : { id, tool });
  }

  const active = rows.filter(row => row.status === "accepted");
  const pending = rows.filter(row => ["open", "invited", "pending_guardian"].includes(row.status));
  return <main style={{ maxWidth: 980, margin: "0 auto", padding: "22px 16px 110px", display: "grid", gap: 14, color: "var(--teacher-ink, #17251c)" }}>
    <Link href="/teacher/tutoring" style={{ color: "#087451", fontSize: 13 }}>← My Tutoring</Link>
    <header style={{ display: "flex", alignItems: "start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 27, margin: "0 0 5px" }}>My tuition students</h1>
        <p style={{ ...muted, margin: 0 }}>Your connected learners and private lessons.</p>
      </div>
      <button type="button" aria-expanded={inviteOpen} aria-controls="tuition-invite" onClick={() => setInviteOpen(open => !open)} style={action}><UserPlus size={17} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 7 }} />Invite student</button>
    </header>
    {inviteOpen && <section id="tuition-invite" style={card}>
      <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>Invite a student</h2>
      <p style={{ ...muted, margin: "0 0 12px" }}>Send a private link to the learner or guardian. The learner accepts in their account. Under-18 learners require guardian approval.</p>
      <button type="button" onClick={() => void create()} disabled={busy || state !== "ready"} style={action}>{busy ? "Working…" : "Create invitation link"}</button>
    </section>}
    {notice && <p role="status" style={{ ...muted, margin: 0 }}>{notice}</p>}
    {error && <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}
    {state === "loading" && <p role="status">Loading tuition students…</p>}
    {state === "error" && <button type="button" onClick={() => void load()} style={action}>Retry</button>}
    {state === "ready" && <>
      <section aria-label="Connected learners" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 17, margin: "3px 0" }}><Users size={18} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 8 }} />My students {active.length > 0 ? `(${active.length})` : ""}</h2>
        {active.length === 0 && <div style={card}><p style={{ ...muted, margin: 0 }}>No connected learners yet. Use Invite student to get started.</p></div>}
        {active.map(row => <article key={row.id} style={card}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", background: "#e9f4ee", color: "#087451" }}><BookOpen size={22} /></div>
            <div style={{ flex: 1, minWidth: 130 }}><strong>{row.student || "Connected learner"}</strong><div style={muted}>Connected learner</div></div>
            <span style={{ background: "#e9f4ee", color: "#087451", padding: "5px 9px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Active</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 9, marginTop: 14 }}>
            {([["lessons", "Lessons", CalendarDays, "Schedule and view"], ["messages", "Messages", MessageCircle, "Private conversation"]] as const).map(([tool, label, Icon, detail]) => {
              const open = expanded?.id === row.id && expanded.tool === tool;
              return <button key={tool} type="button" aria-expanded={open} onClick={() => toggle(row.id, tool)} style={{ border: open ? "2px solid #087451" : "1px solid #dfe5de", borderRadius: 12, padding: 13, background: open ? "#edf7f1" : "#f8faf8", color: "#17251c", textAlign: "left", cursor: "pointer", minHeight: 82 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={18} color="#087451" aria-hidden="true" /><strong>{label}</strong><ChevronDown size={16} aria-hidden="true" style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : undefined }} /></span>
                <span style={{ display: "block", ...muted, marginTop: 6 }}>{detail}</span>
              </button>;
            })}
          </div>
          {expanded?.id === row.id && <PrivateTuitionTools key={row.id} invitationId={row.id} isTutor={true} section={expanded.tool} />}
          <button type="button" disabled={busy} onClick={() => void revoke(row.id)} style={{ border: 0, background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12, marginTop: 12, padding: "8px 2px" }}>Remove connection</button>
        </article>)}
      </section>
      {pending.length > 0 && <section aria-label="Pending invitations" style={{ display: "grid", gap: 9 }}>
        <h2 style={{ fontSize: 16, margin: "12px 0 2px" }}>Pending invitations ({pending.length})</h2>
        {pending.map(row => <div key={row.id} style={card}>
          <strong>{row.student || "Invitation awaiting student"}</strong>
          <p style={{ ...muted, margin: "6px 0 12px" }}>{row.status === "pending_guardian" ? "Awaiting guardian approval" : row.status === "invited" ? "Awaiting student response" : "Awaiting student"}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {row.status === "open" && row.token && <>
              <button type="button" onClick={() => shareWhatsApp(row.token!)} style={action}>WhatsApp</button>
              <button type="button" onClick={() => void share(row.token!)} style={{ ...action, color: "#087451", background: "white", border: "1px solid #087451" }}>Copy link</button>
            </>}
            <button type="button" disabled={busy} onClick={() => void revoke(row.id)} style={{ ...action, color: "#374151", background: "#f3f4f6" }}>Cancel</button>
          </div>
        </div>)}
      </section>}
    </>}
  </main>;
}

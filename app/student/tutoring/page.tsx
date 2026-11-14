"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import PrivateTuitionTools from "@/components/vibetutor/PrivateTuitionTools";
import PrivateTutorTasks from "@/components/vibetutor/PrivateTutorTasks";

type Invite = { id: string; tutor: string; status: string; created_at: string };
type Preview = { available: boolean; tutor?: string };
const panel: React.CSSProperties = {
  border: "1px solid var(--vs-border, #dcdce8)",
  borderRadius: 14, padding: 16, background: "var(--vs-surface, #fff)"
};
const action: React.CSSProperties = {
  minHeight: 44, padding: "10px 18px", border: 0,
  borderRadius: 10, background: "#087451", color: "#fff", fontWeight: 750
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function StudentTuition() {
  const [rows, setRows] = useState<Invite[]>([]);
  const [tab, setTab] = useState<"overview" | "lessons" | "messages" | "tasks">("overview");
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (invitationToken = "") => {
    setLoading(true);
    setError("");
    const db = getSupabaseClient();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError && !isAuthSessionMissingError(authError)) { setError("Could not verify your account. Try again."); setLoading(false); return; }
    if (!auth.user) {
      const destination = "/student/tutoring" + (invitationToken ? "?invite=" + encodeURIComponent(invitationToken) : "");
      window.location.assign("/login/student?redirect=" + encodeURIComponent(destination));
      return;
    }
    const { data, error: inboxError } = await db.rpc("vibetutor_student_inbox");
    if (inboxError) setError("Could not load your tuition invitations.");
    else setRows((data ?? []) as Invite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const invitationToken = new URLSearchParams(window.location.search).get("invite") || "";
    setToken(invitationToken);
    void load(invitationToken);
    if (!invitationToken) return;
    if (!UUID.test(invitationToken)) {
      setPreview({ available: false });
      return;
    }
    let active = true;
    setPreviewLoading(true);
    void (async () => {
      const db = getSupabaseClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) { if (active) setPreviewLoading(false); return; }
      const { data, error } = await db.rpc("vibetutor_preview_student_invite", { p_token: invitationToken });
      if (!active) return;
      setPreview(error ? { available: false } : (data as Preview));
      setPreviewLoading(false);
    })();
    return () => { active = false; };
  }, [load]);

  function dismissLink() {
    setToken("");
    setPreview(null);
    window.history.replaceState(null, "", "/student/tutoring");
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true); setError(""); setNotice("");
    const { data, error } = await getSupabaseClient().rpc("vibetutor_respond_student_invite", { p_id: id, p_accept: accept });
    setBusy(false);
    if (error) { setError("Could not update this invitation."); return; }
    setNotice(data === "pending_guardian" ? "You accepted. A linked parent or guardian must approve before tuition starts." : data === "accepted" ? "You are now connected to your tutor." : "Invitation declined.");
    await load();
  }

  async function acceptLink() {
    if (busy || !token || !preview?.available) return;
    setBusy(true); setError(""); setNotice("");
    const { data, error } = await getSupabaseClient().rpc("vibetutor_claim_student_invite", { p_token: token });
    setBusy(false);
    if (error) { setError("This invitation is no longer available. Ask the tutor for a fresh link."); return; }
    dismissLink();
    setNotice(data === "accepted" ? "You are now connected to your tutor." : "Invitation accepted. A linked parent or guardian must approve before tuition starts.");
    await load();
  }

  const pending = rows.filter(row => row.status === "invited");
  const connected = rows.filter(row => row.status === "accepted" || row.status === "pending_guardian");

  const approved = connected.filter(row => row.status === "accepted");

  return <main style={{ maxWidth: 650, margin: "16px auto", display: "grid", gap: 14, padding: "10px 10px 80px", color: "var(--vs-text, #17251c)" }}>
    <Link href="/student">← My Learning</Link>
    <header><h1 style={{ fontSize: 26, margin: "4px 0" }}>My Tutors</h1>
      <p style={{ fontSize: 13, opacity: .75 }}>Your tutors, private sessions and conversations. Learn, tasks and progress remain in your main learner workspace.</p></header>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}

    {token && <section style={panel} aria-label="Shared tuition invitation">
      <h2 style={{ fontSize: 19, marginTop: 0 }}>You're invited to private tuition</h2>
      {previewLoading ? <p role="status">Checking invitation…</p> : preview?.available ? <>
        <p><strong>{preview.tutor || "Your tutor"}</strong> has invited you to connect for one-to-one tuition on VibeSchool.</p>
        <p style={{ fontSize: 13, opacity: .75 }}>Your school records stay private. If you are under 18, a linked parent or guardian must approve.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={action} disabled={busy} onClick={() => void acceptLink()}>{busy ? "Connecting…" : "Accept invitation"}</button>
          <button type="button" disabled={busy} style={{ ...action, border: "1px solid #b5bdb6", background: "#fff", color: "#17251c" }} onClick={dismissLink}>Not now</button>
        </div>
      </> : <><p>This invitation is invalid, expired or already used.</p>
        <button type="button" style={{ ...action, background: "#fff", color: "#17251c", border: "1px solid #b5bdb6" }} onClick={dismissLink}>Back to My Tutors</button></>}
    </section>}

    <nav aria-label="My Tutors sections" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {([["overview", "My tutors"], ["lessons", "Sessions"], ["messages", "Messages"], ["tasks", "Tasks & feedback"]] as const).map(([key, label]) =>
        <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}
          style={{ ...action, background: tab === key ? "var(--vs-accent, #087451)" : "var(--vs-surface, #fff)",
            color: tab === key ? "#fff" : "var(--vs-text, #17251c)", border: "1px solid var(--vs-border, #dcdce8)" }}>{label}</button>)}
    </nav>

    {loading ? <section role="status" style={panel}>Loading private tuition…</section> : <>
      {tab === "overview" && <section style={panel} aria-label="Private tuition overview">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <div><span style={{ fontSize: 12, opacity: .75 }}>Connected tutors</span><div style={{ fontSize: 28, fontWeight: 800 }}>{approved.length}</div></div>
          <div><span style={{ fontSize: 12, opacity: .75 }}>Invitations</span><div style={{ fontSize: 28, fontWeight: 800 }}>{pending.length}</div></div>
        </div>
        <p style={{ fontSize: 13, opacity: .75 }}>Private lessons and conversations stay with your approved tutors. Your learning tools are shared across school, tutoring and independent study.</p>
        <button type="button" style={action} onClick={() => setTab("lessons")}>View sessions</button>
      </section>}
      {tab === "overview" && <>
      <section style={panel} aria-label="Tuition invitations">
        <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Invitations</h2>
        {pending.length === 0 && <p style={{ fontSize: 13, opacity: .75 }}>No new invitations yet.</p>}
        {pending.map(row => <div key={row.id} style={{ padding: "12px 0", borderTop: "1px solid #d9dce3" }}>
          <strong>{row.tutor}</strong><p style={{ fontSize: 13 }}>Invited you to join private tuition.</p>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} style={action} onClick={() => void respond(row.id, true)}>Accept</button>
            <button type="button" disabled={busy} style={{ ...action, background: "#fff", color: "#17251c", border: "1px solid #aaa" }} onClick={() => void respond(row.id, false)}>Decline</button>
          </div>
        </div>)}
      </section>
      {connected.length > 0 && <section style={panel}>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>My tutors</h2>
        {connected.map(row => <div key={row.id} style={{ fontSize: 14, padding: "14px 0", borderTop: "1px solid #eee", display: "grid", gap: 10 }}><div><strong>{row.tutor}</strong> · {row.status === "accepted" ? "Connected" : "Awaiting guardian approval"}</div>{row.status === "accepted" && <Link href={"/student/tutoring/" + encodeURIComponent(row.id)} style={{ ...action, textAlign: "center", textDecoration: "none", display: "inline-block" }}>Open tutor</Link>}</div>)}
      </section>}
      </>}
      {tab === "lessons" && <section style={panel} aria-label="Private tuition lessons">
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>My lessons</h2>
        {approved.length === 0 ? <p style={{ fontSize: 13, opacity: .75 }}>Approved tutor connections are needed before lessons can be scheduled.</p> : approved.map(row => <div key={row.id} style={{ padding: "12px 0", borderTop: "1px solid #eee" }}><strong>{row.tutor}</strong><PrivateTuitionTools invitationId={row.id} isTutor={false} section="lessons" /></div>)}
      </section>}
      {tab === "messages" && <section style={panel} aria-label="Tutor conversations">
        <h2 style={{ marginTop: 0 }}>Private messages</h2>
        {approved.length === 0 ? <p>No approved tutor connection yet.</p> :
          approved.map(row => <div key={row.id} style={{ padding: "12px 0", borderTop: "1px solid var(--vs-border, #ddd)" }}>
            <strong>{row.tutor}</strong>
            <PrivateTuitionTools invitationId={row.id} isTutor={false} section="messages" />
          </div>)}
      </section>}
      {tab === "tasks" && <section style={panel} aria-label="Private tutor tasks">
        <h2 style={{ marginTop: 0 }}>Tutoring tasks & feedback</h2>
        {approved.length === 0 ? <p>Connect with an approved tutor to receive private tasks.</p> :
          approved.map(row => <section key={row.id} style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, margin: 0 }}>{row.tutor}</h3>
            <PrivateTutorTasks invitationId={row.id} isTutor={false}/>
          </section>)}
      </section>}
      <p style={{ fontSize: 12, opacity: .75 }}>Private tuition only. School records stay separate. Under-18 connections require guardian approval.</p>
    </>}
  </main>;
}

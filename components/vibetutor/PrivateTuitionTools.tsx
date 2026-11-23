"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { tuitionLessonCanCancel, tuitionLessonState } from "@/lib/vibetutor/lessonLifecycle";

type Lesson = { id: string; invitation_id: string; title: string; starts_at: string; ends_at: string; status: string };
const panel: React.CSSProperties = { background: "#fff", border: "1px solid #dfe5de", padding: 14, borderRadius: 12 };
const btn: React.CSSProperties = { minHeight: 42, borderRadius: 10, padding: "9px 12px", background: "#087451", color: "white", border: 0, cursor: "pointer" };
export default function PrivateTuitionTools({ invitationId, isTutor, section = "all" }: { invitationId: string; isTutor: boolean; section?: "all" | "lessons" | "messages" }) {
  const [now, setNow] = useState(Date.now);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const db = getSupabaseClient();
    const { data, error: lessonsError } = await db.rpc("vibetutor_my_lessons");
    if (lessonsError) { setError("Private tuition lessons are not available yet."); return; }
    setLessons(((data ?? []) as Lesson[]).filter(item => item.invitation_id === invitationId));
  }, [invitationId]);
  useEffect(() => { void refresh(); }, [refresh]);
  // Keep actions in sync at the exact lesson boundary, even without a reload.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    if (!start || !title.trim()) return;
    setBusy(true); setError(""); setNotice("");
    const when = new Date(start);
    const { error: e } = await getSupabaseClient().rpc("vibetutor_schedule_lesson", {
      p_invitation: invitationId, p_title: title.trim(), p_start: when.toISOString(),
      p_end: new Date(when.getTime() + duration * 60000).toISOString()
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setTitle(""); setStart(""); setNotice("Lesson scheduled for both accounts.");
    await refresh();
  }
  async function cancel(id: string) {
    setBusy(true); setError("");
    const { error: e } = await getSupabaseClient().rpc("vibetutor_cancel_lesson", { p_lesson: id });
    setBusy(false);
    if (e) setError(e.message); else await refresh();
  }
  return <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {(section === "all" || section === "lessons") && <section style={panel} aria-label="Private tuition lessons">
      <h3 style={{ marginTop: 0 }}>Lessons</h3>
      {isTutor && <form onSubmit={e => void schedule(e)} style={{ display: "grid", gap: 9, marginBottom: 16 }}>
        <label>Lesson topic<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fractions" style={{ display: "block", width: "100%", padding: 10 }} /></label>
        <label>Date and time<input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} style={{ display: "block", padding: 10, width: "100%" }} /></label>
        <label>Duration<select value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ display: "block", padding: 10 }}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={90}>90 minutes</option><option value={120}>2 hours</option></select></label>
        <button disabled={busy} style={btn}>Schedule lesson</button>
      </form>}
      {lessons.length === 0 ? <p>No lessons yet.</p> : lessons.map(l => {
        const state = tuitionLessonState(l, now);
        return <div key={l.id} style={{ borderTop: "1px solid #eee", padding: "10px 0" }}>
        <strong>{l.title}</strong><div>{new Date(l.starts_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })} · {Math.round((new Date(l.ends_at).getTime() - new Date(l.starts_at).getTime()) / 60000)} min</div>
        <small>{state === "ended" ? "Ended" : state === "joinable" ? "Ready to join" : state === "upcoming" ? "Scheduled" : state === "completed" ? "Completed" : state === "cancelled" ? "Cancelled" : "Unavailable"}</small>
        {isTutor && tuitionLessonCanCancel(l, now) && <button type="button" onClick={() => void cancel(l.id)} disabled={busy} style={{ marginLeft: 10 }}>Cancel</button>}
        {state === "joinable" && <div style={{ marginTop: 8 }}><Link href={"/tuition/lessons/" + l.id} style={{ ...btn, display: "inline-block", textDecoration: "none" }}>Join lesson</Link></div>}
        {state === "upcoming" && <small style={{ display: "block", marginTop: 6 }}>Join opens 15 minutes before the lesson.</small>}
        {state === "ended" && <small style={{ display: "block", marginTop: 6 }}>This lesson has ended.</small>}
      </div>;
      })}
    </section>}
    {(section === "all" || section === "messages") && <section style={panel} aria-label="Private tuition messages">
      <h3 style={{ marginTop: 0 }}>VibeChat</h3>
      <p style={{ fontSize: 12 }}>Continue private tuition conversations in VibeChat. Only approved connections may exchange messages.</p>
      <Link href={"/vibechat?thread=tuition:" + encodeURIComponent(invitationId)} style={{ ...btn, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Open VibeChat</Link>
    </section>}
  </div>;
}

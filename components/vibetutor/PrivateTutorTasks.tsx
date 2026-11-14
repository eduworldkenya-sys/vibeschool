"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";

type PrivateTask = {
  id: string; invitation_id: string; title: string; instructions: string;
  status: "assigned" | "completed" | "reviewed"; learner_note: string;
  tutor_feedback: string; created_at: string; is_tutor: boolean;
};
const card: React.CSSProperties = { padding: 14, border: "1px solid var(--vs-border, #dfe5de)", borderRadius: 12, background: "var(--vs-surface, #fff)", display: "grid", gap: 9 };
const action: React.CSSProperties = { minHeight: 42, border: 0, borderRadius: 10, padding: "9px 14px", background: "var(--vs-accent, #087451)", color: "#fff", fontWeight: 700 };
const input: React.CSSProperties = { width: "100%", minHeight: 44, borderRadius: 10, padding: 10, border: "1px solid var(--vs-border, #dfe5de)", background: "var(--vs-surface, #fff)", color: "var(--vs-text, #17251c)" };

export default function PrivateTutorTasks({ invitationId, isTutor }: { invitationId: string; isTutor: boolean }) {
  const [tasks, setTasks] = useState<PrivateTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await getSupabaseClient().rpc("vibetutor_my_private_tasks", { p_invitation: invitationId });
    if (rpcError) { setError("Tutoring tasks are not available. Please retry."); setTasks([]); }
    else { setTasks((data ?? []) as PrivateTask[]); setError(""); }
    setLoading(false);
  }, [invitationId]);
  useEffect(() => { void load(); }, [load]);
  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true); setError(""); setNotice("");
    const { error: rpcError } = await getSupabaseClient().rpc("vibetutor_assign_private_task", {
      p_invitation: invitationId, p_title: title.trim(), p_instructions: instructions.trim(),
    });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setTitle(""); setInstructions(""); setNotice("Private task assigned."); await load();
  }
  async function save(task: PrivateTask) {
    setBusy(true); setError(""); setNotice("");
    const note = notes[task.id] ?? (isTutor ? task.tutor_feedback : task.learner_note);
    const { error: rpcError } = isTutor
      ? await getSupabaseClient().rpc("vibetutor_review_private_task", { p_task: task.id, p_feedback: note })
      : await getSupabaseClient().rpc("vibetutor_complete_private_task", { p_task: task.id, p_note: note });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(isTutor ? "Feedback shared with learner." : "Completed work shared with tutor.");
    await load();
  }
  return <section aria-label="Tutoring tasks and feedback" style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 17 }}>Tasks & feedback</h3>
      <button type="button" onClick={() => void load()} disabled={loading || busy} style={{ ...action, background: "var(--vs-accent-soft, #e5f5ee)", color: "var(--vs-text, #17251c)" }}>Refresh</button>
    </div>
    <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Private tutor tasks and written feedback. Practice and formal exams use VibeSchool's existing learning engines.</p>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {isTutor && <form onSubmit={e => void assign(e)} style={card}>
      <label style={{ fontWeight: 700 }}>Task title<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} style={input} placeholder="e.g. Practise fractions" /></label>
      <label>Instructions<textarea maxLength={2000} value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} style={input} placeholder="Give the learner a clear activity to complete" /></label>
      <button type="submit" style={action} disabled={busy || !title.trim()}>Assign to this learner</button>
    </form>}
    {loading ? <p role="status">Loading private tasks…</p> : tasks.length === 0 ? <p>No tutoring tasks yet.</p> : tasks.map(task => <article key={task.id} style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{task.title}</strong><span style={{ fontSize: 12, opacity: .8 }}>{task.status === "reviewed" ? "Feedback ready" : task.status === "completed" ? "Awaiting review" : "To do"}</span></div>
      {task.instructions && <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{task.instructions}</p>}
      {isTutor && task.learner_note && <p style={{ margin: 0, fontSize: 13 }}><strong>Learner response:</strong> {task.learner_note}</p>}
      {task.tutor_feedback && <p style={{ margin: 0, fontSize: 13, background: "var(--vs-accent-soft, #e5f5ee)", padding: 10, borderRadius: 9 }}><strong>Tutor feedback:</strong> {task.tutor_feedback}</p>}
      {(isTutor ? task.status !== "assigned" : true) && <label style={{ fontSize: 13 }}>
        {isTutor ? "Give constructive feedback" : "Your answer or work summary"}
        <textarea rows={3} maxLength={2000} value={notes[task.id] ?? (isTutor ? task.tutor_feedback : task.learner_note)}
          onChange={e => setNotes(old => ({ ...old, [task.id]: e.target.value }))} style={input}/>
      </label>}
      {(isTutor ? task.status !== "assigned" : true) && <button type="button" style={action} disabled={busy || (isTutor && !(notes[task.id] ?? task.tutor_feedback).trim())}
        onClick={() => void save(task)}>{isTutor ? "Send feedback" : task.status === "assigned" ? "Submit completed work" : "Update completed work"}</button>}
    </article>)}
    {!isTutor && <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13 }}>
      <Link href="/student/vibelearn/topic-practice">Practice</Link><Link href="/student/study">Learn</Link>
      <Link href="/student/vibelearn/exams">Exams</Link><Link href="/student/marks">My Progress</Link>
    </div>}
  </section>;
}

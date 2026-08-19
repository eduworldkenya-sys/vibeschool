"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useStudent } from "@/lib/student-context";
import { supabase } from "@/lib/supabase";
import Skel from "@/components/student/Skel";

interface ExItem {
  id: string;
  title: string;
  instructions: string | null;
  submissionId: string | null;
  submissionStatus: "pending" | "submitted" | "marked" | null;
  notes: string;
  feedback: string | null;
  mark: number | null;
  maxScore: number | null;
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export default function StudentExercisesPage() {
  const { identity, loading: idLoading } = useStudent();
  const [list, setList] = useState<ExItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const client = supabase as unknown as RpcClient;

  async function load() {
    if (!identity?.classId) { setLoading(false); return; }
    setError(null);
    const [exRes, subRes] = await Promise.all([
      supabase
        .from("exercises")
        .select("id,title,instructions,max_score")
        .eq("class_id", identity.classId)
        .is("homework_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("exercise_submissions")
        .select("id,exercise_id,status,notes,feedback,mark")
        .eq("student_id", identity.studentId),
    ]);

    if (exRes.error || subRes.error) {
      setError("Exercises could not be loaded. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const subMap = new Map((subRes.data ?? []).map(s => [s.exercise_id, s]));
    setList((exRes.data ?? []).map(e => {
      const sub = subMap.get(e.id);
      return {
        id: e.id,
        title: e.title ?? "Untitled exercise",
        instructions: e.instructions ?? null,
        submissionId: sub?.id ?? null,
        submissionStatus: (sub?.status as ExItem["submissionStatus"]) ?? null,
        notes: sub?.notes ?? "",
        feedback: sub?.feedback ?? null,
        mark: sub?.mark == null ? null : Number(sub.mark),
        maxScore: e.max_score == null ? null : Number(e.max_score),
      };
    }));
    setLoading(false);
  }

  useEffect(() => {
    if (idLoading || !identity) return;
    void load();
    // identity is stable after canonical resolution; load is intentionally scoped to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, idLoading]);

  function updateNotes(id: string, notes: string) {
    setList(current => current.map(item => item.id === id ? { ...item, notes } : item));
  }

  async function saveDraft(item: ExItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const { error: rpcError } = await client.rpc("student_save_exercise_draft", {
        p_exercise_id: item.id,
        p_notes: item.notes,
        p_photo_url: null,
      });
      if (rpcError) throw new Error(rpcError.message || "Exercise draft could not be saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exercise draft could not be saved.");
    } finally {
      setBusyId(null);
    }
  }

  async function submit(item: ExItem) {
    if (!item.notes.trim()) {
      setError("Write your response before submitting this exercise.");
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      const { error: submitError } = await client.rpc("student_submit_exercise", {
        p_exercise_id: item.id,
        p_notes: item.notes,
        p_photo_url: null,
      });
      if (submitError) throw new Error(submitError.message || "Exercise could not be submitted.");

      const { error: receiptError } = await client.rpc("student_sync_task_execution_receipt", {
        p_task_id: `exercise:${item.id}`,
      });
      if (receiptError) throw new Error(receiptError.message || "Exercise was submitted, but progress could not be synchronized.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exercise could not be submitted.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}><Skel h={100} /><Skel h={100} /><Skel h={100} /></div>;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 100px", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--vs-text)" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Exercises</h1>
      <p style={{ fontSize: 13, color: "var(--vs-muted)", marginBottom: 16 }}>Practice from your teacher. Drafts stay editable until you submit.</p>

      {error && (
        <div role="status" style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: "var(--vs-accent-soft)", color: "var(--vs-text)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--vs-muted)" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>No exercises yet</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Your teacher’s next exercise will appear here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {list.map(item => {
            const locked = item.submissionStatus === "submitted" || item.submissionStatus === "marked";
            const busy = busyId === item.id;
            return (
              <section key={item.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{item.title}</div>
                    <div style={{ fontSize: 10, color: "var(--vs-muted)", marginTop: 4 }}>
                      {item.submissionStatus === "marked" ? "Marked" : item.submissionStatus === "submitted" ? "Submitted" : item.submissionStatus === "pending" ? "Draft saved" : "Ready"}
                    </div>
                  </div>
                  {item.mark != null && <strong style={{ color: "var(--vs-success)", fontSize: 13 }}>{item.mark}{item.maxScore != null ? `/${item.maxScore}` : ""}</strong>}
                </div>

                {item.instructions && <p style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.6, margin: "12px 0" }}>{item.instructions}</p>}

                <label htmlFor={`exercise-${item.id}`} style={{ display: "block", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>My response</label>
                <textarea
                  id={`exercise-${item.id}`}
                  value={item.notes}
                  disabled={locked || busy}
                  onChange={event => updateNotes(item.id, event.target.value)}
                  placeholder="Write your working, answer, observation or reflection here."
                  rows={5}
                  style={{ width: "100%", minHeight: 110, resize: "vertical", borderRadius: 12, border: "1px solid var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-text)", padding: 12, font: "inherit", fontSize: 13, lineHeight: 1.5 }}
                />

                {item.feedback && <div style={{ marginTop: 10, padding: 11, borderRadius: 11, background: "var(--vs-accent-soft)", fontSize: 12 }}><strong>Teacher feedback:</strong> {item.feedback}</div>}

                {!locked && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    <button disabled={busy} onClick={() => void saveDraft(item)} style={{ minHeight: 44, borderRadius: 11, border: "1px solid var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-text)", fontWeight: 750, cursor: busy ? "wait" : "pointer" }}>
                      {busy ? "Saving…" : "Save draft"}
                    </button>
                    <button disabled={busy || !item.notes.trim()} onClick={() => void submit(item)} style={{ minHeight: 44, borderRadius: 11, border: "none", background: "var(--vs-accent)", color: "#fff", fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: !item.notes.trim() ? .55 : 1 }}>
                      Submit
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
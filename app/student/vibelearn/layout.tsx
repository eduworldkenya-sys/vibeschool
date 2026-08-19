"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "@/lib/student-context";
import { supabase } from "@/lib/supabase";
import { getVibeLearnWorkstation, type VibeLearnWorkstation } from "@/lib/student/vibelearn";

type ClassResource = {
  id: string;
  title: string;
  description: string | null;
  type: "ebook" | "epage" | "textbook";
  url: string | null;
  subject_id: string | null;
};

function normaliseClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function GeneralLearnerVibeLearn() {
  const router = useRouter();
  const { identity } = useStudent();
  const [workspace, setWorkspace] = useState<VibeLearnWorkstation | null>(null);
  const [resources, setResources] = useState<ClassResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const brief = await getVibeLearnWorkstation();
        if (cancelled) return;
        setWorkspace(brief);
        const subjectIds = brief.subjects.map(subject => subject.id).filter(Boolean);
        if (subjectIds.length === 0) {
          setResources([]);
          return;
        }
        const { data, error: resourceError } = await supabase
          .from("vibelearn_content")
          .select("id,title,description,type,url,subject_id")
          .in("subject_id", subjectIds)
          .eq("status", "live")
          .not("url", "is", null)
          .order("view_count", { ascending: false })
          .limit(30);
        if (resourceError) throw resourceError;
        if (!cancelled) setResources((data ?? []) as ClassResource[]);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "VibeLearn could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const subjectById = useMemo(
    () => new Map((workspace?.subjects ?? []).map(subject => [subject.id, subject.name])),
    [workspace],
  );

  if (loading) {
    return <main style={{ maxWidth: 760, margin: "0 auto", padding: "18px 14px 110px" }}><div style={{ padding: 22, borderRadius: 18, background: "var(--vs-card)", color: "var(--vs-muted)" }}>Preparing your learning desk…</div></main>;
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "18px 14px 110px", display: "grid", gap: 14 }}>
      <section style={{ borderRadius: 20, padding: 20, background: "linear-gradient(135deg,#312e81,#4f46e5)", color: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 850, letterSpacing: 1.1, opacity: .75 }}>VIBELEARN · {identity?.className || workspace?.className || "MY CLASS"}</div>
        <h1 style={{ margin: "7px 0 5px", fontSize: 25, lineHeight: 1.15 }}>Learn what belongs to your class.</h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, opacity: .84 }}>Continue where you stopped, open class resources, complete assigned work and build real progress.</p>
      </section>

      {error && <div role="status" style={{ padding: 12, borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontSize: 12 }}>{error}</div>}

      {workspace?.twin.now && (
        <section style={{ border: "1px solid var(--vs-border)", borderRadius: 16, background: "var(--vs-card)", padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 850, color: "var(--vs-accent)", letterSpacing: 1 }}>NEXT BEST ACTION</div>
          <h2 style={{ fontSize: 16, margin: "6px 0 4px" }}>{workspace.twin.now.title}</h2>
          <p style={{ margin: 0, color: "var(--vs-muted)", fontSize: 12, lineHeight: 1.5 }}>{workspace.twin.now.reason ?? "Your highest-priority verified learning action."}</p>
          {workspace.twin.now.actionUrl && <button onClick={() => router.push(workspace.twin.now!.actionUrl!)} style={{ marginTop: 12, minHeight: 44, border: 0, borderRadius: 11, background: "var(--vs-accent)", color: "#fff", padding: "0 16px", fontWeight: 800 }}>Open now</button>}
        </section>
      )}

      <section style={{ border: "1px solid var(--vs-border)", borderRadius: 16, background: "var(--vs-card)", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontSize: 10, fontWeight: 850, color: "var(--vs-accent)", letterSpacing: 1 }}>CONTINUE LEARNING</div><h2 style={{ fontSize: 17, margin: "5px 0 0" }}>Pick up where you stopped</h2></div>
        </div>
        {(workspace?.continueLearning.length ?? 0) === 0 ? (
          <p style={{ color: "var(--vs-muted)", fontSize: 12, lineHeight: 1.55, margin: "10px 0 0" }}>Nothing is in progress yet. Choose a class resource below to begin.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {workspace!.continueLearning.slice(0, 4).map(item => (
              <button key={`${item.publicationId}-${item.chapterId ?? "book"}`} onClick={() => router.push(item.actionUrl)} style={{ minHeight: 56, textAlign: "left", border: "1px solid var(--vs-border)", borderRadius: 12, background: "var(--vs-surface)", color: "var(--vs-text)", padding: 12, fontFamily: "inherit" }}>
                <strong style={{ display: "block", fontSize: 13 }}>{item.title}</strong>
                <span style={{ display: "block", color: "var(--vs-muted)", fontSize: 11, marginTop: 3 }}>{item.chapterTitle ?? "Continue reading"} · {item.progressPercent}%</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={{ border: "1px solid var(--vs-border)", borderRadius: 16, background: "var(--vs-card)", padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 850, color: "var(--vs-accent)", letterSpacing: 1 }}>MY CLASS RESOURCES</div>
        <h2 style={{ fontSize: 17, margin: "5px 0 0" }}>Learn by subject</h2>
        {resources.length === 0 ? (
          <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: "var(--vs-surface)" }}>
            <strong style={{ fontSize: 13 }}>No class resource is live yet.</strong>
            <p style={{ color: "var(--vs-muted)", fontSize: 12, lineHeight: 1.55, margin: "5px 0 10px" }}>Your homework, exercises and teacher-assigned work are still available while the class library is being prepared.</p>
            <button onClick={() => router.push("/student/tasks")} style={{ minHeight: 44, border: 0, borderRadius: 10, background: "var(--vs-accent)", color: "#fff", padding: "0 14px", fontWeight: 800 }}>Open my tasks</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
            {resources.map(resource => (
              <button key={resource.id} onClick={() => resource.url && router.push(resource.url)} style={{ minHeight: 112, textAlign: "left", border: "1px solid var(--vs-border)", borderRadius: 14, background: "var(--vs-surface)", color: "var(--vs-text)", padding: 14, fontFamily: "inherit" }}>
                <span style={{ fontSize: 10, color: "var(--vs-accent)", fontWeight: 800 }}>{subjectById.get(resource.subject_id ?? "") ?? "Class resource"}</span>
                <strong style={{ display: "block", fontSize: 14, marginTop: 5 }}>{resource.title}</strong>
                {resource.description && <span style={{ display: "block", color: "var(--vs-muted)", fontSize: 11, lineHeight: 1.45, marginTop: 5 }}>{resource.description.slice(0, 100)}</span>}
                <span style={{ display: "block", color: "var(--vs-accent)", fontSize: 11, fontWeight: 800, marginTop: 8 }}>Open →</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        <button onClick={() => router.push("/student/exercises")} style={{ minHeight: 74, border: "1px solid var(--vs-border)", borderRadius: 14, background: "var(--vs-card)", color: "var(--vs-text)", fontWeight: 800 }}>Exercises</button>
        <button onClick={() => router.push("/student/tasks")} style={{ minHeight: 74, border: "1px solid var(--vs-border)", borderRadius: 14, background: "var(--vs-card)", color: "var(--vs-text)", fontWeight: 800 }}>Tasks & homework</button>
      </section>

      {(workspace?.assignedAssessments.length ?? 0) > 0 && (
        <section style={{ border: "1px solid var(--vs-border)", borderRadius: 16, background: "var(--vs-card)", padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 850, color: "var(--vs-accent)", letterSpacing: 1 }}>ASSESSMENTS</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {workspace!.assignedAssessments.map(item => <button key={item.assignmentId} onClick={() => router.push(item.actionUrl)} style={{ minHeight: 52, border: "1px solid var(--vs-border)", borderRadius: 11, background: "var(--vs-surface)", color: "var(--vs-text)", textAlign: "left", padding: 11, fontFamily: "inherit" }}><strong>{item.title}</strong><span style={{ display: "block", fontSize: 10, color: "var(--vs-muted)", marginTop: 3 }}>{item.subjectName ?? "Assessment"}</span></button>)}
          </div>
        </section>
      )}
    </main>
  );
}

export default function VibeLearnGradeModeLayout({ children }: { children: React.ReactNode }) {
  const { identity, loading } = useStudent();
  if (loading || !identity) return children;

  const classKey = normaliseClass(identity.className);
  const isForm4 = classKey === "form4";
  return isForm4 ? children : <GeneralLearnerVibeLearn />;
}

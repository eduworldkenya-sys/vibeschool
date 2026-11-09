"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CheckCircle2, ClipboardList, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type IndependentProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  independent_notes: string | null;
  independent_completed_at: string | null;
  created_at: string | null;
};
const suggestions = [
  { title: "Observe seed growth", description: "Plant a seed safely, observe changes over several days, and record what you discover." },
  { title: "Research a community challenge", description: "Identify a local challenge, research possible solutions, and explain your findings." },
  { title: "Create a reading reflection", description: "Choose a published book, summarise key ideas, and explain what you learned." },
];

const field: React.CSSProperties = { boxSizing: "border-box", width: "100%", minHeight: 44, border: "1px solid var(--vs-border, #cbd5e1)", background: "var(--vs-card, #fff)", color: "inherit", borderRadius: 10, padding: 11, fontFamily: "inherit", fontSize: 14 };
const button: React.CSSProperties = { minHeight: 44, border: 0, background: "var(--vs-accent, #4338ca)", color: "#fff", borderRadius: 11, padding: "10px 15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

export default function IndependentProjects() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<IndependentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (ownerId: string) => {
    const { data, error: loadError } = await supabase.from("projects")
      .select("id,title,description,status,independent_notes,independent_completed_at,created_at")
      .eq("independent_owner_profile_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (loadError) throw loadError;
    const rows = (data ?? []) as unknown as IndependentProject[];
    setProjects(rows);
    setNotes(Object.fromEntries(rows.map(row => [row.id, row.independent_notes ?? ""])));
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !auth.user) {
          router.replace("/login/student?redirect=" + encodeURIComponent("/student/projects/independent"));
          return;
        }
        setUserId(auth.user.id);
        await load(auth.user.id);
      } catch {
        if (active) setError("Projects could not be loaded. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => { active = false; };
  }, [router, load]);

  async function createProject() {
    if (!userId || working) return;
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 160 || description.length > 3000) {
      setError("Use a title of 3–160 characters and a description of at most 3,000 characters.");
      return;
    }
    setWorking(true); setError("");
    try {
      const { error: writeError } = await supabase.from("projects").insert({
        independent_owner_profile_id: userId, title: cleanTitle,
        description: description.trim() || null, status: "active",
      } as never);
      if (writeError) throw writeError;
      setTitle(""); setDescription("");
      await load(userId);
    } catch {
      setError("Could not create the project. Please try again.");
    } finally { setWorking(false); }
  }

  async function saveProject(project: IndependentProject, complete: boolean) {
    if (!userId || working) return;
    const draft = notes[project.id] ?? "";
    if (draft.length > 8000) { setError("Notes must be 8,000 characters or fewer."); return; }
    setWorking(true); setError("");
    try {
      const { error: writeError } = await supabase.from("projects").update({
        independent_notes: draft,
        status: complete ? "submitted" : "active",
        independent_completed_at: complete ? new Date().toISOString() : null,
      } as never).eq("id", project.id).eq("independent_owner_profile_id", userId);
      if (writeError) throw writeError;
      await load(userId);
    } catch {
      setError("Could not save your project. Please try again.");
    } finally { setWorking(false); }
  }

  return <main style={{ maxWidth: 780, margin: "0 auto", padding: "20px 16px 110px", color: "var(--vs-text, #0f172a)" }}>
    <Link href="/student/vibelearn" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, gap: 7, textDecoration: "none", color: "var(--vs-accent, #4338ca)" }}><ArrowLeft size={18} aria-hidden="true" /> Learn</Link>
    <header style={{ margin: "12px 0 20px" }}>
      <ClipboardList size={28} strokeWidth={1.8} aria-hidden="true" />
      <h1 style={{ fontSize: 26, margin: "8px 0" }}>My Independent Projects</h1>
      <p style={{ color: "var(--vs-muted, #64748b)", margin: 0, lineHeight: 1.5 }}>Choose a question, investigate it and save your own findings. No teacher assignment is required. These projects are personal learning activities, not teacher-marked assessments.</p>
    </header>
    {error && <p role="alert" style={{ background: "#fef2f2", borderRadius: 10, padding: 12, color: "#991b1b" }}>{error}</p>}
    <section style={{ border: "1px solid var(--vs-border, #e2e8f0)", background: "var(--vs-card, #fff)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
      <h2 style={{ fontSize: 17, margin: "0 0 12px" }}><Plus size={18} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 6 }} />Start a project</h2>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 13 }}>
        {suggestions.map(item => <button key={item.title} onClick={() => { setTitle(item.title); setDescription(item.description); }} style={{ border: "1px solid var(--vs-border, #cbd5e1)", borderRadius: 20, padding: "7px 10px", background: "var(--vs-surface, #f8fafc)", color: "inherit", cursor: "pointer" }}>{item.title}</button>)}
      </div>
      <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Project title
        <input style={field} value={title} maxLength={160} onChange={event => setTitle(event.target.value)} placeholder="What will you investigate?" />
      </label>
      <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Question or project plan
        <textarea style={field} rows={3} maxLength={3000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the question, materials and steps" />
      </label>
      <button style={button} onClick={() => void createProject()} disabled={!userId || working || title.trim().length < 3}><Plus size={17} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 6 }} />{working ? "Saving…" : "Create project"}</button>
    </section>
    <h2 style={{ fontSize: 18 }}>My projects</h2>
    {loading ? <p role="status">Loading projects…</p> : projects.length === 0 ? <p style={{ color: "var(--vs-muted, #64748b)" }}>No personal projects yet. Choose an idea or create your own.</p> : (
      <div style={{ display: "grid", gap: 12 }}>
        {projects.map(project => <section key={project.id} style={{ padding: 16, borderRadius: 16, border: "1px solid var(--vs-border, #e2e8f0)", background: "var(--vs-card, #fff)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 16 }}>{project.title}</strong>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: project.status === "submitted" ? "#047857" : "var(--vs-muted, #64748b)" }}>{project.status === "submitted" ? <CheckCircle2 size={15} aria-hidden="true" /> : <BookOpenCheck size={15} aria-hidden="true" />}{project.status === "submitted" ? "Completed" : "In progress"}</span>
          </div>
          {project.description && <p style={{ fontSize: 13, color: "var(--vs-muted, #64748b)", lineHeight: 1.5 }}>{project.description}</p>}
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, marginTop: 12 }}>My observations and findings
            <textarea style={field} rows={4} maxLength={8000} value={notes[project.id] ?? ""} onChange={event => setNotes(old => ({ ...old, [project.id]: event.target.value }))} placeholder="What did you observe or learn?" />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button style={button} disabled={working} onClick={() => void saveProject(project, project.status === "submitted")}><Save size={16} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 6 }} />Save notes</button>
            <button style={{ ...button, background: "var(--vs-surface, #f1f5f9)", color: "var(--vs-text, #0f172a)", border: "1px solid var(--vs-border, #cbd5e1)" }} disabled={working} onClick={() => void saveProject(project, project.status !== "submitted")}>{project.status === "submitted" ? "Reopen project" : "Mark complete"}</button>
          </div>
        </section>)}
      </div>
    )}
  </main>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Assessment = {
  id: string;
  blueprint_id: string;
  status: "draft" | "moderation" | "approved" | "published" | "archived";
  total_marks: number;
  version: number;
  approved_at: string | null;
};

type Blueprint = {
  id: string;
  title: string;
  assessment_type: string;
  status: string;
  class_id: string | null;
  total_marks: number;
};

type Item = {
  id: string;
  sequence: number;
  question_type: string;
  prompt: string;
  options: unknown;
  answer_key: unknown;
  marks: number;
  difficulty: string | null;
  bloom_level: string | null;
  source_resource_id: string | null;
  source_block_id: string | null;
};

function stringOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default function ContentAssessmentReviewPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = typeof params.assessmentId === "string" ? params.assessmentId : "";
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ), []);

  async function load() {
    if (!assessmentId) return;
    setLoading(true);
    setError("");
    const { data: assessmentRow, error: assessmentError } = await supabase
      .from("generated_assessments")
      .select("id,blueprint_id,status,total_marks,version,approved_at")
      .eq("id", assessmentId)
      .maybeSingle();
    if (assessmentError || !assessmentRow) {
      setError(assessmentError?.message || "Assessment draft was not found.");
      setLoading(false);
      return;
    }

    const [{ data: blueprintRow, error: blueprintError }, { data: itemRows, error: itemsError }] = await Promise.all([
      supabase.from("content_assessment_blueprints").select("id,title,assessment_type,status,class_id,total_marks").eq("id", assessmentRow.blueprint_id).maybeSingle(),
      supabase.from("generated_assessment_items").select("id,sequence,question_type,prompt,options,answer_key,marks,difficulty,bloom_level,source_resource_id,source_block_id").eq("assessment_id", assessmentId).order("sequence", { ascending: true }),
    ]);
    if (blueprintError || itemsError || !blueprintRow) {
      setError(blueprintError?.message || itemsError?.message || "Assessment details could not be loaded.");
      setLoading(false);
      return;
    }

    setAssessment(assessmentRow as Assessment);
    setBlueprint(blueprintRow as Blueprint);
    setItems((itemRows ?? []) as Item[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [assessmentId]);

  async function saveItem(item: Item) {
    if (!assessment || assessment.status !== "draft") return;
    if (!item.prompt.trim() || item.marks < 1) return;
    setSavingId(item.id);
    setError("");
    const { error: updateError } = await supabase
      .from("generated_assessment_items")
      .update({ prompt: item.prompt.trim(), options: item.options, answer_key: item.answer_key, marks: item.marks })
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      setSavingId(null);
      return;
    }

    const total = items.reduce((sum, current) => sum + Math.max(1, Number(current.marks) || 1), 0);
    const [{ error: assessmentError }, { error: blueprintError }] = await Promise.all([
      supabase.from("generated_assessments").update({ total_marks: total }).eq("id", assessment.id),
      supabase.from("content_assessment_blueprints").update({ total_marks: total }).eq("id", assessment.blueprint_id),
    ]);
    if (assessmentError || blueprintError) setError(assessmentError?.message || blueprintError?.message || "Totals could not be updated.");
    else {
      setAssessment({ ...assessment, total_marks: total });
      setBlueprint(blueprint ? { ...blueprint, total_marks: total } : blueprint);
    }
    setSavingId(null);
  }

  async function approve() {
    if (!assessment || !blueprint || approving || items.length === 0) return;
    setApproving(true);
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/login");
      return;
    }
    const now = new Date().toISOString();
    const { error: assessmentError } = await supabase
      .from("generated_assessments")
      .update({ status: "approved", approved_by: authData.user.id, approved_at: now })
      .eq("id", assessment.id)
      .eq("status", "draft");
    if (assessmentError) {
      setError(assessmentError.message);
      setApproving(false);
      return;
    }
    const { error: blueprintError } = await supabase
      .from("content_assessment_blueprints")
      .update({ status: "approved" })
      .eq("id", blueprint.id);
    if (blueprintError) {
      setError(blueprintError.message);
      setApproving(false);
      return;
    }
    setAssessment({ ...assessment, status: "approved", approved_at: now });
    setBlueprint({ ...blueprint, status: "approved" });
    setApproving(false);
  }

  if (loading) return <main style={shell}><div style={card}>Loading assessment draft…</div></main>;
  if (!assessment || !blueprint) return <main style={shell}><div style={card}>{error || "Assessment draft not found."}</div></main>;

  const editable = assessment.status === "draft";

  return (
    <main style={shell}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <button type="button" onClick={() => router.back()} style={backButton}>← Back</button>
        <section style={hero}>
          <div style={eyebrow}>Content Engine · teacher review</div>
          <h1 style={{ margin: "7px 0 5px", fontSize: 26 }}>{blueprint.title}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pill}>{blueprint.assessment_type === "cat" ? "Test" : blueprint.assessment_type}</span>
            <span style={pill}>{assessment.total_marks} marks</span>
            <span style={pill}>{items.length} questions</span>
            <span style={{ ...pill, background: assessment.status === "approved" ? "#dcfce7" : "#fef3c7", color: assessment.status === "approved" ? "#166534" : "#92400e" }}>{assessment.status}</span>
          </div>
          <p style={{ margin: "12px 0 0", color: "#cbd5e1", fontSize: 12, lineHeight: 1.6 }}>Every generated item retains a source resource and, where available, an exact source block. Edit before approval; approval freezes this draft for downstream delivery.</p>
        </section>

        {error && <section style={{ ...card, color: "#b91c1c" }}>{error}</section>}

        {items.map((item, index) => {
          const options = stringOptions(item.options);
          return (
            <section key={item.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <strong>Question {index + 1}</strong>
                <div style={{ fontSize: 10, color: "#64748b" }}>{item.source_block_id ? "Exact block source ✓" : "Chapter source ✓"}</div>
              </div>
              <textarea
                disabled={!editable}
                value={item.prompt}
                rows={3}
                onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, prompt: event.target.value } : row))}
                style={textarea}
              />
              {options.length > 0 && (
                <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
                  {options.map((option, optionIndex) => (
                    <input
                      key={optionIndex}
                      disabled={!editable}
                      value={option}
                      onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, options: options.map((value, i) => i === optionIndex ? event.target.value : value) } : row))}
                      style={input}
                    />
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                <label style={{ fontSize: 11, fontWeight: 800 }}>Marks</label>
                <input disabled={!editable} type="number" min={1} max={20} value={item.marks} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, marks: Math.max(1, Number(event.target.value) || 1) } : row))} style={{ ...input, width: 76 }} />
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>{[item.difficulty, item.bloom_level].filter(Boolean).join(" · ")}</span>
              </div>
              {editable && <button type="button" disabled={savingId === item.id} onClick={() => void saveItem(item)} style={secondaryButton}>{savingId === item.id ? "Saving…" : "Save question"}</button>}
            </section>
          );
        })}

        <section style={{ ...card, borderColor: assessment.status === "approved" ? "#86efac" : "#c7d2fe" }}>
          {assessment.status === "approved" ? (
            <><strong style={{ color: "#166534" }}>✓ Approved for use</strong><p style={muted}>This assessment is now an approved Content Engine artifact. Delivery/assignment can use this reviewed version.</p></>
          ) : (
            <><strong>Final teacher approval</strong><p style={muted}>Review all questions and marks. Approval records you as the approving teacher and moves the blueprint and generated assessment to approved state.</p><button type="button" disabled={approving || items.length === 0} onClick={() => void approve()} style={primaryButton}>{approving ? "Approving…" : "Approve assessment"}</button></>
          )}
        </section>
      </div>
    </main>
  );
}

const shell: React.CSSProperties = { minHeight: "100dvh", background: "#f8fafc", color: "#0f172a", padding: "18px 14px 90px", fontFamily: "system-ui,-apple-system,sans-serif" };
const hero: React.CSSProperties = { background: "linear-gradient(135deg,#0f172a,#1e1b4b)", color: "white", borderRadius: 20, padding: 20, marginBottom: 12 };
const card: React.CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12 };
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1, color: "#a5b4fc" };
const pill: React.CSSProperties = { background: "#eef2ff", color: "#4338ca", borderRadius: 999, padding: "4px 9px", fontSize: 10, fontWeight: 850, textTransform: "capitalize" };
const muted: React.CSSProperties = { fontSize: 12, lineHeight: 1.6, color: "#64748b" };
const textarea: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 11, padding: 11, resize: "vertical", fontFamily: "inherit", fontSize: 14 };
const input: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", fontFamily: "inherit", fontSize: 13 };
const primaryButton: React.CSSProperties = { width: "100%", marginTop: 12, border: 0, borderRadius: 11, background: "#4f46e5", color: "white", padding: 12, fontWeight: 850, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { marginTop: 12, border: "1px solid #cbd5e1", borderRadius: 10, background: "white", color: "#334155", padding: "9px 12px", fontWeight: 800, cursor: "pointer" };
const backButton: React.CSSProperties = { border: 0, background: "transparent", color: "#4338ca", fontWeight: 800, marginBottom: 10, cursor: "pointer" };

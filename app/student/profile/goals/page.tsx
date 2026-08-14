"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentHomeOsBrief, updateStudentHomePreferences, type PreferredStudyTime } from "@/lib/student/tasks";

const C = { bg: "#f0f2f5", surface: "#fff", border: "#e5e7eb", text: "#111827", muted: "#6b7280", dark: "#1e1b4b", accent: "#6366f1", error: "#ef4444" };

export default function StudentGoalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetGrade, setTargetGrade] = useState("");
  const [weeklyMinutes, setWeeklyMinutes] = useState(300);
  const [sessionMinutes, setSessionMinutes] = useState(25);
  const [studyTime, setStudyTime] = useState<PreferredStudyTime>("evening");
  const [subjectTargets, setSubjectTargets] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const brief = await getStudentHomeOsBrief();
        if (cancelled) return;
        const targets = brief.progress.targets;
        setTargetGrade(targets.kcseTargetGrade ?? "");
        setWeeklyMinutes(targets.weeklyStudyMinutes);
        setSessionMinutes(targets.preferredSessionMinutes);
        setStudyTime(targets.preferredStudyTime);
        setSubjectTargets(targets.subjectTargets);
      } catch { if (!cancelled) setError("Your current learning goals could not be loaded."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, []);

  async function save() {
    setError(""); setNotice("");
    if (!Number.isInteger(weeklyMinutes) || weeklyMinutes < 30 || weeklyMinutes > 4200) { setError("Weekly study time must be between 30 and 4,200 minutes."); return; }
    if (!Number.isInteger(sessionMinutes) || sessionMinutes < 10 || sessionMinutes > 180) { setError("Focus sessions must be between 10 and 180 minutes."); return; }
    setSaving(true);
    try {
      await updateStudentHomePreferences({ kcseTargetGrade: targetGrade.trim() || null, weeklyStudyMinutes: weeklyMinutes, preferredSessionMinutes: sessionMinutes, preferredStudyTime: studyTime, subjectTargets });
      setNotice("Learning goals saved. Your Home OS and Twin can now use the updated preferences.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your learning goals could not be saved.");
    } finally { setSaving(false); }
  }

  if (loading) return <main style={{ minHeight: "100%", background: C.bg, padding: 16 }}><div style={{ height: 180, borderRadius: 18, background: "#e5e7eb" }} /></main>;

  const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 11, padding: "11px 12px", fontFamily: "inherit", fontSize: 13, color: C.text, background: "#fff" };
  const labelStyle: React.CSSProperties = { display: "grid", gap: 5, color: C.muted, fontSize: 10, fontWeight: 800 };

  return <main style={{ minHeight: "100%", background: C.bg, padding: "14px 14px 32px" }}>
    <button onClick={() => router.push("/student/profile")} style={{ border: "none", background: "none", color: C.muted, fontSize: 12, fontWeight: 750, padding: "2px 0 12px", cursor: "pointer" }}>← My profile</button>
    <section style={{ background: C.dark, color: "#fff", borderRadius: 22, padding: 19, marginBottom: 12 }}><div style={{ fontSize: 10, letterSpacing: 1.1, fontWeight: 850, opacity: .62 }}>MY LEARNING DIRECTION</div><h1 style={{ margin: "5px 0 6px", fontSize: 22 }}>Learning goals</h1><p style={{ margin: 0, fontSize: 11, opacity: .72, lineHeight: 1.5 }}>These are learner-owned preferences used by your Home OS and Twin. They do not change school grades or official academic records.</p></section>
    {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 11 }}>{error}</div>}
    {notice && <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 11 }}>{notice}</div>}
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, display: "grid", gap: 14 }}>
      <label style={labelStyle}>Target grade<input value={targetGrade} onChange={e => setTargetGrade(e.target.value)} placeholder="e.g. A-, B+" maxLength={12} style={inputStyle} /></label>
      <label style={labelStyle}>Weekly study minutes<input type="number" min={30} max={4200} step={15} value={weeklyMinutes} onChange={e => setWeeklyMinutes(Number(e.target.value))} style={inputStyle} /><span style={{ fontWeight: 500, color: "#9ca3af" }}>About {(weeklyMinutes / 60).toFixed(1)} hours per week.</span></label>
      <label style={labelStyle}>Preferred focus-session length<input type="number" min={10} max={180} step={5} value={sessionMinutes} onChange={e => setSessionMinutes(Number(e.target.value))} style={inputStyle} /></label>
      <label style={labelStyle}>Preferred study time<select value={studyTime} onChange={e => setStudyTime(e.target.value as PreferredStudyTime)} style={inputStyle}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="flexible">Flexible</option></select></label>
      <button disabled={saving} onClick={() => void save()} style={{ border: "none", borderRadius: 12, padding: 12, background: saving ? "#9ca3af" : C.accent, color: "#fff", fontWeight: 850, fontSize: 12, cursor: "pointer" }}>{saving ? "Saving…" : "Save goals"}</button>
    </section>
  </main>;
}

"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";
import type { Json } from "@/lib/database.types";

type ContextClass = {
  class_id: string;
  class_name: string;
  stream?: string | null;
  subject_id: string;
  subject_name: string;
  is_class_teacher?: boolean;
};
type Context = { teacher_id: string; school_id: string | null; classes?: ContextClass[] };
type Student = { id: string; name: string; admission_number: string | null };
type Group = {
  id: string;
  name: string;
  color: string;
  type: string;
  mode?: "static" | "smart" | "temporary";
  purpose?: string | null;
  subject_id?: string | null;
  rules?: Json | null;
  expires_at?: string | null;
  archived_at?: string | null;
};
type GroupMember = { group_id: string; student_id: string };
type ResolvedMember = { student_id: string; reason: string | null };

const GROUP_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
const CATEGORIES = [
  ["custom","Custom"],["lesson","Lesson"],["exam","Exam"],["homework","Homework"],
  ["attendance","Attendance"],["participation","Participation"],["support","Support"],
  ["recognition","Recognition"],["opportunity","Opportunity"],["management","Class duties"],
  ["parent_followup","Parent follow-up"],["game","Game / quiz"],
] as const;
const SMART_RULES = [
  { id: "attendance_below", label: "Attendance below", unit: "%", defaultValue: 80 },
  { id: "absence_count_at_least", label: "Absences at least", unit: "", defaultValue: 3 },
  { id: "missing_homework_at_least", label: "Missing homework at least", unit: "", defaultValue: 2 },
  { id: "assessment_below", label: "Latest assessment below", unit: "%", defaultValue: 50 },
  { id: "no_participation_since", label: "No participation in last", unit: "days", defaultValue: 7 },
] as const;

function asContext(value: unknown): Context {
  if (!value || typeof value !== "object") return { teacher_id: "", school_id: null, classes: [] };
  const record = value as Record<string, unknown>;
  return {
    teacher_id: typeof record.teacher_id === "string" ? record.teacher_id : "",
    school_id: typeof record.school_id === "string" ? record.school_id : null,
    classes: Array.isArray(record.classes) ? record.classes.filter(Boolean) as ContextClass[] : [],
  };
}

function GroupsInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const classId = params.id;
  const requestedSubjectId = searchParams.get("subjectId");

  const [context, setContext] = useState<Context | null>(null);
  const [assignment, setAssignment] = useState<ContextClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [resolved, setResolved] = useState<Record<string, ResolvedMember[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [mode, setMode] = useState<"static" | "smart" | "temporary">("static");
  const [groupType, setGroupType] = useState("custom");
  const [groupCount, setGroupCount] = useState(4);
  const [smartRule, setSmartRule] = useState<(typeof SMART_RULES)[number]["id"]>("attendance_below");
  const [smartValue, setSmartValue] = useState(80);
  const [note, setNote] = useState("");

  const subjectId = requestedSubjectId;
  const className = assignment ? `${assignment.class_name}${assignment.stream ? ` · ${assignment.stream}` : ""}` : "Class";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user) { router.replace("/login"); return; }

      const contextRes = await supabase.rpc("teacher_get_operating_context");
      if (contextRes.error) throw contextRes.error;
      const ctx = asContext(contextRes.data);
      if (!ctx.school_id) throw new Error("No active school is available.");
      const matches = (ctx.classes ?? []).filter(item => item.class_id === classId);
      const picked = requestedSubjectId
        ? matches.find(item => item.subject_id === requestedSubjectId)
        : matches.find(item => item.is_class_teacher);
      if (!picked) throw new Error(requestedSubjectId ? "This subject is not assigned to you in the active school." : "Class-wide tools are available to the class teacher. Open this class from SubjectHub for subject-scoped tools.");
      setContext(ctx);
      setAssignment(picked);

      const enrollmentRes = await supabase
        .from("student_classes")
        .select("student_id")
        .eq("school_id", ctx.school_id)
        .eq("class_id", classId)
        .eq("is_current", true);
      if (enrollmentRes.error) throw enrollmentRes.error;
      const ids = Array.from(new Set((enrollmentRes.data ?? []).map(row => row.student_id)));
      let roster: Student[] = [];
      if (ids.length) {
        const studentsRes = await supabase
          .from("students")
          .select("id,name,admission_number")
          .in("id", ids)
          .is("deleted_at", null)
          .order("name");
        if (studentsRes.error) throw studentsRes.error;
        roster = studentsRes.data ?? [];
      }

      const groupRes = await supabase
        .from("class_groups")
        .select("id,name,color,type,mode,purpose,subject_id,rules,expires_at,archived_at")
        .eq("class_id", classId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (groupRes.error) throw groupRes.error;
      const groupRows = (groupRes.data ?? []) as Group[];
      const memberRes = groupRows.length
        ? await supabase.from("class_group_members").select("group_id,student_id").in("group_id", groupRows.map(g => g.id))
        : { data: [], error: null };
      if (memberRes.error) throw memberRes.error;

      setStudents(roster);
      setGroups(groupRows);
      setMembers((memberRes.data ?? []) as GroupMember[]);
      const requestedSelected = new Set((searchParams.get("selected") ?? "").split(",").filter(Boolean));
      setSelected(prev => {
        const source = prev.size ? prev : requestedSelected;
        return new Set([...source].filter(id => roster.some(student => student.id === id)));
      });
    } catch (e) {
      console.error("[GroupsLists] load", e);
      setError(e instanceof Error ? e.message : "Groups and lists could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [classId, requestedSubjectId, router, searchParams]);

  useEffect(() => { void load(); }, [load]);

  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const membersByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const member of members) map.set(member.group_id, [...(map.get(member.group_id) ?? []), member.student_id]);
    return map;
  }, [members]);

  async function createGroup() {
    if (!context?.school_id || !context.teacher_id) return;
    if (!name.trim()) { setError("Give the group or list a name."); return; }
    if (mode === "static" && selected.size === 0) { setError("Select at least one learner for a saved group."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      let rules: Json | null = null;
      if (mode === "smart") {
        if (smartRule === "no_participation_since") {
          const since = new Date(Date.now() - Math.max(1, smartValue) * 86400000).toISOString();
          rules = { rule: smartRule, since };
        } else if (smartRule === "attendance_below" || smartRule === "assessment_below") {
          rules = { rule: smartRule, threshold: smartValue };
        } else {
          rules = { rule: smartRule, count: smartValue };
        }
      }
      const expiresAt = mode === "temporary" ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
      const insertRes = await supabase
        .from("class_groups")
        .insert({
          class_id: classId,
          school_id: context.school_id,
          created_by: context.teacher_id,
          subject_id: subjectId,
          name: name.trim(),
          purpose: purpose.trim() || null,
          color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
          type: groupType,
          mode,
          rules,
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (insertRes.error) throw insertRes.error;
      if (mode !== "smart" && selected.size) {
        const memberRes = await supabase.from("class_group_members").insert(
          [...selected].map(student_id => ({ group_id: insertRes.data.id, student_id })),
        );
        if (memberRes.error) throw memberRes.error;
      }
      setName(""); setPurpose(""); setSelected(new Set());
      setMessage(mode === "smart" ? "Smart list created." : mode === "temporary" ? "Temporary group created." : "Group created.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Group could not be created.");
    } finally { setSaving(false); }
  }

  async function resolveSmart(group: Group) {
    setError("");
    const result = await supabase.rpc("teacher_resolve_class_group_members", { p_group_id: group.id });
    if (result.error) { setError(result.error.message); return; }
    setResolved(prev => ({ ...prev, [group.id]: (result.data ?? []) as ResolvedMember[] }));
  }

  async function archiveGroup(groupId: string) {
    const result = await supabase.from("class_groups").update({ archived_at: new Date().toISOString() }).eq("id", groupId);
    if (result.error) { setError(result.error.message); return; }
    await load();
  }

  async function createRandomTeams() {
    if (!context?.school_id || !context.teacher_id || students.length === 0) return;
    setSaving(true); setError("");
    try {
      const shuffled = [...students].sort(() => Math.random() - 0.5);
      const n = Math.max(2, Math.min(groupCount, students.length));
      for (let i = 0; i < n; i += 1) {
        const ids = shuffled.filter((_, index) => index % n === i).map(s => s.id);
        const groupRes = await supabase
          .from("class_groups")
          .insert({
            class_id: classId, school_id: context.school_id, created_by: context.teacher_id,
            subject_id: subjectId, name: `Team ${i + 1}`, color: GROUP_COLORS[i % GROUP_COLORS.length],
            type: "game", mode: "temporary",
            purpose: "Random classroom team", expires_at: new Date(Date.now() + 86400000).toISOString(),
          })
          .select("id")
          .single();
        if (groupRes.error) throw groupRes.error;
        if (ids.length) {
          const memberRes = await supabase.from("class_group_members").insert(ids.map(student_id => ({ group_id: groupRes.data.id, student_id })));
          if (memberRes.error) throw memberRes.error;
        }
      }
      setMessage(`${n} random teams created for today.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Random teams could not be created.");
    } finally { setSaving(false); }
  }


  async function createAbilityGroups(strategy: "mixed" | "similar") {
    if (!context?.school_id || !context.teacher_id) return;
    const target = selected.size ? students.filter(student => selected.has(student.id)) : students;
    if (target.length < 2) {
      setError("Select at least two learners.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      let query = supabase
        .from("assessment_gradebook_entries")
        .select("student_id,percentage,released_at")
        .eq("school_id", context.school_id)
        .eq("class_id", classId)
        .eq("teacher_id", context.teacher_id)
        .in("student_id", target.map(student => student.id))
        .not("percentage", "is", null);
      if (subjectId) query = query.eq("subject_id", subjectId);
      const evidenceRes = await query.order("released_at", { ascending: false }).limit(500);
      if (evidenceRes.error) throw evidenceRes.error;

      const byStudent = new Map<string, number[]>();
      for (const row of evidenceRes.data ?? []) {
        if (typeof row.percentage !== "number") continue;
        byStudent.set(row.student_id, [...(byStudent.get(row.student_id) ?? []), row.percentage]);
      }
      if (target.some(student => !(byStudent.get(student.id)?.length))) {
        setError("Not enough assessment evidence to balance by performance.");
        return;
      }

      const scored = target.map(student => {
        const values = byStudent.get(student.id) ?? [];
        return { student, score: values.reduce((sum,value) => sum + value, 0) / values.length };
      }).sort((a,b) => a.score - b.score);

      const n = Math.max(2, Math.min(groupCount, scored.length));
      const buckets: typeof scored[] = Array.from({ length: n }, () => []);
      scored.forEach((entry,index) => {
        if (strategy === "similar") {
          const bucket = Math.min(n - 1, Math.floor(index * n / scored.length));
          buckets[bucket].push(entry);
        } else {
          const round = Math.floor(index / n);
          const position = index % n;
          const bucket = round % 2 === 0 ? position : n - 1 - position;
          buckets[bucket].push(entry);
        }
      });

      for (let index = 0; index < buckets.length; index += 1) {
        const bucket = buckets[index];
        if (!bucket.length) continue;
        const groupRes = await supabase.from("class_groups").insert({
          class_id: classId,
          school_id: context.school_id,
          created_by: context.teacher_id,
          subject_id: subjectId,
          name: `${strategy === "mixed" ? "Mixed" : "Similar"} group ${index + 1}`,
          color: GROUP_COLORS[index % GROUP_COLORS.length],
          type: "learning",
          mode: "temporary",
          purpose: `${strategy === "mixed" ? "Mixed" : "Similar"} performance grouping from released assessment evidence`,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).select("id").single();
        if (groupRes.error) throw groupRes.error;
        const memberRes = await supabase.from("class_group_members").insert(
          bucket.map(entry => ({ group_id: groupRes.data.id, student_id: entry.student.id })),
        );
        if (memberRes.error) throw memberRes.error;
      }
      setMessage(`${n} ${strategy === "mixed" ? "mixed-ability" : "similar-ability"} groups created from released assessment evidence.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Performance groups could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function createSelectionAssignmentGroup() {
    if (!context?.school_id || !context.teacher_id || selected.size === 0) return null;
    const groupRes = await supabase.from("class_groups").insert({
      class_id: classId,
      school_id: context.school_id,
      created_by: context.teacher_id,
      subject_id: subjectId,
      name: "Selected learners · assignment",
      color: GROUP_COLORS[0],
      type: "homework",
      mode: "temporary",
      purpose: "Assignment cohort",
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    }).select("id").single();
    if (groupRes.error) throw groupRes.error;
    const memberRes = await supabase.from("class_group_members").insert(
      [...selected].map(student_id => ({ group_id: groupRes.data.id, student_id })),
    );
    if (memberRes.error) throw memberRes.error;
    return groupRes.data.id as string;
  }

  async function assignSelectedHomework() {
    if (!selected.size) return;
    setSaving(true); setError("");
    try {
      const groupId = await createSelectionAssignmentGroup();
      if (!groupId) return;
      const query = new URLSearchParams({ groupId });
      if (subjectId) query.set("subjectId", subjectId);
      router.push(`/teacher/classhub/${classId}/homework?${query.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assignment cohort could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function assignGroupHomework(group: Group) {
    setSaving(true); setError("");
    try {
      const snapshotRes = await supabase.rpc("teacher_snapshot_class_group", {
        p_group_id: group.id,
        p_purpose: "Homework assignment cohort",
      });
      if (snapshotRes.error || !snapshotRes.data) throw snapshotRes.error ?? new Error("Group snapshot returned no ID.");
      const query = new URLSearchParams({ groupId: String(snapshotRes.data) });
      if (group.subject_id) query.set("subjectId", group.subject_id);
      router.push(`/teacher/classhub/${classId}/homework?${query.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This group could not be prepared for homework.");
    } finally {
      setSaving(false);
    }
  }

  async function recordEvent(kind: "observation" | "participation" | "recognition" | "followup") {
    if (!context?.school_id || !context.teacher_id || selected.size === 0) return;
    const activeSchoolId = context.school_id;
    if ((kind === "observation" || kind === "followup") && !note.trim()) { setError("Add a short factual note first."); return; }
    setSaving(true); setError("");
    try {
      const defaultCodes = {
        participation: "participated",
        recognition: "strong_effort",
        observation: "teacher_note",
        followup: "follow_up",
      };
      const rows = [...selected].map(student_id => ({
        school_id: activeSchoolId,
        class_id: classId,
        student_id,
        subject_id: subjectId,
        event_kind: kind,
        event_code: defaultCodes[kind],
        note: note.trim() || (kind === "participation" ? "Participated in class." : "Strong effort shown."),
        visibility: kind === "observation" ? "author" : "subject_team",
        created_by: context.teacher_id,
        due_at: kind === "followup" ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
      }));
      const result = await supabase.from("teacher_learner_events").insert(rows);
      if (result.error) throw result.error;
      setMessage(`${kind === "participation" ? "Participation" : kind === "recognition" ? "Recognition" : kind === "followup" ? "Follow-up" : "Observation"} saved for ${selected.size} learner${selected.size === 1 ? "" : "s"}.`);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The learner action could not be saved.");
    } finally { setSaving(false); }
  }

  function toggleStudent(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading) return <div style={{ padding: 24 }}>Loading groups and lists…</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 14px 110px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: C.dark, color: "#fff", fontSize: 18 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, color: C.dark }}>Groups & Lists</h1>
          <div style={{ fontSize: 12, color: C.textMuted }}>{className}{assignment?.subject_name ? ` · ${assignment.subject_name}` : ""}</div>
        </div>
      </div>

      {error && <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12, marginBottom: 10 }}>{error}</div>}
      {message && <div style={{ background: "#ecfdf5", color: "#065f46", padding: 12, borderRadius: 12, marginBottom: 10 }}>{message}</div>}

      <section style={{ background: "#fff", borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: C.textMuted, marginBottom: 10 }}>CREATE A GROUP OR LIST</div>
        <div style={{ display: "grid", gap: 9 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. Graph support" style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, padding: "0 12px" }} />
          <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose (optional)" style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, padding: "0 12px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
            <select value={mode} onChange={e => setMode(e.target.value as typeof mode)} style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, padding: "0 10px", background: "#fff" }}>
              <option value="static">Saved group</option>
              <option value="smart">Smart list</option>
              <option value="temporary">Temporary group</option>
            </select>
            <select value={groupType} onChange={e => setGroupType(e.target.value)} style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, padding: "0 10px", background: "#fff" }}>
              {CATEGORIES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {mode === "smart" && <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
            <select value={smartRule} onChange={e => { const next = SMART_RULES.find(r => r.id === e.target.value); if (next) { setSmartRule(next.id); setSmartValue(next.defaultValue); } }} style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, padding: "0 10px", background: "#fff" }}>
              {SMART_RULES.map(rule => <option key={rule.id} value={rule.id}>{rule.label}</option>)}
            </select>
            <input type="number" min={1} max={100} value={smartValue} onChange={e => setSmartValue(Number(e.target.value) || 1)} style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, padding: "0 10px" }} />
          </div>}
          <button onClick={createGroup} disabled={saving} style={{ minHeight: 46, border: 0, borderRadius: 12, background: C.accent, color: "#fff", fontWeight: 900 }}>{saving ? "Saving…" : mode === "smart" ? "Create smart list" : "Create from selected learners"}</button>
        </div>
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div><div style={{ fontSize: 11, fontWeight: 900, color: C.textMuted }}>STUDENTS</div><div style={{ fontSize: 12, marginTop: 2 }}>{students.length} enrolled · {selected.size} selected</div></div>
          <button onClick={() => setSelected(selected.size === students.length ? new Set() : new Set(students.map(s => s.id)))} style={{ minHeight: 38, border: "1px solid #d1d5db", borderRadius: 10, background: "#fff", padding: "0 10px", fontWeight: 800 }}>{selected.size === students.length && students.length ? "Clear" : "Select all"}</button>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {students.map(student => <label key={student.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46, borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.has(student.id)} onChange={() => toggleStudent(student.id)} />
            <div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>{student.name}</strong>{student.admission_number && <div style={{ fontSize: 10, color: C.textMuted }}>{student.admission_number}</div>}</div>
          </label>)}
          {students.length === 0 && <div style={{ color: C.textMuted, padding: 16 }}>No current learners are visible in this class.</div>}
        </div>
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: C.textMuted, marginBottom: 10 }}>QUICK CLASSROOM TOOLS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, gridColumn: "1 / -1" }}>
            <button onClick={() => setGroupCount(v => Math.max(2, v - 1))} style={{ width: 38, height: 38, border: "1px solid #d1d5db", borderRadius: 10, background: "#fff" }}>−</button>
            <div style={{ flex: 1, textAlign: "center", fontWeight: 900 }}>{groupCount} random teams</div>
            <button onClick={() => setGroupCount(v => Math.min(8, v + 1))} style={{ width: 38, height: 38, border: "1px solid #d1d5db", borderRadius: 10, background: "#fff" }}>+</button>
          </div>
          <button onClick={createRandomTeams} disabled={saving || students.length < 2} style={{ minHeight: 44, border: 0, borderRadius: 11, background: "#312e81", color: "#fff", fontWeight: 900, gridColumn: "1 / -1" }}>Create random teams</button>
          <button onClick={() => router.push(`/teacher/classhub/${classId}/games${subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ""}`)} disabled={groups.filter(group => group.type === "game" && group.mode !== "smart").length < 2} style={{ minHeight: 44, border: 0, borderRadius: 11, background: "#7c3aed", color: "#fff", fontWeight: 900, gridColumn: "1 / -1" }}>Open quiz scoreboard</button>
          <button onClick={() => void createAbilityGroups("mixed")} disabled={saving || students.length < 2} style={{ minHeight: 44, border: "1px solid #c7d2fe", borderRadius: 11, background: "#eef2ff", color: "#3730a3", fontWeight: 900 }}>Mixed ability</button>
          <button onClick={() => void createAbilityGroups("similar")} disabled={saving || students.length < 2} style={{ minHeight: 44, border: "1px solid #c7d2fe", borderRadius: 11, background: "#eef2ff", color: "#3730a3", fontWeight: 900 }}>Similar ability</button>
          <button onClick={() => void assignSelectedHomework()} disabled={saving || !selected.size} style={{ minHeight: 44, border: 0, borderRadius: 11, background: "#0f766e", color: "#fff", fontWeight: 900, gridColumn: "1 / -1" }}>Assign homework to selected</button>
          <button onClick={() => recordEvent("participation")} disabled={saving || !selected.size} style={{ minHeight: 44, border: 0, borderRadius: 11, background: "#0369a1", color: "#fff", fontWeight: 900 }}>Participated</button>
          <button onClick={() => recordEvent("recognition")} disabled={saving || !selected.size} style={{ minHeight: 44, border: 0, borderRadius: 11, background: "#065f46", color: "#fff", fontWeight: 900 }}>Recognise effort</button>
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Factual note, e.g. Needed prompting during graph interpretation." rows={3} style={{ marginTop: 8, width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 10, fontFamily: "inherit" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 8 }}>
          <button onClick={() => recordEvent("observation")} disabled={saving || !selected.size} style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 11, background: "#fff", fontWeight: 900 }}>Add note</button>
          <button onClick={() => recordEvent("followup")} disabled={saving || !selected.size} style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 11, background: "#fff", fontWeight: 900 }}>Follow up</button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        {groups.map(group => {
          const savedIds = membersByGroup.get(group.id) ?? [];
          const live = group.mode === "smart" ? resolved[group.id] : savedIds.map(student_id => ({ student_id, reason: null }));
          return <article key={group.id} style={{ background: "#fff", borderRadius: 16, padding: 14, boxShadow: "0 2px 12px rgba(0,0,0,.05)", borderLeft: `5px solid ${group.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: C.dark }}>{group.name}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{group.mode ?? "static"} · {group.type}{group.purpose ? ` · ${group.purpose}` : ""}</div>
              </div>
              <button onClick={() => archiveGroup(group.id)} style={{ border: 0, background: "#f3f4f6", borderRadius: 9, minHeight: 36, padding: "0 10px", fontWeight: 800 }}>Archive</button>
            </div>
            {group.mode === "smart" && <button onClick={() => resolveSmart(group)} style={{ marginTop: 10, minHeight: 40, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#3730a3", borderRadius: 10, padding: "0 12px", fontWeight: 900 }}>Refresh smart list</button>}
            <button onClick={() => void assignGroupHomework(group)} disabled={saving} style={{ marginTop: 10, marginLeft: 6, minHeight: 40, border: 0, background: "#0f766e", color: "#fff", borderRadius: 10, padding: "0 12px", fontWeight: 900 }}>Assign homework</button>
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {(live ?? []).map(item => <div key={item.student_id} style={{ background: "#f8fafc", borderRadius: 10, padding: 9 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{studentById.get(item.student_id)?.name ?? "Learner"}</div>
                {item.reason && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{item.reason}</div>}
              </div>)}
              {group.mode === "smart" && !resolved[group.id] && <div style={{ fontSize: 11, color: C.textMuted }}>Refresh to see current rule-based members.</div>}
              {live && live.length === 0 && <div style={{ fontSize: 11, color: C.textMuted }}>No current members.</div>}
            </div>
          </article>;
        })}
        {groups.length === 0 && <div style={{ background: "#fff", borderRadius: 16, padding: 20, color: C.textMuted, textAlign: "center" }}>No groups or lists yet. Select learners above or create a smart list.</div>}
      </section>
    </div>
  );
}

export default function GroupsPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}><GroupsInner /></Suspense>;
}

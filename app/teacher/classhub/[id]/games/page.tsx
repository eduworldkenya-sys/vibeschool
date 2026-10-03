"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ContextClass = {
  class_id: string;
  class_name: string;
  stream: string | null;
  subject_id: string;
  subject_name: string;
  is_class_teacher?: boolean;
};
type Context = { teacher_id: string; school_id: string | null; classes?: ContextClass[] };
type TeamGroup = { id: string; name: string; subject_id: string | null };
type Game = { id: string; title: string; status: string; subject_id: string | null };
type GameTeam = { id: string; game_id: string; group_id: string; label: string; score: number };

function asContext(value: unknown): Context {
  if (!value || typeof value !== "object") return { teacher_id: "", school_id: null, classes: [] };
  const record = value as Record<string, unknown>;
  return {
    teacher_id: typeof record.teacher_id === "string" ? record.teacher_id : "",
    school_id: typeof record.school_id === "string" ? record.school_id : null,
    classes: Array.isArray(record.classes) ? record.classes.filter(Boolean) as ContextClass[] : [],
  };
}

function GamePageInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const classId = params.id;
  const subjectId = search.get("subjectId");

  const [context, setContext] = useState<Context | null>(null);
  const [assignment, setAssignment] = useState<ContextClass | null>(null);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<GameTeam[]>([]);
  const gameRequest = useRef<{ key: string; id: string } | null>(null);
  const [title, setTitle] = useState("Class quiz");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const classLabel = useMemo(() => assignment
    ? `${assignment.class_name}${assignment.stream ? ` · ${assignment.stream}` : ""}${subjectId ? ` · ${assignment.subject_name}` : ""}`
    : "Class", [assignment, subjectId]);

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
      const candidates = (ctx.classes ?? []).filter(item => item.class_id === classId);
      const authorized = subjectId
        ? candidates.find(item => item.subject_id === subjectId)
        : candidates.find(item => item.is_class_teacher);
      if (!authorized) throw new Error(subjectId ? "This subject is not assigned to you." : "Class-wide activities are available to the class teacher.");
      setContext(ctx);
      setAssignment(authorized);

      let groupQuery = supabase
        .from("class_groups")
        .select("id,name,subject_id")
        .eq("school_id", ctx.school_id)
        .eq("class_id", classId)
        .eq("type", "game")
        .is("archived_at", null);
      if (subjectId) groupQuery = groupQuery.eq("subject_id", subjectId);
      else groupQuery = groupQuery.is("subject_id", null);
      const groupRes = await groupQuery.order("created_at", { ascending: false });
      if (groupRes.error) throw groupRes.error;
      setGroups((groupRes.data ?? []) as TeamGroup[]);

      let gameQuery = supabase
        .from("classroom_games")
        .select("id,title,status,subject_id")
        .eq("school_id", ctx.school_id)
        .eq("class_id", classId)
        .eq("teacher_id", ctx.teacher_id)
        .eq("status", "active");
      if (subjectId) gameQuery = gameQuery.eq("subject_id", subjectId);
      else gameQuery = gameQuery.is("subject_id", null);
      const gameRes = await gameQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (gameRes.error) throw gameRes.error;
      const current = gameRes.data as Game | null;
      setGame(current);

      if (current) {
        const teamsRes = await supabase
          .from("classroom_game_teams")
          .select("id,game_id,group_id,label,score")
          .eq("game_id", current.id)
          .order("score", { ascending: false });
        if (teamsRes.error) throw teamsRes.error;
        setTeams((teamsRes.data ?? []) as GameTeam[]);
      } else {
        setTeams([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Class activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [classId, router, subjectId]);

  useEffect(() => { void load(); }, [load]);

  function toggleGroup(id: string) {
    setSelectedGroups(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function startGame() {
    if (!context?.school_id || !context.teacher_id) return;
    const picked = groups.filter(group => selectedGroups.has(group.id));
    if (picked.length < 2) {
      setError("Choose at least two teams.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const key = JSON.stringify([classId, subjectId, title.trim(), picked.map(g => g.id).sort()]);
      if (gameRequest.current?.key !== key) gameRequest.current = { key, id: crypto.randomUUID() };
      const result = await supabase.rpc('teacher_start_class_game', { p_class_id: classId, p_subject_id: subjectId, p_title: title.trim() || 'Class quiz', p_group_ids: picked.map(g => g.id), p_request_id: gameRequest.current.id });
      if (result.error || result.data !== gameRequest.current.id) throw new Error(result.error?.message ?? 'Game save could not be confirmed.');
      gameRequest.current = null;
      setMessage("Scoreboard started. Game points are classroom activity only, not academic evidence.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scoreboard could not be started.");
    } finally { setSaving(false); }
  }

  async function adjustScore(team: GameTeam, delta: number) {
    const result = await supabase.rpc("teacher_adjust_game_score", { p_team_id: team.id, p_delta: delta });
    if (result.error) { setError(result.error.message); return; }
    setTeams(current => current
      .map(item => item.id === team.id ? { ...item, score: Number(result.data) } : item)
      .sort((a,b) => b.score - a.score));
  }

  async function resetScores() {
    if (!game || saving) return;
    setSaving(true); setError('');
    try {
      const result = await supabase.rpc('teacher_reset_class_game', { p_game_id: game.id });
      if (result.error || result.data !== teams.length) throw new Error(result.error?.message ?? 'Some teams were not reset. Reload the scoreboard.');
      await load(); setMessage('Scores reset.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Scores could not be reset.'); }
    finally { setSaving(false); }
  }

  async function finishGame() {
    if (!game) return;
    setSaving(true); setError("");
    const result = await supabase.from("classroom_games").update({ status: "finished" }).eq("id", game.id).select("id").single();
    if (result.error) setError(result.error.message);
    else {
      setMessage("Scoreboard finished. No mastery or permanent learner judgement was created from the game score.");
      setGame(null);
      setTeams([]);
      setSelectedGroups(new Set());
    }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 24 }}>Loading class activity…</div>;

  const backQuery = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";

  return <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 14px 110px" }}>
    <section style={{ borderRadius: 20, padding: 18, background: "linear-gradient(135deg,#312e81,#7c3aed)", color: "#fff", marginBottom: 12 }}>
      <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/groups${backQuery}`)} style={{ minHeight: 38, border: 0, borderRadius: 10, background: "rgba(255,255,255,.15)", color: "#fff", padding: "0 11px", fontWeight: 900 }}>‹ Groups & Lists</button>
      <h1 style={{ margin: "12px 0 3px", fontSize: 23 }}>Class Quiz Scoreboard</h1>
      <div style={{ fontSize: 12, opacity: .8 }}>{classLabel}</div>
    </section>

    {error && <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 13, padding: 12, marginBottom: 10 }}>{error}</div>}
    {message && <div role="status" style={{ background: "#ecfdf5", color: "#065f46", borderRadius: 13, padding: 12, marginBottom: 10 }}>{message}</div>}

    {!game ? <section style={{ background: "#fff", borderRadius: 18, padding: 15, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>START A CLASSROOM GAME</div>
      <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>Use existing game teams from Groups & Lists. Scores stay inside this classroom activity and are never converted into mastery, marks or permanent learner labels.</p>
      <input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Revision league" style={{ width: "100%", boxSizing: "border-box", minHeight: 44, border: "1px solid #d1d5db", borderRadius: 11, padding: "0 11px", fontSize: 16 }} />
      <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
        {groups.map(group => <label key={group.id} style={{ minHeight: 46, border: "1px solid #e5e7eb", borderRadius: 11, padding: "0 11px", display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={selectedGroups.has(group.id)} onChange={() => toggleGroup(group.id)} />
          <strong style={{ fontSize: 12 }}>{group.name}</strong>
        </label>)}
        {groups.length === 0 && <div style={{ padding: 16, color: "#6b7280", textAlign: "center" }}>No game teams yet. Return to Groups & Lists and create random teams first.</div>}
      </div>
      <button type="button" onClick={() => void startGame()} disabled={saving || selectedGroups.size < 2} style={{ width: "100%", minHeight: 46, marginTop: 12, border: 0, borderRadius: 11, background: selectedGroups.size >= 2 ? "#312e81" : "#e5e7eb", color: selectedGroups.size >= 2 ? "#fff" : "#9ca3af", fontWeight: 900 }}>{saving ? "Starting…" : "Start scoreboard"}</button>
    </section> : <section style={{ background: "#fff", borderRadius: 18, padding: 15, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div><div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>LIVE SCOREBOARD</div><div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>{game.title}</div></div>
        <button type="button" onClick={() => void resetScores()} disabled={saving} style={{ minHeight: 36, border: "1px solid #d1d5db", borderRadius: 9, background: "#fff", padding: "0 10px", fontWeight: 800 }}>Reset</button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>{teams.map((team,index) => <div key={team.id} style={{ display: "grid", gridTemplateColumns: "26px 1fr 40px 46px 40px", gap: 7, alignItems: "center", background: "#f8fafc", borderRadius: 12, padding: 9 }}>
        <strong style={{ textAlign: "center" }}>{index + 1}</strong>
        <strong style={{ fontSize: 12 }}>{team.label}</strong>
        <button type="button" onClick={() => void adjustScore(team,-1)} disabled={saving} style={{ height: 38, border: "1px solid #d1d5db", borderRadius: 9, background: "#fff", fontWeight: 900 }}>−</button>
        <span style={{ textAlign: "center", fontSize: 20, fontWeight: 900 }}>{team.score}</span>
        <button type="button" onClick={() => void adjustScore(team,1)} disabled={saving} style={{ height: 38, border: 0, borderRadius: 9, background: "#312e81", color: "#fff", fontWeight: 900 }}>+</button>
      </div>)}</div>
      <button type="button" onClick={() => void finishGame()} disabled={saving} style={{ width: "100%", minHeight: 46, marginTop: 12, border: 0, borderRadius: 11, background: "#111827", color: "#fff", fontWeight: 900 }}>{saving ? "Finishing…" : "Finish scoreboard"}</button>
    </section>}
  </div>;
}

export default function ClassGamePage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}><GamePageInner /></Suspense>;
}

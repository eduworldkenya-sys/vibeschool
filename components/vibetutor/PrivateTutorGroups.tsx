"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Connected = { id: string; student: string | null; status: string };
type Group = { id: string; title: string; members: { invitation_id: string; student: string }[] };
const panel: React.CSSProperties = { display: "grid", gap: 10, border: "1px solid var(--teacher-border, #dfe5de)", borderRadius: 14, padding: 14, background: "var(--teacher-surface, #fff)" };
const button: React.CSSProperties = { minHeight: 42, padding: "9px 13px", borderRadius: 10, border: 0, background: "#087451", color: "#fff", fontWeight: 700 };
export default function PrivateTutorGroups({ learners }: { learners: Connected[] }) {
  const accepted = learners.filter(l => l.status === "accepted");
  const [groups, setGroups] = useState<Group[]>([]);
  const [title, setTitle] = useState("");
  const [groupTasks, setGroupTasks] = useState<Record<string, { title: string; instructions: string }>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const { data, error: e } = await getSupabaseClient().rpc("vibetutor_my_private_groups");
    if (e) { setError("Tutoring groups are unavailable. Please retry."); return; }
    setGroups((data ?? []) as Group[]);
    setError("");
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (!title.trim() || busy) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await getSupabaseClient().rpc("vibetutor_create_private_group", { p_title: title.trim() });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setTitle(""); setNotice("Tutoring group created."); await load();
  }
  async function add(groupId: string) {
    const invitationId = selection[groupId]; if (!invitationId || busy) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await getSupabaseClient().rpc("vibetutor_add_private_group_member", { p_group: groupId, p_invitation: invitationId });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setSelection(old => ({ ...old, [groupId]: "" }));
    setNotice("Approved learner added to group."); await load();
  }
  async function remove(groupId: string, invitationId: string) {
    if (busy || !window.confirm("Remove this learner from the group? Their individual tutoring connection will remain.")) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await getSupabaseClient().rpc("vibetutor_remove_private_group_member", { p_group: groupId, p_invitation: invitationId });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setNotice("Learner removed from this group."); await load();
  }
  async function assign(groupId: string) {
    const task = groupTasks[groupId]; if (!task?.title.trim() || busy) return;
    setBusy(true); setError(""); setNotice("");
    const { data: count, error: e } = await getSupabaseClient().rpc("vibetutor_assign_private_group_task", {
      p_group: groupId, p_title: task.title.trim(), p_instructions: task.instructions.trim(),
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setGroupTasks(old => ({ ...old, [groupId]: { title: "", instructions: "" } }));
    setNotice(`Assigned task to ${count ?? 0} approved learners.`); await load();
  }
  return <section aria-label="Private tutoring groups" style={panel}>
    <h2 style={{ margin: 0, fontSize: 18 }}>Tutoring groups</h2>
    <p style={{ margin: 0, fontSize: 13, opacity: .8 }}>Organise approved learners together without changing their school classes or individual identity. A shared task creates separate learner submissions and individual feedback. Live group classrooms are not yet enabled.</p>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={e => void create(e)} style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      <input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} aria-label="New group name" placeholder="e.g. Grade 9 revision" style={{ flex: "1 1 170px", minHeight: 44, border: "1px solid #dfe5de", borderRadius: 10, padding: 10 }}/>
      <button style={button} disabled={busy || !title.trim()}>Create group</button>
    </form>
    {groups.length === 0 ? <p style={{ fontSize: 13 }}>No private tutoring groups yet.</p> :
      groups.map(g => <article key={g.id} style={{ ...panel, background: "transparent" }}>
        <strong>{g.title}</strong><span style={{ fontSize: 13 }}>{g.members.length} approved {g.members.length === 1 ? "learner" : "learners"}</span>
        {g.members.length > 0 && <div style={{ display: "grid", gap: 5 }}>{g.members.map(m => <div key={m.invitation_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}><span style={{ fontSize: 13 }}>{m.student}</span><button type="button" disabled={busy} onClick={() => void remove(g.id, m.invitation_id)} style={{ border: 0, background: "transparent", color: "#b91c1c", minHeight: 40 }}>Remove</button></div>)}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <select aria-label={`Select learner for ${g.title}`} value={selection[g.id] ?? ""} onChange={e => setSelection(old => ({ ...old, [g.id]: e.target.value }))}
            style={{ flex: "1 1 160px", minHeight: 44, borderRadius: 10, border: "1px solid #dfe5de", padding: 9 }}>
            <option value="">Choose approved learner</option>
            {accepted.filter(l => !g.members.some(m => m.invitation_id === l.id)).map(l => <option key={l.id} value={l.id}>{l.student || "Connected learner"}</option>)}
          </select>
          <button type="button" style={button} disabled={!selection[g.id] || busy} onClick={() => void add(g.id)}>Add learner</button>
        </div>
        <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>Assign one task to this group
            <input maxLength={120} placeholder="Task title" value={groupTasks[g.id]?.title ?? ""}
              onChange={e => setGroupTasks(old => ({ ...old, [g.id]: { title: e.target.value, instructions: old[g.id]?.instructions ?? "" } }))}
              style={{ display: "block", width: "100%", minHeight: 44, border: "1px solid #dfe5de", borderRadius: 10, padding: 9 }}/>
          </label>
          <textarea aria-label={`Instructions for ${g.title}`} maxLength={2000} rows={2} placeholder="Instructions for each learner"
            value={groupTasks[g.id]?.instructions ?? ""}
            onChange={e => setGroupTasks(old => ({ ...old, [g.id]: { title: old[g.id]?.title ?? "", instructions: e.target.value } }))}
            style={{ width: "100%", border: "1px solid #dfe5de", borderRadius: 10, padding: 9 }}/>
          <button type="button" style={button} disabled={busy || !groupTasks[g.id]?.title.trim() || g.members.length === 0}
            onClick={() => void assign(g.id)}>Assign to group</button>
        </div>

      </article>)}
  </section>;
}

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
  return <section aria-label="Private tutoring groups" style={panel}>
    <h2 style={{ margin: 0, fontSize: 18 }}>Tutoring groups</h2>
    <p style={{ margin: 0, fontSize: 13, opacity: .8 }}>Organise approved learners together without changing their school classes or individual identity. Group classroom and bulk assignments are not yet enabled.</p>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={e => void create(e)} style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      <input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} aria-label="New group name" placeholder="e.g. Grade 9 revision" style={{ flex: "1 1 170px", minHeight: 44, border: "1px solid #dfe5de", borderRadius: 10, padding: 10 }}/>
      <button style={button} disabled={busy || !title.trim()}>Create group</button>
    </form>
    {groups.length === 0 ? <p style={{ fontSize: 13 }}>No private tutoring groups yet.</p> :
      groups.map(g => <article key={g.id} style={{ ...panel, background: "transparent" }}>
        <strong>{g.title}</strong><span style={{ fontSize: 13 }}>{g.members.length} approved {g.members.length === 1 ? "learner" : "learners"}</span>
        {g.members.length > 0 && <p style={{ margin: 0, fontSize: 13 }}>{g.members.map(m => m.student).join(", ")}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <select aria-label={`Select learner for ${g.title}`} value={selection[g.id] ?? ""} onChange={e => setSelection(old => ({ ...old, [g.id]: e.target.value }))}
            style={{ flex: "1 1 160px", minHeight: 44, borderRadius: 10, border: "1px solid #dfe5de", padding: 9 }}>
            <option value="">Choose approved learner</option>
            {accepted.filter(l => !g.members.some(m => m.invitation_id === l.id)).map(l => <option key={l.id} value={l.id}>{l.student || "Connected learner"}</option>)}
          </select>
          <button type="button" style={button} disabled={!selection[g.id] || busy} onClick={() => void add(g.id)}>Add learner</button>
        </div>
      </article>)}
  </section>;
}

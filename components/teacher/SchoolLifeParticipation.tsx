"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Check } from "lucide-react";
import LearnerDetailSheet from "./LearnerDetailSheet";
import { supabase } from "@/lib/supabase";
import styles from "./SchoolLifeParticipation.module.css";

type Activity = {
  id: string; title: string; category: string; details: string | null; scope: "class" | "school";
};
type Membership = {
  id: string; activity_id: string; student_id: string; involvement: "interested" | "participant" | "member";
  position: string | null; note: string | null; started_on: string;
};
type Learner = { id: string; name: string };
type Snapshot = { activities: Activity[]; memberships: Membership[]; students: Learner[] };
type Props = { classId: string; studentId?: string; preselectedStudents?: string[]; onBusyChange?: (busy: boolean) => void };

const empty: Snapshot = { activities: [], memberships: [], students: [] };
const categories = [
  ["sport", "Sport"], ["club", "Club"], ["arts", "Arts & talent"],
  ["event", "Event"], ["community", "Community"], ["other", "Other"],
] as const;
const statuses = [["interested", "Interested"], ["participant", "Participant"], ["member", "Team / club member"]] as const;
function isSchoolLifeSnapshot(value: unknown): value is Snapshot {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && "activities" in value && Array.isArray(value.activities)
    && "memberships" in value && Array.isArray(value.memberships)
    && "students" in value && Array.isArray(value.students);
}

const friendlyError = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "Could not save. Try again.");

export default function SchoolLifeParticipation({ classId, studentId, preselectedStudents = [], onBusyChange }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<string[]>(() => studentId ? [studentId] : preselectedStudents);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("sport");
  const [details, setDetails] = useState("");
  const [involvement, setInvolvement] = useState<Membership["involvement"]>("participant");
  const [position, setPosition] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const mutationLock = useRef(false);
  const createdActivity = useRef<string | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const reload = useCallback(async () => {
    const { data, error: readError } = await supabase.rpc(
      "teacher_school_life_snapshot" as never, { p_class_id: classId } as never,
    );
    if (readError) throw new Error(readError.message);
    const payload: unknown = data;
    if (!isSchoolLifeSnapshot(payload)) throw new Error("School-life information could not be read.");
    setSnapshot(payload);
  }, [classId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void reload().catch((cause) => { if (mounted) setError(friendlyError(cause)); })
      .finally(() => { if (mounted) setLoading(false); });
    const refresh = () => { if (document.visibilityState === "visible") void reload().catch(() => {}); };
    document.addEventListener("visibilitychange", refresh);
    return () => { mounted = false; document.removeEventListener("visibilitychange", refresh); };
  }, [reload]);

  const activities = snapshot.activities;
  const currentId = activities.some(a => a.id === selectedId) ? selectedId : (activities.find(a => studentId && snapshot.memberships.some(m => m.student_id === studentId && m.activity_id === a.id))?.id ?? activities[0]?.id ?? "");
  const activity = activities.find(a => a.id === currentId);
  const members = useMemo(() => snapshot.memberships.filter(m => m.activity_id === currentId), [snapshot.memberships, currentId]);
  const selectedMember = studentId ? members.find(m => m.student_id === studentId) : undefined;
  const filteredStudents = useMemo(() => snapshot.students.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [snapshot.students,search]);

  useEffect(() => {
    if (!studentId) return;
    setInvolvement(selectedMember?.involvement ?? "participant");
    setPosition(selectedMember?.position ?? "");
    setNote(selectedMember?.note ?? "");
  }, [studentId, currentId, selectedMember?.id, selectedMember?.involvement, selectedMember?.position, selectedMember?.note]);

  function openCreate(a?: Activity) {
    createdActivity.current = null;
    setEditingActivity(a?.id ?? null);
    setTitle(a?.title ?? "");
    setCategory(a?.category ?? "sport");
    setDetails(a?.details ?? "");
    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function saveActivity() {
    if (mutationLock.current) return;
    if (title.trim().length < 2) { setError("Enter an activity name."); return; }
    mutationLock.current = true; setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    try {
      let activityId = createdActivity.current;
      if (!activityId) {
        const { data, error: writeError } = await supabase.rpc(
          "teacher_save_school_life_activity",
          { p_class_id: classId, p_activity_id: editingActivity, p_title: title.trim(),
            p_category: category, p_details: details.trim() || null, p_scope: "class" },
        );
        if (writeError) {
          if (writeError.code === "23505") {
            await reload();
            throw new Error("An activity with this name already exists. Close this form and select it to add participation.");
          }
          throw new Error(writeError.message);
        }
        if (typeof data !== "string" || !data) throw new Error("The activity could not be confirmed. Refresh before trying again.");
        activityId = data;
        createdActivity.current = activityId;
      }
      setSelectedId(activityId);
      // Creation and participation use their existing canonical authorities. Keep the
      // committed activity ID during partial failure so retry never creates it twice.
      if (studentId && !editingActivity) {
        const key = JSON.stringify({ activityId, studentId });
        if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
        const result = await supabase.rpc("teacher_set_school_life_members", {
          p_activity_id: activityId, p_student_ids: [studentId], p_action: "save",
          p_involvement: "participant", p_position: null, p_note: null, p_request_id: retry.current.id,
        });
        if (result.error) throw new Error(`Activity created. Learner participation is not confirmed. Retry Save to finish: ${result.error.message}`);
      }
      await reload();
      window.dispatchEvent(new Event("learner-school-life-changed"));
      createdActivity.current = null; retry.current = null;
      setShowForm(false);
      setMessage(editingActivity ? "Shared class activity updated." : studentId ? "Activity created and learner added as a participant." : "Activity created. Add participating learners below.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { mutationLock.current = false; setBusy(false); onBusyChange?.(false); }
  }

  async function saveMembers(action: "save" | "end") {
    const ids = studentId ? [studentId] : selected;
    if (!currentId || !ids.length || mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    const payload = JSON.stringify({ currentId, ids: [...ids].sort(), action,
      involvement, position: action === "save" ? position.trim() : "", note: action === "save" ? note.trim() : "" });
    if (retry.current?.key !== payload) retry.current = { key: payload, id: crypto.randomUUID() };
    try {
      const { data, error: writeError } = await supabase.rpc(
        "teacher_set_school_life_members" as never,
        { p_activity_id: currentId, p_student_ids: ids, p_action: action,
          p_involvement: involvement, p_position: action === "save" ? position.trim() || null : null,
          p_note: action === "save" ? note.trim() || null : null, p_request_id: retry.current.id } as never,
      );
      if (writeError) throw new Error(writeError.message);
      retry.current = null; // Server has committed. Never replay this request.
      setMessage(action === "end" ? "Participation ended." : `Saved for ${ids.length} learner${ids.length === 1 ? "" : "s"}.`);
      if (!studentId) setSelected([]);
      await reload();
      window.dispatchEvent(new Event("learner-school-life-changed"));
    } catch (cause) { setError(friendlyError(cause)); }
    finally { mutationLock.current = false; setBusy(false); onBusyChange?.(false); }
  }

  return (
    <section className={styles.root} aria-label="Learner activities and participation">
      <div className={styles.heading}>
        <div><h2>Activities & participation</h2><p>Sports, clubs, talents and school activities</p></div>
        <button type="button" className={styles.secondary} onClick={() => openCreate()} disabled={busy}>
          <Plus size={16}/> New
        </button>
      </div>
      {loading && <p className={styles.muted} role="status">Loading activities…</p>}
      {error && !showForm && <p className={styles.error} role="alert">{error} <button type="button" disabled={busy} onClick={() => { setError(""); void reload().catch(cause => setError(friendlyError(cause))); }}>Retry loading</button></p>}
      {message && <p className={styles.success} role="status">{message}</p>}
      {!loading && (
        <>
          {!activities.length && <p className={styles.empty}>No activities recorded yet. Create a sport, club or activity to start.</p>}
          {!!activities.length && (
            <div className={styles.activityTabs} aria-label="Activities">
              {activities.map(a => {
                const count = snapshot.memberships.filter(m => m.activity_id === a.id).length;
                const studentMember = studentId && snapshot.memberships.some(m => m.activity_id === a.id && m.student_id === studentId);
                return (
                  <button type="button" key={a.id} disabled={busy} onClick={() => { setSelectedId(a.id); setMessage(""); setError(""); }}
                    aria-pressed={a.id === currentId} className={a.id === currentId ? styles.activeTab : styles.tab}>
                    {a.title}<span>{studentId ? (studentMember ? " ✓" : "") : ` · ${count}`}</span>
                  </button>
                );
              })}
            </div>
          )}
          {activity && (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><strong>{activity.title}</strong><small>{categories.find(c => c[0] === activity.category)?.[1] ?? "Activity"} · {activity.scope === "school" ? "School-wide" : "This class"}</small></div>
                {activity.scope === "class" && <button type="button" aria-label={`Edit ${activity.title}`} onClick={() => openCreate(activity)} className={styles.icon} disabled={busy}><Pencil size={17}/></button>}
              </div>
              {activity.details && <p className={styles.muted}>{activity.details}</p>}
              {studentId ? (
                <div className={styles.fields}>
                  <div className={styles.current}>
                    {selectedMember ? `Recorded: ${selectedMember.involvement}${selectedMember.position ? " · " + selectedMember.position : ""}` : "Not yet participating"}
                  </div>
                  <label>Involvement<select disabled={busy} value={involvement} onChange={e => { setInvolvement(e.target.value as Membership["involvement"]); if (e.target.value === "interested") setPosition(""); }}>
                    {statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select></label>
                  {involvement !== "interested" && <label>Position (optional)<input disabled={busy} value={position} onChange={e => setPosition(e.target.value)} maxLength={60} placeholder="e.g. Goalkeeper, Captain"/></label>}
                  <label>Note (optional)<input disabled={busy} value={note} onChange={e => setNote(e.target.value)} maxLength={400} placeholder="Brief factual detail"/></label>
                  <div className={styles.actions}>
                    <button disabled={busy} type="button" className={styles.primary} onClick={() => void saveMembers("save")}><Check size={16}/>{busy ? "Saving…" : selectedMember ? "Update" : "Add participation"}</button>
                    {selectedMember && <button disabled={busy} type="button" className={styles.secondary} onClick={() => void saveMembers("end")}>End</button>}
                  </div>
                </div>
              ) : (
                <div className={styles.fields}>
                  <div className={styles.current}>{members.length} participating in this class</div>
                  <input aria-label="Find a learner" placeholder="Find learner" value={search} onChange={e => setSearch(e.target.value)}/>
                  <div className={styles.selectBar}><button type="button" onClick={() => setSelected(filteredStudents.map(s => s.id))}>Select visible</button><button type="button" onClick={() => setSelected([])}>Clear</button><span>{selected.length} selected</span></div>
                  <div className={styles.roster}>
                    {filteredStudents.map(s => {
                      const record = members.find(m => m.student_id === s.id);
                      return <label key={s.id} className={styles.learnerRow}>
                        <input type="checkbox" checked={selected.includes(s.id)}
                          onChange={() => setSelected(old => old.includes(s.id) ? old.filter(id => id !== s.id) : [...old, s.id])}/>
                        <span>{s.name}</span><small>{record ? [record.involvement, record.position].filter(Boolean).join(" · ") : "—"}</small>
                      </label>;
                    })}
                  </div>
                  <label>Involvement for selection<select disabled={busy} value={involvement} onChange={e => { setInvolvement(e.target.value as Membership["involvement"]); if(e.target.value === "interested") setPosition(""); }}>
                    {statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select></label>
                  {involvement !== "interested" && <label>Position (optional)<input maxLength={60} value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Team captain"/></label>}
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} disabled={busy || !selected.length} onClick={() => void saveMembers("save")}>{busy ? "Saving…" : "Save selected"}</button>
                    <button type="button" className={styles.secondary} disabled={busy || !selected.some(id => members.some(m => m.student_id === id))} onClick={() => void saveMembers("end")}>End selected</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {showForm && <LearnerDetailSheet title={editingActivity ? "Edit shared activity" : "New activity"} learnerName={studentId ? snapshot.students.find(s => s.id === studentId)?.name ?? "Learner" : "This class"} busy={busy} onClose={() => setShowForm(false)}>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <label>Name<input disabled={busy || !!createdActivity.current} maxLength={90} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Football, Wildlife Club"/></label>
              <label>Type<select disabled={busy || !!createdActivity.current} value={category} onChange={e => setCategory(e.target.value)}>{categories.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Details (optional)<input disabled={busy || !!createdActivity.current} maxLength={400} value={details} onChange={e => setDetails(e.target.value)} placeholder="e.g. School field · Tuesday"/></label>
              <p>{editingActivity ? "Changes update this class activity for everyone. Use Position and Note to change only this learner’s participation." : studentId ? "Creates a class activity and adds this learner as a participant. You can update involvement and position next." : "Creates an activity for this class. School-wide activities are managed by school administration."}</p>
              <div className={styles.actions}><button className={styles.secondary} onClick={() => setShowForm(false)} disabled={busy}>Cancel</button><button className={styles.primary} onClick={() => void saveActivity()} disabled={busy || title.trim().length < 2}>{busy ? "Saving…" : createdActivity.current ? "Retry Save" : studentId && !editingActivity ? "Create & add learner" : "Save activity"}</button></div>
          </LearnerDetailSheet>}
        </>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SchoolLifeParticipation from "./SchoolLifeParticipation";

type Group = { id: string; name: string; mode: string; purpose: string | null; subject_id: string | null; expires_at: string | null; subjectName: string | null; member: boolean; reason: string | null };
type Duty = { id: string; title: string; starts_on: string; ends_on: string; members: { student_id: string; active: boolean }[] };
type Loan = { id: string; student_id: string; book_title: string; due_date: string; returned_at: string | null };
type Book = { id: string; title: string; available_copies: number };
type Operations = { duties: Duty[]; borrowings: Loan[]; books: Book[] };
function operations(value: unknown): Operations {
  if (!value || typeof value !== "object" || !("duties" in value) || !Array.isArray(value.duties)
    || !("borrowings" in value) || !Array.isArray(value.borrowings) || !("books" in value) || !Array.isArray(value.books)) {
    throw new Error("Learner records could not be read. Retry.");
  }
  return value as Operations;
}
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

export default function LearnerRelatedRecords({ kind, classId, studentId, subjectId, onBusyChange }: {
  kind: "groups" | "roles" | "resources" | "activities"; classId: string; studentId: string; subjectId: string | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [data, setData] = useState<Operations>({ duties: [], borrowings: [], books: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bookId, setBookId] = useState("");
  const [due, setDue] = useState("");
  const [returnId, setReturnId] = useState<string | null>(null);
  const [condition, setCondition] = useState("good");
  const request = useRef<{ key: string; id: string } | null>(null);
  const lock = useRef(false);
  const load = useCallback(async () => {
    if (kind === "activities") return;
    if (kind === "groups") {
      let query = supabase.from("class_groups").select("id,name,mode,purpose,subject_id,expires_at")
        .eq("class_id", classId).is("archived_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      if (subjectId) query = query.eq("subject_id", subjectId);
      const result = await query.order("name");
      if (result.error) throw result.error;
      const rows: Omit<Group, "member" | "reason" | "subjectName">[] = result.data ?? [];
      const subjectIds = [...new Set(rows.map(group => group.subject_id).filter((id): id is string => !!id))];
      const subjectResult = subjectIds.length
        ? await supabase.from("subjects").select("id,name").in("id", subjectIds)
        : { data: [], error: null };
      if (subjectResult.error) throw subjectResult.error;
      const subjectNames = new Map<string, string>((subjectResult.data ?? []).map((item: { id: string; name: string }): [string, string] => [item.id, item.name]));
      const savedMemberships = rows.length
        ? await supabase.from("class_group_members").select("group_id,student_id").eq("student_id", studentId).in("group_id", rows.map(group => group.id))
        : { data: [], error: null };
      if (savedMemberships.error) throw savedMemberships.error;
      const memberIds = new Set((savedMemberships.data ?? []).map((member: { group_id: string }) => member.group_id));
      const resolved = await Promise.all(rows.map(async group => {
        if (group.mode !== "smart") return { ...group, member: memberIds.has(group.id), reason: null };
        const response = await supabase.rpc("teacher_resolve_class_group_members", { p_group_id: group.id });
        if (response.error) throw response.error;
        const member = (response.data ?? []).find((item: { student_id: string }) => item.student_id === studentId);
        return { ...group, member: !!member, reason: member?.reason ?? null };
      }));
      setGroups(resolved.map(group => ({ ...group, subjectName: group.subject_id ? subjectNames.get(group.subject_id) ?? "Subject unavailable" : null })));
    } else {
      if (subjectId) throw new Error("Open the class-teacher view for school-life records.");
      const result = await supabase.rpc("teacher_get_class_operations", { p_class_id: classId });
      if (result.error) throw result.error;
      setData(operations(result.data));
    }
  }, [classId, studentId, subjectId, kind]);
  useEffect(() => {
    setLoading(true); setError("");
    void load().catch(cause => setError(cause instanceof Error ? cause.message : cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "Records unavailable. Retry."))
      .finally(() => setLoading(false));
  }, [load]);
  async function act(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError(""); setMessage("");
    try { await fn(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The change could not be confirmed. Retry to check the saved record."); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  if (subjectId && kind !== "groups") return <p role="alert">School-life editing is available in the class-teacher view.</p>;
  if (kind === "activities") return <SchoolLifeParticipation classId={classId} studentId={studentId} onBusyChange={onBusyChange}/>;
  return <>
    {loading && <p role="status">Loading learner records…</p>}
    {error && <div role="alert">{error}<button disabled={busy} onClick={() => void act(load)}>Retry</button></div>}
    {message && <p role="status">{message}</p>}
    {!loading && !error && kind === "groups" && <>
      {!groups.some(group => group.member) && <p>No current group memberships for this learner.</p>}
      {[...groups].sort((a, b) => Number(b.member) - Number(a.member)).map(group => <article key={group.id}>
        <strong>{group.name}</strong><p>{group.subjectName ? `Subject: ${group.subjectName}` : "Class-wide group"} · {group.purpose ? `Purpose: ${group.purpose}` : "Purpose not specified"}</p>
        <p>{group.expires_at ? `Expires ${new Date(group.expires_at).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric" })}` : "Review date not recorded"}</p>
        <p>{group.member ? `Member${group.reason && group.mode === "smart" ? ` · ${group.reason}` : ""}` : "Not a member"} · {group.mode === "smart" ? "Smart list" : "Saved group"}</p>
        {group.mode !== "smart" && <button disabled={busy} onClick={() => void act(async () => {
          const result = group.member
            ? await supabase.from("class_group_members").delete().eq("group_id", group.id).eq("student_id", studentId)
            : await supabase.from("class_group_members").upsert({ group_id: group.id, student_id: studentId }, { onConflict: "group_id,student_id", ignoreDuplicates: true });
          if (result.error) throw result.error;
          setMessage(group.member ? "Removed from this group." : "Added to this group.");
        })}>{group.member ? "Remove learner" : "Add learner"}</button>}
        {group.mode === "smart" && <p>Membership follows the list’s rules.</p>}
      </article>)}
      <Link href={`/teacher/classhub/${classId}/groups?selected=${studentId}${subjectId ? `&subjectId=${encodeURIComponent(subjectId)}` : ""}`}>Open full Groups workspace</Link>
    </>}
    {!loading && !error && kind === "roles" && <>
      <h3>Duties and responsibilities</h3>
      {data.duties.filter(duty => duty.members.some(member => member.student_id === studentId)).map(duty => <article key={duty.id}>
        <strong>{duty.title}</strong><p>{duty.starts_on} – {duty.ends_on}</p>
        <p>{duty.members.some(member => member.student_id === studentId && member.active) ? (duty.starts_on > today() ? "Upcoming" : duty.ends_on < today() ? "Past assignment" : "Current assignment") : "Previous assignment"}</p>
      </article>)}
      {!data.duties.some(duty => duty.members.some(member => member.student_id === studentId)) && <p>No duty assignments recorded.</p>}
      <h3>Team and club positions</h3>
      <SchoolLifeParticipation classId={classId} studentId={studentId} onBusyChange={onBusyChange}/>
      <Link href={`/teacher/classhub/${classId}/operations`}>Manage shared class duty roster</Link>
    </>}
    {!loading && !error && kind === "resources" && <>
      <h3>Borrowed resources</h3>
      {!data.borrowings.some(loan => loan.student_id === studentId) && <p>No borrowing records for this learner.</p>}
      {data.borrowings.filter(loan => loan.student_id === studentId).map(loan => <article key={loan.id}>
        <strong>{loan.book_title}</strong><p>{loan.returned_at ? `Returned ${loan.returned_at.slice(0, 10)}` : `${loan.due_date < today() ? "Overdue" : "Due"} ${loan.due_date}`}</p>
        {!loan.returned_at && (returnId === loan.id ? <>
          <label>Condition on return<select value={condition} onChange={event => setCondition(event.target.value)}><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label>
          <button disabled={busy} onClick={() => void act(async () => {
            const result = await supabase.rpc("teacher_return_class_library_book", { p_borrowing_id: loan.id, p_condition_in: condition });
            if (result.error) throw result.error;
            setReturnId(null); setMessage("Return recorded. Library stock updated.");
          })}>Confirm return</button><button disabled={busy} onClick={() => setReturnId(null)}>Cancel</button>
        </> : <button disabled={busy} onClick={() => { setCondition("good"); setReturnId(loan.id); }}>Record return</button>)}
      </article>)}
      <details><summary>Issue a book to this learner</summary>
        <label>Available book<select value={bookId} onChange={event => setBookId(event.target.value)}><option value="">Choose book</option>{data.books.filter(book => book.available_copies > 0).map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
        <label>Return by<input type="date" value={due} min={today()} onChange={event => setDue(event.target.value)}/></label>
        <button disabled={busy || !bookId || !due || due < today()} onClick={() => void act(async () => {
          const args = { p_class_id: classId, p_student_id: studentId, p_book_id: bookId, p_due_date: due, p_condition: "good" };
          const key = JSON.stringify(args);
          if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
          const result = await supabase.rpc("teacher_issue_class_library_book", { ...args, p_request_id: request.current.id });
          if (result.error) throw result.error;
          request.current = null; setBookId(""); setDue(""); setMessage("Book issued to this learner.");
        })}>Issue book</button>
      </details>
      <Link href={`/teacher/classhub/${classId}/operations`}>Open full Class Operations</Link>
    </>}
  </>;
}

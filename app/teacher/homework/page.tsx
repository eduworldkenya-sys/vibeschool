"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";

type Context = {
  teacher_id: string;
  school_id: string | null;
  state: "ready" | "needs_school" | "needs_class" | "needs_curriculum_reconciliation";
  schools: Array<{ id: string; name: string; active: boolean }>;
  classes: Array<{ class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string }>;
};

type HomeworkItem = {
  id: string;
  title: string;
  subject: string;
  due_date: string | null;
  type: string;
  class_id: string;
  class_name: string;
  class_stream: string;
  submitted: number;
};

type HomeworkRow = {
  id: string;
  title: string;
  subject: string | null;
  due_date: string | null;
  type: string | null;
  class_id: string;
  homework_submissions: Array<{ id: string; student_id: string; status: string }> | null;
};

type Filter = "all" | "active" | "overdue";

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", weekday: "short", day: "numeric", month: "short" });
}

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async (requestedSchoolId?: string | null) => {
    const { data, error: contextError } = await supabase.rpc("teacher_get_operating_context", {
      p_requested_school_id: requestedSchoolId ?? undefined,
    });
    if (contextError) throw contextError;
    return data as Context;
  }, []);

  const loadItems = useCallback(async (ctx: Context) => {
    if (!ctx.school_id || ctx.classes.length === 0) {
      setItems([]);
      return;
    }
    const classIds = Array.from(new Set(ctx.classes.map((item) => item.class_id)));
    const classMap = new Map<string, { name: string; stream: string }>();
    for (const assignment of ctx.classes) {
      if (!classMap.has(assignment.class_id)) {
        classMap.set(assignment.class_id, {
          name: assignment.class_name,
          stream: assignment.stream ?? "",
        });
      }
    }

    const homeworkRes = await supabase.from("homework")
      .select("id,title,subject,due_date,type,class_id,homework_submissions(id,student_id,status)")
      .eq("teacher_id", ctx.teacher_id).eq("school_id", ctx.school_id)
      .in("class_id", classIds).order("due_date", { ascending: false });
    if (homeworkRes.error) throw homeworkRes.error;

    setItems(((homeworkRes.data ?? []) as HomeworkRow[]).map((row) => {
      const cls = classMap.get(row.class_id);
      return {
        id: row.id,
        title: row.title,
        subject: row.subject ?? "",
        due_date: row.due_date,
        type: row.type ?? "assignment",
        class_id: row.class_id,
        class_name: cls?.name ?? "Class",
        class_stream: cls?.stream ?? "",
        submitted: new Set((row.homework_submissions ?? []).filter(sub => typeof sub.student_id === 'string' && ['submitted', 'received', 'under_review', 'marked'].includes(sub.status)).map(sub => sub.student_id)).size,
      } satisfies HomeworkItem;
    }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const ctx = await loadContext();
      setContext(ctx);
      await loadItems(ctx);
    } catch (loadError) {
      console.error("[TeacherHomework] load", loadError);
      setError("Homework could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [loadContext, loadItems, router]);

  useEffect(() => { void load(); }, [load]);

  async function changeSchool(schoolId: string) {
    if (!schoolId || schoolId === context?.school_id) return;
    setLoading(true);
    setError(null);
    setClassFilter("");
    try {
      const { error: setSchoolError } = await supabase.rpc("teacher_set_active_school", { p_school_id: schoolId });
      if (setSchoolError) throw setSchoolError;
      const next = await loadContext(schoolId);
      setContext(next);
      await loadItems(next);
    } catch (schoolError) {
      console.error("[TeacherHomework] school", schoolError);
      setError("That school could not be selected. Reload to confirm the active school before continuing.");
    } finally {
      setLoading(false);
    }
  }

  const today = nairobiDateStr();
  const shown = useMemo(() => items.filter(item =>
    (!classFilter || item.class_id === classFilter) &&
    `${item.title} ${item.subject} ${item.class_name}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === 'all' || (filter === 'overdue' ? Boolean(item.due_date && item.due_date.slice(0, 10) < today) : !item.due_date || item.due_date.slice(0, 10) >= today))
  ), [items, classFilter, query, filter, today]);
  const classes = Array.from(new Map((context?.classes ?? []).map(c => [c.class_id, c])).values());
  const control = { minHeight: 44, border: '1px solid #cbd5cf', borderRadius: 6, padding: '8px 12px', background: '#fff', color: '#24352b', font: 'inherit' };
  return (
    <main className="vs-teacher-workspace" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px' }}>
      <header style={{ borderBottom: '1px solid #dfe5de', paddingBottom: 18, marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>Homework</h1>
        <p style={{ margin: 0, color: '#627168', lineHeight: 1.5 }}>Set take-home assignments and review submissions. For classwork, exercises and CATs, open <a href="/teacher/assessment">Assessments</a>.</p>
        {context && context.schools.length > 1 && <label style={{ display: 'block', marginTop: 12 }}>School <select aria-label="Active school" disabled={loading} value={context.school_id ?? ''} onChange={e => void changeSchool(e.target.value)} style={control}>{context.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      </header>
      {error && <p role="alert">{error} <button style={control} onClick={() => void load()}>Retry</button></p>}
      {loading ? <p role="status">Loading homework…</p> : error ? null : context?.state === 'needs_school' ? <p>Connect a school before setting homework. <a href="/teacher/onboarding/school">Connect school</a></p> : context?.state === 'needs_class' ? <p>Add your teaching class first. <a href="/teacher/onboarding/class">Set up class</a></p> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <input aria-label="Search homework" placeholder="Find an assignment" value={query} onChange={e => setQuery(e.target.value)} style={{ ...control, flex: '1 1 200px', minWidth: 0 }} />
            <select aria-label="Filter by class" value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ ...control, maxWidth: '100%' }}><option value="">All classes</option>{classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name} {c.stream}</option>)}</select>
            <select aria-label="Filter by due date" value={filter} onChange={e => setFilter(e.target.value as Filter)} style={control}><option value="all">Any due date</option><option value="active">Upcoming / undated</option><option value="overdue">Past due date</option></select>
          </div>
          <details style={{ borderBottom: '1px solid #dfe5de', paddingBottom: 12, marginBottom: 16 }}><summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 650 }}>Set homework for a class</summary><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{classes.map(c => <a key={c.class_id} style={{ ...control, display: 'inline-flex', alignItems: 'center' }} href={`/teacher/classhub/${c.class_id}/homework`}>{c.class_name} {c.stream}</a>)}</div></details>
          <p style={{ color: '#627168', fontSize: 13 }}>{shown.length} assignment{shown.length === 1 ? '' : 's'}</p>
          {!shown.length ? <p>No assignments match this view. Change the filters or choose a class above.</p> : <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #dfe5de' }}>{shown.map(item => <li key={item.id} style={{ borderBottom: '1px solid #dfe5de' }}>
            <a href={`/teacher/classhub/${item.class_id}/homework/${item.id}`} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '18px 4px', color: '#24352b', textDecoration: 'none' }}>
              <div style={{ flex: '1 1 230px', minWidth: 0 }}><strong style={{ display: 'block', fontSize: 16, overflowWrap: 'anywhere' }}>{item.title}</strong><span style={{ display: 'block', marginTop: 6, fontSize: 13, color: '#627168' }}>{item.class_name} {item.class_stream}{item.subject ? ` · ${item.subject}` : ''}</span></div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}><div>{item.due_date ? `Due ${formatDate(item.due_date)}` : 'No due date'}</div><div>{item.submitted} learner{item.submitted === 1 ? '' : 's'} submitted</div></div><span aria-hidden="true">→</span>
            </a>
          </li>)}</ul>}
        </>
      )}
    </main>
  );
}

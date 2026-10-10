"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import styles from "@/components/teacher/LearnerExperience.module.css";

type Context = {
  teacher_id: string;
  school_id: string | null;
  state:
    | "ready"
    | "needs_school"
    | "needs_class"
    | "needs_curriculum_reconciliation";
  schools: Array<{ id: string; name: string; active: boolean }>;
  classes: Array<{
    class_id: string;
    class_name: string;
    stream: string | null;
    subject_id: string;
    subject_name: string;
  }>;
};
type Student = {
  id: string;
  name: string;
  admission_number: string | null;
  profile_id: string | null;
};
type ClassGroup = {
  id: string;
  name: string;
  stream: string | null;
  subjects: string[];
  students: Student[];
};

export default function StudentsPage() {
  const router = useRouter(),
    [context, setContext] = useState<Context | null>(null),
    [groups, setGroups] = useState<ClassGroup[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [classFilter, setClassFilter] = useState("all");
  const loadContext = useCallback(async (requestedSchoolId?: string | null) => {
    const { data, error: e } = await supabase.rpc(
      "teacher_get_operating_context",
      { p_requested_school_id: requestedSchoolId ?? undefined },
    );
    if (e) throw e;
    return data as Context;
  }, []);
  const loadGroups = useCallback(async (ctx: Context) => {
    if (!ctx.school_id || !ctx.classes.length) {
      setGroups([]);
      return;
    }
    const classMap = new Map<
      string,
      { name: string; stream: string | null; subjects: Set<string> }
    >();
    for (const a of ctx.classes) {
      const current = classMap.get(a.class_id) ?? {
        name: a.class_name,
        stream: a.stream,
        subjects: new Set<string>(),
      };
      current.subjects.add(a.subject_name);
      classMap.set(a.class_id, current);
    }
    const classIds = Array.from(classMap.keys());
    const { data: enrolments, error: rosterError } = await supabase
      .from("student_classes")
      .select("class_id,student_id")
      .eq("school_id", ctx.school_id)
      .eq("is_current", true)
      .in("class_id", classIds);
    if (rosterError) throw rosterError;
    const studentIds = Array.from(
      new Set((enrolments ?? []).map((row) => row.student_id)),
    );
    const { data: studentRows, error: studentError } = studentIds.length
      ? await supabase
          .from("students")
          .select("id,name,admission_number,profile_id,deleted_at")
          .in("id", studentIds)
          .is("deleted_at", null)
      : { data: [], error: null };
    if (studentError) throw studentError;
    const byId = new Map<string, Student>(
      (studentRows ?? []).map(
        (s) =>
          [
            s.id,
            {
              id: s.id,
              name: s.name,
              admission_number: s.admission_number ?? null,
              profile_id: s.profile_id ?? null,
            },
          ] as const,
      ),
    );
    const grouped = new Map<string, Student[]>();
    for (const row of enrolments ?? []) {
      const student = byId.get(row.student_id);
      if (!student) continue;
      const list = grouped.get(row.class_id) ?? [];
      if (!list.some((item) => item.id === student.id)) list.push(student);
      grouped.set(row.class_id, list);
    }
    setGroups(
      classIds.map((id) => {
        const cls = classMap.get(id)!;
        return {
          id,
          name: cls.name,
          stream: cls.stream,
          subjects: Array.from(cls.subjects).sort(),
          students: (grouped.get(id) ?? []).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        };
      }),
    );
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
      await loadGroups(ctx);
    } catch (e) {
      console.error("[TeacherStudents] load", e);
      setError("Learners could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [loadContext, loadGroups, router]);
  useEffect(() => {
    void load();
  }, [load]);
  async function changeSchool(id: string) {
    if (!id || id === context?.school_id) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase.rpc("teacher_set_active_school", {
        p_school_id: id,
      });
      if (e) throw e;
      const next = await loadContext(id);
      setContext(next);
      setClassFilter("all");
      await loadGroups(next);
    } catch (e) {
      console.error("[TeacherStudents] school", e);
      setError("That school could not be selected.");
    } finally {
      setLoading(false);
    }
  }
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      groups
        .filter((group) => classFilter === "all" || group.id === classFilter)
        .map((group) => ({
          ...group,
          students: normalized
            ? group.students.filter(
                (student) =>
                  student.name.toLowerCase().includes(normalized) ||
                  (student.admission_number ?? "")
                    .toLowerCase()
                    .includes(normalized),
              )
            : group.students,
        }))
        .filter((group) => group.students.length),
    [classFilter, groups, normalized],
  );
  const total = groups.reduce((sum, group) => sum + group.students.length, 0),
    unclaimed = groups.reduce(
      (sum, group) =>
        sum + group.students.filter((student) => !student.profile_id).length,
      0,
    ),
    activeSchool =
      context?.schools.find((s) => s.id === context.school_id)?.name ??
      "School";
  return (
    <main className={styles.listPage}>
      <header className={styles.listHeader}>
        <div>
          <span className={styles.eyebrow}>{activeSchool}</span>
          <h1>
            Learners <b>{loading ? "" : total}</b>
          </h1>
        </div>
        <button
          className={styles.addButton}
          onClick={() => router.push("/teacher/onboarding/students")}
          aria-label="Add learner"
        >
          <Plus size={19} />
          <span>Add</span>
        </button>
      </header>
      <section className={styles.insightStrip} aria-label="Learner summary">
        <div>
          <UsersRound size={18} />
          <strong>{groups.length}</strong>
          <span>Classes</span>
        </div>
        <div>
          <UserRoundCheck size={18} />
          <strong>{total - unclaimed}</strong>
          <span>Connected</span>
        </div>
        <div>
          <span className={unclaimed ? styles.attentionDot : styles.goodDot} />
          <strong>{unclaimed}</strong>
          <span>To link</span>
        </div>
      </section>
      <div className={styles.searchBar}>
        <Search size={18} />
        <input
          aria-label="Search learners"
          type="search"
          placeholder="Search learners"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SlidersHorizontal size={17} aria-hidden="true" />
      </div>
      {groups.length > 1 && (
        <div className={styles.classChips} aria-label="Filter by class">
          <button
            aria-pressed={classFilter === "all"}
            onClick={() => setClassFilter("all")}
          >
            All
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              aria-pressed={classFilter === group.id}
              onClick={() => setClassFilter(group.id)}
            >
              {group.name}
              {group.stream ? ` ${group.stream}` : ""}
            </button>
          ))}
        </div>
      )}
      {context && context.schools.length > 1 && (
        <label className={styles.schoolPicker}>
          <span>School</span>
          <select
            value={context.school_id ?? ""}
            onChange={(e) => void changeSchool(e.target.value)}
          >
            {context.schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <div role="alert" className={styles.errorState}>
          <span>{error}</span>
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {loading ? (
        <div className={styles.skeletonList} aria-label="Loading learners">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} />
          ))}
        </div>
      ) : context?.state === "needs_school" ? (
        <EmptyState
          icon={<UsersRound />}
          title="Connect your school"
          action="Connect"
          onAction={() => router.push("/teacher/onboarding/school")}
        />
      ) : context?.state === "needs_class" ? (
        <EmptyState
          icon={<UsersRound />}
          title="Set up a class"
          action="Set up"
          onAction={() => router.push("/teacher/onboarding/class")}
        />
      ) : !groups.length ? (
        <EmptyState
          icon={<UsersRound />}
          title="No learners yet"
          action="Add learner"
          onAction={() => router.push("/teacher/onboarding/students")}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={<Search />}
          title="No match"
          action="Clear"
          onAction={() => setQuery("")}
        />
      ) : (
        <div className={styles.roster}>
          {filtered.map((group) => (
            <section key={group.id} className={styles.classSection}>
              <div className={styles.classHeading}>
                <div>
                  <h2>
                    {group.name}
                    {group.stream ? ` ${group.stream}` : ""}
                  </h2>
                  <span>{group.subjects.slice(0, 2).join(" · ")}</span>
                </div>
                <b>{group.students.length}</b>
              </div>
              <div className={styles.learnerRows}>
                {group.students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() =>
                      router.push(
                        `/teacher/classhub/${group.id}/student/${student.id}`,
                      )
                    }
                    className={styles.learnerRow}
                  >
                    <span className={styles.avatar}>
                      {initials(student.name)}
                    </span>
                    <span className={styles.learnerIdentity}>
                      <strong>{student.name}</strong>
                      <small>
                        {student.admission_number || "Admission number pending"}
                      </small>
                    </span>
                    {!student.profile_id && (
                      <span className={styles.linkBadge}>Link</span>
                    )}
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
function EmptyState({
  icon,
  title,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <section className={styles.emptyState}>
      {icon}
      <h2>{title}</h2>
      <button onClick={onAction}>{action}</button>
    </section>
  );
}

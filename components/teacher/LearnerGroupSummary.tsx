"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type GroupRow = {
  id: string;
  name: string;
  mode: string;
  purpose: string | null;
  subject_id: string | null;
  expires_at: string | null;
};
type Membership = GroupRow & { subjectName: string | null };

export default function LearnerGroupSummary({
  classId,
  studentId,
  subjectId,
  refreshKey,
  onManage,
}: {
  classId: string;
  studentId: string;
  subjectId: string | null;
  refreshKey: number;
  onManage: () => void;
}) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        let query = supabase.from("class_groups")
          .select("id,name,mode,purpose,subject_id,expires_at")
          .eq("class_id", classId)
          .is("archived_at", null)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        if (subjectId) query = query.eq("subject_id", subjectId);
        const result = await query.order("name");
        if (result.error) throw result.error;
        const groups = (result.data ?? []) as GroupRow[];
        const membershipResult = groups.length
          ? await supabase.from("class_group_members")
              .select("group_id").eq("student_id", studentId)
              .in("group_id", groups.map(group => group.id))
          : { data: [], error: null };
        if (membershipResult.error) throw membershipResult.error;
        const manualIds = new Set((membershipResult.data ?? []).map(item => item.group_id));
        const subjects = [...new Set(groups.map(group => group.subject_id).filter((id): id is string => !!id))];
        const namesResult = subjects.length
          ? await supabase.from("subjects").select("id,name").in("id", subjects)
          : { data: [], error: null };
        if (namesResult.error) throw namesResult.error;
        const names = new Map<string, string>((namesResult.data ?? []).map((row: { id: string; name: string }): [string, string] => [row.id, row.name]));
        const entries = await Promise.all(groups.map(async group => {
          if (group.mode !== "smart") return manualIds.has(group.id) ? group : null;
          const resolved = await supabase.rpc("teacher_resolve_class_group_members", { p_group_id: group.id });
          if (resolved.error) throw resolved.error;
          return (resolved.data ?? []).some((row: { student_id: string }) => row.student_id === studentId) ? group : null;
        }));
        if (!cancelled) setMemberships(entries.filter((group): group is GroupRow => group !== null)
          .map(group => ({ ...group, subjectName: group.subject_id ? names.get(group.subject_id) ?? "Subject not available" : null })));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load group membership.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [classId, studentId, subjectId, refreshKey]);

  return (
    <div className="learner-group-summary" aria-live="polite">
      <div className="learner-group-summary-heading">
        <strong>Current groups</strong>
        <button type="button" onClick={onManage}>Manage groups</button>
      </div>
      {loading ? <p>Loading memberships…</p> : error ? (
        <p role="alert">Group memberships unavailable. <button type="button" onClick={onManage}>Open groups</button></p>
      ) : memberships.length ? memberships.map(group => (
        <div className="learner-group-membership" key={group.id}>
          <strong>{group.name}</strong>
          <span>{[group.subjectName ? `Subject: ${group.subjectName}` : "Class-wide",
            group.purpose ? `Purpose: ${group.purpose}` : "Purpose not specified",
            group.expires_at ? `Expires ${new Date(group.expires_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" })}` : "Review date not recorded"
          ].join(" · ")}</span>
        </div>
      )) : <p>No current group memberships recorded.</p>}
    </div>
  );
}

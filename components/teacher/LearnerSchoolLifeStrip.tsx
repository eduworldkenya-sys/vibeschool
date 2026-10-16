"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import LearnerDetailSheet from "./LearnerDetailSheet";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SchoolLifeParticipation from "@/components/teacher/SchoolLifeParticipation";

type Snapshot = {
  activities: { id: string; title: string }[];
  memberships: { activity_id: string; student_id: string; involvement: string; position: string | null }[];
};
function isActivitySnapshot(value: unknown): value is Snapshot {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && "activities" in value && Array.isArray(value.activities)
    && "memberships" in value && Array.isArray(value.memberships);
}

export default function LearnerSchoolLifeStrip({ classId, studentId }: { classId: string; studentId: string }) {
  const subjectId = useSearchParams().get("subjectId");
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const reload = useCallback(async () => {
    if (subjectId) return;
    const { data, error } = await supabase.rpc("teacher_school_life_snapshot" as never, { p_class_id: classId } as never);
    const payload: unknown = data;
    if (error || !isActivitySnapshot(payload)) return;
    const value = payload;
    const ids = new Set(value.memberships.filter(m => m.student_id === studentId).map(m => m.activity_id));
    setNames(value.activities.filter(a => ids.has(a.id)).map(a => a.title));
    setReady(true);
  }, [classId, studentId, subjectId]);
  useEffect(() => {
    const refresh = () => { void reload(); };
    refresh(); window.addEventListener("learner-school-life-changed", refresh);
    return () => window.removeEventListener("learner-school-life-changed", refresh);
  }, [reload]);
  useEffect(() => {
    if (open) return;
    void reload();
  }, [open, reload]);

  if (!ready || subjectId) return null;
  return <div style={{ padding: "10px 14px 0", maxWidth: 850, margin: "0 auto" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "#eef8f1", border: "1px solid #d9e9df", borderRadius: 12, padding: "10px 12px", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Activity size={18} color="#087455" style={{ flexShrink: 0 }}/>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 12, color: "#1d4d39" }}>School life</strong>
          <span style={{ display: "block", fontSize: 12, color: "#496b58", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {names.length ? names.join(" · ") : "No activities recorded"}
          </span>
        </div>
      </div>
      <button type="button" onClick={() => setOpen(true)}
        style={{ border: "1px solid #8fbaa5", borderRadius: 9, padding: "0 12px", minHeight: 36,
          background: "#fff", color: "#116746", fontSize: 12, fontWeight: 750, flexShrink: 0 }}>Edit</button>
    </div>
    {open && <LearnerDetailSheet title="Activities & participation" learnerName="Current learner" busy={busy} onClose={() => setOpen(false)}>
      <SchoolLifeParticipation classId={classId} studentId={studentId} onBusyChange={setBusy}/>
    </LearnerDetailSheet>}
  </div>;
}

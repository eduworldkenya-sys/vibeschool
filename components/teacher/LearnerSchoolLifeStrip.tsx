"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, X } from "lucide-react";
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
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const reload = useCallback(async () => {
    const { data, error } = await supabase.rpc("teacher_school_life_snapshot" as never, { p_class_id: classId } as never);
    if (error || !isActivitySnapshot(data)) return;
    const value = data;
    const ids = new Set(value.memberships.filter(m => m.student_id === studentId).map(m => m.activity_id));
    setNames(value.activities.filter(a => ids.has(a.id)).map(a => a.title));
    setReady(true);
  }, [classId, studentId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (open) return;
    void reload();
  }, [open, reload]);

  if (!ready) return null;
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
    {open && <div role="presentation" onMouseDown={e => { if(e.target === e.currentTarget) setOpen(false); }}
      style={{ position: "fixed", inset: 0, zIndex: 990, display: "flex", alignItems: "flex-end",
        justifyContent: "center", background: "rgba(12,25,19,.45)" }}>
      <div role="dialog" aria-label="Edit learner activities" aria-modal="true"
        style={{ width: "min(100%,600px)", maxHeight: "88dvh", overflow: "auto", background: "#fff",
          borderRadius: "20px 20px 0 0", padding: "18px 14px 95px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close activities"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40,
              border: "1px solid #dae6de", borderRadius: 10, background: "#fff" }}><X size={18}/></button>
        </div>
        <SchoolLifeParticipation classId={classId} studentId={studentId}/>
      </div>
    </div>}
  </div>;
}

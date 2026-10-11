"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SchoolLifeParticipation from "@/components/teacher/SchoolLifeParticipation";

export const dynamic = "force-dynamic";

function ClassActivities() {
  const { id: classId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = (searchParams.get("selected") ?? "")
    .split(",").filter(value => /^[0-9a-f-]{36}$/i.test(value)).slice(0, 100);
  return <main style={{ padding: "16px 14px 92px", margin: "0 auto", maxWidth: 850, minHeight: "70vh" }}>
    <button type="button" onClick={() => router.push(`/teacher/classhub/${classId}`)}
      style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#356252", background: "transparent",
        border: 0, minHeight: 42, cursor: "pointer", padding: 0, fontWeight: 700 }}>
      <ArrowLeft size={18}/> Class Hub
    </button>
    <div style={{ margin: "8px 0 16px" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 5px", color: "#1b3328" }}>Class activities</h1>
      <p style={{ color: "#5e7065", fontSize: 13, margin: 0 }}>Add learners to sports, clubs and activities. Changes also appear on individual profiles.</p>
    </div>
    <SchoolLifeParticipation classId={classId} preselectedStudents={selected}/>
  </main>;
}

export default function ClassActivitiesPage() {
  return <Suspense fallback={<div role="status" style={{ padding: 24 }}>Loading class activities…</div>}><ClassActivities/></Suspense>;
}

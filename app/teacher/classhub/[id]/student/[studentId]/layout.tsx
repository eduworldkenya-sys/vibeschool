"use client";

import type { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import LearnerSchoolLifeStrip from "@/components/teacher/LearnerSchoolLifeStrip";

export default function LearnerProfileLayout({ children }: { children: ReactNode }) {
  const { id: classId, studentId } = useParams<{ id: string; studentId: string }>();
  const pathname = usePathname();
  const profilePath = `/teacher/classhub/${classId}/student/${studentId}`;
  return <>
    {(pathname === profilePath || pathname === profilePath + "/") && <LearnerSchoolLifeStrip classId={classId} studentId={studentId}/>}
    {children}
  </>;
}

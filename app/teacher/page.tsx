"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PortalLoading } from "@/components/shared/PortalState";

/**
 * Teacher entry must land on the daily command center.
 * Week/timetable remain available from Today/Teach, but should not replace Home.
 */
export default function TeacherRoot() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teacher/pulse");
  }, [router]);

  return <PortalLoading role="Teacher" />;
}

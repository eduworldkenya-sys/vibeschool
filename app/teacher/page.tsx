"use client";
export const dynamic = "force-dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher/pulse"); }, [router]);
  return null;
}

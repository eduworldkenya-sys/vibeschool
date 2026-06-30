"use client";
export const dynamic = "force-dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Disabled — superseded by /teacher/teach-today (taught/upcoming/tomorrow view).
// Kept as a redirect instead of deleting so any stale bookmarks/links still resolve.
export default function TeachPageDisabled() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher/teach-today"); }, [router]);
  return null;
}

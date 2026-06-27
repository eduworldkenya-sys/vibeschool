"use client";
export const dynamic = "force-dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TwinPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher/pulse?twin=1"); }, [router]);
  return null;
}

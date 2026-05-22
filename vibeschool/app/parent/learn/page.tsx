"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ParentLearnPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/academy/signin?role=parent"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (data?.role !== "parent") { router.push("/academy/signin?role=parent"); return; }
    }
    checkRole();
  }, []);

  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
      <h1 style={{ color: "#1e1b4b" }}>📚 Learn</h1>
      <p style={{ color: "#6b7280" }}>Parent Learn page is working!</p>
    </div>
  );
}

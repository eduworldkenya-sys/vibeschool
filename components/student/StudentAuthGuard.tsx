"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function StudentAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!alive) return;
        if (!user) { router.replace("/?role=student"); return; }

        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!alive) return;
        if (data?.role !== "student") { router.replace("/?role=student"); return; }

        setAuthReady(true);
      } catch {
        if (alive) router.replace("/?role=student");
      }
    }
    check();
    return () => { alive = false; };
  }, [router]);

  if (!authReady) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #C8A84B", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}

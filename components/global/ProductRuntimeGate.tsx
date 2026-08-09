"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type HQProductKey = "student" | "teacher" | "parent" | "school_admin" | "vibelearn" | "vibebooks" | "vibelabs" | "twin" | "billing";

type RuntimeState = "checking" | "enabled" | "disabled" | "degraded";

export default function ProductRuntimeGate({ product, children }: { product: HQProductKey; children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<RuntimeState>("checking");

  useEffect(() => {
    let alive = true;
    async function handshake() {
      try {
        const { data, error } = await (supabase as any).rpc("hq_product_runtime_handshake", {
          p_product_key: product,
          p_route: pathname || null,
        });
        if (error) throw error;
        if (!alive) return;
        setState(data?.enabled === false ? "disabled" : "enabled");
      } catch {
        if (alive) setState("degraded");
      }
    }
    void handshake();
    return () => { alive = false; };
  }, [pathname, product]);

  if (state === "checking") {
    return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "var(--vs-bg, #0f172a)", color: "var(--vs-text, #fff)", fontFamily: "system-ui, sans-serif" }}><div style={{ fontSize: 13, opacity: .7 }}>Checking VibeSchool service status…</div></div>;
  }

  if (state === "disabled") {
    return <div role="status" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--vs-bg, #0f172a)", color: "var(--vs-text, #fff)", fontFamily: "system-ui, sans-serif" }}><div style={{ width: "min(100%, 460px)", textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 850 }}>Service temporarily unavailable</div><p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, opacity: .7 }}>This VibeSchool product has been paused by HQ. Your account and learning data remain intact. Refresh later to re-check service status.</p><button onClick={() => location.reload()} style={{ marginTop: 18, border: "1px solid currentColor", borderRadius: 10, padding: "9px 14px", background: "transparent", color: "inherit", fontWeight: 750, cursor: "pointer" }}>Check again</button></div></div>;
  }

  return <>{children}</>;
}

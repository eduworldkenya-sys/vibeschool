"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RuntimeSurface = { product_key?: string; events?: number; actors?: number; last_seen?: string };
type NervousState = { captured_events?: number; runtime_surfaces?: RuntimeSurface[]; recent_policy_failures?: unknown[]; policy_states?: Array<{ state?: string }> };

export default function HQProductNervousPulse() {
  const [data, setData] = useState<NervousState | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: next, error } = await (supabase as any).rpc("hq_get_product_nervous_system", { p_hours: 24 });
      if (alive && !error) setData(next as NervousState);
    })();
    return () => { alive = false; };
  }, []);
  if (!data) return null;
  const failures = Array.isArray(data.recent_policy_failures) ? data.recent_policy_failures.length : 0;
  const drift = Array.isArray(data.policy_states) ? data.policy_states.filter(x => x.state && x.state !== "verified").length : 0;
  const surfaces = Array.isArray(data.runtime_surfaces) ? data.runtime_surfaces : [];
  return <div style={{ position: "relative", zIndex: 30, padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "#08111f", color: "#dbeafe", font: "600 11px/1.4 system-ui,sans-serif", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
    <strong style={{ color: failures || drift ? "#fbbf24" : "#34d399" }}>Product nervous system · {failures || drift ? "attention" : "connected"}</strong>
    <span>{Number(data.captured_events ?? 0).toLocaleString("en-KE")} events / 24h</span><span>{surfaces.length} live product surfaces</span><span>{drift} policy exceptions</span><span>{failures} recent policy failures</span>
    {surfaces.slice(0, 6).map(s => <span key={s.product_key}>{s.product_key}: {s.actors ?? 0} actors</span>)}
  </div>;
}

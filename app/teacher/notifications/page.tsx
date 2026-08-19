"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

interface TeacherNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(ts: string): string {
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function category(type: string): "action" | "info" | "system" {
  const value = type.toLowerCase();
  if (["alert", "warning", "attendance", "homework", "assessment", "action"].includes(value)) return "action";
  if (["system", "security", "error"].includes(value)) return "system";
  return "info";
}

export default function TeacherNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<TeacherNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/?role=teacher");
      return;
    }

    const { data, error: loadError } = await supabase
      .from("notifications")
      .select("id,title,body,type,is_read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (loadError) {
      setError("Notifications could not be loaded. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const next = (data ?? []) as TeacherNotification[];
    setItems(next);
    setLoading(false);

    const unreadIds = next.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length > 0) {
      const { error: markError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .in("id", unreadIds);
      if (!markError) {
        setItems((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, is_read: true } : item));
      }
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => ({
    action: items.filter((item) => category(item.type) === "action"),
    info: items.filter((item) => category(item.type) === "info"),
    system: items.filter((item) => category(item.type) === "system"),
  }), [items]);

  if (loading && items.length === 0) {
    return (
      <div aria-live="polite" aria-busy="true" style={{ padding: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.textPrimary, marginBottom: 14 }}>Notifications</div>
        {[0,1,2].map((i) => <div key={i} style={{ height: 76, borderRadius: 16, background: "#e5e7eb", marginBottom: 10 }} />)}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 24px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.textPrimary }}>Notifications</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>Action first, then information and system updates.</p>
      </div>

      {error && (
        <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#991b1b" }}>{error}</div>
          <button onClick={() => void load()} style={{ marginTop: 10, minHeight: 44, border: 0, borderRadius: 10, padding: "0 16px", fontWeight: 800, background: C.dark, color: "#fff" }}>Retry</button>
        </div>
      )}

      {items.length === 0 && !error ? (
        <div style={{ background: "#fff", borderRadius: 18, padding: "44px 20px", textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.textPrimary }}>You’re all caught up</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>New teaching, class and system updates will appear here.</div>
          <button onClick={() => router.push("/teacher/pulse")} style={{ marginTop: 16, minHeight: 44, border: 0, borderRadius: 12, padding: "0 16px", fontWeight: 800, background: C.accent, color: "#fff" }}>Back to Today</button>
        </div>
      ) : (
        (["action", "info", "system"] as const).map((group) => grouped[group].length > 0 && (
          <section key={group} aria-labelledby={`notification-${group}`} style={{ marginBottom: 18 }}>
            <h2 id={`notification-${group}`} style={{ margin: "0 0 8px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.7, color: C.textMuted }}>
              {group === "action" ? "Requires action" : group === "info" ? "Information" : "System"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {grouped[group].map((item) => (
                <article key={item.id} style={{ background: "#fff", borderRadius: 16, padding: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, marginTop: 5, background: group === "action" ? "#f59e0b" : group === "system" ? "#64748b" : C.accent, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 850, color: C.textPrimary }}>{item.title}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: C.textMuted, marginTop: 3 }}>{item.body}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>{timeAgo(item.created_at)}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

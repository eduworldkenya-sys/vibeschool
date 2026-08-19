"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import { readCache, writeCache } from "@/lib/student-cache";
import Skel from "@/components/student/Skel";

interface Notif {
  id: string; title: string; body: string; type: string;
  related_id: string | null; is_read: boolean; created_at: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function notificationTarget(notification: Notif): string {
  const type = notification.type.toLowerCase();
  if (notification.related_id && type.includes("homework") && !type.includes("submitted")) {
    return `/student/homework/${notification.related_id}`;
  }
  if (notification.related_id && type.includes("assessment")) {
    return `/student/assessment/${notification.related_id}`;
  }
  if (type.includes("result") || type.includes("grade") || type.includes("mark") || type.includes("feedback")) {
    return "/student/marks";
  }
  if (type.includes("learn") || type.includes("revision") || type.includes("reminder")) {
    return "/student/vibelearn";
  }
  if (type.includes("task") || type.includes("assignment") || type.includes("homework")) {
    return "/student/tasks";
  }
  return "/student";
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function notifIcon(type: string) {
  if (type === "alert" || type === "warning") return <IconAlert />;
  return <IconInfo />;
}

function notifColor(type: string): string {
  if (type === "alert"   || type === "warning") return "var(--vs-warning)";
  if (type === "success" || type === "grade")   return "var(--vs-success)";
  return "var(--vs-accent)";
}

export default function NotificationsPage() {
  const router = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const [notifs,    setNotifs]    = useState<Notif[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (idLoading || !identity) return;
    const cached = readCache<Notif[]>("notifications", identity.studentId);
    if (cached) { setNotifs(cached); setLoading(false); }

    async function load() {
      setLoadError(null);
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, type, related_id, is_read, created_at")
        .eq("user_id", identity!.profileId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        setLoadError("Notifications could not be loaded. Pull down or return here when your connection is stable.");
        setLoading(false);
        return;
      }
      const result: Notif[] = (data ?? []).map(notification => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        related_id: notification.related_id ?? null,
        is_read: notification.is_read ?? false,
        created_at: notification.created_at ?? new Date(0).toISOString(),
      }));

      writeCache("notifications", identity!.studentId, result);
      setNotifs(result);
      setLoading(false);
      const unread = result.filter(n => !n.is_read).map(n => n.id);
      if (unread.length > 0) {
        const { error: markReadError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", identity!.profileId)
          .in("id", unread);
        if (!markReadError) {
          const read = result.map(notification =>
            unread.includes(notification.id)
              ? { ...notification, is_read: true }
              : notification
          );
          setNotifs(read);
          writeCache("notifications", identity!.studentId, read);
        }
      }
    }
    void load();
  }, [identity, idLoading]);

  const isLoading = idLoading || (loading && notifs.length === 0);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
      <Skel h={70} radius={12} /><Skel h={70} radius={12} /><Skel h={70} radius={12} />
    </div>
  );

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>Updates</h1>
        <p style={{ fontSize: 12, color: "var(--vs-muted)", marginTop: 2 }}>
          {notifs.filter(n => !n.is_read).length > 0 ? `${notifs.filter(n => !n.is_read).length} unread` : "All caught up"}
        </p>
      </div>
      {loadError && <div role="status" style={{ fontSize: 12, color: "var(--vs-error, #ef4444)", marginBottom: 10 }}>{loadError}</div>}
      {notifs.length === 0 ? (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "60px 24px", textAlign: "center" }}>
          <div style={{ color: "var(--vs-muted)", marginBottom: 8, display: "flex", justifyContent: "center" }}><IconBell /></div>
          <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No notifications yet</div>
          <button onClick={() => router.push("/student/tasks")} style={{ marginTop: 12, minHeight: 44, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-accent)", fontWeight: 700 }}>Check my tasks</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifs.map(n => (
            <button key={n.id} onClick={() => router.push(notificationTarget(n))} style={{
              width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
              background: n.is_read ? "var(--vs-card)" : "var(--vs-accent-soft)",
              color: "inherit", border: `1px solid ${n.is_read ? "var(--vs-border)" : "var(--vs-accent)"}`,
              borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", minHeight: 56,
            }}>
              <div style={{ color: notifColor(n.type), flexShrink: 0, marginTop: 1 }}>{notifIcon(n.type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vs-text)", marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.5 }}>{n.body}</div>
                <div style={{ fontSize: 10, color: "var(--vs-muted)", marginTop: 6 }}>{timeAgo(n.created_at)} · Open</div>
              </div>
              {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--vs-accent)", flexShrink: 0, marginTop: 4 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  school_id: string | null;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
};

function destinationFor(row: NotificationRow): string {
  const id = row.related_id ? encodeURIComponent(row.related_id) : null;
  switch ((row.type ?? "").toLowerCase()) {
    case "homework_submission":
    case "submission":
    case "homework":
      return id ? `/teacher/homework/${id}` : "/teacher/homework";
    case "assessment":
    case "assessment_action":
    case "results":
      return id ? `/teacher/assessment/${id}` : "/teacher/assessment";
    case "timetable":
    case "timetable_change":
      return "/teacher/timetable";
    case "student":
    case "student_progress":
      return id ? `/teacher/students/${id}` : "/teacher/students";
    case "message":
    case "parent_message":
    case "teacher_message":
      return "/teacher/vibeconnect";
    case "school_announcement":
    case "announcement":
    case "admin_request":
      return "/teacher/pulse";
    default:
      return "/teacher/pulse";
  }
}

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TeacherNotificationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const unreadCount = useMemo(() => rows.filter((row) => !row.is_read).length, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const { data, error: queryError } = await supabase
        .from("notifications")
        .select("id,school_id,user_id,title,body,type,related_id,is_read,created_at")
        .eq("user_id", auth.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      setRows((data ?? []) as NotificationRow[]);
    } catch (loadError) {
      console.error("[TeacherNotifications] load", loadError);
      setError("Notifications could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function openNotification(row: NotificationRow) {
    if (savingId) return;
    setSavingId(row.id);
    try {
      if (!row.is_read) {
        const { error: updateError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", row.id)
          .eq("user_id", row.user_id);
        if (updateError) throw updateError;
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, is_read: true } : item));
      }
      router.push(destinationFor(row));
    } catch (openError) {
      console.error("[TeacherNotifications] open", openError);
      setError("That notification could not be opened. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || savingId) return;
    setSavingId("all");
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("Not authenticated");
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", auth.user.id)
        .eq("is_read", false);
      if (updateError) throw updateError;
      setRows((current) => current.map((row) => ({ ...row, is_read: true })));
    } catch (markError) {
      console.error("[TeacherNotifications] markAllRead", markError);
      setError("Could not mark notifications as read.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#10b981", letterSpacing: 1.1, textTransform: "uppercase" }}>Teacher inbox</div>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, color: "#111827" }}>Notifications</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{unreadCount ? `${unreadCount} unread` : "You're up to date"}</div>
        </div>
        <button type="button" onClick={markAllRead} disabled={unreadCount === 0 || savingId !== null} style={{ minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, background: "#fff", padding: "0 13px", fontWeight: 800, color: "#374151", opacity: unreadCount === 0 ? 0.5 : 1 }}>Mark all read</button>
      </div>

      {error && (
        <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 14, marginBottom: 12, fontSize: 13 }}>
          {error} <button type="button" onClick={() => void load()} style={{ border: 0, background: "transparent", color: "#991b1b", fontWeight: 900, textDecoration: "underline" }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div aria-label="Loading notifications" style={{ display: "grid", gap: 10 }}>
          {[1,2,3].map((item) => <div key={item} style={{ height: 88, borderRadius: 16, background: "#e5e7eb" }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 18, padding: "34px 20px", textAlign: "center", boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>No notifications yet</div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "#6b7280" }}>School announcements, learner submissions, timetable changes and actions that need your attention will appear here.</div>
          <button type="button" onClick={() => router.push("/teacher/pulse")} style={{ marginTop: 16, minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Back to Today</button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 9 }}>
          {rows.map((row) => (
            <button key={row.id} type="button" disabled={savingId !== null} onClick={() => void openNotification(row)} style={{ width: "100%", textAlign: "left", border: row.is_read ? "1px solid #e5e7eb" : "1px solid #a7f3d0", borderRadius: 16, background: row.is_read ? "#fff" : "#f0fdf4", padding: 14, minHeight: 78, opacity: savingId === row.id ? 0.65 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span aria-hidden="true" style={{ marginTop: 6, width: 8, height: 8, borderRadius: 99, background: row.is_read ? "#d1d5db" : "#10b981", flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: row.is_read ? 750 : 900, color: "#111827" }}>{row.title}</div>
                  {row.body && <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{row.body}</div>}
                  <div style={{ marginTop: 7, fontSize: 10, fontWeight: 800, color: "#9ca3af" }}>{relativeTime(row.created_at)}</div>
                </div>
                <span aria-hidden="true" style={{ color: "#9ca3af", fontSize: 20 }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

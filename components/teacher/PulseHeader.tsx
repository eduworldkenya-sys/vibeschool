"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { PulseSnapshot } from "@/lib/types";

const WEEK_TYPE_LABELS: Record<string, string> = {
  exam: "Exams",
  midterm_break: "Mid-Term Break",
  sports: "Sports",
  holiday: "Holiday",
};

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconBell() {
  return <svg {...iconProps}><path d="M6 8a6 6 0 0 1 12 0c0 3 1 5 1.5 6H4.5C5 13 6 11 6 8z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
}

function IconSchool() {
  return <svg {...iconProps}><path d="M3 10l9-6 9 6"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/></svg>;
}

function IconClass() {
  return <svg {...iconProps}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M17.5 14.5A5 5 0 0 1 21 19"/></svg>;
}

function IconCalendar() {
  return <svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
}

function IconChevron() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ContextIcon({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 32, height: 32, borderRadius: 10, background: "#ecfdf5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </span>
  );
}

export default function PulseHeader({
  snap,
  name,
  avatarUrl: _avatarUrl,
  selectedKey,
  onSelectedKeyChange,
  onOpenNotifications,
  schools = [],
  activeSchoolId,
  onSchoolChange,
  offline = false,
}: {
  snap: PulseSnapshot;
  name: string;
  avatarUrl?: string;
  selectedKey: string;
  onSelectedKeyChange: (key: string) => void;
  onOpenNotifications?: () => void;
  schools?: { id: string; name: string }[];
  activeSchoolId?: string | null;
  onSchoolChange?: (id: string) => void;
  offline?: boolean;
}) {
  const router = useRouter();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", snap.userId)
      .eq("is_read", false)
      .then(({ count }) => {
        if (!cancelled) setUnreadNotifications(count ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, [snap.userId]);

  const keyOf = (classId: string, subjectId: string) => `${classId}::${subjectId}`;
  const [activeClassId, activeSubjectId] = selectedKey.split("::");
  const selectedSlot = snap.todaySlots.find(
    (slot) => slot.class_id === activeClassId && slot.subject_id === activeSubjectId
  );
  const selectedRoster = snap.myClasses.find(
    (item) => item.class_id === activeClassId && item.subject_id === activeSubjectId
  );

  const dateLabel = new Date().toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const weekLabel = snap.weekNumber == null
    ? "No active term"
    : snap.weekType && snap.weekType !== "normal"
    ? `Term ${snap.termNumber ?? "—"} · Week ${snap.weekNumber} · ${WEEK_TYPE_LABELS[snap.weekType] ?? snap.weekType}`
    : `Term ${snap.termNumber ?? "—"} · Week ${snap.weekNumber}`;

  const openNotifications = () => {
    onOpenNotifications?.();
    router.push("/teacher/notifications");
  };

  return (
    <header style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827", letterSpacing: -0.35, lineHeight: 1.2 }}>
            {greeting()}{name ? `, ${name}` : ""}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
            <span>{dateLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{weekLabel}</span>
            {offline && <><span aria-hidden="true">·</span><span style={{ color: "#92400e", fontWeight: 800 }}>Offline snapshot</span></>}
          </div>
        </div>

        <button
          type="button"
          onClick={openNotifications}
          aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : "Open notifications"}
          style={{ position: "relative", width: 44, height: 44, border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <IconBell />
          {unreadNotifications > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </button>
      </div>

      <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 12, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }} aria-label="Teaching context">
        {schools.length > 1 && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
            <ContextIcon><IconSchool /></ContextIcon>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: 10, color: "#6b7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.7 }}>School</span>
              <span style={{ position: "relative", display: "block", marginTop: 2 }}>
                <select
                  value={activeSchoolId ?? ""}
                  onChange={(event) => onSchoolChange?.(event.target.value)}
                  style={{ width: "100%", minHeight: 30, appearance: "none", border: 0, background: "transparent", padding: "0 24px 0 0", fontSize: 13, fontWeight: 900, color: "#111827", fontFamily: "inherit" }}
                >
                  {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
                <span style={{ pointerEvents: "none", position: "absolute", right: 0, top: 7, color: "#6b7280" }}><IconChevron /></span>
              </span>
            </span>
          </label>
        )}

        {snap.myClasses.length > 0 ? (
          <label style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <ContextIcon><IconClass /></ContextIcon>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: 10, color: "#6b7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.7 }}>Class · Subject</span>
              <span style={{ position: "relative", display: "block", marginTop: 2 }}>
                <select
                  value={selectedKey}
                  onChange={(event) => onSelectedKeyChange(event.target.value)}
                  style={{ width: "100%", minHeight: 30, appearance: "none", border: 0, background: "transparent", padding: "0 24px 0 0", fontSize: 14, fontWeight: 900, color: "#111827", fontFamily: "inherit" }}
                >
                  {snap.myClasses.map((item) => (
                    <option key={keyOf(item.class_id, item.subject_id)} value={keyOf(item.class_id, item.subject_id)}>
                      {item.class_name} · {item.subject}
                    </option>
                  ))}
                </select>
                <span style={{ pointerEvents: "none", position: "absolute", right: 0, top: 7, color: "#6b7280" }}><IconChevron /></span>
              </span>
              {!selectedSlot && selectedRoster && (
                <button
                  type="button"
                  onClick={() => router.push(`/teacher/classhub/${selectedRoster.class_id}`)}
                  style={{ marginTop: 4, border: 0, background: "transparent", padding: 0, color: "#047857", fontSize: 11, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}
                >
                  No lesson today · Open class
                </button>
              )}
            </span>
          </label>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/teacher/onboarding/class")}
            style={{ width: "100%", minHeight: 54, display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: 0, background: "transparent", padding: 0, fontFamily: "inherit", cursor: "pointer" }}
          >
            <ContextIcon><IconClass /></ContextIcon>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 10, color: "#6b7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.7 }}>Class</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 14, fontWeight: 900, color: "#111827" }}>No classes assigned</span>
              <span style={{ display: "block", marginTop: 3, fontSize: 11, fontWeight: 800, color: "#047857" }}>Add your class</span>
            </span>
          </button>
        )}

        {snap.myClasses.length === 0 && (
          <div style={{ display: "none" }} aria-hidden="true"><IconCalendar /></div>
        )}
      </section>
    </header>
  );
}

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
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconBell() {
  return (
    <svg {...iconProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 3 1 5 1.5 6H4.5C5 13 6 11 6 8z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function IconChip({
  children,
  count,
  onClick,
}: {
  children: React.ReactNode;
  count: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: 38,
        height: 38,
        borderRadius: 999,
        background: "#f9fafb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#374151",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {children}
      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "#8b5cf6",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  );
}

function Avatar({ initials, photoUrl }: { initials: string; photoUrl?: string }) {
  return (
    <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="Profile"
          style={{ width: 40, height: 40, borderRadius: 999, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: "#1e1b4b",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials}
        </div>
      )}
      <span
        style={{
          position: "absolute",
          bottom: -1,
          right: -1,
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "#10b981",
          border: "2px solid #fff",
        }}
      />
    </div>
  );
}

function SelectorItem({
  icon,
  label,
  value,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>{label}</div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#1e1b4b",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </div>
        {actionLabel && (
          <div
            onClick={onAction}
            style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, cursor: "pointer", marginTop: 1 }}
          >
            {actionLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function PulseHeader({
  snap,
  name,
  avatarUrl,
  selectedKey,
  onSelectedKeyChange,
  onOpenNotifications,
  schools = [],
  activeSchoolId,
  onSchoolChange,
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

  const initials = name
    ? name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()
    : "";

  const key = (classId: string, subjectId: string) => `${classId}::${subjectId}`;

  const [activeClassId, activeSubjectId] = selectedKey.split("::");

  const selectedSlot = snap.todaySlots.find(
    (slot) => slot.class_id === activeClassId && slot.subject_id === activeSubjectId
  );
  const selectedRoster = snap.myClasses.find(
    (c) => c.class_id === activeClassId && c.subject_id === activeSubjectId
  );

  const openNotifications = () => {
    if (onOpenNotifications) {
      // Keep the optional hook available for analytics/host integrations, but
      // navigation is authoritative so the bell can never become a dead CTA.
      onOpenNotifications();
    }
    router.push("/teacher/notifications");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1e1b4b", letterSpacing: -0.4 }}>
            {greeting()}{name ? `, ${name}` : ""} 👋
          </div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
            You&apos;re changing lives today.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <IconChip count={unreadNotifications} onClick={openNotifications}>
            <IconBell />
          </IconChip>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "#fff",
          borderRadius: 16,
          padding: "12px 14px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
          overflowX: "auto",
        }}
      >
        {schools.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ color: "#8b5cf6", flexShrink: 0 }}>🏫</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>School</div>
              <select
                value={activeSchoolId ?? ""}
                onChange={(event) => onSchoolChange?.(event.target.value)}
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#1e1b4b",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  maxWidth: 140,
                }}
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {snap.myClasses.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ color: "#10b981", flexShrink: 0 }}>👥</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>Class · Subject</div>
              <select
                value={selectedKey}
                onChange={(event) => onSelectedKeyChange(event.target.value)}
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#1e1b4b",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  maxWidth: 170,
                }}
              >
                {snap.myClasses.map((c) => (
                  <option key={key(c.class_id, c.subject_id)} value={key(c.class_id, c.subject_id)}>
                    {c.class_name} · {c.subject}
                  </option>
                ))}
              </select>
              {!selectedSlot && selectedRoster && (
                <div
                  onClick={() => router.push(`/teacher/classhub/${selectedRoster.class_id}`)}
                  style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, cursor: "pointer", marginTop: 1 }}
                >
                  No lesson today · View class →
                </div>
              )}
            </div>
          </div>
        ) : (
          <SelectorItem
            icon={<span style={{ color: "#10b981" }}>👥</span>}
            label="Class"
            value="No classes assigned"
            actionLabel="Add your class →"
            onAction={() => router.push("/teacher/onboarding/class")}
          />
        )}
        <SelectorItem
          icon={<span>📅</span>}
          label="Week"
          value={
            snap.weekNumber == null
              ? "No active term"
              : snap.weekType && snap.weekType !== "normal"
              ? `Week ${snap.weekNumber} · ${WEEK_TYPE_LABELS[snap.weekType] ?? snap.weekType}`
              : `Week ${snap.weekNumber}`
          }
        />
      </div>
    </div>
  );
}

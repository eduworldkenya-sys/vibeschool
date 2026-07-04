"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PulseSnapshot } from "@/lib/types";

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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
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
  onOpenNotifications,
}: {
  snap: PulseSnapshot;
  name: string;
  avatarUrl?: string;
  onOpenNotifications?: () => void;
}) {
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

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

  const currentSlot =
    snap.todaySlots.find((slot) => slot.id === selectedSlotId) ?? snap.todaySlots[0] ?? null;

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
          <IconChip count={unreadNotifications} onClick={onOpenNotifications}>
            <IconBell />
          </IconChip>
          <Avatar initials={initials} photoUrl={avatarUrl} />
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
        <SelectorItem
          icon={<span style={{ color: "#8b5cf6" }}>🏫</span>}
          label="School"
          value={snap.schoolName || "—"}
        />
        {snap.todaySlots.length > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ color: "#10b981", flexShrink: 0 }}>👥</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>Class · Subject</div>
              <select
                value={currentSlot?.id ?? ""}
                onChange={(event) => setSelectedSlotId(event.target.value)}
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#1e1b4b",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  maxWidth: 160,
                }}
              >
                {snap.todaySlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.class_name} · {slot.subject}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <>
            <SelectorItem
              icon={<span style={{ color: "#10b981" }}>👥</span>}
              label="Class"
              value={currentSlot?.class_name ?? "—"}
            />
            <SelectorItem
              icon={<span style={{ color: "#3b82f6" }}>📖</span>}
              label="Subject"
              value={currentSlot?.subject ?? "—"}
            />
          </>
        )}
        <SelectorItem
          icon={<span>📅</span>}
          label="Week"
          value={snap.weekNumber != null ? `Week ${snap.weekNumber}` : "—"}
        />
      </div>
    </div>
  );
}

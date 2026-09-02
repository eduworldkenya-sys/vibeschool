"use client";

import { useEffect, useMemo, useState } from "react";
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
  return (
    <svg {...iconProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 3 1 5 1.5 6H4.5C5 13 6 11 6 8z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function IconClass() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6a3 3 0 0 1 0 6" />
      <path d="M17.5 14.5A5 5 0 0 1 21 19" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg {...iconProps} width={16} height={16}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg {...iconProps} width={17} height={17}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface PulseHeaderProps {
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
  contextRefreshing?: boolean;
}

export default function PulseHeader({
  snap,
  name,
  selectedKey,
  onSelectedKeyChange,
  onOpenNotifications,
  offline = false,
  contextRefreshing = false,
}: PulseHeaderProps) {
  const router = useRouter();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  useEffect(() => {
    if (!pickerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  const keyOf = (classId: string, subjectId: string) => `${classId}::${subjectId}`;
  const [activeClassId, activeSubjectId] = selectedKey.split("::");

  const selectedSlot = snap.todaySlots.find(
    (slot) => slot.class_id === activeClassId && slot.subject_id === activeSubjectId
  );
  const selectedRoster = snap.myClasses.find(
    (item) => item.class_id === activeClassId && item.subject_id === activeSubjectId
  );

  const options = useMemo(
    () =>
      [...snap.myClasses].sort((a, b) =>
        `${a.class_name} ${a.subject}`.localeCompare(`${b.class_name} ${b.subject}`)
      ),
    [snap.myClasses]
  );

  const dateLabel = new Date().toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const weekLabel =
    snap.weekNumber == null
      ? "No active term"
      : snap.weekType && snap.weekType !== "normal"
      ? `Term ${snap.termNumber ?? "—"} · Week ${snap.weekNumber} · ${WEEK_TYPE_LABELS[snap.weekType] ?? snap.weekType}`
      : `Term ${snap.termNumber ?? "—"} · Week ${snap.weekNumber}`;

  const chooseContext = (key: string) => {
    if (key !== selectedKey) onSelectedKeyChange(key);
    setPickerOpen(false);
  };

  return (
    <header style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: "#111827",
              letterSpacing: -0.35,
              lineHeight: 1.2,
            }}
          >
            {greeting()}
            {name ? `, ${name}` : ""}
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginTop: 4,
              fontSize: 12,
              color: "#6b7280",
              flexWrap: "wrap",
            }}
          >
            <span>{dateLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{weekLabel}</span>
            {offline && (
              <>
                <span aria-hidden="true">·</span>
                <span style={{ color: "#92400e", fontWeight: 800 }}>Offline snapshot</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenNotifications?.();
            router.push("/teacher/notifications");
          }}
          aria-label={
            unreadNotifications > 0
              ? `${unreadNotifications} unread notifications`
              : "Open notifications"
          }
          style={{
            position: "relative",
            width: 44,
            height: 44,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "#fff",
            color: "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <IconBell />
          {unreadNotifications > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: "0 4px",
                borderRadius: 999,
                background: "#dc2626",
                color: "#fff",
                fontSize: 9,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #fff",
              }}
            >
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </button>
      </div>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 12,
          boxShadow: "0 2px 10px rgba(15,23,42,0.045)",
        }}
        aria-label="Teaching context"
      >
        {options.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: "#ecfdf5",
                color: "#047857",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <IconClass />
            </span>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "#6b7280",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Teaching context
              </div>

              <button
                type="button"
                disabled={contextRefreshing}
                onClick={() => setPickerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                style={{
                  width: "100%",
                  minHeight: 36,
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  color: "#111827",
                  fontFamily: "inherit",
                  cursor: contextRefreshing ? "wait" : "pointer",
                  opacity: contextRefreshing ? 0.65 : 1,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {selectedRoster
                    ? `${selectedRoster.class_name} · ${selectedRoster.subject}`
                    : "Choose class and subject"}
                </span>
                <span style={{ color: "#6b7280", flexShrink: 0 }} aria-hidden="true">
                  <IconChevron />
                </span>
              </button>

              {contextRefreshing ? (
                <div role="status" style={{ fontSize: 11, color: "#047857", fontWeight: 800 }}>
                  Refreshing this class…
                </div>
              ) : selectedSlot ? (
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  Today · {selectedSlot.start_time}–{selectedSlot.end_time}
                </div>
              ) : selectedRoster ? (
                <button
                  type="button"
                  onClick={() => router.push(`/teacher/classhub/${selectedRoster.class_id}`)}
                  style={{
                    border: 0,
                    background: "transparent",
                    padding: 0,
                    color: "#047857",
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  No lesson today · Open class
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/teacher/onboarding/class")}
            style={{
              width: "100%",
              minHeight: 54,
              border: 0,
              background: "transparent",
              textAlign: "left",
              padding: 0,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <strong style={{ display: "block", color: "#111827" }}>No classes assigned</strong>
            <span style={{ display: "block", fontSize: 11, color: "#047857", marginTop: 3 }}>
              Add your class
            </span>
          </button>
        )}
      </section>

      {pickerOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPickerOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,0.42)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "16px 12px calc(16px + env(safe-area-inset-bottom))",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="teaching-context-title"
            style={{
              width: "min(100%, 560px)",
              maxHeight: "min(72vh, 620px)",
              overflow: "hidden",
              background: "#fff",
              borderRadius: 24,
              boxShadow: "0 24px 70px rgba(15,23,42,0.24)",
              border: "1px solid rgba(226,232,240,0.9)",
            }}
          >
            <div
              style={{
                padding: "10px 18px 14px",
                borderBottom: "1px solid #eef2f7",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 1,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 42,
                  height: 4,
                  borderRadius: 999,
                  background: "#d1d5db",
                  margin: "0 auto 12px",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div id="teaching-context-title" style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>
                    Change teaching context
                  </div>
                  <div style={{ marginTop: 3, fontSize: 12, color: "#6b7280" }}>
                    The Today dashboard updates to the class you choose.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  aria-label="Close class picker"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#f8fafc",
                    color: "#475569",
                    fontSize: 20,
                    lineHeight: 1,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ overflowY: "auto", maxHeight: "calc(min(72vh, 620px) - 92px)", padding: 10 }}>
              {options.map((item) => {
                const optionKey = keyOf(item.class_id, item.subject_id);
                const active = optionKey === selectedKey;
                const todaySlot = snap.todaySlots.find(
                  (slot) => slot.class_id === item.class_id && slot.subject_id === item.subject_id
                );

                return (
                  <button
                    key={optionKey}
                    type="button"
                    onClick={() => chooseContext(optionKey)}
                    aria-pressed={active}
                    style={{
                      width: "100%",
                      minHeight: 64,
                      border: active ? "1px solid #a7f3d0" : "1px solid transparent",
                      borderRadius: 16,
                      background: active ? "#ecfdf5" : "#fff",
                      padding: "11px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      color: "#111827",
                      textAlign: "left",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 900, lineHeight: 1.25 }}>
                        {item.class_name} · {item.subject}
                      </span>
                      <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "#6b7280" }}>
                        {todaySlot
                          ? `Today · ${todaySlot.start_time}–${todaySlot.end_time}`
                          : `${item.studentCount} learner${item.studentCount === 1 ? "" : "s"} · No lesson today`}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: active ? "#10b981" : "#f3f4f6",
                        color: active ? "#fff" : "#94a3b8",
                        flexShrink: 0,
                      }}
                    >
                      {active ? <IconCheck /> : <IconClass />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </header>
  );
}

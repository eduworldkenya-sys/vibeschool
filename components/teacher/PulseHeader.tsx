"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { PulseSnapshot } from "@/lib/types";

const CONTEXT_KEY = "vibeschool:teacher:last-context";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function BellIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 3 1 5 1.5 6H4.5C5 13 6 11 6 8z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export default function PulseHeader({
  snap,
  name,
  avatarUrl,
  selectedKey,
  onSelectedKeyChange,
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
  const restoredContextRef = useRef(false);

  const options = useMemo(() => snap.myClasses.map((item) => ({
    key: `${item.class_id}::${item.subject_id}`,
    label: `${item.class_name} · ${item.subject}`,
  })), [snap.myClasses]);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", snap.userId)
      .eq("is_read", false)
      .then(({ count }) => {
        if (!cancelled) setUnreadNotifications(count ?? 0);
      });
    return () => { cancelled = true; };
  }, [snap.userId]);

  useEffect(() => {
    if (restoredContextRef.current || typeof window === "undefined" || options.length === 0) return;
    restoredContextRef.current = true;
    const saved = window.sessionStorage.getItem(CONTEXT_KEY);
    if (saved && saved !== selectedKey && options.some((option) => option.key === saved)) {
      onSelectedKeyChange(saved);
    }
  }, [onSelectedKeyChange, options, selectedKey]);

  function selectContext(key: string) {
    onSelectedKeyChange(key);
    if (typeof window !== "undefined") window.sessionStorage.setItem(CONTEXT_KEY, key);
  }

  const initials = name
    ? name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
    : "T";

  return (
    <header style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 21, lineHeight: 1.2, fontWeight: 900, color: "#1e1b4b", letterSpacing: -0.35 }}>
            {greeting()}{name ? `, ${name}` : ""}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>Here’s what matters for teaching today.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => router.push("/teacher/notifications")}
            aria-label={unreadNotifications > 0 ? `Open notifications, ${unreadNotifications} unread` : "Open notifications"}
            style={{ position: "relative", width: 44, height: 44, border: 0, borderRadius: 999, background: "#fff", color: "#374151", display: "grid", placeItems: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", cursor: "pointer" }}
          >
            <BellIcon />
            {unreadNotifications > 0 && (
              <span aria-hidden="true" style={{ position: "absolute", top: -2, right: -1, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: "#8b5cf6", color: "#fff", fontSize: 10, fontWeight: 900, display: "grid", placeItems: "center", border: "2px solid #f8fafc" }}>
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => router.push("/teacher/profile")}
            aria-label="Open teacher profile"
            style={{ width: 44, height: 44, borderRadius: 999, border: "2px solid #fff", overflow: "hidden", background: "#1e1b4b", color: "#fff", fontSize: 13, fontWeight: 900, display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
          >
            {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 14, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", display: "grid", gap: 12 }}>
        {schools.length > 1 && (
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 800 }}>School</span>
            <select
              aria-label="Current school"
              value={activeSchoolId ?? ""}
              onChange={(event) => onSchoolChange?.(event.target.value)}
              style={{ width: "100%", minHeight: 44, border: "1px solid #d1d5db", borderRadius: 12, background: "#fff", color: "#1f2937", padding: "0 12px", fontSize: 14, fontWeight: 800 }}
            >
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </label>
        )}

        <label style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 800 }}>Class · Subject</span>
          {options.length > 0 ? (
            <select
              aria-label="Current class and subject"
              value={selectedKey}
              onChange={(event) => selectContext(event.target.value)}
              style={{ width: "100%", minHeight: 46, border: "1px solid #d1d5db", borderRadius: 12, background: "#fff", color: "#1e1b4b", padding: "0 12px", fontSize: 14, fontWeight: 850 }}
            >
              {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          ) : (
            <button type="button" onClick={() => router.push("/teacher/classhub")} style={{ minHeight: 46, textAlign: "left", border: "1px dashed #cbd5e1", borderRadius: 12, background: "#f8fafc", color: "#475569", padding: "0 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              No assigned classes yet · Open Classes
            </button>
          )}
        </label>
      </div>
    </header>
  );
}

export const dynamic = 'force-dynamic'

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/parent-context";

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  dark:        "#1e1b4b",
  accent:      "#10b981",
  accentLight: "#d1fae5",
  red:         "#ef4444",
  redLight:    "#fef2f2",
  redBorder:   "#fecaca",
  bg:          "#f0f2f5",
  surface:     "#ffffff",
  border:      "#e5e7eb",
  textPrimary: "#111827",
  textMuted:   "#6b7280",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = 44, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: 10,
        background:
          "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.textMuted,
        padding: "14px 16px 6px",
      }}
    >
      {label}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({
  children,
  border = true,
}: {
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderTop: border ? `1px solid ${C.border}` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? C.accent : C.border,
        border: "none",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          display: "block",
        }}
      />
    </button>
  );
}

// ── Types local to this page ──────────────────────────────────────────────────
type Channel = "app" | "sms" | "whatsapp" | "email";

interface NotifState {
  feeReminders:     boolean;
  attendanceAlerts: boolean;
  homeworkUpdates:  boolean;
  behaviorNotifs:   boolean;
  generalAnnounce:  boolean;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ParentSettingsPage() {
  const router            = useRouter();
  const { fullName }      = useUser();

  const [email,      setEmail]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const [notifs, setNotifs] = useState<NotifState>({
    feeReminders:     true,
    attendanceAlerts: true,
    homeworkUpdates:  true,
    behaviorNotifs:   true,
    generalAnnounce:  true,
  });

  const [channel, setChannel] = useState<Channel>("app");

  const [dnd,     setDnd]     = useState(false);
  const [dndFrom, setDndFrom] = useState("21:00");
  const [dndTo,   setDndTo]   = useState("07:00");

  // ── Fetch email only — fullName comes from layout context ─────────────────
  const fetchEmail = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? "");
    } catch (_) {
      // silent — empty state handles it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmail(); }, [fetchEmail]);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/academy/signin?role=parent");
  }, [router]);

  // ── Toggle notif ──────────────────────────────────────────────────────────
  const toggleNotif = useCallback((key: keyof NotifState) => {
    setNotifs(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const notifRows: { key: keyof NotifState; label: string }[] = [
    { key: "feeReminders",     label: "Fee reminders" },
    { key: "attendanceAlerts", label: "Attendance alerts" },
    { key: "homeworkUpdates",  label: "Homework updates" },
    { key: "behaviorNotifs",   label: "Behavior notifications" },
    { key: "generalAnnounce",  label: "General announcements" },
  ];

  const channels: { key: Channel; label: string }[] = [
    { key: "app",      label: "App" },
    { key: "sms",      label: "SMS" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "email",    label: "Email" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          color: C.dark,
          margin: 0,
          lineHeight: 1.2,
        }}>
          Settings
        </h1>
        <p style={{
          fontSize: 13,
          color: C.textMuted,
          margin: "4px 0 0",
        }}>
          Manage your account and preferences
        </p>
      </div>

      {/* ── Account ── */}
      <SectionLabel label="Account" />
      <Section>
        {loading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton h={40} />
            <Skeleton h={40} />
          </div>
        ) : (
          <>
            <Row border={false}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>
                  Full name
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>
                  {fullName || "—"}
                </div>
              </div>
            </Row>

            <Row>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>
                  Email
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>
                  {email || "—"}
                </div>
              </div>
            </Row>

            <Row>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>
                  Role
                </div>
                <span style={{
                  display: "inline-block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.accent,
                  background: C.accentLight,
                  borderRadius: 20,
                  padding: "3px 10px",
                }}>
                  Parent
                </span>
              </div>
            </Row>

            <Row>
              <button
                onClick={() => router.push("/parent/profile")}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 10,
                  border: `1.5px solid ${C.accent}`,
                  background: "transparent",
                  color: C.accent,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Edit Profile
              </button>
            </Row>
          </>
        )}
      </Section>

      {/* ── Notification settings ── */}
      <SectionLabel label="Notification Settings" />
      <Section>
        {notifRows.map((row, i) => (
          <Row key={row.key} border={i > 0}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>
                {row.label}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                Coming soon
              </div>
            </div>
            <Toggle on={notifs[row.key]} onToggle={() => toggleNotif(row.key)} />
          </Row>
        ))}
      </Section>

      {/* ── Communication preferences ── */}
      <SectionLabel label="Communication Preferences" />
      <Section>
        <Row border={false}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.textPrimary,
              marginBottom: 12,
            }}>
              Preferred channel
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {channels.map(ch => (
                <button
                  key={ch.key}
                  onClick={() => setChannel(ch.key)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 20,
                    border: `1.5px solid ${channel === ch.key ? C.accent : C.border}`,
                    background: channel === ch.key ? C.accentLight : C.surface,
                    color: channel === ch.key ? C.accent : C.textMuted,
                    fontSize: 13,
                    fontWeight: channel === ch.key ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
        </Row>
      </Section>

      {/* ── Do Not Disturb ── */}
      <SectionLabel label="Do Not Disturb" />
      <Section>
        <Row border={false}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>
              Do not disturb
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
              Pause all notifications
            </div>
          </div>
          <Toggle on={dnd} onToggle={() => setDnd(v => !v)} />
        </Row>

        {dnd && (
          <Row>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>
                Quiet hours
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                    From
                  </div>
                  <input
                    type="time"
                    value={dndFrom}
                    onChange={e => setDndFrom(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      fontSize: 14,
                      color: C.textPrimary,
                      background: C.bg,
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 16 }}>
                  to
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                    To
                  </div>
                  <input
                    type="time"
                    value={dndTo}
                    onChange={e => setDndTo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      fontSize: 14,
                      color: C.textPrimary,
                      background: C.bg,
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          </Row>
        )}
      </Section>

      {/* ── Danger zone ── */}
      <SectionLabel label="Danger Zone" />
      <div
        style={{
          background: C.redLight,
          border: `1px solid ${C.redBorder}`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, color: "#b91c1c", marginBottom: 14 }}>
          Signing out will end your current session.
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 10,
            border: "none",
            background: signingOut ? "#fca5a5" : C.red,
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            cursor: signingOut ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>

    </div>
  );
}

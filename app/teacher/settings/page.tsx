"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────
interface NotifPrefs {
  attendance:    boolean;
  flags:         boolean;
  messages:      boolean;
  lessonPlans:   boolean;
  schoolNotices: boolean;
  news:          boolean;
}

const NOTIF_LABELS: Record<keyof NotifPrefs, string> = {
  attendance:    "Attendance reminders",
  flags:         "Early warning flags",
  messages:      "VibeConnect messages",
  lessonPlans:   "Lesson plan alerts",
  schoolNotices: "School notices",
  news:          "Education news",
};

const DEFAULT_PREFS: NotifPrefs = {
  attendance:    true,
  flags:         true,
  messages:      true,
  lessonPlans:   true,
  schoolNotices: false,
  news:          false,
};

// ── Toggle ─────────────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        cursor: "pointer",
        background: value ? C.accent : C.border,
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: value ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "11px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 13, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [profile, setProfile] = useState<{
    full_name: string;
    phone: string;
    role: string;
  } | null>(null);

  const [notifs, setNotifs]       = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const router = useRouter();

  // ── Classes ──────────────────────────────────────────────────────────────

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, role, notification_prefs")
        .eq("id", user.id)
        .single();

      if (error) { setLoading(false); return; }

      setProfile({
        full_name: data.full_name ?? "—",
        phone:     data.phone     ?? "—",
        role:      data.role      ?? "—",
      });

      if (data.notification_prefs) {
        setNotifs({ ...DEFAULT_PREFS, ...data.notification_prefs });
      }

      setLoading(false);
    }

    load();
  }, []);
  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
    router.push('/')
  }

  // ── Save ──────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    setSaveState("idle");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) { setSaving(false); setSaveState("error"); return; }

    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: notifs })
      .eq("id", user.id);

    setSaving(false);
    setSaveState(error ? "error" : "saved");
    if (!error) setTimeout(() => setSaveState("idle"), 2500);
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 0",
          color: C.textMuted,
          fontSize: 14,
        }}
      >
        Loading settings…
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, #374151 0%, #6b7280 100%)",
          borderRadius: 20,
          padding: "20px",
          marginBottom: 14,
          color: "#fff",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Settings
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
          Account & Preferences
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.65)",
            marginTop: 6,
          }}
        >
          Manage your VibeSchool experience.
        </div>
      </div>

      {/* Account */}
      <Card>
        <SectionLabel>Account</SectionLabel>
        {profile ? (
          <>
            <InfoRow label="Name"        value={profile.full_name} />
            <InfoRow label="Phone"       value={profile.phone} />
            <InfoRow label="Role"        value={profile.role} />
            <InfoRow label="Language"    value="English (Kenya)" />
            <InfoRow label="Time Zone"   value="Africa/Nairobi (EAT)" />
            <InfoRow label="Date Format" value="DD/MM/YYYY" />
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.textMuted, padding: "12px 0" }}>
            No profile data found.
          </div>
        )}
      </Card>

      {/* Notifications */}
      <Card>
        <SectionLabel>Notifications</SectionLabel>
        {(Object.keys(notifs) as (keyof NotifPrefs)[]).map((key) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
              {NOTIF_LABELS[key]}
            </span>
            <Toggle
              value={notifs[key]}
              onChange={(v) => setNotifs((p) => ({ ...p, [key]: v }))}
            />
          </div>
        ))}
      </Card>

      {/* Save */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Btn
          style={{ flex: 1, justifyContent: "center" }}
          onClick={save}
          disabled={saving}
        >
          {saving
            ? "Saving…"
            : saveState === "saved"
            ? "✓ Saved"
            : saveState === "error"
            ? "Error — retry"
            : "Save Changes"}
        </Btn>
        <Btn
          variant="ghost"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => setNotifs(DEFAULT_PREFS)}
        >
          Reset to Default
        </Btn>
      </div>

      {/* Logout */}
      <div style={{ marginBottom: 14 }}>
        <Btn variant="ghost" style={{ width: "100%", justifyContent: "center" }} onClick={handleLogout}>
          Log Out
        </Btn>
      </div>

      {/* Danger Zone */}
      <Card>
        <SectionLabel>Danger Zone</SectionLabel>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
          These actions are permanent and cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="danger">Delete Account</Btn>
          <Btn variant="muted">Export My Data</Btn>
        </div>
      </Card>
    </div>
  );
}

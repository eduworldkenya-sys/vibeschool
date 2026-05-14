"use client";
import { useState } from "react";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: "pointer",
        background: value ? C.accent : C.border,
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </div>
  );
}

export default function SettingsPage() {
  const [notifs, setNotifs] = useState({
    attendance:   true,
    flags:        true,
    messages:     true,
    lessonPlans:  true,
    schoolNotices: false,
    news:         false,
  });
  const [saved, setSaved] = useState(false);

  function save() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #374151 0%, #6b7280 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Settings</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Account & Preferences</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Manage your VibeSchool experience.</div>
      </div>

      <Card>
        <SectionLabel>Account</SectionLabel>
        {[
          { label: "Name",   value: "Ms. Wanjiku Kamau" },
          { label: "Email",  value: "w.kamau@stmarys.ac.ke" },
          { label: "Phone",  value: "+254 712 345 678" },
          { label: "School", value: "St. Mary's Academy" },
          { label: "Role",   value: "Class Teacher · Grade 6B" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{r.value}</span>
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <Btn variant="ghost">Edit Account Details</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Notifications</SectionLabel>
        {(Object.entries(notifs) as [keyof typeof notifs, boolean][]).map(([key, val]) => {
          const labels: Record<keyof typeof notifs, string> = {
            attendance:    "Attendance reminders",
            flags:         "Early warning flags",
            messages:      "VibeConnect messages",
            lessonPlans:   "Lesson plan alerts",
            schoolNotices: "School notices",
            news:          "Education news",
          };
          return (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>{labels[key]}</span>
              <Toggle value={val} onChange={v => setNotifs(p => ({ ...p, [key]: v }))} />
            </div>
          );
        })}
      </Card>

      <Card>
        <SectionLabel>Display</SectionLabel>
        {[
          { label: "Language",   value: "English (Kenya)" },
          { label: "Time Zone",  value: "Africa/Nairobi (EAT)" },
          { label: "Date Format", value: "DD/MM/YYYY" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{r.value}</span>
          </div>
        ))}
      </Card>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Btn style={{ flex: 1, justifyContent: "center" }} onClick={save}>
          {saved ? "✓ Saved" : "Save Changes"}
        </Btn>
        <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }}>Cancel</Btn>
      </div>

      <Card>
        <SectionLabel>Danger Zone</SectionLabel>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>These actions are permanent and cannot be undone.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="danger">Delete Account</Btn>
          <Btn variant="muted">Export My Data</Btn>
        </div>
      </Card>
    </div>
  );
}
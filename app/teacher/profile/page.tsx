"use client";
import { useState, useEffect } from "react";
import { supabase, getTeacherProfile, updateTeacherProfile } from "@/lib/supabase";

const SECTIONS = [
  "Personal Information",
  "Professional Information",
  "Qualifications",
  "Professional Development",
  "Teaching Style & Twin",
  "Attendance & Leave",
  "Performance & Appraisal",
  "Messages",
  "Documents",
  "Finance Reference",
];

export default function TeacherProfilePage() {
  const [activeSection, setActiveSection] = useState(0);

  return (
    <div className="min-h-screen bg-[#0D0F14]">
      <header className="sticky top-0 z-30 bg-[#0D0F14]/90 backdrop-blur border-b border-white/5 px-4 md:px-8 py-4">
        <h1 className="text-white text-xl font-bold">My Profile</h1>
        <p className="text-white/40 text-sm mt-0.5">Edit your personal details below</p>
      </header>

      <div id="profile-tabs-mobile" style={{
        display: "none",
        overflowX: "auto",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        gap: "8px",
        WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
      }}>
        {SECTIONS.map((section, i) => (
          <button
            key={section}
            onClick={() => setActiveSection(i)}
            style={{
              flexShrink: 0,
              padding: "6px 14px",
              borderRadius: "99px",
              fontSize: "12px",
              fontWeight: activeSection === i ? 600 : 400,
              color: activeSection === i ? "#00E5A0" : "rgba(255,255,255,0.4)",
              background: activeSection === i ? "rgba(0,229,160,0.1)" : "transparent",
              border: activeSection === i ? "1px solid rgba(0,229,160,0.2)" : "1px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {section}
          </button>
        ))}
      </div>

      <div style={{ display: "flex" }}>
        <aside id="profile-aside" style={{
          width: "240px",
          flexShrink: 0,
          position: "sticky",
          top: "73px",
          height: "calc(100vh - 73px)",
          overflowY: "auto",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          padding: "16px",
        }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {SECTIONS.map((section, i) => (
              <button
                key={section}
                onClick={() => setActiveSection(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: activeSection === i ? 600 : 400,
                  color: activeSection === i ? "#00E5A0" : "rgba(255,255,255,0.4)",
                  background: activeSection === i ? "rgba(0,229,255,0.08)" : "transparent",
                  border: activeSection === i ? "1px solid rgba(0,229,160,0.2)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", marginRight: "8px" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {section}
              </button>
            ))}
          </nav>
        </aside>

        <div id="profile-content" style={{ flex: 1, padding: "32px", minWidth: 0 }}>
          <ProfileSection index={activeSection} />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #profile-aside { display: none !important; }
          #profile-tabs-mobile { display: flex !important; }
          #profile-content { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}

function ProfileSection({ index }: { index: number }) {
  const sections = [
    <PersonalInfoSection key="1" />,
    <ProfessionalInfoSection key="2" />,
    <QualificationsSection key="3" />,
    <PDSection key="4" />,
    <TeachingStyleSection key="5" />,
    <AttendanceSection key="6" />,
    <AppraisalSection key="7" />,
    <MessagesSection key="8" />,
    <DocumentsSection key="9" />,
    <FinanceSection key="10" />,
  ];
  return sections[index] ?? null;
}

// ─── SHARED PRIMITIVES ────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-white text-2xl font-bold">{title}</h2>
      {sub && <p className="text-white/40 text-sm mt-1">{sub}</p>}
      <div className="mt-4 h-px bg-gradient-to-r from-[#00E5A0]/30 via-white/10 to-transparent" />
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="field-grid">{children}</div>
      <style>{`
        .field-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 540px) {
          .field-grid { grid-template-columns: repeat(2, 1fr); gap: 20px 32px; }
        }
      `}</style>
    </>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/[0.08]" />
        {title}
        <span className="h-px flex-1 bg-white/[0.08]" />
      </h3>
      {children}
    </div>
  );
}

// ─── SECTION 1 — REAL DATA ────────────────────────────────────────────────────

function PersonalInfoSection() {
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", school: "", subject: "", class: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const profile = await getTeacherProfile(data.user.id);
      if (profile) {
        setForm({
          name: profile.name ?? "",
          school: profile.school ?? "",
          subject: profile.subject ?? "",
          class: profile.class ?? "",
          phone: profile.phone ?? "",
        });
      }
      setLoadingProfile(false);
    });
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const initials = form.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    await updateTeacherProfile(userId, { ...form, initials });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    display: "block",
  };

  if (loadingProfile) {
    return <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading profile...</p>;
  }

  return (
    <div>
      <SectionHeader title="Personal Information" sub="Your basic details — visible across VibeSchool" />
      <SubSection title="Core Details">
        <FieldGrid>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Janet Chebet"
            />
          </div>
          <div>
            <label style={labelStyle}>School</label>
            <input
              style={inputStyle}
              value={form.school}
              onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
              placeholder="e.g. St. Mary's Academy"
            />
          </div>
          <div>
            <label style={labelStyle}>Subject</label>
            <input
              style={inputStyle}
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Mathematics"
            />
          </div>
          <div>
            <label style={labelStyle}>Class</label>
            <input
              style={inputStyle}
              value={form.class}
              onChange={e => setForm(f => ({ ...f, class: e.target.value }))}
              placeholder="e.g. Grade 6B"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. +254 712 345 678"
            />
          </div>
        </FieldGrid>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 24,
            padding: "12px 28px",
            borderRadius: 12,
            background: saved ? "rgba(0,229,160,0.15)" : "#00E5A0",
            color: saved ? "#00E5A0" : "#0D0F14",
            fontWeight: 700,
            fontSize: 14,
            border: saved ? "1px solid rgba(0,229,160,0.3)" : "none",
            cursor: saving ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Profile"}
        </button>
      </SubSection>
    </div>
  );
}
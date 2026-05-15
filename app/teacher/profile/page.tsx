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

function Field({ label, value, span = false }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-full" : ""}>
      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="field-grid">{children}</div>
      <style>{`
        .field-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 540px) { .field-grid { grid-template-columns: repeat(2, 1fr); gap: 20px 32px; } }
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
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Janet Chebet" />
          </div>
          <div>
            <label style={labelStyle}>School</label>
            <input style={inputStyle} value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))} placeholder="e.g. St. Mary's Academy" />
          </div>
          <div>
            <label style={labelStyle}>Subject</label>
            <input style={inputStyle} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" />
          </div>
          <div>
            <label style={labelStyle}>Class</label>
            <input style={inputStyle} value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} placeholder="e.g. Grade 6B" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +254 712 345 678" />
          </div>
        </FieldGrid>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 24, padding: "12px 28px", borderRadius: 12,
            background: saved ? "rgba(0,229,160,0.15)" : "#00E5A0",
            color: saved ? "#00E5A0" : "#0D0F14",
            fontWeight: 700, fontSize: 14,
            border: saved ? "1px solid rgba(0,229,160,0.3)" : "none",
            cursor: saving ? "not-allowed" : "pointer", transition: "all 0.2s",
          }}
        >
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Profile"}
        </button>
      </SubSection>
    </div>
  );
}

// ─── SECTION 2 ────────────────────────────────────────────────────────────────

function ProfessionalInfoSection() {
  return (
    <div>
      <SectionHeader title="Professional Information" sub="Employment, designation, and teaching assignment" />
      <SubSection title="Employment Details">
        <FieldGrid>
          <Field label="Staff Number" value="VS-2021-047" />
          <Field label="Employment Type" value="Permanent" />
          <Field label="Start Date" value="01 January 2021" />
          <Field label="Payroll Category" value="School Payroll" />
          <Field label="Job Group / Grade" value="C4" />
          <Field label="Notice Period" value="3 months" />
          <Field label="Probation Status" value="Passed" />
          <Field label="Deployment Type" value="School BOM Employed" />
        </FieldGrid>
      </SubSection>
      <SubSection title="Designation and Role">
        <FieldGrid>
          <Field label="Primary Designation" value="HOD — Mathematics" />
          <Field label="System Role" value="HOD" />
          <Field label="Department" value="Mathematics & Sciences" />
          <Field label="Secondary Roles" value="Subject Teacher · Games Mistress" span />
          <Field label="House Mistress" value="Serengeti House" />
          <Field label="Boarding Duty" value="Tuesdays and Thursdays" />
        </FieldGrid>
      </SubSection>
    </div>
  );
}

// ─── SECTION 3 ────────────────────────────────────────────────────────────────

function QualificationsSection() {
  const quals = [
    { name: "Bachelor of Education (Science)", institution: "University of Nairobi", years: "2005–2009", grade: "Second Upper", verified: true },
    { name: "PGDE — Mathematics", institution: "Kenyatta University", years: "2010–2011", grade: "Distinction", verified: true },
    { name: "CBC Curriculum Orientation", institution: "KICD", years: "2020", grade: "Pass", verified: true },
  ];
  const certs = [
    { name: "TSC Certificate of Registration", number: "TSC-0041-8821", expiry: "Dec 2027", status: "valid" },
    { name: "TSC Practicing Certificate", number: "PC-2024-0041", expiry: "Jun 2026", status: "expiring" },
    { name: "First Aid Certificate", number: "KRCS-2023-4421", expiry: "Sep 2025", status: "expiring" },
    { name: "Child Protection Certificate", number: "CP-2022-9812", expiry: "Dec 2026", status: "valid" },
  ];
  const statusColors: Record<string, string> = {
    valid: "text-[#00E5A0]", expiring: "text-[#FFB800]", missing: "text-[#FF4D6A]",
  };
  return (
    <div>
      <SectionHeader title="Academic Qualifications" sub="Formal education and professional certificates" />
      <SubSection title="Formal Education">
        <div className="space-y-3">
          {quals.map(q => (
            <div key={q.name} className="p-4 rounded-xl bg-white/4 border border-white/8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white text-sm font-semibold">{q.name}</p>
                  <p className="text-white/50 text-xs mt-1">{q.institution} · {q.years}</p>
                  <p className="text-white/40 text-xs mt-0.5">Grade: {q.grade}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ml-2 ${q.verified ? "bg-[#00E5A0]/10 text-[#00E5A0]" : "bg-[#FFB800]/10 text-[#FFB800]"}`}>
                  {q.verified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SubSection>
      <SubSection title="Professional Certificates">
        <div className="space-y-2">
          {certs.map(cert => (
            <div key={cert.name} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
              <div className="min-w-0 mr-3">
                <p className="text-white text-sm">{cert.name}</p>
                <p className="text-white/30 text-xs mt-0.5">{cert.number}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-semibold ${statusColors[cert.status]}`}>
                  {cert.status === "valid" ? "Valid" : "Expiring"}
                </p>
                <p className="text-white/30 text-xs mt-0.5">Exp: {cert.expiry}</p>
              </div>
            </div>
          ))}
        </div>
      </SubSection>
    </div>
  );
}

// ─── SECTION 4 ────────────────────────────────────────────────────────────────

function PDSection() {
  return (
    <div>
      <SectionHeader title="Professional Development" sub="Training history and PD progress" />
      <SubSection title="PD Hours Progress">
        <div className="p-5 rounded-2xl bg-white/4 border border-white/8 mb-4">
          <div className="flex items-end gap-2 mb-3">
            <span className="text-4xl font-bold text-white">22</span>
            <span className="text-white/40 mb-1">/ 40 hrs this year</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mb-2">
            <div className="h-3 rounded-full bg-gradient-to-r from-[#00E5A0] to-[#00B8FF]" style={{ width: "55%" }} />
          </div>
          <p className="text-white/40 text-xs">18 hours remaining</p>
        </div>
      </SubSection>
    </div>
  );
}

// ─── SECTION 5 ────────────────────────────────────────────────────────────────

function TeachingStyleSection() {
  return (
    <div>
      <SectionHeader title="Teaching Style & Twin Profile" sub="Your preferences and what Twin has observed" />
      <SubSection title="Your Preferences">
        <FieldGrid>
          <Field label="Preferred Lesson Structure" value="3-Phase CBC" />
          <Field label="Preferred Assessment" value="Written + Practical" />
          <Field label="Preferred Grouping" value="Small groups + Mixed" />
          <Field label="Easiest to Teach" value="Science Practicals" />
          <Field label="Most Challenging" value="Number Strand (Grade 6)" />
          <Field label="My Goal This Term" value="Improve lesson timing accuracy" span />
        </FieldGrid>
      </SubSection>
    </div>
  );
}

// ─── SECTION 6 ────────────────────────────────────────────────────────────────

function AttendanceSection() {
  const leaveTypes = [
    { type: "Annual Leave", entitlement: 21, used: 9, remaining: 12 },
    { type: "Sick Leave", entitlement: 10, used: 2, remaining: 8 },
    { type: "Compassionate Leave", entitlement: 5, used: 0, remaining: 5 },
  ];
  return (
    <div>
      <SectionHeader title="Attendance & Leave" sub="Daily attendance record and leave management" />
      <SubSection title="This Term Attendance">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-4 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/20">
            <p className="text-[#00E5A0] text-2xl font-bold">96%</p>
            <p className="text-white/40 text-xs mt-1">Attendance Rate</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/4 border border-white/8">
            <p className="text-white text-2xl font-bold">2</p>
            <p className="text-white/40 text-xs mt-1">Days Absent</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/4 border border-white/8">
            <p className="text-white text-2xl font-bold">1</p>
            <p className="text-white/40 text-xs mt-1">Late Arrivals</p>
          </div>
        </div>
      </SubSection>
      <SubSection title="Leave Balances">
        <div className="space-y-3">
          {leaveTypes.map(leave => (
            <div key={leave.type} className="p-4 rounded-xl bg-white/4 border border-white/8">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium">{leave.type}</p>
                <span className="text-white/40 text-xs">{leave.remaining} days left</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-[#00E5A0]" style={{ width: `${(leave.used / leave.entitlement) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-white/30 text-xs">{leave.used} used</p>
                <p className="text-white/30 text-xs">{leave.entitlement} total</p>
              </div>
            </div>
          ))}
        </div>
      </SubSection>
    </div>
  );
}

// ─── SECTION 7 ────────────────────────────────────────────────────────────────

function AppraisalSection() {
  return (
    <div>
      <SectionHeader title="Performance & Appraisal" sub="TSC appraisal cycle and performance signals" />
      <SubSection title="This Appraisal Cycle">
        <div className="space-y-3 mb-6">
          {[
            { label: "Self-Appraisal", status: "pending", note: "Due in 7 days" },
            { label: "HOD Review", status: "waiting", note: "Awaiting your submission" },
            { label: "Principal Moderation", status: "waiting", note: "" },
            { label: "Submitted to TSC", status: "waiting", note: "" },
          ].map(step => (
            <div key={step.label} className="flex items-center gap-4 p-3 rounded-xl bg-white/4 border border-white/8">
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${step.status === "done" ? "bg-[#00E5A0]" : step.status === "pending" ? "bg-[#FFB800] animate-pulse" : "bg-white/15"}`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${step.status === "pending" ? "text-[#FFB800]" : step.status === "done" ? "text-[#00E5A0]" : "text-white/40"}`}>{step.label}</p>
                {step.note && <p className="text-white/30 text-xs mt-0.5">{step.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </SubSection>
    </div>
  );
}

// ─── SECTION 8 ────────────────────────────────────────────────────────────────

function MessagesSection() {
  return (
    <div>
      <SectionHeader title="Messages & Communication" sub="Internal messages and notification settings" />
      <div className="flex items-center justify-center h-40 rounded-2xl bg-white/3 border border-white/8 border-dashed">
        <div className="text-center">
          <p className="text-white/30 text-sm">Messages module</p>
          <p className="text-white/20 text-xs mt-1">Linked to VibeConnect</p>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION 9 ────────────────────────────────────────────────────────────────

function DocumentsSection() {
  const docs = [
    { name: "National ID Copy", status: "valid", expiry: null },
    { name: "TSC Certificate of Registration", status: "valid", expiry: "Dec 2027" },
    { name: "TSC Practicing Certificate", status: "expiring", expiry: "Jun 2026" },
    { name: "Academic Certificates", status: "valid", expiry: null },
    { name: "Good Conduct Certificate", status: "expiring", expiry: "Jul 2026" },
    { name: "CBC Orientation Certificate", status: "missing", expiry: null },
  ];
  const statusStyle: Record<string, { dot: string; text: string; label: string }> = {
    valid:    { dot: "bg-[#00E5A0]", text: "text-[#00E5A0]", label: "Valid" },
    expiring: { dot: "bg-[#FFB800]", text: "text-[#FFB800]", label: "Expiring" },
    missing:  { dot: "bg-[#FF4D6A]", text: "text-[#FF4D6A]", label: "Missing" },
  };
  return (
    <div>
      <SectionHeader title="Documents & Compliance" sub="Upload and track required documents" />
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-4 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/20">
          <p className="text-[#00E5A0] text-2xl font-bold">{docs.filter(d => d.status === "valid").length}</p>
          <p className="text-white/40 text-xs mt-1">Valid</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/20">
          <p className="text-[#FFB800] text-2xl font-bold">{docs.filter(d => d.status === "expiring").length}</p>
          <p className="text-white/40 text-xs mt-1">Expiring</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-[#FF4D6A]/10 border border-[#FF4D6A]/20">
          <p className="text-[#FF4D6A] text-2xl font-bold">{docs.filter(d => d.status === "missing").length}</p>
          <p className="text-white/40 text-xs mt-1">Missing</p>
        </div>
      </div>
      <div className="space-y-2">
        {docs.map(doc => {
          const s = statusStyle[doc.status];
          return (
            <div key={doc.name} className="flex items-center justify-between p-3.5 rounded-xl bg-white/3 border border-white/8">
              <div className="flex items-center gap-3 min-w-0 mr-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className="text-white/70 text-sm truncate">{doc.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {doc.expiry && <span className="text-white/25 text-xs hidden sm:block">Exp: {doc.expiry}</span>}
                <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SECTION 10 ───────────────────────────────────────────────────────────────

function FinanceSection() {
  return (
    <div>
      <SectionHeader title="Finance Reference" sub="Payroll reference — managed in Finance module" />
      <SubSection title="Payroll Details">
        <FieldGrid>
          <Field label="Payroll Number" value="PR-2021-047" />
          <Field label="Payroll Category" value="School Payroll" />
          <Field label="Bank Name" value="Equity Bank Kenya" />
          <Field label="Branch" value="Westlands Branch" />
          <Field label="Account Number" value="**** **** 4821" />
          <Field label="Pay Date" value="25th of every month" />
        </FieldGrid>
      </SubSection>
      <SubSection title="Statutory Deductions">
        <FieldGrid>
          <Field label="PAYE" value="KES 4,200 / month" />
          <Field label="NSSF" value="KES 200 / month" />
          <Field label="NHIF" value="KES 500 / month" />
          <Field label="SACCO" value="KES 3,000 / month" />
        </FieldGrid>
      </SubSection>
    </div>
  );
}
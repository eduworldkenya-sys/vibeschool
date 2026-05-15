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
  "Documents",
];

export default function TeacherProfilePage() {
  const [activeSection, setActiveSection] = useState(0);
  return (
    <div style={{ minHeight: '100vh', background: '#0D0F14' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,15,20,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '16px' }}>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>My Profile</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 }}>Edit your personal details below</p>
      </header>

      <div style={{ display: 'flex', overflowX: 'auto', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 8, WebkitOverflowScrolling: 'touch' }}>
        {SECTIONS.map((s, i) => (
          <button key={s} onClick={() => setActiveSection(i)} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: activeSection === i ? 600 : 400, color: activeSection === i ? '#00E5A0' : 'rgba(255,255,255,0.4)', background: activeSection === i ? 'rgba(0,229,160,0.1)' : 'transparent', border: activeSection === i ? '1px solid rgba(0,229,160,0.2)' : '1px solid transparent', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        <ProfileSection index={activeSection} />
      </div>
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
    <DocumentsSection key="8" />,
  ];
  return sections[index] ?? null;
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h2>
      {sub && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>{sub}</p>}
      <div style={{ marginTop: 12, height: 1, background: 'linear-gradient(to right, rgba(0,229,160,0.3), rgba(255,255,255,0.1), transparent)' }} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{value || '—'}</p>
    </div>
  );
}

// ─── SECTION 1 — Personal Info ────────────────────────────────────────────────
function PersonalInfoSection() {
  const [userId, setUserId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ name: '', phone: '' });
  const [school, setSchool]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return; }
      setUserId(data.user.id);
      const profile = await getTeacherProfile(data.user.id);
      if (profile) {
        setForm({ name: profile.name ?? '', phone: profile.phone ?? '' });
        setSchool(profile.school ?? '');
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    await updateTeacherProfile(userId, { name: form.name, phone: form.phone });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.4)', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block',
  };

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading profile...</p>;

  return (
    <div>
      <SectionHeader title="Personal Information" sub="Your basic details — visible across VibeSchool" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Full Name</label>
          <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Janet Chebet" />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +254 712 345 678" />
        </div>
        <div>
          <label style={labelStyle}>School</label>
          <div style={{ ...inputStyle, color: 'rgba(255,255,255,0.4)', cursor: 'not-allowed' }}>{school || 'Set by school admin'}</div>
        </div>
        <button onClick={handleSave} disabled={saving} style={{ padding: '12px 28px', borderRadius: 12, background: saved ? 'rgba(0,229,160,0.15)' : '#00E5A0', color: saved ? '#00E5A0' : '#0D0F14', fontWeight: 700, fontSize: 14, border: saved ? '1px solid rgba(0,229,160,0.3)' : 'none', cursor: saving ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

// ─── SECTION 2 ────────────────────────────────────────────────────────────────
function ProfessionalInfoSection() {
  return (
    <div>
      <SectionHeader title="Professional Information" sub="Employment, designation, and teaching assignment" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
        <Field label="Staff Number" value="VS-2021-047" />
        <Field label="Employment Type" value="Permanent" />
        <Field label="Start Date" value="01 January 2021" />
        <Field label="Job Group / Grade" value="C4" />
        <Field label="Primary Designation" value="HOD — Mathematics" />
        <Field label="Department" value="Mathematics & Sciences" />
      </div>
    </div>
  );
}

// ─── SECTION 3 ────────────────────────────────────────────────────────────────
function QualificationsSection() {
  const quals = [
    { name: "Bachelor of Education (Science)", institution: "University of Nairobi", years: "2005–2009", grade: "Second Upper" },
    { name: "PGDE — Mathematics", institution: "Kenyatta University", years: "2010–2011", grade: "Distinction" },
    { name: "CBC Curriculum Orientation", institution: "KICD", years: "2020", grade: "Pass" },
  ];
  return (
    <div>
      <SectionHeader title="Academic Qualifications" sub="Formal education and professional certificates" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {quals.map(q => (
          <div key={q.name} style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>{q.name}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>{q.institution} · {q.years} · {q.grade}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SECTION 4 ────────────────────────────────────────────────────────────────
function PDSection() {
  return (
    <div>
      <SectionHeader title="Professional Development" sub="Training history and PD progress" />
      <div style={{ padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>22</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>/ 40 hrs this year</span>
        </div>
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 10 }}>
          <div style={{ height: 10, borderRadius: 99, background: 'linear-gradient(to right, #00E5A0, #00B8FF)', width: '55%' }} />
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 }}>18 hours remaining</p>
      </div>
    </div>
  );
}

// ─── SECTION 5 ────────────────────────────────────────────────────────────────
function TeachingStyleSection() {
  return (
    <div>
      <SectionHeader title="Teaching Style & Twin Profile" sub="Your preferences and what Twin has observed" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
        <Field label="Preferred Lesson Structure" value="3-Phase CBC" />
        <Field label="Preferred Assessment" value="Written + Practical" />
        <Field label="Preferred Grouping" value="Small groups + Mixed" />
        <Field label="Easiest to Teach" value="Science Practicals" />
      </div>
    </div>
  );
}

// ─── SECTION 6 ────────────────────────────────────────────────────────────────
function AttendanceSection() {
  return (
    <div>
      <SectionHeader title="Attendance & Leave" sub="Daily attendance record and leave management" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[{ label: 'Attendance Rate', value: '96%' }, { label: 'Days Absent', value: '2' }, { label: 'Late Arrivals', value: '1' }].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: 16, borderRadius: 12, background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
            <p style={{ color: '#00E5A0', fontSize: 22, fontWeight: 700, margin: 0 }}>{s.value}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SECTION 7 ────────────────────────────────────────────────────────────────
function AppraisalSection() {
  return (
    <div>
      <SectionHeader title="Performance & Appraisal" sub="TSC appraisal cycle and performance signals" />
      {[
        { label: 'Self-Appraisal', status: 'pending', note: 'Due in 7 days' },
        { label: 'HOD Review', status: 'waiting', note: 'Awaiting your submission' },
        { label: 'Principal Moderation', status: 'waiting', note: '' },
        { label: 'Submitted to TSC', status: 'waiting', note: '' },
      ].map(step => (
        <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: step.status === 'done' ? '#00E5A0' : step.status === 'pending' ? '#FFB800' : 'rgba(255,255,255,0.15)' }} />
          <div>
            <p style={{ color: step.status === 'pending' ? '#FFB800' : step.status === 'done' ? '#00E5A0' : 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 500, margin: 0 }}>{step.label}</p>
            {step.note && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>{step.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION 8 ────────────────────────────────────────────────────────────────
function DocumentsSection() {
  return (
    <div>
      <SectionHeader title="Documents" sub="Certificates and official records" />
      {[
        { name: 'TSC Certificate of Registration', expiry: 'Dec 2027', status: 'valid' },
        { name: 'TSC Practicing Certificate', expiry: 'Jun 2026', status: 'expiring' },
        { name: 'First Aid Certificate', expiry: 'Sep 2025', status: 'expiring' },
      ].map(doc => (
        <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
          <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>{doc.name}</p>
          <span style={{ fontSize: 11, fontWeight: 700, color: doc.status === 'valid' ? '#00E5A0' : '#FFB800' }}>{doc.status === 'valid' ? 'Valid' : 'Expiring'} · {doc.expiry}</span>
        </div>
      ))}
    </div>
  );
}

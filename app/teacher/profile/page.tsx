"use client";

import { useState } from "react";

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
      <header className="sticky top-0 z-30 bg-[#0D0F14]/90 backdrop-blur border-b border-white/5 px-8 py-4">
        <h1 className="text-white text-xl font-bold">My Profile</h1>
        <p className="text-white/40 text-sm mt-0.5">Mrs. Janet Chebet · VS-2021-047</p>
      </header>

      <div className="flex gap-0">
        {/* Section nav */}
        <aside className="w-60 flex-shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto border-r border-white/5 p-4">
          <nav className="space-y-0.5">
            {SECTIONS.map((section, i) => (
              <button
                key={section}
                onClick={() => setActiveSection(i)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeSection === i
                    ? "bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-white/20 text-xs mr-2">{String(i + 1).padStart(2, "0")}</span>
                {section}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 px-8 py-8">
          <ProfileSection index={activeSection} />
        </div>
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
    <MessagesSection key="8" />,
    <DocumentsSection key="9" />,
    <FinanceSection key="10" />,
  ];
  return sections[index] ?? null;
}

// ─── SECTION COMPONENTS ──────────────────────────────────────────────────────

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
    <div className={span ? "col-span-2" : ""}>
      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-8 gap-y-5">{children}</div>;
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/8" />
        {title}
        <span className="h-px flex-1 bg-white/8" />
      </h3>
      {children}
    </div>
  );
}

function PersonalInfoSection() {
  return (
    <div>
      <SectionHeader title="Personal Information" sub="Your legal identity and contact details" />
      <SubSection title="Identity">
        <FieldGrid>
          <Field label="Full Legal Name" value="Janet Achieng Chebet" span />
          <Field label="Preferred Name" value="Mrs. Chebet" />
          <Field label="Date of Birth" value="14 March 1986" />
          <Field label="Age" value="40 years" />
          <Field label="Gender" value="Female" />
          <Field label="Nationality" value="Kenyan" />
          <Field label="National ID" value="23847591" />
          <Field label="TSC Number" value="TSC-0041-8821" />
          <Field label="KRA PIN" value="A004185217B" />
          <Field label="NSSF Number" value="NSSF-0047821" />
          <Field label="NHIF Number" value="NHIF-0091234" />
          <Field label="Blood Group" value="O+" />
          <Field label="Personal Email" value="janet.chebet@gmail.com" />
          <Field label="Phone (Primary)" value="+254 712 345 678" />
          <Field label="Phone (Secondary)" value="+254 733 456 789" />
          <Field label="WhatsApp" value="+254 712 345 678" />
        </FieldGrid>
      </SubSection>
      <SubSection title="Home Address">
        <FieldGrid>
          <Field label="County" value="Nairobi" />
          <Field label="Sub-County" value="Westlands" />
          <Field label="Ward" value="Parklands" />
          <Field label="Estate" value="Mountain View Estate" />
          <Field label="Postal Address" value="P.O. Box 41872-00100, Nairobi" span />
        </FieldGrid>
      </SubSection>
      <SubSection title="Emergency Contact">
        <FieldGrid>
          <Field label="Full Name" value="David Chebet" />
          <Field label="Relationship" value="Spouse" />
          <Field label="Phone (Primary)" value="+254 722 876 543" />
          <Field label="Phone (Secondary)" value="+254 711 987 654" />
          <Field label="Address" value="Mountain View Estate, Nairobi" span />
        </FieldGrid>
      </SubSection>
    </div>
  );
}

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
          <Field label="Second Department" value="—" />
          <Field label="Secondary Roles" value="Subject Teacher · Games Mistress" span />
          <Field label="House Mistress" value="Serengeti House" />
          <Field label="Boarding Duty" value="Tuesdays and Thursdays" />
        </FieldGrid>
      </SubSection>
      <SubSection title="Teaching Assignment — This Term">
        <div className="space-y-2">
          {[
            { subject: "Mathematics", classes: "Grade 7A, 7B, 6B", periods: 12 },
            { subject: "Science", classes: "Grade 5A", periods: 4 },
          ].map((row) => (
            <div key={row.subject} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
              <div>
                <p className="text-white text-sm font-medium">{row.subject}</p>
                <p className="text-white/40 text-xs mt-0.5">{row.classes}</p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-bold">{row.periods}</p>
                <p className="text-white/30 text-xs">periods/wk</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4">
          <div className="bg-white/4 rounded-xl p-3 flex-1 text-center">
            <p className="text-white font-bold">16</p>
            <p className="text-white/40 text-xs">Total periods/wk</p>
          </div>
          <div className="bg-white/4 rounded-xl p-3 flex-1 text-center">
            <p className="text-white font-bold">24</p>
            <p className="text-white/40 text-xs">Max allowed (TSC)</p>
          </div>
          <div className="bg-[#00E5A0]/10 rounded-xl p-3 flex-1 text-center">
            <p className="text-[#00E5A0] font-bold">67%</p>
            <p className="text-white/40 text-xs">Workload used</p>
          </div>
        </div>
      </SubSection>
    </div>
  );
}

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
    { name: "CBC Training Certificate", number: "KICD-2020-1139", expiry: "—", status: "valid" },
  ];

  const statusColors: Record<string, string> = {
    valid: "text-[#00E5A0]",
    expiring: "text-[#FFB800]",
    missing: "text-[#FF4D6A]",
  };

  return (
    <div>
      <SectionHeader title="Academic Qualifications" sub="Formal education, specialisms, and professional certificates" />
      <SubSection title="Formal Education">
        <div className="space-y-3">
          {quals.map((q) => (
            <div key={q.name} className="p-4 rounded-xl bg-white/4 border border-white/8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white text-sm font-semibold">{q.name}</p>
                  <p className="text-white/50 text-xs mt-1">{q.institution} · {q.years}</p>
                  <p className="text-white/40 text-xs mt-0.5">Grade: {q.grade}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${q.verified ? "bg-[#00E5A0]/10 text-[#00E5A0]" : "bg-[#FFB800]/10 text-[#FFB800]"}`}>
                  {q.verified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SubSection>
      <SubSection title="Teaching Specialisms">
        <FieldGrid>
          <Field label="Primary Subjects" value="Mathematics · Science" />
          <Field label="Age Group" value="Upper Primary · Junior Secondary" />
          <Field label="CBC Training" value="Completed — 2020" />
          <Field label="SNE Certificate" value="—" />
        </FieldGrid>
      </SubSection>
      <SubSection title="Professional Certificates">
        <div className="space-y-2">
          {certs.map((cert) => (
            <div key={cert.name} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
              <div>
                <p className="text-white text-sm">{cert.name}</p>
                <p className="text-white/30 text-xs mt-0.5">{cert.number}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold ${statusColors[cert.status]}`}>
                  {cert.status === "valid" ? "Valid" : cert.status === "expiring" ? "Expiring" : "Missing"}
                </p>
                {cert.expiry !== "—" && <p className="text-white/30 text-xs mt-0.5">Exp: {cert.expiry}</p>}
              </div>
            </div>
          ))}
        </div>
      </SubSection>
    </div>
  );
}

function PDSection() {
  const pdEntries = [
    { title: "CBC Assessment Workshop", type: "Workshop", provider: "KICD", hours: 8, date: "Mar 2026", topics: ["CBC", "Assessment"], takeaway: "Aligned my continuous assessment with CBC competency framework" },
    { title: "Differentiated Instruction — Online", type: "Online course", provider: "Coursera", hours: 14, date: "Jan 2026", topics: ["Differentiation", "Inclusion"], takeaway: "Now using tiered tasks in Grade 7 Mathematics" },
  ];

  return (
    <div>
      <SectionHeader title="Professional Development" sub="Training history, PD progress, and appraisal record" />
      <SubSection title="PD Hours Progress">
        <div className="p-5 rounded-2xl bg-white/4 border border-white/8 mb-4">
          <div className="flex items-end gap-2 mb-3">
            <span className="text-4xl font-bold text-white">22</span>
            <span className="text-white/40 mb-1">/ 40 hrs this year</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mb-2">
            <div className="h-3 rounded-full bg-gradient-to-r from-[#00E5A0] to-[#00B8FF]" style={{ width: "55%" }} />
          </div>
          <p className="text-white/40 text-xs">18 hours remaining · on track if 1 workshop/month attended</p>
        </div>
      </SubSection>
      <SubSection title="PD History">
        <div className="space-y-3">
          {pdEntries.map((entry) => (
            <div key={entry.title} className="p-4 rounded-xl bg-white/4 border border-white/8">
              <div className="flex items-start justify-between mb-2">
                <p className="text-white text-sm font-semibold">{entry.title}</p>
                <span className="text-xs text-white/40 flex-shrink-0 ml-2">{entry.date}</span>
              </div>
              <p className="text-white/40 text-xs mb-2">{entry.type} · {entry.provider} · {entry.hours} hrs</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {entry.topics.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-[#00B8FF]/10 border border-[#00B8FF]/20 text-[#00B8FF] text-xs">{t}</span>
                ))}
              </div>
              <p className="text-white/50 text-xs italic">"{entry.takeaway}"</p>
            </div>
          ))}
        </div>
      </SubSection>
    </div>
  );
}

function TeachingStyleSection() {
  return (
    <div>
      <SectionHeader title="Teaching Style & Twin Profile" sub="Your preferences and what Twin has observed — private to you" />
      <SubSection title="Your Preferences">
        <FieldGrid>
          <Field label="Preferred Lesson Structure" value="3-Phase CBC" />
          <Field label="Preferred Assessment" value="Written + Practical (Mixed)" />
          <Field label="Preferred Grouping" value="Small groups + Mixed" />
          <Field label="Preferred Resources" value="Realia + Teacher-made" />
          <Field label="Easiest to Teach" value="Science Practicals" />
          <Field label="Most Challenging" value="Number Strand (Grade 6)" />
          <Field label="Topics I Find Difficult" value="Fractions and Decimals, Grade 6" span />
          <Field label="My Goal This Term" value="Improve lesson timing accuracy in development phase" span />
          <Field label="Support I Would Like" value="Peer observation + Twin assistance" span />
        </FieldGrid>
      </SubSection>
      <SubSection title="Twin-Observed Profile">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#00E5A0]/5 to-[#00B8FF]/5 border border-[#00E5A0]/15 mb-4">
          <p className="text-white/70 text-sm leading-relaxed italic">
            "Mrs. Chebet is a consistent planner who prepares 91% of lessons before delivery. She favors group work and realia-based activities, which her reflections consistently rate highly. Her timing runs slightly long in development phases. She has flagged Number strand as challenging to teach and her student performance data confirms this is her weakest delivery area. Twin recommends a short PD input on Number strand pedagogy and has adjusted future lesson plan suggestions to front-load visual resources for Number topics."
          </p>
        </div>
        <FieldGrid>
          <Field label="Most Used Structure" value="3-Phase CBC" />
          <Field label="Avg Prep Time" value="28 minutes per lesson" />
          <Field label="Preparation Rate" value="91%" />
          <Field label="Avg Assessment Turnaround" value="2.3 days" />
          <Field label="Strongest Delivery" value="Science Practicals" />
          <Field label="Weakest Delivery" value="Number Strand" />
          <Field label="Highest Rated Conditions" value="Practical and group-based lessons" span />
          <Field label="Common Reflection Themes" value="Group work · Timing · Realia · Number strand" span />
        </FieldGrid>
      </SubSection>
    </div>
  );
}

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
        <div className="grid grid-cols-3 gap-4 mb-4">
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
          {leaveTypes.map((leave) => (
            <div key={leave.type} className="p-4 rounded-xl bg-white/4 border border-white/8">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium">{leave.type}</p>
                <span className="text-white/40 text-xs">{leave.remaining} days left</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#00E5A0]"
                  style={{ width: `${(leave.used / leave.entitlement) * 100}%` }}
                />
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
          ].map((step) => (
            <div key={step.label} className="flex items-center gap-4 p-3 rounded-xl bg-white/4 border border-white/8">
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${step.status === "done" ? "bg-[#00E5A0]" : step.status === "pending" ? "bg-[#FFB800] animate-pulse" : "bg-white/15"}`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${step.status === "pending" ? "text-[#FFB800]" : step.status === "done" ? "text-[#00E5A0]" : "text-white/40"}`}>{step.label}</p>
                {step.note && <p className="text-white/30 text-xs mt-0.5">{step.note}</p>}
              </div>
            </div>
          ))}
        </div>
        <button className="w-full py-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/20 text-[#00E5A0] font-medium hover:bg-[#00E5A0]/20 transition-colors">
          Start Self-Appraisal
        </button>
      </SubSection>
      <SubSection title="Performance Signals (Internal)">
        <FieldGrid>
          <Field label="Lesson Plan Prep Rate" value="91%" />
          <Field label="Assessment Completion Rate" value="88%" />
          <Field label="Last Appraisal Score" value="78 / 100 (Good)" />
          <Field label="Last Appraisal Date" value="December 2024" />
        </FieldGrid>
      </SubSection>
    </div>
  );
}

function MessagesSection() {
  return (
    <div>
      <SectionHeader title="Messages & Communication" sub="Internal messages, parent comms, and notification settings" />
      <div className="flex items-center justify-center h-40 rounded-2xl bg-white/3 border border-white/8 border-dashed">
        <div className="text-center">
          <p className="text-white/30 text-sm">Messages module</p>
          <p className="text-white/20 text-xs mt-1">Linked to FamilyLayer and school messaging</p>
        </div>
      </div>
    </div>
  );
}

function DocumentsSection() {
  const docs = [
    { name: "National ID Copy", status: "valid", expiry: null, uploaded: true },
    { name: "TSC Certificate of Registration", status: "valid", expiry: "Dec 2027", uploaded: true },
    { name: "TSC Practicing Certificate", status: "expiring", expiry: "Jun 2026", uploaded: true },
    { name: "Academic Certificates", status: "valid", expiry: null, uploaded: true },
    { name: "KRA PIN Certificate", status: "valid", expiry: null, uploaded: true },
    { name: "Good Conduct Certificate", status: "expiring", expiry: "Jul 2026", uploaded: true },
    { name: "Medical Fitness Certificate", status: "valid", expiry: "Jan 2027", uploaded: true },
    { name: "CBC Orientation Certificate", status: "missing", expiry: null, uploaded: false },
    { name: "Child Protection Acknowledgement", status: "valid", expiry: null, uploaded: true },
    { name: "Signed Code of Conduct", status: "valid", expiry: null, uploaded: true },
    { name: "Letter of Appointment", status: "valid", expiry: null, uploaded: true },
    { name: "NSSF Card", status: "valid", expiry: null, uploaded: true },
    { name: "NHIF Card", status: "valid", expiry: null, uploaded: true },
  ];

  const statusStyle: Record<string, { dot: string; text: string; label: string }> = {
    valid: { dot: "bg-[#00E5A0]", text: "text-[#00E5A0]", label: "Valid" },
    expiring: { dot: "bg-[#FFB800]", text: "text-[#FFB800]", label: "Expiring" },
    missing: { dot: "bg-[#FF4D6A]", text: "text-[#FF4D6A]", label: "Missing" },
    expired: { dot: "bg-[#FF4D6A]", text: "text-[#FF4D6A]", label: "Expired" },
  };

  return (
    <div>
      <SectionHeader title="Documents & Compliance" sub="All required documents — upload, track expiry, stay compliant" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/20">
          <p className="text-[#00E5A0] text-2xl font-bold">{docs.filter(d => d.status === "valid").length}</p>
          <p className="text-white/40 text-xs mt-1">Valid</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/20">
          <p className="text-[#FFB800] text-2xl font-bold">{docs.filter(d => d.status === "expiring").length}</p>
          <p className="text-white/40 text-xs mt-1">Expiring</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-[#FF4D6A]/10 border border-[#FF4D6A]/20">
          <p className="text-[#FF4D6A] text-2xl font-bold">{docs.filter(d => d.status === "missing" || d.status === "expired").length}</p>
          <p className="text-white/40 text-xs mt-1">Action Needed</p>
        </div>
      </div>
      <div className="space-y-2">
        {docs.map((doc) => {
          const s = statusStyle[doc.status];
          return (
            <div key={doc.name} className="flex items-center justify-between p-3.5 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className="text-white/70 text-sm">{doc.name}</span>
              </div>
              <div className="flex items-center gap-3">
                {doc.expiry && <span className="text-white/25 text-xs">Exp: {doc.expiry}</span>}
                <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
                <button className="text-xs text-[#00B8FF] hover:underline">
                  {doc.uploaded ? "Replace" : "Upload"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
      <div className="mt-4 p-4 rounded-xl bg-white/4 border border-white/8 text-center">
        <p className="text-white/40 text-sm">Payslip history is managed in the Finance module</p>
        <a href="/finance/payslips" className="text-[#00B8FF] text-sm hover:underline mt-1 block">
          View payslip history →
        </a>
      </div>
    </div>
  );
}
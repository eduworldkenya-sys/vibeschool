import StatCard from "@/components/teacher/StatCard";
import AlertBanner from "@/components/teacher/AlertBanner";
import TwinSummary from "@/components/teacher/TwinSummary";
import DocumentStatus from "@/components/teacher/DocumentStatus";
import { TeacherAlert, TeacherDocument, TimetablePeriod } from "@/lib/types";

const ALERTS: TeacherAlert[] = [
  {
    id: "1",
    type: "warning",
    message: "Your TSC Practicing Certificate expires in 45 days. Upload renewal before it lapses.",
    action: "Upload now",
    actionHref: "/teacher/documents",
  },
  {
    id: "2",
    type: "info",
    message: "You are 18 PD hours behind your annual target. 3 upcoming workshops available.",
    action: "View workshops",
    actionHref: "/teacher/pd",
  },
  {
    id: "3",
    type: "urgent",
    message: "Your self-appraisal is due in 7 days. You have not yet started.",
    action: "Start now",
    actionHref: "/teacher/appraisal",
  },
];

const DOCUMENTS: TeacherDocument[] = [
  { name: "National ID Copy", status: "valid", uploaded: true },
  { name: "TSC Certificate of Registration", status: "valid", uploaded: true, expiryDate: "Dec 2027" },
  { name: "TSC Practicing Certificate", status: "expiring", uploaded: true, expiryDate: "Jun 2026" },
  { name: "Good Conduct Certificate", status: "expiring", uploaded: true, expiryDate: "Jul 2026" },
  { name: "Medical Fitness Certificate", status: "valid", uploaded: true, expiryDate: "Jan 2027" },
  { name: "CBC Orientation Certificate", status: "missing", uploaded: false },
  { name: "Child Protection Acknowledgement", status: "valid", uploaded: true },
];

const TODAY_SCHEDULE: TimetablePeriod[] = [
  { periodNumber: 1, subject: "Mathematics", class: "Grade 7A", room: "R-12", startTime: "7:30", endTime: "8:15" },
  { periodNumber: 2, subject: "Mathematics", class: "Grade 6B", room: "R-12", startTime: "8:15", endTime: "9:00" },
  { periodNumber: 4, subject: "Science", class: "Grade 5A", room: "Lab 2", startTime: "10:15", endTime: "11:00" },
  { periodNumber: 6, subject: "Mathematics", class: "Grade 7B", room: "R-12", startTime: "12:00", endTime: "12:45" },
];

const TWIN_OBSERVATIONS = {
  mostUsedStructure: "3-Phase CBC",
  avgPrepTime: 28,
  prepRate: 91,
  commonReflectionThemes: ["Group work", "Number strand", "Timing", "Realia resources"],
  highestRatedConditions: "Practical and group-based lessons",
  weakestDeliveryArea: "Number Strand",
  strongestDeliveryArea: "Science Practicals",
};

const TWIN_SUMMARY =
  "Mrs. Chebet is a consistent planner who prepares 91% of lessons before delivery. She favors group work and realia-based activities, which her reflections consistently rate highly. Her timing runs slightly long in development phases. Twin recommends a short PD input on Number strand pedagogy and has adjusted future lesson plan suggestions to front-load visual resources for Number topics.";

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: "100vh",
    background: "#F0F2F5",
  } as React.CSSProperties,

  header: {
    position: "sticky" as const,
    top: 0,
    zIndex: 30,
    background: "rgba(240,242,245,0.95)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #E2E5EB",
    padding: "16px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,

  heading: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#1A1D23",
    margin: 0,
  } as React.CSSProperties,

  subtext: {
    fontSize: "13px",
    color: "#7C8493",
    marginTop: "2px",
  } as React.CSSProperties,

  activePeriodBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    borderRadius: "12px",
    background: "#E6FAF4",
    border: "1px solid #A7EDD4",
  } as React.CSSProperties,

  activeDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#00C07A",
    flexShrink: 0,
  } as React.CSSProperties,

  activePeriodText: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#00875A",
  } as React.CSSProperties,

  noPeriodBadge: {
    padding: "8px 16px",
    borderRadius: "12px",
    background: "#F5F6F8",
    border: "1px solid #E2E5EB",
    fontSize: "13px",
    color: "#9BA3AF",
  } as React.CSSProperties,

  body: {
    padding: "32px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "32px",
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#9BA3AF",
    marginBottom: "16px",
  } as React.CSSProperties,

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
  } as React.CSSProperties,

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: "24px",
    alignItems: "start",
  } as React.CSSProperties,

  leftCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  } as React.CSSProperties,

  rightCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  } as React.CSSProperties,

  card: {
    background: "#FFFFFF",
    borderRadius: "16px",
    border: "1px solid #E2E5EB",
    padding: "20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  } as React.CSSProperties,

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  } as React.CSSProperties,

  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1A1D23",
    margin: 0,
  } as React.CSSProperties,

  cardLink: {
    fontSize: "12px",
    color: "#0078D4",
    textDecoration: "none",
  } as React.CSSProperties,

  periodRow: (isNow: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px",
    borderRadius: "12px",
    marginBottom: "8px",
    background: isNow ? "#E6FAF4" : "#F8F9FB",
    border: isNow ? "1px solid #A7EDD4" : "1px solid transparent",
    transition: "all 0.2s",
  }),

  periodNum: (isNow: boolean): React.CSSProperties => ({
    width: "32px",
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 700,
    color: isNow ? "#00875A" : "#9BA3AF",
  }),

  periodSubject: (isNow: boolean): React.CSSProperties => ({
    fontSize: "14px",
    fontWeight: 500,
    color: isNow ? "#1A1D23" : "#3D4452",
    margin: 0,
  }),

  periodMeta: {
    fontSize: "12px",
    color: "#9BA3AF",
    margin: 0,
  } as React.CSSProperties,

  periodTime: (isNow: boolean): React.CSSProperties => ({
    fontSize: "12px",
    color: isNow ? "#00875A" : "#9BA3AF",
    textAlign: "right",
  }),

  nowTag: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#00875A",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    display: "block",
  } as React.CSSProperties,

  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  } as React.CSSProperties,

  actionBtn: (color: string): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "14px",
    borderRadius: "12px",
    background: "#F8F9FB",
    border: "1px solid #E2E5EB",
    textDecoration: "none",
    transition: "border-color 0.2s, background 0.2s",
    cursor: "pointer",
  }),

  actionDot: (color: string): React.CSSProperties => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),

  actionLabel: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#3D4452",
  } as React.CSSProperties,

  // Profile card
  avatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #E6FAF4 0%, #E0F2FF 100%)",
    border: "2px solid #E2E5EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: 700,
    color: "#00875A",
    margin: "0 auto 12px",
  } as React.CSSProperties,

  profileName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1A1D23",
    textAlign: "center" as const,
    margin: 0,
  } as React.CSSProperties,

  profileRole: {
    fontSize: "12px",
    color: "#7C8493",
    textAlign: "center" as const,
    marginTop: "4px",
  } as React.CSSProperties,

  profileStaff: {
    fontSize: "11px",
    color: "#9BA3AF",
    textAlign: "center" as const,
    marginTop: "2px",
  } as React.CSSProperties,

  profileMeta: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "16px",
  } as React.CSSProperties,

  profileMetaBox: {
    background: "#F8F9FB",
    borderRadius: "10px",
    padding: "8px 12px",
  } as React.CSSProperties,

  profileMetaLabel: {
    fontSize: "11px",
    color: "#9BA3AF",
    margin: 0,
  } as React.CSSProperties,

  profileMetaValue: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#1A1D23",
    marginTop: "2px",
  } as React.CSSProperties,

  editProfileBtn: {
    marginTop: "16px",
    display: "block",
    width: "100%",
    padding: "10px",
    borderRadius: "12px",
    background: "#E6FAF4",
    border: "1px solid #A7EDD4",
    color: "#00875A",
    fontSize: "14px",
    fontWeight: 500,
    textAlign: "center" as const,
    textDecoration: "none",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  // PD
  pdNumbers: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    marginBottom: "12px",
  } as React.CSSProperties,

  pdBig: {
    fontSize: "32px",
    fontWeight: 700,
    color: "#1A1D23",
    lineHeight: 1,
  } as React.CSSProperties,

  pdSub: {
    fontSize: "13px",
    color: "#9BA3AF",
    marginBottom: "4px",
  } as React.CSSProperties,

  pdTrack: {
    width: "100%",
    height: "8px",
    background: "#F0F2F5",
    borderRadius: "99px",
    marginBottom: "8px",
    overflow: "hidden",
  } as React.CSSProperties,

  pdFill: {
    height: "8px",
    width: "55%",
    borderRadius: "99px",
    background: "linear-gradient(90deg, #00C07A, #0078D4)",
  } as React.CSSProperties,

  pdNote: {
    fontSize: "12px",
    color: "#9BA3AF",
  } as React.CSSProperties,

  // Appraisal
  appraisalCard: {
    background: "#FFFBF0",
    borderRadius: "16px",
    border: "1px solid #FFE4A0",
    padding: "20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  } as React.CSSProperties,

  appraisalRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  } as React.CSSProperties,

  appraisalBtn: {
    marginTop: "16px",
    display: "block",
    width: "100%",
    padding: "10px",
    borderRadius: "12px",
    background: "#FFF3CC",
    border: "1px solid #FFD966",
    color: "#996600",
    fontSize: "14px",
    fontWeight: 500,
    textAlign: "center" as const,
    textDecoration: "none",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const currentPeriod = TODAY_SCHEDULE.find((p) => {
    const [sh, sm] = p.startTime.split(":").map(Number);
    const [eh, em] = p.endTime.split(":").map(Number);
    const nowMins = hour * 60 + now.getMinutes();
    return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
  });

  return (
    <div style={s.page}>

      {/* Header */}
      <header style={s.header}>
        <div>
          <h1 style={s.heading}>{greeting}, Mrs. Chebet</h1>
          <p style={s.subtext}>
            {now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div>
          {currentPeriod ? (
            <div style={s.activePeriodBadge}>
              <span style={s.activeDot} />
              <span style={s.activePeriodText}>
                Now: P{currentPeriod.periodNumber} — {currentPeriod.subject} · {currentPeriod.class}
              </span>
            </div>
          ) : (
            <div style={s.noPeriodBadge}>No active period</div>
          )}
        </div>
      </header>

      <div style={s.body}>

        {/* Alerts */}
        {ALERTS.length > 0 && <AlertBanner alerts={ALERTS} />}

        {/* Stats */}
        <section>
          <p style={s.sectionLabel}>This Term</p>
          <div style={s.statsGrid}>
            <StatCard label="Classes Assigned" value="6" sub="Grade 5–7" accent="blue"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
            />
            <StatCard label="Lessons Taught" value="84" sub="of 96 scheduled" accent="green"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
            />
            <StatCard label="Plan Prep Rate" value="91%" sub="School avg: 78%" accent="green"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
            />
            <StatCard label="Assessment Turnaround" value="2.3 days" sub="avg per assessment" accent="default"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
            />
          </div>
        </section>

        {/* Main grid */}
        <div style={s.mainGrid}>

          {/* Left */}
          <div style={s.leftCol}>

            {/* Schedule */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <p style={s.cardTitle}>{"Today's Schedule"}</p>
                <a href="/teacher/timetable" style={s.cardLink}>Full timetable</a>
              </div>
              {TODAY_SCHEDULE.map((period) => {
                const isNow = currentPeriod?.periodNumber === period.periodNumber;
                return (
                  <div key={period.periodNumber} style={s.periodRow(isNow)}>
                    <div style={s.periodNum(isNow)}>P{period.periodNumber}</div>
                    <div style={{ flex: 1 }}>
                      <p style={s.periodSubject(isNow)}>{period.subject}</p>
                      <p style={s.periodMeta}>{period.class} · {period.room}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={s.periodTime(isNow)}>{period.startTime}–{period.endTime}</p>
                      {isNow && <span style={s.nowTag}>Now</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div style={s.card}>
              <p style={{ ...s.cardTitle, marginBottom: "16px" }}>Quick Actions</p>
              <div style={s.actionsGrid}>
                {[
                  { label: "New Lesson Plan", href: "/teacher/lesson-plans/new", color: "#00C07A" },
                  { label: "Mark Attendance", href: "/teacher/attendance", color: "#0078D4" },
                  { label: "Submit Assessment", href: "/teacher/assessments/new", color: "#7C5CFC" },
                  { label: "Upload Document", href: "/teacher/documents", color: "#F59E0B" },
                  { label: "Request Leave", href: "/teacher/leave/new", color: "#F97316" },
                  { label: "Message Parent", href: "/teacher/messages", color: "#EF4444" },
                ].map((action) => (
                  <a key={action.href} href={action.href} style={s.actionBtn(action.color)}>
                    <div style={s.actionDot(action.color)} />
                    <span style={s.actionLabel}>{action.label}</span>
                  </a>
                ))}
              </div>
            </div>

            <TwinSummary summary={TWIN_SUMMARY} observations={TWIN_OBSERVATIONS} />
          </div>

          {/* Right */}
          <div style={s.rightCol}>

            {/* Profile */}
            <div style={{ ...s.card, textAlign: "center" }}>
              <div style={s.avatar}>JC</div>
              <p style={s.profileName}>Mrs. Janet Chebet</p>
              <p style={s.profileRole}>HOD Mathematics · Grade 5–7</p>
              <p style={s.profileStaff}>Staff No: VS-2021-047</p>
              <div style={s.profileMeta}>
                <div style={s.profileMetaBox}>
                  <p style={s.profileMetaLabel}>TSC No.</p>
                  <p style={s.profileMetaValue}>TSC-0041-8821</p>
                </div>
                <div style={s.profileMetaBox}>
                  <p style={s.profileMetaLabel}>School</p>
                  <p style={s.profileMetaValue}>Nairobi Primary</p>
                </div>
              </div>
              <a href="/teacher/profile" style={s.editProfileBtn}>Edit Profile</a>
            </div>

            <DocumentStatus documents={DOCUMENTS} />

            {/* PD Progress */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <p style={s.cardTitle}>PD Hours Progress</p>
                <a href="/teacher/pd" style={s.cardLink}>View all</a>
              </div>
              <div style={s.pdNumbers}>
                <span style={s.pdBig}>22</span>
                <span style={s.pdSub}>/ 40 hrs</span>
              </div>
              <div style={s.pdTrack}>
                <div style={s.pdFill} />
              </div>
              <p style={s.pdNote}>18 hours remaining · 8 weeks left in year</p>
            </div>

            {/* Appraisal */}
            <div style={s.appraisalCard}>
              <p style={{ ...s.cardTitle, marginBottom: "12px" }}>Appraisal Cycle</p>
              {[
                { step: "Self-appraisal", status: "pending" },
                { step: "HOD review", status: "waiting" },
                { step: "Principal moderation", status: "waiting" },
                { step: "Submitted to TSC", status: "waiting" },
              ].map((item) => (
                <div key={item.step} style={s.appraisalRow}>
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: item.status === "done" ? "#00C07A" : item.status === "pending" ? "#F59E0B" : "#D1D5DB",
                  }} />
                  <span style={{
                    fontSize: "14px",
                    color: item.status === "done" ? "#00875A" : item.status === "pending" ? "#996600" : "#9BA3AF",
                  }}>
                    {item.step}
                  </span>
                </div>
              ))}
              <a href="/teacher/appraisal" style={s.appraisalBtn}>Start Self-Appraisal</a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
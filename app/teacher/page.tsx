import StatCard from "@/components/teacher/StatCard";
import AlertBanner from "@/components/teacher/AlertBanner";
import TwinSummary from "@/components/teacher/TwinSummary";
import DocumentStatus from "@/components/teacher/DocumentStatus";
import { TeacherAlert, TeacherDocument, TimetablePeriod } from "@/lib/types";

// ─── MOCK DATA (replace with real fetch) ─────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

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
    <div className="min-h-screen bg-[#0D0F14]">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-[#0D0F14]/90 backdrop-blur border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">
            {greeting}, Mrs. Chebet
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {currentPeriod ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/20">
              <span className="w-2 h-2 rounded-full bg-[#00E5A0] animate-pulse" />
              <span className="text-[#00E5A0] text-sm font-medium">
                Now: P{currentPeriod.periodNumber} — {currentPeriod.subject} · {currentPeriod.class}
              </span>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm">
              No active period
            </div>
          )}
        </div>
      </header>

      <div className="px-8 py-8 space-y-8">

        {/* Alerts */}
        {ALERTS.length > 0 && (
          <section>
            <AlertBanner alerts={ALERTS} />
          </section>
        )}

        {/* Stats strip */}
        <section>
          <h2 className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-4">This Term</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Classes Assigned"
              value="6"
              sub="Grade 5–7"
              accent="blue"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              }
            />
            <StatCard
              label="Lessons Taught"
              value="84"
              sub="of 96 scheduled"
              accent="green"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              }
            />
            <StatCard
              label="Plan Prep Rate"
              value="91%"
              sub="School avg: 78%"
              accent="green"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              }
            />
            <StatCard
              label="Assessment Turnaround"
              value="2.3 days"
              sub="avg per assessment"
              accent="default"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Main 2-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left col — Today's timetable + quick actions */}
          <div className="lg:col-span-2 space-y-6">

            {/* Today's Schedule */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-semibold text-sm">Today's Schedule</p>
                <a href="/teacher/timetable" className="text-xs text-[#00B8FF] hover:underline">Full timetable</a>
              </div>
              {TODAY_SCHEDULE.length === 0 ? (
                <p className="text-white/30 text-sm py-4 text-center">No periods scheduled today</p>
              ) : (
                <div className="space-y-2">
                  {TODAY_SCHEDULE.map((period) => {
                    const isNow = currentPeriod?.periodNumber === period.periodNumber;
                    return (
                      <div
                        key={period.periodNumber}
                        className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                          isNow
                            ? "bg-[#00E5A0]/10 border border-[#00E5A0]/20"
                            : "bg-white/3 border border-transparent hover:border-white/10"
                        }`}
                      >
                        <div className="w-10 text-center">
                          <span className={`text-xs font-bold ${isNow ? "text-[#00E5A0]" : "text-white/30"}`}>
                            P{period.periodNumber}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isNow ? "text-white" : "text-white/70"}`}>
                            {period.subject}
                          </p>
                          <p className="text-white/40 text-xs">
                            {period.class} · {period.room}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs ${isNow ? "text-[#00E5A0]" : "text-white/30"}`}>
                            {period.startTime}–{period.endTime}
                          </p>
                          {isNow && (
                            <span className="text-[10px] text-[#00E5A0] font-semibold uppercase tracking-wide">
                              Now
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <p className="text-white font-semibold text-sm mb-4">Quick Actions</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "New Lesson Plan", href: "/teacher/lesson-plans/new", color: "#00E5A0" },
                  { label: "Mark Attendance", href: "/teacher/attendance", color: "#00B8FF" },
                  { label: "Submit Assessment", href: "/teacher/assessments/new", color: "#A78BFA" },
                  { label: "Upload Document", href: "/teacher/documents", color: "#FFB800" },
                  { label: "Request Leave", href: "/teacher/leave/new", color: "#FF8C42" },
                  { label: "Message Parent", href: "/teacher/messages", color: "#FF4D6A" },
                ].map((action) => (
                  <a
                    key={action.href}
                    href={action.href}
                    className="flex flex-col items-start gap-2 p-3.5 rounded-xl bg-white/4 border border-white/8 hover:border-white/20 transition-all group"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: action.color }}
                    />
                    <span
                      className="text-sm font-medium text-white/70 group-hover:text-white transition-colors"
                    >
                      {action.label}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Twin Summary */}
            <TwinSummary summary={TWIN_SUMMARY} observations={TWIN_OBSERVATIONS} />
          </div>

          {/* Right col — Profile card + documents + PD */}
          <div className="space-y-6">

            {/* Profile card */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00E5A0]/30 to-[#00B8FF]/30 border-2 border-white/10 flex items-center justify-center text-xl font-bold text-white mx-auto mb-3">
                JC
              </div>
              <p className="text-white font-semibold">Mrs. Janet Chebet</p>
              <p className="text-white/40 text-xs mt-1">HOD Mathematics · Grade 5–7</p>
              <p className="text-white/30 text-xs mt-0.5">Staff No: VS-2021-047</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white/5 rounded-lg py-2 px-3">
                  <p className="text-white/40 text-xs">TSC No.</p>
                  <p className="text-white font-medium text-xs mt-0.5">TSC-0041-8821</p>
                </div>
                <div className="bg-white/5 rounded-lg py-2 px-3">
                  <p className="text-white/40 text-xs">School</p>
                  <p className="text-white font-medium text-xs mt-0.5">Nairobi Primary</p>
                </div>
              </div>
              <a
                href="/teacher/profile"
                className="mt-4 block w-full py-2.5 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/20 text-[#00E5A0] text-sm font-medium hover:bg-[#00E5A0]/20 transition-colors"
              >
                Edit Profile
              </a>
            </div>

            {/* Document Compliance */}
            <DocumentStatus documents={DOCUMENTS} />

            {/* PD Progress */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold text-sm">PD Hours Progress</p>
                <a href="/teacher/pd" className="text-xs text-[#00B8FF] hover:underline">View all</a>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold text-white">22</span>
                <span className="text-white/40 text-sm mb-1">/ 40 hrs</span>
              </div>
              <div className="w-full bg-white/8 rounded-full h-2 mb-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-[#00E5A0] to-[#00B8FF] transition-all"
                  style={{ width: "55%" }}
                />
              </div>
              <p className="text-white/40 text-xs">18 hours remaining · 8 weeks left in year</p>
            </div>

            {/* Appraisal status */}
            <div className="rounded-2xl border border-[#FFB800]/20 bg-[#FFB800]/5 p-5">
              <p className="text-white font-semibold text-sm mb-3">Appraisal Cycle</p>
              <div className="space-y-2">
                {[
                  { step: "Self-appraisal", status: "pending" },
                  { step: "HOD review", status: "waiting" },
                  { step: "Principal moderation", status: "waiting" },
                  { step: "Submitted to TSC", status: "waiting" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.status === "done"
                          ? "bg-[#00E5A0]"
                          : item.status === "pending"
                          ? "bg-[#FFB800] animate-pulse"
                          : "bg-white/15"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        item.status === "done"
                          ? "text-[#00E5A0]"
                          : item.status === "pending"
                          ? "text-[#FFB800]"
                          : "text-white/30"
                      }`}
                    >
                      {item.step}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href="/teacher/appraisal"
                className="mt-4 block w-full py-2 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/20 text-[#FFB800] text-sm font-medium text-center hover:bg-[#FFB800]/20 transition-colors"
              >
                Start Self-Appraisal
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
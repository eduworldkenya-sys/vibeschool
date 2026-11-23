"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity, ArrowLeft, Award, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, ClipboardList,
  Clock3, Edit3, ExternalLink, FileText, GraduationCap,
  Heart, MessageCircle, MoreHorizontal, Plus, ShieldCheck,
  SlidersHorizontal, Sparkles, Target, TrendingUp, Trophy,
  UserRound, UsersRound, AlertTriangle, Search, Library,
} from "lucide-react";
import styles from "./LearnerWorkspace.module.css";

/** One learner identity and permission-scoped records. Never populate missing data with demo values. */
export type Learner = {
  id: string;
  name: string;
  username?: string | null;
  learnerCode?: string | null;
  avatarUrl?: string | null;
  grade?: string | null;
  className?: string | null;
  schoolName?: string | null;
  joinedAt?: string | null;
  status?: "active" | "inactive" | "pending" | null;
  subjects?: string[];
  tutorName?: string | null;
  parentName?: string | null;
};
export type LearningProfile = {
  strengths?: string[];
  interests?: string[];
  bestSupport?: string[];
  currentNeeds?: string[];
  accommodations?: string[];
};
export type SchoolLife = {
  groups?: string[];
  roles?: string[];
  recognition?: string[];
  resources?: { id: string; title: string }[];
};
export type LearningLesson = {
  id: string;
  title: string;
  subject: string;
  status: "completed" | "in_progress" | "not_started";
  completedAt?: string | null;
  outcome?: string | null;
};
export type MasteryRecord = {
  id: string;
  title: string;
  subject: string;
  /** Percentage only when supported by scored evidence. */
  percent?: number | null;
  evidenceCount: number;
};
export type LearnerMistake = {
  id: string;
  title: string;
  subject: string;
  count: number;
  corrected?: boolean;
  outcomeId?: string | null;
};
export type LearnerWork = {
  id: string;
  title: string;
  subject?: string | null;
  dueDate?: string | null;
  status: "assigned" | "submitted" | "marked" | "missing";
  score?: number | null;
  maxScore?: number | null;
};
export type LearnerResult = {
  id: string;
  title: string;
  subject: string;
  date?: string | null;
  score?: number | null;
  maxScore?: number | null;
  status: "draft" | "released" | "pending";
};
export type AttendanceSummary = {
  sessions: number;
  present: number;
  absent: number;
  late: number;
};
export type LearnerEvent = {
  id: string;
  at: string;
  label: string;
  kind: "work" | "result" | "attendance" | "message" | "recognition" | "other";
};
export type NextAction = {
  id: string;
  label: string;
  secondary?: string;
  actionLabel: string;
  kind: "assign" | "mark" | "review" | "support";
};
export type LearnerWorkspaceData = {
  learner: Learner;
  learningProfile?: LearningProfile;
  schoolLife?: SchoolLife;
  lessons?: LearningLesson[];
  mastery?: MasteryRecord[];
  mistakes?: LearnerMistake[];
  work?: LearnerWork[];
  results?: LearnerResult[];
  attendance?: AttendanceSummary;
  activity?: LearnerEvent[];
  nextActions?: NextAction[];
  /** Follow-up count comes from canonical intervention records, never inferred. */
  followUpCount?: number | null;
};
export type WorkspaceTab = "profile" | "progress" | "work" | "results" | "attendance" | "activity";
export type LearnerWorkspaceActions = {
  back?: () => void;
  assign?: () => void;
  chat?: () => void;
  parent?: () => void;
  editProfile?: () => void;
  editLearningProfile?: () => void;
  openSchoolItem?: (type: "groups" | "roles" | "recognition" | "resources", id?: string) => void;
  openLesson?: (id: string) => void;
  openMistake?: (id: string) => void;
  openWork?: (id: string) => void;
  markWork?: (id: string) => void;
  openResult?: (id: string) => void;
  correctMark?: (id: string) => void;
  openAttendance?: () => void;
  openEvent?: (id: string) => void;
  performNextAction?: (item: NextAction) => void;
  addNote?: () => void;
};
export type LearnerWorkspaceProps = {
  data: LearnerWorkspaceData;
  actions?: LearnerWorkspaceActions;
  initialTab?: WorkspaceTab;
  onTabChange?: (tab: WorkspaceTab) => void;
  /** The parent page must enforce permissions server-side; these only control visible actions. */
  permissions?: { canAssign?: boolean; canChat?: boolean; canSeeParent?: boolean; canEditProfile?: boolean; canCorrectMarks?: boolean; canManageLearning?: boolean };
};

const TABS: { id: WorkspaceTab; label: string; icon: typeof UserRound }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "progress", label: "Progress", icon: TrendingUp },
  { id: "work", label: "Work", icon: ClipboardList },
  { id: "results", label: "Results", icon: Trophy },
  { id: "attendance", label: "Attendance", icon: CalendarDays },
  { id: "activity", label: "Activity", icon: Activity },
];
const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(d);
};
const formatPct = (value?: number | null) => value == null || !Number.isFinite(value) ? "—" : `${Math.round(Math.max(0, Math.min(100, value)))}%`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() ?? "").join("") || "?";
const initialsAlt = (name: string) => `Avatar for ${name}`;
const Empty = ({ children }: { children: string }) => <p className={styles.empty}>{children}</p>;
const PillList = ({ items }: { items?: string[] }) => items?.length ? <span className={styles.pills}>{items.map((x, i) => <span className={styles.pill} key={`${x}-${i}`}>{x}</span>)}</span> : <span className={styles.muted}>—</span>;
const Panel = ({ title, icon: Icon, action, children, className = "" }: { title: string; icon?: typeof UserRound; action?: ReactNode; children: ReactNode; className?: string }) => <section className={`${styles.panel} ${className}`}><div className={styles.panelHeading}><h2>{Icon ? <Icon size={18} aria-hidden="true"/> : null}{title}</h2>{action}</div><div className={styles.panelBody}>{children}</div></section>;
const ActionButton = ({ children, onClick, primary = false, icon: Icon }: { children: ReactNode; onClick?: () => void; primary?: boolean; icon?: typeof UserRound }) => <button type="button" onClick={onClick} disabled={!onClick} className={`${styles.actionButton} ${primary ? styles.primary : ""}`}>{Icon && <Icon size={17} aria-hidden="true"/>}{children}</button>;

export default function LearnerWorkspace({ data, actions = {}, initialTab = "profile", onTabChange, permissions = {} }: LearnerWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const [subject, setSubject] = useState("All subjects");
  const [workFilter, setWorkFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { learner } = data;
  const lessons = data.lessons ?? [];
  const mastery = data.mastery ?? [];
  const mistakes = data.mistakes ?? [];
  const work = data.work ?? [];
  const results = data.results ?? [];
  const activities = data.activity ?? [];
  const subjects = useMemo(() => [...new Set([...lessons.map(x => x.subject), ...mastery.map(x => x.subject), ...results.map(x => x.subject), ...mistakes.map(x => x.subject), ...(learner.subjects ?? [])].filter(Boolean))].sort(), [lessons, mastery, results, mistakes, learner.subjects]);
  const matchesSubject = (subjectName?: string | null) => subject === "All subjects" || subjectName === subject;
  const completed = lessons.filter(x => x.status === "completed").length;
  const validMastery = mastery.filter(x => x.percent != null && x.evidenceCount > 0);
  const masteryMean = validMastery.length ? Math.round(validMastery.reduce((sum, x) => sum + (x.percent ?? 0), 0) / validMastery.length) : null;
  const attendancePercent = data.attendance?.sessions ? Math.round(100 * data.attendance.present / data.attendance.sessions) : null;
  const pendingWork = work.filter(x => x.status === "assigned" || x.status === "missing").length;
  const changeTab = (next: WorkspaceTab) => { setTab(next); onTabChange?.(next); };
  const searchable = (value: string) => value.toLowerCase().includes(search.trim().toLowerCase());
  const filteredLessons = lessons.filter(x => matchesSubject(x.subject) && searchable(`${x.title} ${x.subject}`));
  const filteredMistakes = mistakes.filter(x => matchesSubject(x.subject) && searchable(`${x.title} ${x.subject}`));
  const filteredMastery = mastery.filter(x => matchesSubject(x.subject) && searchable(`${x.title} ${x.subject}`));
  const filteredWork = work.filter(x => matchesSubject(x.subject) && (workFilter === "All" || x.status === workFilter.toLowerCase()) && searchable(`${x.title} ${x.subject ?? ""}`));
  const filteredResults = results.filter(x => matchesSubject(x.subject) && searchable(`${x.title} ${x.subject}`));
  const schoolLife = data.schoolLife ?? {};
  const profile = data.learningProfile ?? {};
  return <main className={styles.workspace}>
    <div className={styles.identityHeader}>
      <button type="button" aria-label="Back to learners" onClick={actions.back} disabled={!actions.back} className={styles.back}><ArrowLeft size={20}/></button>
      {learner.avatarUrl ? <img src={learner.avatarUrl} className={styles.avatar} alt={initialsAlt(learner.name)} /> : <div className={styles.avatar} aria-label={initialsAlt(learner.name)}>{initials(learner.name)}</div>}
      <div className={styles.identityText}><div className={styles.nameRow}><h1>{learner.name}</h1>{learner.status && <span className={styles.status}>{learner.status}</span>}</div><p>{[learner.grade, learner.className, learner.schoolName].filter(Boolean).join(" · ") || "Learner"}{learner.learnerCode ? <span className={styles.learnerCode}>{learner.learnerCode}</span> : null}</p></div>
      <div className={styles.headerActions}>
        {permissions.canAssign && <ActionButton primary icon={Plus} onClick={actions.assign}>Assign</ActionButton>}
        {permissions.canChat && <ActionButton icon={MessageCircle} onClick={actions.chat}>VibeChat</ActionButton>}
        {permissions.canSeeParent && <ActionButton icon={UsersRound} onClick={actions.parent}>Parent</ActionButton>}
        <div className={styles.moreContainer}><button className={styles.actionButton} type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen(!moreOpen)}><MoreHorizontal size={18}/> More <ChevronDown size={14}/></button>{moreOpen && <div role="menu" className={styles.moreMenu}>
          {permissions.canEditProfile && <button role="menuitem" type="button" onClick={() => { setMoreOpen(false); actions.editProfile?.(); }} disabled={!actions.editProfile}>Edit profile</button>}
          {actions.addNote && <button role="menuitem" type="button" onClick={() => { setMoreOpen(false); actions.addNote?.(); }}>Add note</button>}
          {actions.openAttendance && <button role="menuitem" type="button" onClick={() => { setMoreOpen(false); actions.openAttendance?.(); }}>Attendance register</button>}
          {!actions.addNote && !actions.openAttendance && !permissions.canEditProfile && <span className={styles.muted}>No additional actions</span>}
        </div>}</div>
      </div>
    </div>
    <nav className={styles.tabBar} aria-label="Individual learner workspace tabs">
      {TABS.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={`${styles.tab} ${tab === id ? styles.activeTab : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => changeTab(id)}><Icon size={18} aria-hidden="true"/>{label}</button>)}
    </nav>
    {tab === "profile" && <div className={styles.profileGrid}>
      <Panel title="About" className={styles.aboutPanel} action={permissions.canEditProfile && actions.editProfile ? <button type="button" className={styles.iconButton} onClick={actions.editProfile} aria-label="Edit learner profile"><Edit3 size={18}/></button> : null}>
        <dl className={styles.details}>{[
          ["Name", learner.name], ["Username", learner.username ? `@${learner.username.replace(/^@/, "")}` : null], ["Grade", learner.grade], ["Class", learner.className], ["School", learner.schoolName], ["Joined", formatDate(learner.joinedAt)], ["Subjects", learner.subjects?.join(", ")], ["Tutor", learner.tutorName],
        ].map(([key, value]) => <div key={key ?? ""}><dt>{key}</dt><dd>{value || "—"}</dd></div>)}<div><dt>Parent</dt><dd>{permissions.canSeeParent && actions.parent ? <button type="button" className={styles.textLink} onClick={actions.parent}>{learner.parentName || "View parent"}<ExternalLink size={14}/></button> : "—"}</dd></div></dl>
      </Panel>
      <Panel title="Learning Profile" icon={GraduationCap} action={permissions.canManageLearning && actions.editLearningProfile ? <button type="button" className={styles.iconButton} onClick={actions.editLearningProfile} aria-label="Edit learning profile"><Edit3 size={17}/></button> : null}>
        <dl className={styles.learningDetails}>{[
          { label: "Strengths", icon: Award, values: profile.strengths }, { label: "Interests", icon: Heart, values: profile.interests }, { label: "Best support", icon: Target, values: profile.bestSupport }, { label: "Current needs", icon: TrendingUp, values: profile.currentNeeds }, { label: "Accommodations", icon: SlidersHorizontal, values: profile.accommodations },
        ].map(row => <div key={row.label}><dt><row.icon size={17} aria-hidden="true"/>{row.label}</dt><dd><PillList items={row.values}/></dd></div>)}</dl>
      </Panel>
      <Panel title="School Life" icon={UsersRound}>
        <div className={styles.lifeRows}>{[
          { label: "Groups", icon: UsersRound, type: "groups" as const, value: schoolLife.groups?.join(", ") }, { label: "Roles", icon: ShieldCheck, type: "roles" as const, value: schoolLife.roles?.join(", ") }, { label: "Recognition", icon: Trophy, type: "recognition" as const, value: schoolLife.recognition?.join(", ") }, { label: "Resources", icon: BookOpen, type: "resources" as const, value: schoolLife.resources?.map(x => x.title).join(", ") },
        ].map(x => <button type="button" key={x.label} onClick={() => actions.openSchoolItem?.(x.type)} disabled={!actions.openSchoolItem} className={styles.lifeRow}><x.icon size={18}/><strong>{x.label}</strong><span>{x.value || "—"}</span>{actions.openSchoolItem && <ChevronRight size={15}/>}</button>)}</div>
      </Panel>
      <Panel title="Quick Insights" icon={TrendingUp}>
        <div className={styles.metrics}>{[
          { label: "Lessons", value: lessons.length ? `${completed}/${lessons.length}` : "—", icon: BookOpen, dest: "progress" as WorkspaceTab }, { label: "Mastery", value: formatPct(masteryMean), icon: Target, dest: "progress" as WorkspaceTab }, { label: "Mistakes", value: mistakes.length ? String(mistakes.reduce((sum, x) => sum + x.count, 0)) : "—", icon: AlertTriangle, dest: "progress" as WorkspaceTab }, { label: "Attendance", value: formatPct(attendancePercent), icon: CalendarDays, dest: "attendance" as WorkspaceTab }, { label: "Work pending", value: work.length ? String(pendingWork) : "—", icon: ClipboardList, dest: "work" as WorkspaceTab }, { label: "Follow-up", value: data.followUpCount == null ? "—" : String(data.followUpCount), icon: CheckCircle2, dest: "activity" as WorkspaceTab },
        ].map(metric => <button key={metric.label} type="button" className={styles.metric} onClick={() => changeTab(metric.dest)}><span><metric.icon size={17}/>{metric.label}</span><strong>{metric.value}</strong></button>)}</div>
      </Panel>
      <Panel title="Next Actions" icon={CheckCircle2}>
        {data.nextActions?.length ? <div className={styles.nextActions}>{data.nextActions.slice(0, 5).map(item => <div className={styles.nextAction} key={item.id}><div><strong>{item.label}</strong>{item.secondary && <span>{item.secondary}</span>}</div><button type="button" className={styles.smallAction} onClick={() => actions.performNextAction?.(item)} disabled={!actions.performNextAction}>{item.actionLabel}</button></div>)}</div> : <Empty>No actions pending</Empty>}
      </Panel>
      <Panel title="Recent Activity" icon={Clock3}>
        {activities.length ? <div className={styles.timeline}>{[...activities].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 5).map(event => <button type="button" className={styles.timelineRow} key={event.id} disabled={!actions.openEvent} onClick={() => actions.openEvent?.(event.id)}><span className={styles.timelineDot}/><strong>{event.label}</strong><time dateTime={event.at}>{formatDate(event.at)}</time></button>)}</div> : <Empty>No activity recorded</Empty>}
      </Panel>
    </div>}
    {tab === "progress" && <div className={styles.detailLayout}>
      <div className={styles.filters}><label>Subject <select value={subject} onChange={e => setSubject(e.target.value)}><option>All subjects</option>{subjects.map(x => <option key={x}>{x}</option>)}</select></label><label className={styles.searchLabel}><Search size={17}/><input placeholder="Find a topic" aria-label="Find a topic" value={search} onChange={e => setSearch(e.target.value)}/></label></div>
      <div className={styles.twoColumns}>
        <Panel title="Lessons" icon={BookOpen}>{filteredLessons.length ? filteredLessons.map(x => <button key={x.id} type="button" className={styles.recordRow} onClick={() => actions.openLesson?.(x.id)} disabled={!actions.openLesson}><span><strong>{x.title}</strong><small>{x.subject}{x.outcome ? ` · ${x.outcome}` : ""}</small></span><span className={styles.recordMeta}>{x.status.replaceAll("_", " ")}</span><ChevronRight size={16}/></button>) : <Empty>No lessons found</Empty>}</Panel>
        <Panel title="Mastery" icon={Target}>{filteredMastery.length ? filteredMastery.map(x => <div className={styles.masteryRow} key={x.id}><div className={styles.masteryTitle}><strong>{x.title}</strong><span>{x.evidenceCount > 0 ? formatPct(x.percent) : "No evidence"}</span></div><small>{x.subject} · {x.evidenceCount} assessment {x.evidenceCount === 1 ? "record" : "records"}</small>{x.percent != null && x.evidenceCount > 0 && <div className={styles.progressTrack}><div style={{ width: `${Math.max(0, Math.min(100, x.percent))}%` }}/></div>}</div>) : <Empty>No mastery evidence</Empty>}</Panel>
      </div>
      <Panel title="Mistakes" icon={AlertTriangle}>{filteredMistakes.length ? filteredMistakes.map(x => <div className={styles.recordRow} key={x.id}><span><strong>{x.title}</strong><small>{x.subject} · {x.count} {x.count === 1 ? "error" : "errors"}{x.corrected ? " · Corrected" : ""}</small></span><button type="button" className={styles.smallAction} disabled={!actions.openMistake} onClick={() => actions.openMistake?.(x.id)}>Review</button></div>) : <Empty>No recorded mistakes</Empty>}</Panel>
    </div>}
    {tab === "work" && <div className={styles.detailLayout}><div className={styles.filters}><label>Status <select value={workFilter} onChange={e => setWorkFilter(e.target.value)}>{["All", "Assigned", "Submitted", "Marked", "Missing"].map(x => <option key={x}>{x}</option>)}</select></label><label>Subject <select value={subject} onChange={e => setSubject(e.target.value)}><option>All subjects</option>{subjects.map(x => <option key={x}>{x}</option>)}</select></label><label className={styles.searchLabel}><Search size={17}/><input placeholder="Find work" aria-label="Find work" value={search} onChange={e => setSearch(e.target.value)}/></label></div><Panel title="Assigned Work" icon={ClipboardList}>{filteredWork.length ? filteredWork.map(x => <div key={x.id} className={styles.recordRow}><span><strong>{x.title}</strong><small>{x.subject || "Subject not set"} · {x.dueDate ? `Due ${formatDate(x.dueDate)}` : "No due date"}</small></span><span className={styles.recordMeta}>{x.status}{x.score != null && x.maxScore != null ? ` · ${x.score}/${x.maxScore}` : ""}</span><button className={styles.smallAction} type="button" disabled={!actions.openWork} onClick={() => actions.openWork?.(x.id)}>Open</button>{x.status === "submitted" && actions.markWork && <button className={styles.smallAction} type="button" onClick={() => actions.markWork?.(x.id)}>Mark</button>}</div>) : <Empty>No assigned work found</Empty>}</Panel></div>}
    {tab === "results" && <div className={styles.detailLayout}><div className={styles.filters}><label>Subject <select value={subject} onChange={e => setSubject(e.target.value)}><option>All subjects</option>{subjects.map(x => <option key={x}>{x}</option>)}</select></label><label className={styles.searchLabel}><Search size={17}/><input placeholder="Find an exam" aria-label="Find an exam" value={search} onChange={e => setSearch(e.target.value)}/></label></div><Panel title="Exam & Assessment Results" icon={Trophy}>{filteredResults.length ? filteredResults.map(x => <div className={styles.recordRow} key={x.id}><span><strong>{x.title}</strong><small>{x.subject} · {formatDate(x.date)}</small></span><span className={styles.recordMeta}>{x.score != null && x.maxScore != null && x.status === "released" ? `${x.score}/${x.maxScore}` : x.status}</span><button type="button" className={styles.smallAction} disabled={!actions.openResult} onClick={() => actions.openResult?.(x.id)}>Review</button>{permissions.canCorrectMarks && actions.correctMark && <button type="button" className={styles.smallAction} onClick={() => actions.correctMark?.(x.id)}>Correct mark</button>}</div>) : <Empty>No results recorded</Empty>}</Panel></div>}
    {tab === "attendance" && <div className={styles.detailLayout}><Panel title="Attendance" icon={CalendarDays}>{data.attendance ? <div className={styles.attendanceGrid}>{[{label:"Sessions",value:data.attendance.sessions},{label:"Present",value:data.attendance.present},{label:"Absent",value:data.attendance.absent},{label:"Late",value:data.attendance.late}].map(x => <div className={styles.attendanceValue} key={x.label}><strong>{x.value}</strong><span>{x.label}</span></div>)}</div> : <Empty>No attendance recorded</Empty>}{actions.openAttendance && <button type="button" className={styles.smallAction} onClick={actions.openAttendance}>Open register <ExternalLink size={14}/></button>}</Panel></div>}
    {tab === "activity" && <div className={styles.detailLayout}><Panel title="Activity History" icon={Activity}>{activities.length ? <div className={styles.timeline}>{[...activities].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).map(x=><button type="button" className={styles.timelineRow} key={x.id} onClick={()=>actions.openEvent?.(x.id)} disabled={!actions.openEvent}><span className={styles.timelineDot}/><strong>{x.label}</strong><time dateTime={x.at}>{formatDate(x.at)}</time></button>)}</div> : <Empty>No activity recorded</Empty>}</Panel></div>}
  </main>;
}
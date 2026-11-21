"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Bookmark, BriefcaseBusiness, GraduationCap, ListFilter, MonitorPlay, RefreshCw, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAdminSchoolAuthority } from "@/lib/admin/authority";
import { useKenyaCounties } from "@/lib/geography/kenyaCounties";
import { Candidate, DIRECTORY_FIELDS, RecruitmentRequest, REQUEST_FIELDS } from "@/lib/public/teacherEmployment";
import { JOB_SELECT, PublicJob, PublicSwap, SWAP_SELECT, jobLifecycle, listingDate, swapLifecycle } from "@/lib/public/teacherListings";
import { vacancyApplication } from "@/lib/public/vacancyApplication";
import styles from "./PremiumTeacherMarketplace.module.css";

type View = "jobs" | "tuition" | "swaps" | "teachers" | "shortlisted" | "interviews";
type Role = "teacher" | "school";
type Tuition = {
  id: string; learner_label: string; levels: string[]; subjects: string[];
  teaching_mode: string; area: string | null; budget_kes: number | null;
  available_days: string[]; dayparts: string[]; created_at: string;
};
type SchoolAuthority = { schoolId: string; userId: string };
type MarketplaceRow =
  | { type: "job"; key: string; title: string; subtitle: string; county: string; level: string; tags: string[]; data: PublicJob }
  | { type: "tuition"; key: string; title: string; subtitle: string; county: string; level: string; tags: string[]; data: Tuition }
  | { type: "swap"; key: string; title: string; subtitle: string; county: string; level: string; tags: string[]; data: PublicSwap }
  | { type: "teacher"; key: string; title: string; subtitle: string; county: string; level: string; tags: string[]; data: Candidate }
  | { type: "interview"; key: string; title: string; subtitle: string; county: string; level: string; tags: string[]; data: RecruitmentRequest };

const TABS: Record<Role, { value: View; label: string }[]> = {
  teacher: [{ value: "jobs", label: "School jobs" }, { value: "tuition", label: "Online tuition" }, { value: "swaps", label: "Station swaps" }],
  school: [{ value: "teachers", label: "Find teachers" }, { value: "shortlisted", label: "Shortlisted" }, { value: "interviews", label: "Interviews" }],
};

const safeText = (value: string | null | undefined) => value?.trim() || "Not provided";
const requestUrl = (id: string) => "/vibetutor/browse?view=students&request=" + encodeURIComponent(id);
const swapUrl = (id: string) => "/teacher/marketplace/manage?swap=" + encodeURIComponent(id) + "&interest=1";
const levelFromJob = (j: PublicJob) => j.title.match(/\b(ECDE|Primary|Junior School|Senior School|Secondary)\b/i)?.[0] || "";

function toRows(view: View, jobs: PublicJob[], tuition: Tuition[], swaps: PublicSwap[], teachers: Candidate[], saved: string[], requests: RecruitmentRequest[]): MarketplaceRow[] {
  if (view === "jobs") return jobs.filter(j => j.status === "published" && jobLifecycle(j) === "open").map(j => ({
    type: "job", key: j.id, title: j.title, subtitle: j.school_name,
    county: j.county, level: levelFromJob(j), tags: [j.county, levelFromJob(j), j.employment_type ?? ""].filter(Boolean), data: j,
  }));
  if (view === "tuition") return tuition.filter(t => t.teaching_mode === "online" || t.teaching_mode === "either").map(t => ({
    type: "tuition", key: t.id, title: t.subjects.join(" · ") || "Tuition request", subtitle: "Guardian's learner request",
    county: t.area ?? "", level: t.levels.join(" · "),
    tags: [t.area ?? "", t.levels.join(" · "), t.available_days.join(", ") || "Schedule to discuss"].filter(Boolean), data: t,
  }));
  if (view === "swaps") return swaps.filter(s => s.status === "published" && swapLifecycle(s) === "active").map(s => ({
    type: "swap", key: s.id, title: s.current_county + " → " + s.preferred_county,
    subtitle: "Teacher station swap", county: s.current_county, level: s.school_level,
    tags: [s.school_level, s.subject, s.employment_sector === "tsc" ? "TSC" : s.employment_sector === "private" ? "Private school" : ""].filter(Boolean), data: s,
  }));
  if (view === "interviews") return requests.map(r => ({
    type: "interview", key: r.id, title: r.teacher_name || "Teacher", subtitle: r.school_name,
    county: "", level: "", tags: [r.status, "Interview request"], data: r,
  }));
  return teachers.filter(t => view !== "shortlisted" || saved.includes(t.id)).map(t => ({
    type: "teacher", key: t.id, title: t.display_name, subtitle: t.subjects.join(" · "),
    county: t.counties.join(" · "), level: t.levels.join(" · "),
    tags: [t.counties[0] ?? "", t.levels[0] ?? "", t.experience === 0 ? "New teacher" : t.experience + " years experience"].filter(Boolean), data: t,
  }));
}

export default function PremiumTeacherMarketplace() {
  const { countyNames } = useKenyaCounties();
  const [role, setRole] = useState<Role>("teacher");
  const [view, setView] = useState<View>("jobs");
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("");
  const [level, setLevel] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [tuition, setTuition] = useState<Tuition[]>([]);
  const [swaps, setSwaps] = useState<PublicSwap[]>([]);
  const [teachers, setTeachers] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({ jobs: true, tuition: true, swaps: true, teachers: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const [authority, setAuthority] = useState<SchoolAuthority | null>(null);
  const [schoolChecked, setSchoolChecked] = useState(false);
  const [shortlisted, setShortlisted] = useState<string[]>([]);
  const [requests, setRequests] = useState<RecruitmentRequest[]>([]);
  const [invite, setInvite] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "hire" || tab === "teachers" || tab === "shortlisted" || tab === "interviews" || params.get("role") === "school") {
      setRole("school"); setView(tab === "shortlisted" || tab === "interviews" ? tab : "teachers");
    } else if (tab === "tuition" || tab === "swaps" || tab === "swap" || tab === "jobs") {
      setView(tab === "swap" ? "swaps" : tab);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading({ jobs: true, tuition: true, swaps: true, teachers: true });
      setErrors({});
      const results = await Promise.allSettled([
        supabase.from("teacher_vacancies").select(JOB_SELECT).eq("status", "published").order("created_at", { ascending: false }).limit(100),
        supabase.from("vibetutor_open_requests").select("id,learner_label,levels,subjects,teaching_mode,area,budget_kes,available_days,dayparts,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("teacher_swap_listings").select(SWAP_SELECT).eq("status", "published").order("created_at", { ascending: false }).limit(100),
        supabase.from("teacher_employment_directory").select(DIRECTORY_FIELDS).order("published_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      const errs: Record<string, string> = {};
      const keys = ["jobs", "tuition", "swaps", "teachers"];
      results.forEach((entry, i) => {
        const value = entry.status === "fulfilled" ? entry.value : null;
        if (!value || value.error) errs[keys[i]] = keys[i] === "teachers"
          ? "The employment directory is not available. Publishing is not ready yet."
          : "Unable to load listings. Try again.";
        else if (i === 0) setJobs((value.data ?? []) as PublicJob[]);
        else if (i === 1) setTuition((value.data ?? []) as Tuition[]);
        else if (i === 2) setSwaps((value.data ?? []) as PublicSwap[]);
        else setTeachers((value.data ?? []) as Candidate[]);
      });
      setErrors(errs);
      setLoading({ jobs: false, tuition: false, swaps: false, teachers: false });
    }
    void load();
    return () => { active = false };
  }, [retry]);

  const refreshSchool = useCallback(async (school: SchoolAuthority) => {
    const [s, r] = await Promise.all([
      supabase.from("teacher_employment_shortlists").select("listing_id").eq("school_id", school.schoolId),
      supabase.from("teacher_employment_requests").select(REQUEST_FIELDS).eq("school_id", school.schoolId).order("created_at", { ascending: false }),
    ]);
    if (s.error || r.error) throw new Error("School recruitment records could not load.");
    setShortlisted((s.data ?? []).map((x: { listing_id: string }) => x.listing_id));
    setRequests((r.data ?? []) as RecruitmentRequest[]);
  }, []);

  useEffect(() => {
    if (role !== "school") return;
    let active = true;
    setSchoolChecked(false);
    void (async () => {
      try {
        const a = await getAdminSchoolAuthority();
        if (!active) return;
        setAuthority({ schoolId: a.schoolId, userId: a.userId });
        await refreshSchool({ schoolId: a.schoolId, userId: a.userId });
      } catch {
        if (active) { setAuthority(null); setShortlisted([]); setRequests([]) }
      } finally { if (active) setSchoolChecked(true) }
    })();
    return () => { active = false };
  }, [role, retry, refreshSchool]);

  const allRows = useMemo(() => toRows(view, jobs, tuition, swaps, teachers, shortlisted, requests), [view, jobs, tuition, swaps, teachers, shortlisted, requests]);
  const visible = useMemo(() => allRows.filter(row => {
    const term = search.trim().toLocaleLowerCase();
    return (!term || [row.title, row.subtitle, row.county, row.level, ...row.tags].join(" ").toLocaleLowerCase().includes(term))
      && (!county || row.county.split(" · ").includes(county))
      && (!level || row.level.split(" · ").includes(level));
  }), [allRows, search, county, level]);
  const current = visible.find(row => row.key === selected) ?? visible[0] ?? null;
  const rowKey = view === "shortlisted" || view === "interviews" ? "teachers" : view;
  const isLoading = !!loading[rowKey] || (role === "school" && view !== "teachers" && !schoolChecked);
  const error = errors[rowKey];
  const canManageSchool = !!authority;

  function selectRole(next: Role) {
    setRole(next); setView(next === "school" ? "teachers" : "jobs");
    setSearch(""); setCounty(""); setLevel(""); setFiltersOpen(false);
    setSelected(null); setNotice(""); setMobileDetail(false);
    window.history.replaceState(null, "", "/teacher/marketplace" + (next === "school" ? "?tab=hire" : ""));
  }
  function selectView(next: View) {
    setView(next); setSearch(""); setCounty(""); setLevel("");
    setSelected(null); setNotice(""); setMobileDetail(false); setFiltersOpen(false);
    window.history.replaceState(null, "", "/teacher/marketplace?tab=" + encodeURIComponent(next));
  }
  function openDetail(id: string, element: HTMLElement) {
    lastFocus.current = element;
    setSelected(id); setNotice(""); setInvite(""); setMobileDetail(true);
  }
  function closeDetail() {
    setMobileDetail(false);
    lastFocus.current?.focus();
  }
  useEffect(() => {
    if (!mobileDetail) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileDetail(false) };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileDetail]);
  async function toggleShortlist(id: string) {
    if (!authority || busy) return;
    setBusy(true); setNotice("");
    try {
      const has = shortlisted.includes(id);
      const response = has
        ? await supabase.from("teacher_employment_shortlists").delete().eq("school_id", authority.schoolId).eq("listing_id", id)
        : await supabase.from("teacher_employment_shortlists").insert({ school_id: authority.schoolId, listing_id: id });
      if (response.error) throw response.error;
      setShortlisted(prev => has ? prev.filter(value => value !== id) : [...prev, id]);
      setNotice(has ? "Removed from your school's shortlist." : "Added to your school's shortlist.");
    } catch { setNotice("Unable to update shortlist. Please retry.") }
    finally { setBusy(false) }
  }
  async function sendInterview(id: string) {
    if (!authority || busy || !invite.trim()) return;
    setBusy(true); setNotice("");
    try {
      const { error: e } = await supabase.from("teacher_employment_requests").insert({
        school_id: authority.schoolId, listing_id: id, message: invite.trim().slice(0, 1000),
      });
      if (e) {
        setNotice(e.code === "23505" ? "Your school has already requested an interview." : "The interview request could not be sent.");
        return;
      }
      await refreshSchool(authority);
      setInvite("");
      setNotice("Interview request sent privately to the teacher.");
    } catch { setNotice("The interview request could not be sent.") }
    finally { setBusy(false) }
  }

  const title = role === "teacher" ? "Find your next opportunity." : "Find the right teacher.";
  const lead = role === "teacher" ? "School employment and online teaching, in one place." : "Discover candidates. Shortlist. Arrange interviews.";
  const empty = view === "shortlisted" ? "No teachers shortlisted yet." : view === "interviews" ? "No interview requests yet."
    : view === "teachers" ? "No teachers have published matching employment profiles."
    : view === "tuition" ? "No consented online tuition requests match right now."
    : view === "swaps" ? "No active station swaps match right now." : "No open school vacancies match right now.";

  return (
    <section className={styles.marketplace} aria-labelledby="marketplace-heading">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headingCopy}>
            <p className={styles.kicker}>Teacher Marketplace · Kenya</p>
            <h1 id="marketplace-heading">{title}</h1>
            <p className={styles.lead}>{lead}</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.roleSwitch} role="group" aria-label="Browse as">
              <button type="button" className={role === "teacher" ? styles.activeRole : ""} aria-pressed={role === "teacher"} onClick={() => selectRole("teacher")}>Teacher</button>
              <button type="button" className={role === "school" ? styles.activeRole : ""} aria-pressed={role === "school"} onClick={() => selectRole("school")}>School</button>
            </div>
            {role === "teacher"
              ? <Link className={styles.primaryAction} href="/teacher/marketplace/employment"><UserRound size={16} aria-hidden="true" /> My profile</Link>
              : <button type="button" className={styles.primaryAction} onClick={() => selectView("shortlisted")}><Bookmark size={16} aria-hidden="true" /> My shortlist{shortlisted.length ? " (" + shortlisted.length + ")" : ""}</button>}
          </div>
        </div>

        <div className={styles.tabs} role="group" aria-label={role === "teacher" ? "Teaching opportunities" : "School recruitment"}>
          {TABS[role].map(tab => <button key={tab.value} type="button" onClick={() => selectView(tab.value)} className={view === tab.value ? styles.activeTab : ""} aria-pressed={view === tab.value}>
            {tab.label}{tab.value === "interviews" && requests.length > 0 ? " (" + requests.length + ")" : ""}
          </button>)}
        </div>

        <div className={styles.tools}>
          <label className={styles.search}><Search size={18} aria-hidden="true" /><span className={styles.srOnly}>Search listings</span>
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={role === "teacher" ? "Search subjects, vacancies or counties" : "Search names, subjects or counties"} />
          </label>
          <button type="button" className={styles.filterButton} onClick={() => setFiltersOpen(value => !value)} aria-controls="marketplace-filters" aria-expanded={filtersOpen}>
            <ListFilter size={17} aria-hidden="true" /> Filters{county || level ? " · " + Number(Boolean(county) + Number(Boolean(level))) : ""}
          </button>
          <span className={styles.count}>{isLoading ? "Loading" : visible.length + " results"}</span>
        </div>
        {filtersOpen && <div id="marketplace-filters" className={styles.filters}>
          <label>County<select value={county} onChange={event => setCounty(event.target.value)}><option value="">All counties</option>{countyNames.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Level<select value={level} onChange={event => setLevel(event.target.value)}><option value="">All levels</option>{[...new Set(allRows.flatMap(row => row.level.split(" · ")).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
          <button type="button" onClick={() => { setCounty(""); setLevel(""); setSearch("") }}>Clear filters</button>
        </div>}

        <div className={styles.workspace}>
          <div className={styles.list} aria-live="polite" aria-busy={isLoading}>
            {isLoading ? <div className={styles.empty} role="status">Loading {role === "teacher" ? "opportunities" : "teacher profiles"}…</div>
              : error ? <div className={styles.empty} role="alert"><strong>{error}</strong><button type="button" className={styles.retry} onClick={() => setRetry(n => n + 1)}><RefreshCw size={15} /> Retry</button></div>
              : role === "school" && view !== "teachers" && !canManageSchool ? <div className={styles.empty}>Sign in as an authorized school administrator to see your {view === "shortlisted" ? "shortlist" : "interview requests"}. <Link href={"/login?redirect=" + encodeURIComponent("/teacher/marketplace?tab=" + view)}>Sign in</Link></div>
              : visible.length === 0 ? <div className={styles.empty}>
                  <strong>{empty}</strong>
                  {search || county || level ? <button type="button" className={styles.retry} onClick={() => { setSearch(""); setCounty(""); setLevel("") }}>Clear search</button> : null}
                  {view === "tuition" ? <Link href="/vibetutor/become-tutor">Set up your tutor profile</Link> : null}
                </div>
              : visible.map(row => <button type="button" key={row.type + row.key}
                  className={styles.listing + " " + (current?.key === row.key ? styles.selected : "")}
                  onClick={event => openDetail(row.key, event.currentTarget)} aria-label={"View " + row.title}>
                  <span className={styles.listIcon} aria-hidden="true">{row.type === "job" || row.type === "interview" ? <BriefcaseBusiness size={19} /> : row.type === "tuition" ? <MonitorPlay size={19} /> : row.type === "swap" ? <ArrowLeftRight size={19} /> : <UserRound size={19} />}</span>
                  <span className={styles.listCopy}><strong>{row.title}</strong><span className={styles.subtitle}>{row.subtitle}</span><span className={styles.tags}>{row.tags.map((tag, index) => <span key={index}>{tag}</span>)}</span></span><ArrowRight size={17} className={styles.arrow} aria-hidden="true" />
                </button>)}
          </div>

          {mobileDetail && <button className={styles.backdrop} aria-label="Close details" onClick={closeDetail} />}
          <aside className={styles.details + " " + (mobileDetail ? styles.detailsOpen : "")} aria-label="Opportunity details">
            <div className={styles.detailHeader}><span>{current ? (current.type === "teacher" ? "Teacher profile" : current.type === "interview" ? "Interview request" : "Opportunity details") : "Details"}</span><button type="button" className={styles.mobileClose} onClick={closeDetail} aria-label="Close"><X size={20}/></button></div>
            {current ? <>
              <h2>{current.title}</h2><p className={styles.detailSubtitle}>{current.subtitle}</p>
              <dl className={styles.facts}>
                {current.type !== "interview" && <><dt>Location</dt><dd>{safeText(current.county)}</dd><dt>Level</dt><dd>{safeText(current.level)}</dd></>}
                {current.type === "job" && <><dt>Employment</dt><dd>{safeText(current.data.employment_type)}</dd><dt>Closing</dt><dd>{listingDate(current.data.closing_date)}</dd></>}
                {current.type === "tuition" && <><dt>Format</dt><dd>{current.data.teaching_mode}</dd><dt>Budget</dt><dd>{current.data.budget_kes ? "Up to KSh " + current.data.budget_kes.toLocaleString("en-KE") + " / hour" : "To discuss"}</dd><dt>Days</dt><dd>{current.data.available_days.join(", ") || "To discuss"}</dd></>}
                {current.type === "swap" && <><dt>Subjects</dt><dd>{current.data.subject}</dd><dt>From</dt><dd>{current.data.current_subcounty + ", " + current.data.current_county}</dd><dt>To</dt><dd>{current.data.preferred_subcounty ? current.data.preferred_subcounty + ", " + current.data.preferred_county : current.data.preferred_county}</dd></>}
                {current.type === "teacher" && <><dt>Subjects</dt><dd>{current.data.subjects.join(", ")}</dd><dt>Qualification</dt><dd>{current.data.qualification} · Self-declared</dd><dt>Experience</dt><dd>{current.data.experience === 0 ? "New teacher" : current.data.experience + " years"}</dd><dt>Availability</dt><dd>{current.data.availability}</dd></>}
                {current.type === "interview" && <><dt>Status</dt><dd>{current.data.status}</dd><dt>Sent</dt><dd>{new Date(current.data.created_at).toLocaleDateString("en-KE")}</dd></>}
              </dl>
              {current.type === "job" && <><p className={styles.description}>{current.data.description || "The school has not provided additional details."}</p>{vacancyApplication(current.data.application_url)
                ? <a className={styles.primaryAction} href={vacancyApplication(current.data.application_url)!.href} target={vacancyApplication(current.data.application_url)!.external ? "_blank" : undefined} rel={vacancyApplication(current.data.application_url)!.external ? "noopener noreferrer" : undefined}>View application <ArrowRight size={16}/></a>
                : <p className={styles.help}>No verified application destination is listed. Check with the school before applying.</p>}</>}
              {current.type === "tuition" && <><p className={styles.description}>A guardian has opted to share this limited learner request. Private contact details remain hidden.</p><Link className={styles.primaryAction} href={requestUrl(current.data.id)}>View and respond in VibeTutor <ArrowRight size={16}/></Link></>}
              {current.type === "swap" && <><p className={styles.description}>Interested teachers can use the existing private station-swap conversation. Official approvals remain outside VibeSchool.</p><Link className={styles.primaryAction} href={swapUrl(current.data.id)}>Express interest privately <ArrowRight size={16}/></Link></>}
              {current.type === "teacher" && <>
                {current.data.bio && <p className={styles.description}>{current.data.bio}</p>}
                <p className={styles.help}><ShieldCheck size={14} aria-hidden="true"/> Credentials are self-declared. Schools must verify them.</p>
                {!canManageSchool
                  ? <Link className={styles.primaryAction} href={"/login?redirect=" + encodeURIComponent("/teacher/marketplace?tab=hire")}>School admin sign-in <ArrowRight size={16}/></Link>
                  : <>
                    <div className={styles.detailActions}><button type="button" className={styles.secondaryAction} disabled={busy} onClick={() => void toggleShortlist(current.data.id)}><Bookmark size={16}/> {shortlisted.includes(current.data.id) ? "Remove shortlist" : "Shortlist"}</button></div>
                    {requests.some(r => r.listing_id === current.data.id) ? <p className={styles.help}>Interview request already sent: {requests.find(r => r.listing_id === current.data.id)?.status}.</p>
                      : <form className={styles.inviteForm} onSubmit={e => { e.preventDefault(); void sendInterview(current.data.id) }}><label htmlFor="marketplace-interview">Invite this teacher for an interview</label><textarea id="marketplace-interview" rows={3} maxLength={1000} required value={invite} onChange={e => setInvite(e.target.value)} placeholder="Introduce your school and the vacancy."/><button type="submit" className={styles.primaryAction} disabled={busy || !invite.trim()}>{busy ? "Sending…" : "Send interview request"} <ArrowRight size={16}/></button></form>}
                  </>}
              </>}
              {current.type === "interview" && <><p className={styles.description}>{current.data.message}</p><p className={styles.help}>Teachers manage their replies and private CV sharing from My Employment.</p></>}
              {notice && <p role="status" className={styles.notice}>{notice}</p>}
            </> : <p className={styles.help}>Select an opportunity to view details.</p>}
          </aside>
        </div>
        <div className={styles.footerActions}>
          {role === "teacher" ? <>
            <Link href="/vibetutor/become-tutor">Teach online</Link><Link href="/teacher/marketplace/manage?tab=swap">Manage swaps</Link><Link href="/teacher/marketplace/sandbox">TSC recruitment</Link><Link href="/login?redirect=/teacher/pulse">Teacher OS</Link>
          </> : <><Link href="/admin/teachers">School administration</Link><Link href="/teacher/marketplace?tab=hire">Recruit teachers</Link></>}
        </div>
      </div>
    </section>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check,
  ClipboardCheck, Info, MapPin, RotateCcw, ShieldCheck, Search,
} from "lucide-react";
import { useKenyaCounties } from "@/lib/geography/kenyaCounties";
import type { TeachingLevel } from "@/lib/teacher/tscSandboxMatching";
import {
  COUNTY_ALLOCATION_SOURCE, OFFICIAL_TSC_ADVERTS,
  REPORTED_COUNTY_ALLOCATIONS, reportedAllocation,
} from "@/lib/teacher/tsc2026CountyAllocations";
import styles from "./sandbox.module.css";

const portalHref = "https://teachersonline.tsc.go.ke/";
const deadline = Date.parse("2026-11-23T21:00:00Z");
// This is the application deadline for the national exercise, not a county-specific deadline.
function countdownParts(ms: number) {
  const totalMinutes = Math.ceil(Math.max(0, ms) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}
const levelNames: Record<TeachingLevel, string> = {
  primary: "Primary",
  junior: "Junior School",
  secondary: "Secondary",
};
const requirements: Record<TeachingLevel, string> = {
  primary: "At least a P1 teaching certificate",
  junior: "At least a Diploma in Education",
  secondary: "At least a Diploma in Education",
};

export default function VacancyMatchSandbox() {
  const [level, setLevel] = useState<TeachingLevel>("secondary");
  const [county, setCounty] = useState("");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [countyQuery, setCountyQuery] = useState("");
  const [showAllCounties, setShowAllCounties] = useState(false);
  const { countyNames, error: countyError } = useKenyaCounties();

  useEffect(() => {
    const update = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const fallbackCounties = useMemo(
    () => REPORTED_COUNTY_ALLOCATIONS.map(item => item.county), []
  );
  const countyOptions = countyNames.length > 0
    ? (county && !countyNames.includes(county) ? [...countyNames, county] : countyNames)
    : fallbackCounties;
  const allocation = useMemo(
    () => reportedAllocation(level, county), [level, county]
  );
  const nationalTotal = level === "primary" ? 5609 : level === "junior" ? 25 : 2086;
  const countyTotal = allocation.count;
  const applicationClosed = remainingMs !== null && remainingMs <= 0;
  const countdown = remainingMs === null ? null : countdownParts(remainingMs);
  const rankedCounties = useMemo(() => {
    if (level === "junior") return [];
    const key = level === "primary" ? "primary" : "secondary";
    return [...REPORTED_COUNTY_ALLOCATIONS]
      .map(row => ({ county: row.county, count: row[key] }))
      .sort((a, b) => b.count - a.count || a.county.localeCompare(b.county, "en-KE"))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [level]);
  const query = countyQuery.trim().toLocaleLowerCase("en-KE");
  const visibleCounties = query
    ? rankedCounties.filter(row => row.county.toLocaleLowerCase("en-KE").includes(query))
    : showAllCounties ? rankedCounties : rankedCounties.slice(0, 8);
  const maxCountyCount = rankedCounties[0]?.count ?? 1;

  return (
    <div className={styles.shell}>
      <div className={styles.trail}>
        <Link href="/teacher" className={styles.back}>
          <ArrowLeft aria-hidden="true" size={16} /> VibeSchool Teachers
        </Link>
        <span className={styles.sandboxTag}>TEACHER MARKETPLACE</span>
      </div>

      <section className={styles.hero} aria-labelledby="sandbox-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>TSC RECRUITMENT 2026 / 2027</span>
          <h1 id="sandbox-title">Find TSC vacancies and prepare your application.</h1>
          <p>Check recruitment numbers in your preferred county, see the minimum requirements, and follow the official application process.</p>
          <div className={styles.heroMeta}>
            <span><BookOpen aria-hidden="true" size={16} /> 7,720 advertised posts nationally</span>
            <span><ClipboardCheck aria-hidden="true" size={16} /> Deadline: 23 Nov 2026, midnight EAT</span>
          </div>
        </div>
        <div className={styles.deadlineClock} aria-label="TSC application deadline countdown">
          <span>APPLICATION DEADLINE</span>
          <strong>{countdown === null ? "23 NOV" : applicationClosed ? "Closed" : countdown.days > 0
            ? `${countdown.days}d ${countdown.hours}h`
            : `${countdown.hours}h ${countdown.minutes}m`}</strong>
          <small>{countdown === null ? "23 November 2026" : applicationClosed ? "Application window ended" : "Time left to apply"}</small>
          <small>23 Nov 2026 · 11:59 p.m. EAT</small>
        </div>
      </section>

      <div className={styles.demoNotice} role="note">
        <Info aria-hidden="true" size={19} />
        <div>
          <strong>Real recruitment figures, not fictional school vacancies.</strong>
          <p>The nationwide numbers are from the November 2026 TSC recruitment announcement. County totals are from a dated published breakdown. School-by-school and subject-combination matches are not yet verified in VibeSchool; confirm specific openings in TSC's official schedules.</p>
        </div>
      </div>

      <div className={styles.workspace}>
        <section className={styles.filtersCard} aria-labelledby="choose-heading">
          <div className={styles.sectionTop}>
            <span className={styles.step}>01 · YOUR SEARCH</span>
            <button type="button" className={styles.reset} onClick={() => { setLevel("secondary"); setCounty(""); }}>
              <RotateCcw aria-hidden="true" size={14} /> Reset
            </button>
          </div>
          <h2 id="choose-heading">Where would you like to teach?</h2>
          <p className={styles.supportText}>Select a teaching level and county to review the published figures.</p>

          <fieldset className={styles.fieldset}>
            <legend>Teaching level</legend>
            <div className={styles.levelChoices}>
              {(["primary", "junior", "secondary"] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  className={level === value ? styles.levelActive : styles.levelButton}
                  onClick={() => setLevel(value)}
                  aria-pressed={level === value}
                >
                  {level === value && <Check aria-hidden="true" size={14} />}
                  {levelNames[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className={styles.countyField}>
            <label htmlFor="tsc-county"><MapPin aria-hidden="true" size={15} /> Preferred county</label>
            <select id="tsc-county" value={county} onChange={event => setCounty(event.target.value)}>
              <option value="">All of Kenya</option>
              {countyOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            {countyError && <p className={styles.help}>Using the published county list while the county directory is unavailable.</p>}
            <p className={styles.help}>County totals show advertised allocation, not a personal eligibility decision.</p>
          </div>
          <div className={styles.quickExamples}>
            <p>Minimum qualification for {levelNames[level]}</p>
            <div className={styles.guidance}>
              <span><Check aria-hidden="true" size={16} /> {requirements[level]}</span>
              <span><Check aria-hidden="true" size={16} /> Kenyan citizenship</span>
              <span><Check aria-hidden="true" size={16} /> TSC teacher registration</span>
            </div>
          </div>
        </section>

        <section className={styles.matchesCard} aria-labelledby="matches-heading">
          <div className={styles.sectionTop}>
            <span className={styles.step}>02 · ADVERTISED POSTS</span>
            <span className={styles.demoLabel}>PUBLISHED FIGURES</span>
          </div>
          <div className={styles.matchesTitle}>
            <div>
              <h2 id="matches-heading">Vacancies for {levelNames[level]}</h2>
              <p className={styles.supportText}>Based on the November 2026 recruitment notice and the published county allocation breakdown.</p>
            </div>
          </div>

          <section className={styles.allocationPanel} aria-label="Reported recruitment allocation" aria-live="polite">
            <div className={styles.allocationHeading}>
              <span>REPORTED RECRUITMENT ALLOCATION</span>
              <span>{levelNames[level]}</span>
            </div>
            <div className={styles.allocationNumber}>
              <strong>{countyTotal === null ? "Not verified" : countyTotal.toLocaleString("en-KE")}</strong>
              <span>{county ? "posts reported for " + county : "posts advertised nationally"}</span>
            </div>
            <p>{county && level === "junior"
              ? "A junior-school allocation for this county has not been verified. The national total is 25 posts."
              : countyTotal === null
                ? "We do not have a reconciled county total. Check TSC's official vacancy schedules."
                : county
                  ? "These are reported county-level totals, not a list of schools or subject combinations."
                  : "These are nationwide vacancies at the selected teaching level."}</p>
            <div className={styles.allocationSources}>
              <a href={COUNTY_ALLOCATION_SOURCE} target="_blank" rel="noopener noreferrer">See county breakdown <ArrowUpRight aria-hidden="true" size={13} /></a>
              <a href={OFFICIAL_TSC_ADVERTS} target="_blank" rel="noopener noreferrer">Check TSC schedules <ArrowUpRight aria-hidden="true" size={13} /></a>
            </div>
          </section>

          <div className={styles.matchContent} aria-live="polite">
            <div className={styles.resultList}>
              <p className={styles.resultSummary}>{nationalTotal.toLocaleString("en-KE")} posts advertised nationally · {levelNames[level]}</p>
              <article className={styles.result}>
                <div className={styles.resultTop}>
                  <div>
                    <span className={styles.exampleFlag}>OFFICIAL RECRUITMENT PROCESS</span>
                    <h3>{county ? "Applying from " + county : "Preparing to apply"}</h3>
                  </div>
                </div>
                <p>Before applying, confirm that your qualifications meet TSC requirements and compare any school or subject combination with the original vacancy schedule.</p>
                <div className={styles.guidance}>
                  <span><Check aria-hidden="true" size={16} /> Confirm your TSC registration and qualification</span>
                  <span><Check aria-hidden="true" size={16} /> Read the official vacancy schedule and recruitment guidelines</span>
                  <span><Check aria-hidden="true" size={16} /> Apply online through TSC before 23 November 2026</span>
                  <span><Check aria-hidden="true" size={16} /> Retain your reference details and original certificates for verification</span>
                </div>
                <p className={styles.supportText}>Applications are free. TSC says to submit only one employment application form. Shortlisted teachers must present original documents for verification.</p>
                <a href={portalHref} className={styles.detailsButton} target="_blank" rel="noopener noreferrer">
                  {applicationClosed ? "Check TSC recruitment updates" : "Continue to official TSC application"} <ArrowRight aria-hidden="true" size={17} />
                </a>
              </article>
            </div>
          </div>
          <div className={styles.sourceFoot}>
            <ShieldCheck aria-hidden="true" size={19} />
            <p><strong>School and subject verification:</strong> VibeSchool does not currently hold a reconciled school-by-school list. County totals are not subject-specific matches. For a named school or subject combination, consult the complete original TSC appendices.</p>
          </div>
        </section>
      </div>

      <section className={styles.countyBoard} aria-labelledby="county-board-title">
        <div className={styles.countyBoardHeading}>
          <div>
            <span className={styles.step}>COUNTY VACANCY COUNT · 11 NOVEMBER 2026</span>
            <h2 id="county-board-title">See advertised posts in every county</h2>
            <p>Compare the published county allocations for {levelNames[level]}. Select a county to view its total above.</p>
          </div>
          <span className={styles.countyBoardTotal}>{level === "junior" ? "25 nationwide" : "47 counties"}</span>
        </div>
        {level === "junior" ? (
          <div className={styles.countyUnavailable} role="status">
            The 25 junior-school posts are confirmed nationally, but the complete county-by-county distribution has not been reconciled here.
            <a href={OFFICIAL_TSC_ADVERTS} target="_blank" rel="noopener noreferrer">Check the original TSC vacancy schedules <ArrowUpRight size={15} aria-hidden="true" /></a>
          </div>
        ) : (
          <>
            <div className={styles.countyTools}>
              <label htmlFor="county-allocation-search"><Search size={16} aria-hidden="true" /> Find a county</label>
              <input
                id="county-allocation-search"
                type="search"
                value={countyQuery}
                onChange={event => setCountyQuery(event.target.value)}
                placeholder="Search all 47 counties"
              />
              {!query && <button type="button" onClick={() => setShowAllCounties(value => !value)} aria-expanded={showAllCounties}>
                {showAllCounties ? "Show top 8" : "Show all 47 counties"}
              </button>}
            </div>
            <ol className={styles.countyList} aria-label={`Reported ${levelNames[level]} allocations ranked by county`}>
              {visibleCounties.map(row => (
                <li key={row.county}>
                  <button
                    type="button"
                    className={county === row.county ? styles.countySelected : styles.countyRow}
                    aria-pressed={county === row.county}
                    onClick={() => setCounty(row.county)}
                  >
                    <span className={styles.countyRank}>{row.rank.toString().padStart(2, "0")}</span>
                    <span className={styles.countyRowName}>
                      <span>{row.county}</span>
                      <span className={styles.countyBar} aria-hidden="true">
                        <span style={{ width: `${Math.max(2, (row.count / maxCountyCount) * 100)}%` }} />
                      </span>
                    </span>
                    <strong>{row.count.toLocaleString("en-KE")}</strong>
                    <span className={styles.countyPostLabel}>posts</span>
                  </button>
                </li>
              ))}
            </ol>
            {visibleCounties.length === 0 && <p className={styles.noCountyResults}>No county matches that search.</p>}
            {county && <p className={styles.countySelection} role="status">Selected: <strong>{county}</strong> · {countyTotal === null ? "County total not verified" : `${countyTotal.toLocaleString("en-KE")} advertised ${levelNames[level]} posts`}</p>}
          </>
        )}
        <p className={styles.countyFootnote}>
          Source: published allocation breakdown, 11 November 2026.
          These are advertised allocations, not live vacancies remaining, application counts, or subject-specific openings.
          The 25 junior-school posts are excluded from the primary and secondary county rankings.
          <a href={COUNTY_ALLOCATION_SOURCE} target="_blank" rel="noopener noreferrer">View source <ArrowUpRight size={13} aria-hidden="true" /></a>
        </p>
      </section>

      <section className={styles.next} aria-labelledby="next-heading">
        <div className={styles.nextText}>
          <span className={styles.step}>03 · SUBMIT YOUR APPLICATION</span>
          <h2 id="next-heading">Application checklist</h2>
          <p>For primary teachers, the minimum requirement is P1. Junior and secondary teachers need at least a Diploma in Education. All applicants must be registered with TSC.</p>
          <div className={styles.guidance}>
            <span><Check aria-hidden="true" size={16} /> Confirm you meet the advertised requirements</span>
            <span><Check aria-hidden="true" size={16} /> Choose opportunities using official TSC schedules</span>
            <span><Check aria-hidden="true" size={16} /> Submit one application on the official portal</span>
          </div>
        </div>
        <div className={styles.nextActions}>
          <a href={portalHref} target="_blank" rel="noopener noreferrer" className={styles.apply}>
            {applicationClosed ? "Check TSC for updates" : "Apply through official TSC portal"} <ArrowUpRight aria-hidden="true" size={18} />
          </a>
          <a href={OFFICIAL_TSC_ADVERTS} target="_blank" rel="noopener noreferrer" className={styles.readArticle}>Read TSC adverts and requirements <ArrowUpRight aria-hidden="true" size={17} /></a>
          <p>Applications are free. VibeSchool never collects your TSC password.</p>
        </div>
      </section>
    </div>
  );
}

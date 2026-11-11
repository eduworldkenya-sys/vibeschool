"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight,
  ClipboardCheck, Info, MapPin, RotateCcw, Search, ShieldCheck,
} from "lucide-react";
import { useKenyaCounties } from "@/lib/geography/kenyaCounties";
import {
  SUBJECT_OPTIONS, matchDemoOpenings,
  type TeachingLevel,
} from "@/lib/teacher/tscSandboxMatching";
import styles from "./sandbox.module.css";
import { COUNTY_ALLOCATION_SOURCE, OFFICIAL_TSC_ADVERTS, REPORTED_COUNTY_ALLOCATIONS, reportedAllocation } from "@/lib/teacher/tsc2026CountyAllocations";

const articleHref = "/blog/50ef6c33-da45-4a6e-a951-77da15386fa3";
const portalHref = "https://teachersonline.tsc.go.ke/";
const deadline = Date.parse("2026-11-23T21:00:00Z");

const levelNames: Record<TeachingLevel, string> = {
  primary: "Primary",
  junior: "Junior School",
  secondary: "Secondary",
};

const samples = [
  { label: "Maths / Physics", level: "secondary" as const, first: "Mathematics", second: "Physics", county: "Murang'a" },
  { label: "English / Literature", level: "secondary" as const, first: "English", second: "Literature", county: "Kiambu" },
  { label: "Primary example", level: "primary" as const, first: "", second: "", county: "Kilifi" },
];

export default function VacancyMatchSandbox() {
  const [level, setLevel] = useState<TeachingLevel>("secondary");
  const [subjectOne, setSubjectOne] = useState("");
  const [subjectTwo, setSubjectTwo] = useState("");
  const [county, setCounty] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applicationClosed, setApplicationClosed] = useState(false);
  const { countyNames, error: countyError } = useKenyaCounties();

  useEffect(() => {
    setApplicationClosed(Date.now() >= deadline);
  }, []);

  // The canonical directory supplies all 47 counties when available. The
  // county names from the reported 47-county distribution remain available.
  const demoCounties = useMemo(() => REPORTED_COUNTY_ALLOCATIONS.map(item => item.county), []);
  const countyOptions = countyNames.length > 0
    ? (county && !countyNames.includes(county) ? [...countyNames, county] : countyNames)
    : demoCounties;

  const allocation = useMemo(() => reportedAllocation(level, county), [level, county]);
  const { ready, matches, inOtherCounties } = useMemo(() =>
    matchDemoOpenings({ level, subjectOne, subjectTwo, county }),
    [level, subjectOne, subjectTwo, county]
  );

  function chooseLevel(next: TeachingLevel) {
    setLevel(next);
    setSubjectOne("");
    setSubjectTwo("");
    setExpanded(null);
  }

  function applySample(sample: typeof samples[number]) {
    setLevel(sample.level);
    setSubjectOne(sample.first);
    setSubjectTwo(sample.second);
    setCounty(sample.county);
    setExpanded(null);
  }

  function reset() {
    setLevel("secondary");
    setSubjectOne("");
    setSubjectTwo("");
    setCounty("");
    setExpanded(null);
  }

  return (
    <div className={styles.shell}>
      <div className={styles.trail}>
        <Link href="/for-teachers" className={styles.back}>
          <ArrowLeft aria-hidden="true" size={16} /> VibeSchool Teachers
        </Link>
        <span className={styles.sandboxTag}>SANDBOX · NO LOGIN</span>
      </div>

      <section className={styles.hero} aria-labelledby="sandbox-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>TSC RECRUITMENT 2026 / 2027</span>
          <h1 id="sandbox-title">Explore vacancies by level, subjects and county.</h1>
          <p>Tell us what you teach. See how VibeSchool will help you find the right vacancy when the official schedules are verified.</p>
          <div className={styles.heroMeta}>
            <span><BookOpen aria-hidden="true" size={16} /> 7,720 advertised posts nationwide</span>
            <span><ClipboardCheck aria-hidden="true" size={16} /> 23 Nov 2026 deadline</span>
          </div>
        </div>
        <div className={styles.heroStamp} aria-hidden="true">
          <strong>V</strong>
          <span>VIBESCHOOL<br />TEACHERS</span>
        </div>
      </section>

      <div className={styles.demoNotice} role="note">
        <Info aria-hidden="true" size={19} />
        <div>
          <strong>This is a working demo, not a live vacancy search.</strong>
          <p>The subject-matching examples below use invented school records. County-level allocations are reported 2026 TSC recruitment figures, not school-level subject matches.</p>
        </div>
      </div>

      <div className={styles.workspace}>
        <section className={styles.filtersCard} aria-labelledby="choose-heading">
          <div className={styles.sectionTop}>
            <span className={styles.step}>01 · YOUR TEACHING</span>
            <button type="button" className={styles.reset} onClick={reset}>
              <RotateCcw aria-hidden="true" size={14} /> Reset
            </button>
          </div>
          <h2 id="choose-heading">What do you teach?</h2>
          <p className={styles.supportText}>No account or personal details needed.</p>

          <fieldset className={styles.fieldset}>
            <legend>Teaching level</legend>
            <div className={styles.levelChoices}>
              {(["primary", "junior", "secondary"] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  className={level === value ? styles.levelActive : styles.levelButton}
                  onClick={() => chooseLevel(value)}
                  aria-pressed={level === value}
                >
                  {level === value && <Check aria-hidden="true" size={14} />}
                  {levelNames[value]}
                </button>
              ))}
            </div>
          </fieldset>

          {level !== "primary" && (
            <div className={styles.subjectFields}>
              <label htmlFor="tsc-demo-subject-one">First teaching subject</label>
              <select id="tsc-demo-subject-one" value={subjectOne} onChange={event => { const next = event.target.value; setSubjectOne(next); if (next === subjectTwo) setSubjectTwo(""); setExpanded(null); }}>
                <option value="">Choose a subject</option>
                {SUBJECT_OPTIONS.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <label htmlFor="tsc-demo-subject-two">Second teaching subject</label>
              <select id="tsc-demo-subject-two" value={subjectTwo} onChange={event => { setSubjectTwo(event.target.value); setExpanded(null); }}>
                <option value="">Choose a subject</option>
                {SUBJECT_OPTIONS.filter(name => name !== subjectOne).map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <p className={styles.help}>We compare subject combinations, not just one subject.</p>
            </div>
          )}
          {level === "primary" && <p className={styles.primaryHint}>Primary school examples are matched by county, without a subject combination.</p>}

          <div className={styles.countyField}>
            <label htmlFor="tsc-demo-county"><MapPin aria-hidden="true" size={15} /> Preferred county</label>
            <select id="tsc-demo-county" value={county} onChange={event => { setCounty(event.target.value); setExpanded(null); }}>
              <option value="">Anywhere in Kenya</option>
              {countyOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            {countyError && <p className={styles.help}>County directory unavailable. Showing demo locations only.</p>}
            <p className={styles.help}>Open to relocating? Leave this set to anywhere.</p>
          </div>

          <div className={styles.quickExamples}>
            <p>Try an example</p>
            <div className={styles.presets}>
              {samples.map(sample => (
                <button type="button" key={sample.label} onClick={() => applySample(sample)}>
                  {sample.label} <ChevronRight aria-hidden="true" size={15} />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.matchesCard} aria-labelledby="matches-heading">
          <div className={styles.sectionTop}>
            <span className={styles.step}>02 · YOUR MATCHES</span>
            <span className={styles.demoLabel}>EXAMPLE RESULTS</span>
          </div>
          <div className={styles.matchesTitle}>
            <div>
              <h2 id="matches-heading">Try the subject-matching preview</h2>
              <p className={styles.supportText}>The school cards are fictional examples. Reported county figures appear separately below.</p>
            </div>
            <span className={styles.matchCount} aria-label={String(matches.length) + " demo matches"}>{ready ? matches.length : "—"}</span>
          </div>

          <section className={styles.allocationPanel} aria-label="Reported vacancy allocation">
            <div className={styles.allocationHeading}>
              <span>REPORTED RECRUITMENT ALLOCATION</span>
              <span>{levelNames[level]}</span>
            </div>
            <div className={styles.allocationNumber}>
              <strong>{allocation.count === null ? "Not available" : allocation.count.toLocaleString("en-KE")}</strong>
              <span>{county ? "posts reported for " + county : "posts advertised nationally"}</span>
            </div>
            <p>{allocation.count === null
              ? level === "junior"
                ? "The junior-school county distribution has not been verified here. The national announcement advertises 25 posts."
                : "We do not have a reconciled figure for this county. Check the official vacancy schedule."
              : level === "junior"
                ? "The national total is shown. County-specific junior-school figures are not yet verified."
                : "This is the total for this teaching level, not a subject-specific match. You may not be eligible for every post."}</p>
            <div className={styles.allocationSources}>
              <a href={COUNTY_ALLOCATION_SOURCE} target="_blank" rel="noopener noreferrer">Read reported breakdown <ArrowUpRight aria-hidden="true" size={13} /></a>
              <a href={OFFICIAL_TSC_ADVERTS} target="_blank" rel="noopener noreferrer">Check original TSC adverts <ArrowUpRight aria-hidden="true" size={13} /></a>
            </div>
          </section>

          <div className={styles.matchContent} aria-live="polite">
            {!ready ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}><Search aria-hidden="true" size={24} /></span>
                <h3>Start with your teaching subjects</h3>
                <p>Choose two different subjects above, or try one of the examples. We&apos;ll show how matching works.</p>
              </div>
            ) : matches.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}><Search aria-hidden="true" size={24} /></span>
                <h3>No sample record for this combination</h3>
                <p>We have not verified any school-specific openings for this selection. This small demonstration cannot establish whether real vacancies exist. Use the reported county figures above and check the official schedule.</p>
                {inOtherCounties.length > 0 && (
                  <button type="button" className={styles.showAll} onClick={() => { setCounty(""); setExpanded(null); }}>
                    See {inOtherCounties.length} example {inOtherCounties.length === 1 ? "record" : "records"} in other counties
                    <ArrowRight aria-hidden="true" size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.resultList}>
                <p className={styles.resultSummary}>{matches.length} matching {matches.length === 1 ? "example" : "examples"} · {levelNames[level]}{county ? " · " + county : " · Across demo counties"}</p>
                {matches.map(opening => (
                  <article key={opening.id} className={styles.result}>
                    <div className={styles.resultTop}>
                      <div>
                        <span className={styles.exampleFlag}>DEMO RECORD · NOT A REAL VACANCY</span>
                        <h3>{opening.school}</h3>
                      </div>
                      <span className={styles.places}>{opening.places} example {opening.places === 1 ? "post" : "posts"}</span>
                    </div>
                    <p className={styles.location}><MapPin aria-hidden="true" size={15} /> {opening.county} · {levelNames[opening.level]}</p>
                    {opening.subjects.length > 0 && (
                      <p className={styles.subjects}><BookOpen aria-hidden="true" size={15} /> {opening.subjects.join(" / ")}</p>
                    )}
                    <button
                      type="button"
                      aria-expanded={expanded === opening.id}
                      aria-controls={"example-details-" + opening.id}
                      className={styles.detailsButton}
                      onClick={() => setExpanded(value => value === opening.id ? null : opening.id)}
                    >
                      {expanded === opening.id ? "Hide match explanation" : "Why this example matches"}
                      <ChevronRight aria-hidden="true" size={17} />
                    </button>
                    {expanded === opening.id && (
                      <div id={"example-details-" + opening.id} className={styles.explanation}>
                        <Check aria-hidden="true" size={16} />
                        <p>{opening.level === "primary"
                          ? "The teaching level and county preference match this sample record."
                          : "Both teaching subjects match the sample combination, regardless of order."}{" "}
                          This illustrates how the matching tool works. It is not a verified TSC vacancy or eligibility decision.</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className={styles.sourceFoot}>
            <ShieldCheck aria-hidden="true" size={19} />
            <p><strong>Real vacancy matching is not active.</strong> School-by-school and subject-specific records still require reconciliation against the complete official TSC schedules. The reported county allocations above do not establish a personal match.</p>
          </div>
        </section>
      </div>

      <section className={styles.next} aria-labelledby="next-heading">
        <div className={styles.nextText}>
          <span className={styles.step}>03 · WHEN YOU ARE READY</span>
          <h2 id="next-heading">From finding a vacancy to applying</h2>
          <p>VibeSchool helps you understand your options. You submit your application directly to TSC.</p>
          <div className={styles.guidance}>
            <span><Check aria-hidden="true" size={16} /> Find a verified opening</span>
            <span><Check aria-hidden="true" size={16} /> Check the stated requirements</span>
            <span><Check aria-hidden="true" size={16} /> Apply on the official portal</span>
          </div>
        </div>
        <div className={styles.nextActions}>
          <a href={portalHref} target="_blank" rel="noopener noreferrer" className={styles.apply}>
            {applicationClosed ? "Check TSC for updates" : "Go to official TSC portal"} <ArrowUpRight aria-hidden="true" size={18} />
          </a>
          <Link href={articleHref} className={styles.readArticle}>Read recruitment requirements <ArrowRight aria-hidden="true" size={17} /></Link>
          <p>Applications are free. We never ask for TSC passwords or submission details.</p>
        </div>
      </section>
    </div>
  );
}

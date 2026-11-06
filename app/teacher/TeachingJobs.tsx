"use client";

import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useKenyaCounties, normalizeKenyaCounty } from "@/lib/geography/kenyaCounties";
import { createClient } from "@supabase/supabase-js";
import { JOB_SELECT, PublicJob, jobListing, listingDate, provided, validListingId } from "@/lib/public/teacherListings";
import ListingDetailDialog from "@/components/teacher/marketplace/ListingDetailDialog";
import styles from "@/components/teacher/marketplace/listingDetails.module.css";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function TeachingJobs() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState("");
  const [motionPaused, setMotionPaused] = useState(false);
  const { counties: officialCounties, countyNames } = useKenyaCounties();
  const [selected, setSelected] = useState<PublicJob | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(false);
      try {
        if (!url || !key) throw new Error("Missing configuration");
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const today = new Date().toISOString().slice(0, 10);
        const { data, error: fetchError } = await client.from("teacher_vacancies").select(JOB_SELECT)
          .eq("status", "published").or("closing_date.is.null,closing_date.gte." + today)
          .order("created_at", { ascending: false }).limit(50);
        if (fetchError) throw fetchError;
        const rows = (data ?? []) as PublicJob[];
        const sharedId = new URLSearchParams(window.location.search).get("job");
        if (validListingId(sharedId) && !rows.some(row => row.id === sharedId)) {
          const { data: shared, error: sharedError } = await client.from("teacher_vacancies").select(JOB_SELECT)
            .eq("id", sharedId).eq("status", "published").or("closing_date.is.null,closing_date.gte." + today).maybeSingle();
          if (sharedError) throw sharedError;
          if (shared) rows.push(shared as PublicJob);
        }
        if (active) setJobs(rows);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    function sync() {
      const id = new URLSearchParams(window.location.search).get("job");
      const match = jobs.find(job => job.id === id) ?? null;
      setSelected(match); setUnavailable(!!id && !match && !loading && !error);
    }
    sync(); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [jobs, loading, error]);
  function open(job: PublicJob) {
    const next = new URL(window.location.href); next.searchParams.set("job", job.id); next.searchParams.delete("swap");
    window.history.pushState(null, "", next); setSelected(job); setUnavailable(false);
  }
  function close() {
    const next = new URL(window.location.href); next.searchParams.delete("job");
    window.history.replaceState(null, "", next); setSelected(null); setUnavailable(false);
  }
  const counties = useMemo(() => countyNames.filter(name => jobs.some(job => normalizeKenyaCounty(job.county, officialCounties) === name)), [countyNames, jobs, officialCounties]);
  const visible = useMemo(() => jobs.filter(j => {
    const term = query.trim().toLocaleLowerCase();
    return (!county || normalizeKenyaCounty(j.county, officialCounties) === county) && (!term || [j.title, j.school_name, j.county, j.location ?? "", j.description ?? ""].some(v => v.toLocaleLowerCase().includes(term)));
  }), [jobs, county, query, officialCounties]);
  // Use only published vacancies already loaded for the grid. Prioritise a verified
  // approaching deadline, then the newest postings; never invent featured records.
  const featured = useMemo(() => {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return [...visible].sort((a, b) => {
      const priority = (job: PublicJob) => {
        if (!job.closing_date) return Number.MAX_SAFE_INTEGER;
        const date = Date.parse(job.closing_date.slice(0, 10) + "T00:00:00Z");
        const days = (date - today) / 86400000;
        return Number.isFinite(days) && days >= 0 && days <= 21 ? days : Number.MAX_SAFE_INTEGER;
      };
      return priority(a) - priority(b) || Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "") || a.id.localeCompare(b.id);
    }).slice(0, 6);
  }, [visible]);
  const featuredCards = (repeated: boolean) => featured.map(job => <article key={(repeated ? "duplicate-" : "featured-") + job.id} className={styles.featuredCard} aria-hidden={repeated ? true : undefined}>
    <button type="button" tabIndex={repeated ? -1 : 0} className={styles.featuredButton} onClick={() => open(job)} aria-label={"View featured job: " + job.title + " at " + job.school_name}>
      <span className={styles.badge}>{job.closing_date && Number.isFinite(Date.parse(job.closing_date)) && Date.parse(job.closing_date) - Date.now() <= 21 * 86400000 && Date.parse(job.closing_date) >= Date.now() - 86400000 ? "Closing soon" : "Teaching opportunity"}</span>
      <strong>{job.title}</strong>
      <span className={styles.featuredSchool}>{provided(job.school_name)}</span>
      {provided(job.county) !== "Not provided" && <span className={styles.featuredSchool}>{job.county}</span>}
      <span className={styles.view}>View details →</span>
    </button>
  </article>);
  return <div>
    {unavailable && <p role="status" className={styles.empty}>This job is no longer available. <button type="button" onClick={close}>Dismiss</button></p>}
    {loading ? <p role="status">Loading current vacancies…</p> : error ? <div role="alert"><p>Vacancies are temporarily unavailable.</p><button type="button" className={styles.retry} onClick={() => setRetry(n => n + 1)}>Try again</button></div> : jobs.length === 0 ? <p role="status">No approved teaching vacancies are listed right now.</p> : <>
      <div className={styles.filters}>
        <input aria-label="Search teaching vacancies" placeholder="Search jobs or schools" value={query} onChange={e => setQuery(e.target.value)} />
        <SearchableSelect label="Filter vacancies by county" value={county} onChange={setCounty} options={counties} placeholder="All counties" />
      </div>
      {featured.length > 0 && <section className={styles.featured} aria-labelledby="featured-jobs-title">
        <div className={styles.featuredHeading}><div><p className={styles.badge}>DISCOVER</p><h3 id="featured-jobs-title">Featured opportunities</h3><p>Closing soon and recently posted vacancies</p></div><button type="button" className={styles.motionToggle} aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? "Resume movement" : "Pause movement"}</button></div>
        <div className={styles.featuredViewport}>
          <div className={styles.featuredTrack + (motionPaused ? " " + styles.featuredPaused : "")}>{featuredCards(false)}{featured.length > 1 && featuredCards(true)}</div>
        </div>
      </section>}
      {visible.length === 0 ? <p role="status" className={styles.empty}>No vacancies match these filters.</p> : <div aria-label="Current teaching vacancies" className={styles.cards}>
        {visible.map(job => <article key={job.id} className={styles.card}><button type="button" className={styles.cardButton} onClick={() => open(job)} aria-label={"View job: " + job.title + " at " + job.school_name}>
          <span className={styles.badge}>School job</span><h3>{job.title}</h3><p>{provided(job.school_name)}</p><p>{provided(job.county)} · {provided(job.location)}</p><small>Closes: {listingDate(job.closing_date)}</small><span className={styles.view}>View details →</span>
        </button></article>)}
      </div>}
    </>}
    {selected && <ListingDetailDialog key={selected.id} listing={jobListing(selected)} onClose={close} />}
  </div>;
}

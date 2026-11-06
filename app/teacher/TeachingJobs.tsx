"use client";

import { useEffect, useMemo, useState } from "react";
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
  const counties = useMemo(() => [...new Set(jobs.map(j => j.county).filter(Boolean))].sort(), [jobs]);
  const visible = useMemo(() => jobs.filter(j => {
    const term = query.trim().toLocaleLowerCase();
    return (!county || j.county === county) && (!term || [j.title, j.school_name, j.county, j.location ?? "", j.description ?? ""].some(v => v.toLocaleLowerCase().includes(term)));
  }), [jobs, county, query]);
  return <div>
    {unavailable && <p role="status" className={styles.empty}>This job is no longer available. <button type="button" onClick={close}>Dismiss</button></p>}
    {loading ? <p role="status">Loading current vacancies…</p> : error ? <div role="alert"><p>Vacancies are temporarily unavailable.</p><button type="button" className={styles.retry} onClick={() => setRetry(n => n + 1)}>Try again</button></div> : jobs.length === 0 ? <p role="status">No approved teaching vacancies are listed right now.</p> : <>
      <div className={styles.filters}>
        <input aria-label="Search teaching vacancies" placeholder="Search jobs or schools" value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="Filter vacancies by county" value={county} onChange={e => setCounty(e.target.value)}><option value="">All counties</option>{counties.map(c => <option key={c} value={c}>{provided(c)}</option>)}</select>
      </div>
      {visible.length === 0 ? <p role="status" className={styles.empty}>No vacancies match these filters.</p> : <div aria-label="Current teaching vacancies" className={styles.cards}>
        {visible.map(job => <article key={job.id} className={styles.card}><button type="button" className={styles.cardButton} onClick={() => open(job)} aria-label={"View job: " + job.title + " at " + job.school_name}>
          <span className={styles.badge}>School job</span><h3>{job.title}</h3><p>{provided(job.school_name)}</p><p>{provided(job.county)} · {provided(job.location)}</p><small>Closes: {listingDate(job.closing_date)}</small><span className={styles.view}>View details →</span>
        </button></article>)}
      </div>}
    </>}
    {selected && <ListingDetailDialog key={selected.id} listing={jobListing(selected)} onClose={close} />}
  </div>;
}

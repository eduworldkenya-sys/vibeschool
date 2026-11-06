"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { vacancyApplication } from "@/lib/public/vacancyApplication";

type Vacancy = {
  id: string; title: string; school_name: string; county: string;
  location: string | null; employment_type: string | null;
  application_url: string | null; closing_date: string | null;
  description: string | null;
};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function TeachingJobs() {
  const [jobs, setJobs] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!url || !key) { if (active) { setError(true); setLoading(false); } return; }
      try {
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const today = new Date().toISOString().slice(0, 10);
        const { data, error: fetchError } = await client.from("teacher_vacancies")
          .select("id,title,school_name,county,location,employment_type,application_url,closing_date,description")
          .eq("status", "published").or(`closing_date.is.null,closing_date.gte.${today}`)
          .order("created_at", { ascending: false }).limit(50);
        if (fetchError) throw fetchError;
        if (active) setJobs((data ?? []) as Vacancy[]);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);
  const counties = useMemo(() => [...new Set(jobs.map(j => j.county).filter(Boolean))].sort(), [jobs]);
  const visible = useMemo(() => jobs.filter(j => {
    const term = query.trim().toLocaleLowerCase();
    return (!county || j.county === county) &&
      (!term || [j.title, j.school_name, j.county, j.location ?? "", j.description ?? ""].some(v => v.toLocaleLowerCase().includes(term)));
  }), [jobs, county, query]);
  return <div>
    {loading ? <p role="status">Loading current vacancies…</p> :
      error ? <p role="status">Vacancies are temporarily unavailable. Please try again later.</p> :
      jobs.length === 0 ? <p role="status">No approved teaching vacancies are listed right now.</p> :
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0" }}>
          <input aria-label="Search teaching vacancies" placeholder="Search jobs or schools" value={query} onChange={e => setQuery(e.target.value)}
            style={{ flex: "1 1 190px", minHeight: 44, padding: 10, border: "1px solid #8d9d93", borderRadius: 10, color: "#172b25", background: "#fff" }} />
          <select aria-label="Filter vacancies by county" value={county} onChange={e => setCounty(e.target.value)}
            style={{ minHeight: 44, padding: 10, border: "1px solid #8d9d93", borderRadius: 10, color: "#172b25", background: "#fff" }}>
            <option value="">All counties</option>
            {counties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {visible.length === 0 ? <p role="status">No vacancies match these filters.</p> :
          <div aria-label="Current teaching vacancies" style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", padding: "4px 0 12px" }}>
            {visible.map(j => <article key={j.id} style={{ flex: "0 0 min(78vw, 300px)", scrollSnapAlign: "start", padding: 18, border: "1px solid #8d9d93", borderRadius: 16 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{j.title}</h3>
              <p style={{ margin: "0 0 8px" }}>{j.school_name} · {j.county}</p>
              {j.location && <p style={{ margin: "0 0 8px" }}>{j.location}</p>}
              {j.employment_type && <p style={{ margin: "0 0 8px" }}>{j.employment_type}</p>}
              {j.closing_date && <p>Closes {j.closing_date}</p>}
              {j.description && <details style={{ margin: "12px 0" }}><summary style={{ cursor: "pointer", fontWeight: 600 }}>Job details</summary><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{j.description}</p></details>}
              {(() => {
                const application = vacancyApplication(j.application_url);
                return application && <a href={application.href} target={application.external ? "_blank" : undefined} rel={application.external ? "noopener noreferrer" : undefined} style={{ fontWeight: 700, textDecoration: "underline", overflowWrap: "anywhere" }}>{application.label}</a>;
              })()}
            </article>)}
          </div>}
      </>}
  </div>;
}

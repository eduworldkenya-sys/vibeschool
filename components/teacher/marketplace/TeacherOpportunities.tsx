"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import TeachingJobs from "@/app/teacher/TeachingJobs";
import { PublicSwap, SWAP_SELECT, swapListing, validListingId, provided } from "@/lib/public/teacherListings";
import ListingDetailDialog from "./ListingDetailDialog";
import ListingTabs from "./ListingTabs";
import FeaturedSwapStrip from "./FeaturedSwapStrip";
import styles from "./listingDetails.module.css";

function PublicSwaps() {
  const [rows, setRows] = useState<PublicSwap[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [retry, setRetry] = useState(0), [query, setQuery] = useState(""), [selected, setSelected] = useState<PublicSwap | null>(null), [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true); setError(false);
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error("Missing configuration");
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error: readError } = await client.from("teacher_swap_listings").select(SWAP_SELECT).eq("status", "published").order("created_at", { ascending: false }).limit(200);
        if (readError) throw readError;
        const swaps = (data ?? []) as PublicSwap[];
        const sharedId = new URLSearchParams(window.location.search).get("swap");
        if (validListingId(sharedId) && !swaps.some(row => row.id === sharedId)) {
          const { data: shared, error: sharedError } = await client.from("teacher_swap_listings").select(SWAP_SELECT).eq("id", sharedId).eq("status", "published").maybeSingle();
          if (sharedError) throw sharedError;
          if (shared) swaps.push(shared as PublicSwap);
        }
        if (active) setRows(swaps);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    function sync() {
      const id = new URLSearchParams(window.location.search).get("swap");
      setSelected(rows.find(row => row.id === id) ?? null); setUnavailable(!!id && !rows.some(row => row.id === id) && !loading && !error);
    }
    sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync);
  }, [rows, loading, error]);
  function open(row: PublicSwap) {
    const next = new URL(window.location.href); next.searchParams.set("swap", row.id); next.searchParams.delete("job");
    window.history.pushState(null, "", next); setSelected(row); setUnavailable(false);
  }
  function close() {
    const next = new URL(window.location.href); next.searchParams.delete("swap"); window.history.replaceState(null, "", next); setSelected(null); setUnavailable(false);
  }
  const visible = rows.filter(row => [row.current_county, row.current_subcounty, row.preferred_county, row.preferred_subcounty ?? "", row.subject, row.school_level, row.employment_sector ?? ""].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div>
    <p className={styles.status}>Find a possible match. Private messaging opens after both teachers agree.</p>
    {unavailable && <p role="status" className={styles.empty}>This swap is no longer available. <button type="button" onClick={close}>Dismiss</button></p>}
    {loading ? <p role="status">Loading available swaps…</p> : error ? <div role="alert"><p>Swaps are temporarily unavailable.</p><button type="button" className={styles.retry} onClick={() => setRetry(n => n + 1)}>Try again</button></div> : <>
      <div className={styles.filters}><input aria-label="Search teacher swaps" placeholder="Search counties, subjects or teaching level" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <FeaturedSwapStrip swaps={visible} onOpen={open} />
      {visible.length === 0 ? <p role="status" className={styles.empty}>No published swaps match yet. <a href="/login?redirect=%2Fteacher%2Fmarketplace%3Ftab%3Dswap">Sign in to post yours.</a></p> : <div className={styles.cards} aria-label="Current teacher swaps">{visible.map(row => <article className={styles.card} key={row.id}><button type="button" className={styles.cardButton} onClick={() => open(row)} aria-label={"View swap: " + row.current_county + " to " + row.preferred_county}><span className={styles.badge}>{row.employment_sector==="tsc"?"TSC swap":row.employment_sector==="private"?"Private-school move":"Teacher swap"}</span><h3>{row.current_county} → {row.preferred_county}</h3><p>{provided(row.current_subcounty)} · {provided(row.school_level)}</p><p>Subjects: {provided(row.subject)}</p><span className={styles.view}>View details →</span></button></article>)}</div>}
    </>}
    {selected && <ListingDetailDialog key={selected.id} listing={swapListing(selected)} onClose={close} interest={{ href: "/login?redirect=" + encodeURIComponent("/teacher/marketplace?swap=" + selected.id + "&interest=1") }} />}
  </div>;
}

export default function TeacherOpportunities() {
  const [tab, setTab] = useState<"jobs" | "swap">("jobs");
  useEffect(() => {
    const sync = () => { const params = new URLSearchParams(window.location.search); setTab(params.has("swap") || params.get("tab") === "swap" ? "swap" : "jobs"); };
    sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync);
  }, []);
  function choose(next: "jobs" | "swap") {
    setTab(next); const url = new URL(window.location.href); url.searchParams.delete("job"); url.searchParams.delete("swap"); url.searchParams.set("tab", next); window.history.replaceState(null, "", url);
  }
  return <div>
    <ListingTabs value={tab} onChange={choose} idPrefix="opportunities" />
    <section role="tabpanel" id={"opportunities-panel-" + tab} aria-labelledby={"opportunities-tab-" + tab}>{tab === "jobs" ? <TeachingJobs /> : <PublicSwaps />}</section>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { TeacherListing } from "@/lib/public/teacherListings";
import ListingDetailDialog from "./ListingDetailDialog";
import styles from "./listingDetails.module.css";

// Curated information-only opportunities. Never assign member identities or
// enable private messages until the relevant teacher registers independently.
const leads = [
  { id: "lead-1", from: "Narok", area: "Emurua Dikirr", to: "Nairobi", preferred: "Dagoretti North", level: "Primary", subject: "General Teaching" },
  { id: "lead-2", from: "Kisumu", area: "Muhoroni", to: "Kisumu", preferred: "Muhoroni, Nyakach, Kisumu Central", level: "Junior School", subject: "English / Literature" },
  { id: "lead-3", from: "Nakuru", area: "Naivasha", to: "Nakuru", preferred: "Gilgil, Bahati, Nakuru Town East, Rongai", level: "Senior Secondary", subject: "Mathematics / Business Studies" },
  { id: "lead-4", from: "Nakuru", area: "Nakuru Town East", to: "Kiambu, Murang’a", preferred: "Thika Town", level: "Senior Secondary", subject: "Biology / Chemistry" },
  { id: "lead-5", from: "Murang’a", area: "Kandara", to: "Murang’a", preferred: "Kandara", level: "Senior Secondary", subject: "Mathematics / Chemistry" },
  { id: "lead-6", from: "Busia", area: "Nambale", to: "Homa Bay, Kericho, Kisumu, Kisii", preferred: "Any", level: "Senior Secondary", subject: "Agriculture / Biology" },
] as const;

type Lead = (typeof leads)[number];
function leadListing(lead: Lead): TeacherListing {
  return {
    id: lead.id, kind: "swap", title: lead.from + " → " + lead.to,
    school: "Not provided", subtitle: lead.level + " · " + lead.subject,
    fields: [
      { label: "Current county", value: lead.from },
      { label: "Current sub-county", value: lead.area },
      { label: "Preferred county", value: lead.to },
      { label: "Preferred areas", value: lead.preferred },
      { label: "Teaching level", value: lead.level },
      { label: "Subjects", value: lead.subject },
      { label: "Availability", value: "Not confirmed" },
    ],
    details: "Community swap opportunity. The station preferences and teaching subjects are provided for discovery. Availability is not confirmed.",
    actions: [],
  };
}
export default function CommunitySwapLeads() {
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  useEffect(() => {
    const sync = () => {
      const id = new URLSearchParams(window.location.search).get("lead");
      setSelected(leads.find(l => l.id === id) ?? null);
    };
    sync(); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function open(lead: Lead) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "swap"); url.searchParams.set("lead", lead.id);
    window.history.pushState(null, "", url); setSelected(lead);
  }
  function close() {
    const url = new URL(window.location.href);
    url.searchParams.delete("lead"); window.history.replaceState(null, "", url);
    setSelected(null);
  }
  const cards = (duplicate: boolean) => leads.map(lead =>
    <article key={lead.id + (duplicate ? "-copy" : "")} className={styles.featuredCard} aria-hidden={duplicate || undefined}>
      <button className={styles.featuredButton} type="button" tabIndex={duplicate ? -1 : 0} onClick={() => open(lead)}>
        <span className={styles.badge}>Swap opportunity</span>
        <strong>{lead.from} → {lead.to}</strong>
        <span className={styles.featuredSchool}>{lead.level} · {lead.subject}</span>
        <span className={styles.view}>View details →</span>
      </button>
    </article>
  );
  const shareLink = selected && typeof window !== "undefined" ? (() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "swap"); url.searchParams.set("lead", selected.id);
    return url.href;
  })() : undefined;
  return <section className={styles.featured} aria-label="Swap opportunities">
    <div className={styles.featuredHeading}>
      <div><h3>Swap opportunities</h3><p>6 community opportunities · Availability not confirmed</p></div>
      <button type="button" className={styles.motionToggle} aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? "Resume movement" : "Pause movement"}</button>
    </div>
    <div className={styles.featuredViewport}><div className={styles.featuredTrack + " " + styles.featuredReverse + (paused ? " " + styles.featuredPaused : "")}>{cards(false)}{cards(true)}</div></div>
    {selected && <ListingDetailDialog key={selected.id} listing={leadListing(selected)} onClose={close} communityLead linkOverride={shareLink} />}
  </section>;
}

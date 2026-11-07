"use client";

import { useState } from "react";
import styles from "./listingDetails.module.css";

// Historical leads supplied for curation by the site owner. They have not
// been submitted by VibeSchool members; never represent them as verified,
// live, contactable offers or place them in teacher_swap_listings.
const leads = [
  { id: "lead-1", from: "Narok", area: "Emurua Dikirr", to: "Nairobi", preferred: "Dagoretti North", level: "Primary", subject: "General Teaching" },
  { id: "lead-2", from: "Kisumu", area: "Muhoroni", to: "Kisumu", preferred: "Muhoroni, Nyakach, Kisumu Central", level: "Junior School", subject: "English / Literature" },
  { id: "lead-3", from: "Nakuru", area: "Naivasha", to: "Nakuru", preferred: "Gilgil, Bahati, Nakuru Town East, Rongai", level: "Senior Secondary", subject: "Mathematics / Business Studies" },
  { id: "lead-4", from: "Nakuru", area: "Nakuru Town East", to: "Kiambu, Murang’a", preferred: "Thika Town", level: "Senior Secondary", subject: "Biology / Chemistry" },
  { id: "lead-5", from: "Murang’a", area: "Kandara", to: "Murang’a", preferred: "Kandara", level: "Senior Secondary", subject: "Mathematics / Chemistry" },
  { id: "lead-6", from: "Busia", area: "Nambale", to: "Homa Bay, Kericho, Kisumu, Kisii", preferred: "Any", level: "Senior Secondary", subject: "Agriculture / Biology" },
] as const;

export default function CommunitySwapLeads() {
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<(typeof leads)[number] | null>(null);
  const cards = (duplicate: boolean) => leads.map(lead =>
    <article key={lead.id + (duplicate ? "-copy" : "")} className={styles.featuredCard} aria-hidden={duplicate || undefined}>
      <button className={styles.featuredButton} type="button" tabIndex={duplicate ? -1 : 0} onClick={() => setSelected(lead)}>
        <span className={styles.badge}>Community lead · unconfirmed</span>
        <strong>{lead.from} → {lead.to}</strong>
        <span className={styles.featuredSchool}>{lead.level} · {lead.subject}</span>
        <span className={styles.view}>View details →</span>
      </button>
    </article>
  );
  return <section className={styles.featured} aria-label="Community swap leads">
    <div className={styles.featuredHeading}>
      <div><h3>Swap opportunities</h3><p>6 community leads · Availability not confirmed</p></div>
      <button type="button" className={styles.motionToggle} aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? "Resume movement" : "Pause movement"}</button>
    </div>
    <div className={styles.featuredViewport}><div className={styles.featuredTrack + " " + styles.featuredReverse + (paused ? " " + styles.featuredPaused : "")}>{cards(false)}{cards(true)}</div></div>
    {selected && <div className={styles.note} role="region" aria-label="Community lead details">
      <strong>{selected.from} → {selected.to}</strong>
      <p>Current area: {selected.area} · Preferred area: {selected.preferred}</p>
      <p>{selected.level} · {selected.subject}</p>
      <p>Unconfirmed community lead. No registered VibeSchool teacher is linked to this item; contact and interest requests are unavailable until the teacher posts a listing.</p>
      <button type="button" className={styles.secondary} onClick={() => setSelected(null)}>Close details</button>
    </div>}
  </section>;
}

"use client";

import { useState } from "react";
import styles from "./listingDetails.module.css";

// Source-attributed public examples supplied by the site owner from SwapKenya screenshots.
// These are not VibeSchool member accounts or verified VibeSchool swap offers.
// Never copy third-party personal contact details or open VibeSchool private messaging.
type ExternalSwap = {
  reference: string;
  name: string;
  current: string;
  currentSubcounty: string;
  school: string;
  desired: string;
  desiredAreas: string;
  level: string;
  subjects: string;
  listed: string;
  original?: string;
};
const examples: ExternalSwap[] = [
  {
    reference: "TSE202611044597", name: "Maria Ken", current: "Narok",
    currentSubcounty: "Emurua Dikirr", school: "Not provided",
    desired: "Nairobi", desiredAreas: "Dagoretti North", level: "Primary",
    subjects: "General Teaching", listed: "4 Nov 2026",
    original: "https://swapkenya.com/swap/TSE202611044597",
  },
  {
    reference: "TSE202611060887", name: "Nancy Aluoch", current: "Kisumu",
    currentSubcounty: "Muhoroni", school: "Ogwedhi Primary",
    desired: "Kisumu", desiredAreas: "Muhoroni, Nyakach, Kisumu Central",
    level: "Junior School", subjects: "English / Literature", listed: "5 Nov 2026",
  },
  {
    reference: "TSE202611019870", name: "Mary Kimani", current: "Nakuru",
    currentSubcounty: "Naivasha", school: "Ngeya Girls Secondary School",
    desired: "Nakuru", desiredAreas: "Gilgil, Bahati, Nakuru Town East, Rongai",
    level: "Senior Secondary", subjects: "Mathematics / Business Studies", listed: "1 Nov 2026",
  },
  {
    reference: "TSE202610315966", name: "Mark Okeyo", current: "Busia",
    currentSubcounty: "Nambale", school: "Musokoto Secondary School",
    desired: "Homa Bay, Kericho, Kisumu, Kisii", desiredAreas: "Any",
    level: "Senior Secondary", subjects: "Agriculture / Biology", listed: "31 Oct 2026",
  },
];

export default function ExternalSwapReferences() {
  const [open, setOpen] = useState(false);
  return <section aria-label="SwapKenya public swap references">
    <div className={styles.featuredHeading}>
      <div><h3>Other public swap requests</h3><p>4 examples shared from SwapKenya · Source details, not VibeSchool listings</p></div>
    </div>
    <button type="button" className={styles.retry} aria-expanded={open} aria-controls="external-swap-references" onClick={() => setOpen(value => !value)}>{open ? "Hide external swaps" : "View 4 external swaps"}</button>
    {open && <div id="external-swap-references" className={styles.cards}>
      {examples.map(swap => <article className={styles.card} key={swap.reference}>
        <div className={styles.cardButton} style={{cursor: "default"}}>
          <span className={styles.badge}>From SwapKenya · External</span>
          <h3>{swap.current} → {swap.desired}</h3>
          <p>{swap.name} · {swap.level}</p>
          <p>{swap.subjects}</p>
          <details style={{width: "100%"}}>
            <summary className={styles.view} style={{cursor: "pointer"}}>View details</summary>
            <dl className={styles.fields} style={{display: "block"}}>
              <div><dt>Current county</dt><dd>{swap.current}</dd></div>
              <div><dt>Current sub-county</dt><dd>{swap.currentSubcounty}</dd></div>
              <div><dt>Current school</dt><dd>{swap.school}</dd></div>
              <div><dt>Desired county</dt><dd>{swap.desired}</dd></div>
              <div><dt>Preferred areas</dt><dd>{swap.desiredAreas}</dd></div>
              <div><dt>Teaching level</dt><dd>{swap.level}</dd></div>
              <div><dt>Subjects</dt><dd>{swap.subjects}</dd></div>
              <div><dt>Source listing date</dt><dd>{swap.listed}</dd></div>
              <div><dt>Source reference</dt><dd>{swap.reference}</dd></div>
            </dl>
            <p>Source information has not been independently verified by VibeSchool. Contact and requests remain on the original platform.</p>
            <a href={swap.original ?? "https://swapkenya.com/"} target="_blank" rel="noopener noreferrer" className={styles.view}>View on SwapKenya</a>
          </details>
        </div>
      </article>)}
    </div>}
  </section>;
}

"use client";

import { useEffect, useRef, useState } from "react";
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
    reference: "TSE202610294559", name: "Edward Karanja", current: "Nakuru",
    currentSubcounty: "Nakuru Town East", school: "Langalanga Secondary School",
    desired: "Kiambu, Murang’a", desiredAreas: "Thika Town",
    level: "Senior Secondary", subjects: "Biology / Chemistry", listed: "29 Oct 2026",
  },
  {
    reference: "TSE202610290630", name: "James Kuria", current: "Murang’a",
    currentSubcounty: "Kandara", school: "Kirirwa Secondary School",
    desired: "Murang’a", desiredAreas: "Kandara",
    level: "Senior Secondary", subjects: "Mathematics / Chemistry", listed: "29 Oct 2026",
  },
  {
    reference: "TSE202610315966", name: "Mark Okeyo", current: "Busia",
    currentSubcounty: "Nambale", school: "Musokoto Secondary School",
    desired: "Homa Bay, Kericho, Kisumu, Kisii", desiredAreas: "Any",
    level: "Senior Secondary", subjects: "Agriculture / Biology", listed: "31 Oct 2026",
  },
];

export const externalSwapCount = examples.length;
export function findExternalSwaps(query: string) {
  const term = query.trim().toLocaleLowerCase();
  return examples.filter(swap => !term || [
    swap.name, swap.reference, swap.current, swap.currentSubcounty, swap.school,
    swap.desired, swap.desiredAreas, swap.level, swap.subjects,
  ].some(value => value.toLocaleLowerCase().includes(term)));
}

function ExternalSwapDialog({ swap, onClose }: { swap: ExternalSwap; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = oldOverflow; previouslyFocused?.focus(); };
  }, []);
  const fields = [
    ["Current county", swap.current], ["Current sub-county", swap.currentSubcounty],
    ["Current school", swap.school], ["Desired county", swap.desired],
    ["Preferred areas", swap.desiredAreas], ["Teaching level", swap.level],
    ["Subjects", swap.subjects], ["Source listing date", swap.listed],
    ["SwapKenya reference", swap.reference],
  ];
  return <dialog ref={dialogRef} aria-modal="true" aria-label={swap.name + " swap details"}
    className={styles.dialog} onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={styles.dialogHeader}>
      <div><span className={styles.eyebrow}>SWAPKENYA · EXTERNAL SOURCE</span><h2>{swap.name}</h2><p>{swap.level} · {swap.subjects}</p></div>
      <button type="button" autoFocus className={styles.close} aria-label="Close listing" onClick={onClose}>×</button>
    </header>
    <div className={styles.dialogBody}>
      <div className={styles.swapRoute}>
        <div><small>CURRENT STATION</small><strong>{swap.current}</strong><span>{swap.currentSubcounty}</span></div>
        <span aria-hidden="true">→</span>
        <div><small>DESIRED DESTINATION</small><strong>{swap.desired}</strong><span>{swap.desiredAreas}</span></div>
      </div>
      <h3>Career and station details</h3>
      <dl className={styles.fields}>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className={styles.note}>From a user-supplied SwapKenya listing. VibeSchool has not verified the teacher, current availability or transfer eligibility. Contact and applications stay with SwapKenya.</p>
    </div>
    <footer className={styles.dialogFooter}>
      {swap.original && <a className={styles.primary} href={swap.original} target="_blank" rel="noopener noreferrer">Open original listing</a>}
      <button type="button" className={styles.secondary} onClick={onClose}>Back to swaps</button>
    </footer>
  </dialog>;
}

export default function ExternalSwapReferences({ query = "" }: { query?: string }) {
  const [selected, setSelected] = useState<ExternalSwap | null>(null);
  const visible = findExternalSwaps(query);
  return <section aria-label="SwapKenya public swap references">
    <div className={styles.featuredHeading}>
      <div><h3>Recent swap requests</h3><p>{visible.length} of {examples.length} shared from SwapKenya · External, not VibeSchool-verified</p></div>
    </div>
    {visible.length > 0 && <div className={styles.cards} aria-label="External teacher swap requests">
      {visible.map(swap => <article className={styles.card} key={swap.reference}>
        <button type="button" className={styles.cardButton} onClick={() => setSelected(swap)} aria-label={`View swap: ${swap.name}, ${swap.current} to ${swap.desired}`}>
          <span className={styles.badge}>SwapKenya · External</span>
          <h3>{swap.current} → {swap.desired}</h3>
          <p><strong>{swap.name}</strong> · {swap.level}</p>
          <p>{swap.school !== "Not provided" ? swap.school + " · " : ""}{swap.currentSubcounty}</p>
          <p>{swap.subjects}</p>
          <span className={styles.view}>View details →</span>
        </button>
      </article>)}
    </div>}
    {selected && <ExternalSwapDialog key={selected.reference} swap={selected} onClose={() => setSelected(null)} />}
  </section>;
}

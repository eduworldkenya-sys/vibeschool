"use client";
import { useRef } from "react";
import styles from "./listingDetails.module.css";

export default function ListingTabs({ value, onChange, idPrefix }: { value: "jobs" | "swap"; onChange: (value: "jobs" | "swap") => void; idPrefix: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className={styles.tabs} role="tablist" aria-label="Teacher opportunities">{(["jobs", "swap"] as const).map((tab, i) => <button key={tab} ref={node => { refs.current[i] = node; }} id={idPrefix + "-tab-" + tab} type="button" role="tab" aria-selected={value === tab} aria-controls={idPrefix + "-panel-" + tab} tabIndex={value === tab ? 0 : -1} onClick={() => onChange(tab)} onKeyDown={e => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault(); const index = e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - i;
    onChange(index === 0 ? "jobs" : "swap"); refs.current[index]?.focus();
  }}>{tab === "jobs" ? "Jobs" : "Swaps"}</button>)}</div>;
}

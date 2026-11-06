"use client";

import { useState } from "react";
import { PublicSwap } from "@/lib/public/teacherListings";
import styles from "./listingDetails.module.css";

type MatchProfile = Pick<PublicSwap, "current_county" | "preferred_county" | "current_subcounty" | "preferred_subcounty" | "school_level" | "subject" | "employment_sector">;
function clean(value: string | null | undefined) { return (value ?? "").trim().toLocaleLowerCase(); }
export function swapMatchScore(candidate: PublicSwap, mine?: MatchProfile | null): number {
  if (!mine) return 0;
  if (mine.employment_sector && candidate.employment_sector && mine.employment_sector !== "unspecified" && candidate.employment_sector !== "unspecified" && mine.employment_sector !== candidate.employment_sector) return 0;
  if (clean(candidate.current_county) !== clean(mine.preferred_county) || clean(candidate.preferred_county) !== clean(mine.current_county)) return 0;
  let score = 2;
  if (clean(candidate.school_level) === clean(mine.school_level)) score += 2;
  if (clean(candidate.subject) && clean(mine.subject) && clean(candidate.subject) === clean(mine.subject)) score++;
  if (clean(mine.preferred_subcounty) && clean(candidate.current_subcounty) === clean(mine.preferred_subcounty)) score++;
  if (clean(candidate.preferred_subcounty) && clean(mine.current_subcounty) === clean(candidate.preferred_subcounty)) score++;
  return score;
}
export default function FeaturedSwapStrip<T extends PublicSwap>({ swaps, onOpen, mine }: { swaps: T[]; onOpen: (swap: T) => void; mine?: MatchProfile | null }) {
  const [paused, setPaused] = useState(false);
  const featured = [...swaps].sort((a, b) => {
    const matching = swapMatchScore(b, mine) - swapMatchScore(a, mine);
    const recent = Date.parse(b.created_at) - Date.parse(a.created_at);
    return matching || (Number.isFinite(recent) ? recent : 0) || a.id.localeCompare(b.id);
  }).slice(0, 6);
  if (featured.length === 0) return null;
  const renderCards = (copy: boolean) => featured.map(swap => <article key={(copy ? "copy-" : "item-") + swap.id} className={styles.featuredCard} aria-hidden={copy || undefined}>
    <button type="button" tabIndex={copy ? -1 : 0} className={styles.featuredButton} onClick={() => onOpen(swap)} aria-label={`View featured swap: ${swap.current_county} to ${swap.preferred_county}`}>
      <span className={styles.badge}>{swapMatchScore(swap, mine) >= 4 ? "Possible reciprocal match" : swap.employment_sector === "tsc" ? "TSC swap" : swap.employment_sector === "private" ? "Private-school move" : "Teacher swap"}</span>
      <strong>{swap.current_county} → {swap.preferred_county}</strong>
      <span className={styles.featuredSchool}>{swap.school_level}{clean(swap.subject) ? " · " + swap.subject : ""}</span>
      <span className={styles.view}>View details →</span>
    </button>
  </article>);
  return <section className={styles.featured} aria-labelledby="featured-swaps-title">
    <div className={styles.featuredHeading}>
      <div><p className={styles.badge}>DISCOVER</p><h3 id="featured-swaps-title">Featured swaps</h3><p>Possible matches and recently posted requests</p></div>
      <button type="button" className={styles.motionToggle} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Resume movement" : "Pause movement"}</button>
    </div>
    <div className={styles.featuredViewport}><div className={styles.featuredTrack + (paused || featured.length === 1 ? " " + styles.featuredPaused : "")}>{renderCards(false)}{featured.length > 1 && renderCards(true)}</div></div>
  </section>;
}

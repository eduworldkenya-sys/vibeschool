"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { TeacherListing, listingText, listingUrl } from "@/lib/public/teacherListings";
import styles from "./listingDetails.module.css";

type Props = { listing: TeacherListing; onClose: () => void; interest?: { href?: string; onClick?: () => void; disabled?: boolean; label?: string } };

export default function ListingDetailDialog({ listing, onClose, interest }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [notice, setNotice] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [copyLink, setCopyLink] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; returnFocus?.focus(); };
  }, []);
  const url = () => listingUrl(listing.kind, listing.id, window.location.origin);
  async function share() {
    setNotice("");
    try {
      if (navigator.share) { await navigator.share({ title: listing.title, text: listingText(listing), url: url() }); return; }
      await navigator.clipboard.writeText(listingText(listing) + "\n" + url());
      setNotice("Listing copied. Share it anywhere.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setCopyLink(url()); setNotice("Copy the listing link below to share.");
    }
  }
  async function download() {
    setDownloadBusy(true); setNotice("");
    try {
      const { createListingPdf } = await import("@/lib/public/listingPdf");
      const doc = await createListingPdf(listing, url());
      doc.save(`vibeschool-${listing.kind}-${listing.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}.pdf`);
      setNotice("PDF downloaded.");
    } catch { setNotice("Could not download. Please try again."); }
    finally { setDownloadBusy(false); }
  }
  return <dialog ref={dialogRef} className={styles.dialog} aria-modal="true" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <header className={styles.dialogHeader}><div><span className={styles.eyebrow}>VIBESCHOOL · {listing.kind === "job" ? "SCHOOL JOB" : "TEACHER SWAP"}</span><h2 id={titleId}>{listing.title}</h2></div><button type="button" autoFocus className={styles.close} aria-label="Close listing" onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
    <div className={styles.dialogBody}>
      <dl className={styles.fields}>{listing.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
      <section className={styles.advert} aria-label="Full advert and requirements"><h3>Full advert &amp; requirements</h3><p>{listing.details}</p></section>
      {listing.kind === "swap" && <p className={styles.note}>Private messaging opens after both teachers connect. A match is not official TSC transfer approval.</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {copyLink && <label className={styles.copyLink}>Listing link<input readOnly value={copyLink} onFocus={e => e.currentTarget.select()} /></label>}
    </div>
    <footer className={styles.dialogFooter}>
      {listing.actions.map((action, index) => <a key={action.href} className={index === 0 ? styles.primary : styles.secondary} href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noopener noreferrer" : undefined}>{action.label}</a>)}
      {interest && (interest.href ? <a className={styles.primary} href={interest.href}>{interest.label ?? "Express interest"}</a> : <button type="button" className={styles.primary} onClick={interest.onClick} disabled={interest.disabled}>{interest.label ?? "Express interest"}</button>)}
      <button type="button" className={styles.secondary} onClick={() => void share()}><Share2 size={17} aria-hidden="true" /> Share</button>
      <button type="button" className={styles.secondary} onClick={() => void download()} disabled={downloadBusy}><Download size={17} aria-hidden="true" />{downloadBusy ? "Preparing PDF…" : "Download PDF"}</button>
    </footer>
  </dialog>;
}

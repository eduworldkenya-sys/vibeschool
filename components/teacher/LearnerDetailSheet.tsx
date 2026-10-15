"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./LearnerDetailSheet.module.css";

export default function LearnerDetailSheet({ title, learnerName, children, onClose, busy = false }: {
  title: string; learnerName: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} className={styles.sheet} aria-label={`${title} · ${learnerName}`}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className={styles.header}><div><small>{learnerName}</small><h2>{title}</h2></div>
      <button type="button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}><X size={20}/></button>
    </header>
    <div className={styles.body}>{children}</div>
  </dialog>;
}

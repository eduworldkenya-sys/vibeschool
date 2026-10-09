'use client'

import { CSSProperties, useEffect, useRef } from "react";
import { X } from "lucide-react";

export const C = {
  bg:          "#ffffff",
  surface:     "#f5f6f2",
  accent:      "#087451",
  accentLight: "#e9f4ed",
  textPrimary: "#1c2923",
  textMuted:   "#627168",
  error:       "#b42318",
  warning:     "#946200",
  dark:        "#1c2923",
  border:      "#dfe5de",
  shadow:      "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
};

interface CardProps {
  children: React.ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}
export function Card({ children, style = {}, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={event => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}
      style={{
        background: C.bg, borderRadius: 16, boxShadow: C.shadow,
        border: `1px solid ${C.border}`, padding: "18px 18px", marginBottom: 14,
        cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.18s", ...style,
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)")}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = C.shadow)}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, style = {} }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, color: C.textMuted,
      letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 12, ...style,
    }}>
      {children}
    </div>
  );
}

type BtnVariant = "primary" | "ghost" | "muted" | "danger" | "dark";
interface BtnProps {
  children: React.ReactNode;
  variant?: BtnVariant;
  onClick?: () => void;
  small?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
}
export function Btn({ children, variant = "primary", onClick, small, style = {}, disabled, ariaLabel }: BtnProps) {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    minHeight: 44,
    padding: small ? "7px 12px" : "10px 18px",
    borderRadius: 10, border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", fontWeight: 700,
    fontSize: small ? 12 : 13,
    transition: "opacity 0.15s, transform 0.15s",
    opacity: disabled ? 0.5 : 1,
    touchAction: "manipulation",
    ...style,
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: C.accent,      color: "#fff" },
    ghost:   { background: "transparent", color: C.accent, border: `1.5px solid ${C.accent}` },
    muted:   { background: C.surface,     color: C.textPrimary },
    danger:  { background: "#fee2e2",     color: "#991b1b" },
    dark:    { background: C.dark,        color: "#fff" },
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      style={{ ...base, ...variants[variant] }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "0.82")}
      onMouseLeave={e => (e.currentTarget.style.opacity = disabled ? "0.5" : "1")}
    >
      {children}
    </button>
  );
}

interface AvatarProps {
  initials: string;
  size?: number;
  bg?: string;
  color?: string;
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
}
export function Avatar({ initials, size = 36, bg = C.accent, color = "#fff", style = {}, onClick, ariaLabel = "Open profile" }: AvatarProps) {
  const visual: CSSProperties = {
    width: size, height: size, minWidth: size, minHeight: size, borderRadius: "50%", background: bg,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.36, fontWeight: 800, color, flexShrink: 0,
    cursor: onClick ? "pointer" : "default", padding: 0, ...style,
  };

  if (onClick) {
    return (
      <button type="button" aria-label={ariaLabel} onClick={onClick} style={{ ...visual, border: "none", fontFamily: "inherit", touchAction: "manipulation" }}>
        {initials}
      </button>
    );
  }

  return <div aria-hidden="true" style={visual}>{initials}</div>;
}

export function ReadinessChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    green: { bg: "#e9f4ed", color: "#065f46", label: "Ready"     },
    amber: { bg: "#fef3c7", color: "#92400e", label: "Resource"  },
    red:   { bg: "#fee2e2", color: "#991b1b", label: "No Plan"   },
    grey:  { bg: "#f3f4f6", color: "#627168", label: "Cancelled" },
  };
  const s = map[status] || map.grey;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export function SeverityBadge({ sev }: { sev: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: "#fee2e2", color: "#991b1b" },
    high:     { bg: "#fef3c7", color: "#92400e" },
    medium:   { bg: "#e0f2fe", color: "#075985" },
    low:      { bg: "#f3f4f6", color: "#627168" },
  };
  const s = map[sev] || map.low;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {sev}
    </span>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') ?? []).filter(control => control.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="teacher-modal-backdrop" onClick={onClose}>
    <div ref={dialog} className="teacher-modal" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
      <header><h2>{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={onClose} className="teacher-icon-button"><X size={20}/></button></header>
      {children}
    </div>
  </div>;
}

export function TwinDot({ delay = 0 }: { delay?: number }) {
  return (
    <span aria-hidden="true" style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: C.accent, margin: "0 2px",
      animation: `twinPulse 1.4s ease-in-out ${delay}s infinite`,
    }} />
  );
}


/**
 * Shared compact Teacher OS primitives.
 * Mirrors the Assessment workspace visual hierarchy without coupling pages
 * to its CSS module. New screens can adopt these incrementally.
 */
export const TEACHER_UI = {
  green: "#087d57",
  greenSoft: "#e4f8ef",
  ink: "#17211b",
  muted: "#657069",
  border: "#e0e7e3",
  canvas: "#f7f9f8",
  radius: 16,
} as const;

export function TeacherWorkspace({
  children,
  title,
  eyebrow,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="vs-teacher-workspace">
      <header className="vs-teacher-workspace__header">
        <div>
          {eyebrow && <p className="vs-teacher-workspace__eyebrow">{eyebrow}</p>}
          <h1 className="vs-teacher-workspace__title">{title}</h1>
        </div>
        {actions && <div className="vs-teacher-workspace__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function TeacherActionTile({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <a className="vs-teacher-action-tile" href={href}>
      <span className="vs-teacher-action-tile__icon" aria-hidden="true">{icon}</span>
      <strong>{label}</strong>
      {description && <span className="vs-teacher-action-tile__description">{description}</span>}
    </a>
  );
}

export function TeacherMetric({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="vs-teacher-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

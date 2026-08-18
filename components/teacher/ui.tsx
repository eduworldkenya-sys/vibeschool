'use client'

import { CSSProperties } from "react";

export const C = {
  bg:          "#ffffff",
  surface:     "#f8f9fa",
  accent:      "#10b981",
  accentLight: "#d1fae5",
  textPrimary: "#111827",
  textMuted:   "#6b7280",
  error:       "#ef4444",
  warning:     "#f59e0b",
  dark:        "#1e1b4b",
  border:      "#e5e7eb",
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
    minHeight: small ? 36 : 44,
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
    green: { bg: "#d1fae5", color: "#065f46", label: "Ready"     },
    amber: { bg: "#fef3c7", color: "#92400e", label: "Resource"  },
    red:   { bg: "#fee2e2", color: "#991b1b", label: "No Plan"   },
    grey:  { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
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
    low:      { bg: "#f3f4f6", color: "#6b7280" },
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
  if (!open) return null;
  return (
    <div
      role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", width: "100%", maxWidth: 520, padding: "26px 26px 22px", position: "relative", maxHeight: "85vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary }}>{title}</span>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose} style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", borderRadius: 10, fontSize: 24, cursor: "pointer", color: C.textMuted }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
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

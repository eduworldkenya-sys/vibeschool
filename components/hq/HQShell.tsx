"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import HQNotificationCenter from "@/components/hq/NotificationCenter"

export const HQ_THEME = {
  bg: "#07111f",
  panel: "#0d1b2f",
  panelSoft: "rgba(255,255,255,.025)",
  border: "rgba(255,255,255,.09)",
  text: "#f8fafc",
  muted: "rgba(255,255,255,.5)",
  green: "#34d399",
  blue: "#60a5fa",
  amber: "#f59e0b",
  red: "#fb7185",
  violet: "#a78bfa",
} as const

const links = [
  ["HQ", "/hq"],
  ["Signals", "/hq/notifications"],
  ["Users", "/hq/users"],
  ["Schools", "/hq/schools"],
  ["Billing", "/hq/billing"],
  ["Marketing", "/hq/marketing"],
  ["Security", "/hq/security"],
  ["Workroom", "/hq/workroom"],
  ["Workforce", "/hq/workforce"],
  ["Departments", "/hq/departments"],
  ["Decisions", "/hq/decisions"],
  ["Studio", "/hq/studio"],
  ["Publishing", "/hq/content"],
  ["Content Engine", "/hq/curriculum-intelligence/engine"],
  ["Curriculum Authority", "/hq/curriculum-authority"],
  ["Analytics", "/hq/analytics"],
] as const

export function HQNavigation() {
  const pathname = usePathname()

  return (
    <nav aria-label="HQ owner navigation" className="hq-nav">
      <div className="hq-nav-inner">
        <Link href="/hq" className="hq-brand" aria-label="VibeSchool HQ home">
          <span className="hq-brand-mark">V</span>
          <span>HQ</span>
        </Link>
        <div className="hq-nav-scroll">
          {links.map(([label, href]) => {
            const active = href === "/hq" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`hq-nav-link${active ? " is-active" : ""}`}
              >
                {label}
              </Link>
            )
          })}
        </div>
        <div className="hq-nav-alerts">
          <HQNotificationCenter />
        </div>
      </div>
    </nav>
  )
}

export function HQPage({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="hq-page">
      <div className="hq-container">
        <header className="hq-page-header">
          <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="hq-page-actions">{actions}</div>}
        </header>
        {children}
      </div>
    </main>
  )
}

export function HQPanel({
  title,
  description,
  children,
  className = "",
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`hq-panel ${className}`}>
      {(title || description) && (
        <header className="hq-panel-header">
          {title && <h2>{title}</h2>}
          {description && <p>{description}</p>}
        </header>
      )}
      <div className="hq-panel-body">{children}</div>
    </section>
  )
}

export const hqButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${HQ_THEME.border}`,
  background: "rgba(255,255,255,.045)",
  color: HQ_THEME.text,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
}

export function HQStyles() {
  return (
    <style jsx global>{`
      :root{--hq-bg:#07111f;--hq-panel:#0d1b2f;--hq-border:rgba(255,255,255,.09);--hq-text:#f8fafc;--hq-muted:rgba(255,255,255,.5);--hq-green:#34d399;--hq-blue:#60a5fa;--hq-amber:#f59e0b;--hq-red:#fb7185}
      .hq-nav{position:sticky;top:0;z-index:100;background:rgba(7,17,31,.96);backdrop-filter:blur(18px);border-bottom:1px solid var(--hq-border);font-family:Inter,system-ui,sans-serif}
      .hq-nav-inner{max-width:1240px;margin:auto;display:flex;align-items:center;gap:12px;padding:8px 14px}
      .hq-brand{display:flex;align-items:center;gap:7px;color:var(--hq-text);text-decoration:none;font-size:12px;font-weight:950;flex:none}
      .hq-brand-mark{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:var(--hq-green);color:#05251a;font-size:13px}
      .hq-nav-scroll{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;min-width:0;flex:1}
      .hq-nav-scroll::-webkit-scrollbar{display:none}
      .hq-nav-link{white-space:nowrap;padding:8px 10px;border-radius:9px;color:rgba(248,250,252,.64);font-size:11px;font-weight:800;text-decoration:none;border:1px solid transparent}
      .hq-nav-link:hover{color:var(--hq-text);background:rgba(255,255,255,.04)}
      .hq-nav-link.is-active{color:var(--hq-text);background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.24)}
      .hq-nav-alerts{flex:none;display:flex;align-items:center}
      .hq-page{min-height:100dvh;background:var(--hq-bg);color:var(--hq-text);font-family:Inter,system-ui,sans-serif}
      .hq-container{max-width:1220px;margin:auto;padding:22px 18px 80px}
      .hq-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
      .hq-page-header h1{margin:0;font-size:clamp(22px,3vw,30px);letter-spacing:-.03em}
      .hq-page-header p{margin:6px 0 0;color:var(--hq-muted);font-size:12px;line-height:1.5}
      .hq-page-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .hq-panel{border:1px solid var(--hq-border);border-radius:16px;background:rgba(255,255,255,.025);overflow:hidden}
      .hq-panel-header{padding:14px 16px;border-bottom:1px solid var(--hq-border)}
      .hq-panel-header h2{margin:0;font-size:13px}
      .hq-panel-header p{margin:4px 0 0;color:var(--hq-muted);font-size:11px}
      .hq-panel-body{min-width:0}
      .hq-mobile-stack{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
      @media(max-width:720px){
        .hq-nav-inner{padding:7px 10px;gap:8px}
        .hq-brand span:last-child{display:none}
        .hq-nav-alerts button{min-width:38px;padding:0 8px;font-size:0}
        .hq-nav-alerts button::before{content:"!";font-size:12px;font-weight:950}
        .hq-container{padding:16px 12px 64px}
        .hq-page-header{display:block}
        .hq-page-actions{margin-top:12px;justify-content:flex-start}
        .hq-mobile-stack{grid-template-columns:1fr}
        .hq-panel{border-radius:13px}
      }
    `}</style>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import HQNotificationCenter from "@/components/hq/NotificationCenter"

export const HQ_THEME = {
  bg: "#06101d", panel: "#0b1728", panelSoft: "#0e1d31", border: "rgba(148,163,184,.13)", text: "#f8fafc", muted: "#8fa2ba", green: "#22c55e", blue: "#3b82f6", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6", cyan: "#06b6d4",
} as const

type NavItem = readonly [string,string,string]
type NavGroup = {label:string;items:readonly NavItem[]}
const navGroups: readonly NavGroup[] = [
  {label:"Company",items:[["Home","/hq","⌂"],["Decisions","/hq/decisions","✓"],["Company Intelligence","/hq/intelligence","◈"]]},
  {label:"Product",items:[["Product & Schools","/hq/product","◎"],["Users","/hq/users","♙"],["Executive metrics","/hq/analytics","↗"]]},
  {label:"Content",items:[["Content","/hq/content","▣"],["Curriculum Authority","/hq/curriculum-authority","A"],["Content Factory","/hq/curriculum-intelligence/engine","✦"]]},
  {label:"Company systems",items:[["Revenue","/hq/billing","$"],["System","/hq/security","◇"],["Workforce","/hq/workforce","⚙"],["Commissioning","/hq/workforce/readiness","✓"]]},
]

const mobileLinks: readonly NavItem[] = [
  ["Home","/hq","⌂"], ["Decisions","/hq/decisions","✓"], ["Alerts","/hq/notifications","!"], ["Operations","/hq/intelligence","◈"], ["More","/hq/more","≡"],
]

function isActive(pathname:string,href:string){return href==="/hq"?pathname===href:pathname===href||pathname.startsWith(`${href}/`)}

export function HQNavigation(){
  const pathname=usePathname()
  return <>
    <aside className="hq-sidebar" aria-label="HQ owner navigation">
      <Link href="/hq" className="hq-side-brand" aria-label="VibeSchool HQ home"><span className="hq-side-logo">V</span><span><strong>VibeSchool HQ</strong><small>Company Operating System</small></span></Link>
      <div className="hq-side-scroll">{navGroups.map(group=><section key={group.label} className="hq-side-group"><div className="hq-side-group-label">{group.label}</div>{group.items.map(([label,href,icon])=>{const active=isActive(pathname,href);return <Link key={`${label}-${href}`} href={href} className={`hq-side-link${active?" is-active":""}`} aria-current={active?"page":undefined}><span className="hq-side-icon" aria-hidden>{icon}</span><span>{label}</span></Link>})}</section>)}</div>
      <div className="hq-side-owner"><span className="hq-owner-avatar">F</span><span><strong>Founder</strong><small>System Owner</small></span><span className="hq-owner-chevron">⌄</span></div>
    </aside>
    <header className="hq-mobile-topbar"><Link href="/hq" className="hq-mobile-brand"><span className="hq-side-logo">V</span><strong>VibeSchool HQ</strong><i>Owner</i></Link><HQNotificationCenter /></header>
    <nav className="hq-bottom-nav" aria-label="HQ mobile navigation">{mobileLinks.map(([label,href,icon])=>{const active=isActive(pathname,href);return <Link key={label} href={href} aria-current={active?"page":undefined} className={`hq-bottom-link${active?" is-active":""}`}><span className="hq-bottom-icon" aria-hidden>{icon}</span><span>{label}</span></Link>})}</nav>
  </>
}

export function HQPage({title,description,actions,children}:{title:string;description?:string;actions?:ReactNode;children:ReactNode}){
  return <main className="hq-page"><div className="hq-container"><header className="hq-page-header"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="hq-page-actions">{actions}</div>}</header>{children}</div></main>
}

export function HQPanel({title,description,children,className=""}:{title?:string;description?:string;children:ReactNode;className?:string}){
  return <section className={`hq-panel ${className}`}>{(title||description)&&<header className="hq-panel-header">{title&&<h2>{title}</h2>}{description&&<p>{description}</p>}</header>}<div className="hq-panel-body">{children}</div></section>
}

export const hqButtonStyle:CSSProperties={minHeight:44,padding:"0 14px",borderRadius:10,border:`1px solid ${HQ_THEME.border}`,background:"rgba(255,255,255,.04)",color:HQ_THEME.text,fontSize:13,fontWeight:800,cursor:"pointer",touchAction:"manipulation"}

export function HQStyles(){return <style jsx global>{`
:root{--hq-bg:#06101d;--hq-panel:#0b1728;--hq-panel2:#0e1d31;--hq-border:rgba(148,163,184,.13);--hq-text:#f8fafc;--hq-muted:#8fa2ba;--hq-green:#22c55e;--hq-blue:#3b82f6;--hq-amber:#f59e0b;--hq-red:#ef4444;--hq-violet:#8b5cf6;--hq-cyan:#06b6d4}
*{box-sizing:border-box}.hq-sidebar{position:fixed;z-index:120;inset:0 auto 0 0;width:248px;background:linear-gradient(180deg,#071426 0%,#071321 100%);border-right:1px solid var(--hq-border);font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;padding:14px 12px}.hq-side-brand{min-height:62px;display:flex;align-items:center;gap:11px;padding:0 8px;text-decoration:none;color:var(--hq-text)}.hq-side-logo{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#0ea5e9,#22c55e);color:#04101d;font-size:17px;font-weight:1000;transform:skew(-10deg)}.hq-side-brand strong{display:block;font-size:14px;letter-spacing:-.02em}.hq-side-brand small,.hq-side-owner small{display:block;color:var(--hq-muted);font-size:11px;margin-top:3px}.hq-side-scroll{overflow-y:auto;scrollbar-width:none;padding:8px 0 12px}.hq-side-scroll::-webkit-scrollbar{display:none}.hq-side-group{margin:9px 0 17px}.hq-side-group-label{padding:0 11px 7px;color:#7e91a9;text-transform:uppercase;font-size:10px;letter-spacing:.1em;font-weight:900}.hq-side-link{min-height:44px;display:flex;align-items:center;gap:10px;padding:0 11px;border-radius:9px;text-decoration:none;color:#b9c7d7;font-size:13px;font-weight:720;margin:2px 0;border:1px solid transparent}.hq-side-link:hover{background:rgba(255,255,255,.04);color:#fff}.hq-side-link:focus-visible,.hq-bottom-link:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}.hq-side-link.is-active{color:#fff;background:linear-gradient(90deg,rgba(37,99,235,.33),rgba(37,99,235,.16));border-color:rgba(59,130,246,.18);box-shadow:inset 2px 0 #3b82f6}.hq-side-icon{width:20px;text-align:center;color:#9fb2c8;font-size:15px}.hq-side-link.is-active .hq-side-icon{color:#60a5fa}.hq-side-owner{margin-top:auto;border-top:1px solid var(--hq-border);padding:14px 8px 2px;display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;color:#fff}.hq-side-owner strong{font-size:12px}.hq-owner-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#cbd5e1,#64748b);color:#08111e;font-weight:950;font-size:13px}.hq-owner-chevron{color:#71849b}.hq-mobile-topbar{display:none}.hq-page{min-height:100dvh;margin-left:248px;background:radial-gradient(circle at 90% -10%,rgba(37,99,235,.12),transparent 30rem),linear-gradient(180deg,#06101d,#071321 46%,#06101d);color:var(--hq-text);font-family:Inter,system-ui,sans-serif}.hq-container{width:min(100%,1450px);margin:auto;padding:24px 22px 52px}.hq-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.hq-page-header h1{margin:0;font-size:clamp(24px,2.1vw,30px);letter-spacing:-.035em}.hq-page-header p{margin:7px 0 0;color:var(--hq-muted);font-size:13px;line-height:1.5}.hq-page-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.hq-panel{border:1px solid var(--hq-border);border-radius:14px;background:linear-gradient(180deg,rgba(15,32,53,.93),rgba(10,24,41,.98));overflow:hidden;box-shadow:0 15px 42px rgba(0,0,0,.13)}.hq-panel-header{padding:15px 16px;border-bottom:1px solid var(--hq-border)}.hq-panel-header h2{margin:0;font-size:13px;text-transform:uppercase;letter-spacing:.035em}.hq-panel-header p{margin:5px 0 0;color:var(--hq-muted);font-size:12px;line-height:1.45}.hq-panel-body{min-width:0}.hq-mobile-stack{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.hq-bottom-nav{display:none}
@media(max-width:980px){.hq-sidebar{width:220px}.hq-page{margin-left:220px}.hq-container{padding:20px 15px 44px}}
@media(max-width:720px){body{overscroll-behavior-y:none;background:var(--hq-bg)}.hq-sidebar{display:none}.hq-page{margin-left:0;padding-top:60px}.hq-mobile-topbar{position:fixed;z-index:120;top:0;left:0;right:0;height:60px;padding:0 13px;display:flex;align-items:center;justify-content:space-between;background:rgba(6,16,29,.96);backdrop-filter:blur(18px);border-bottom:1px solid var(--hq-border);font-family:Inter,system-ui,sans-serif}.hq-mobile-brand{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none}.hq-mobile-brand .hq-side-logo{width:32px;height:32px;font-size:14px}.hq-mobile-brand strong{font-size:14px}.hq-mobile-brand i{font-style:normal;color:var(--hq-green);font-size:10px;margin-left:2px}.hq-container{padding:16px 12px calc(94px + env(safe-area-inset-bottom))}.hq-page-header{display:block;margin-bottom:14px}.hq-page-header h1{font-size:23px}.hq-page-header p{font-size:12px}.hq-page-actions{margin-top:13px;justify-content:flex-start;display:flex;flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px;scrollbar-width:none}.hq-page-actions::-webkit-scrollbar{display:none}.hq-page-actions button{flex:0 0 auto;min-height:44px}.hq-mobile-stack{grid-template-columns:1fr}.hq-panel{border-radius:13px}.hq-bottom-nav{position:fixed;z-index:125;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);gap:2px;padding:6px 7px calc(6px + env(safe-area-inset-bottom));background:rgba(6,16,29,.98);backdrop-filter:blur(20px);border-top:1px solid var(--hq-border)}.hq-bottom-link{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#8799b0;text-decoration:none;font-size:10px;font-weight:800;border-radius:11px}.hq-bottom-icon{font-size:17px;line-height:1}.hq-bottom-link.is-active{color:#60a5fa}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`}</style>}

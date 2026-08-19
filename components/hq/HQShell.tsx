"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import HQNotificationCenter from "@/components/hq/NotificationCenter"

export const HQ_THEME = {
  bg: "#06101d", panel: "#0b1728", panelSoft: "#0e1d31", border: "rgba(148,163,184,.13)", text: "#f8fafc", muted: "#7f93ad", green: "#22c55e", blue: "#3b82f6", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6", cyan: "#06b6d4",
} as const

type NavItem = readonly [string,string,string]
type NavGroup = {label:string;items:readonly NavItem[]}

// Task 18 canonical owner information architecture. Existing strong surfaces are retained,
// but each appears once in the primary navigation under the owner job it actually serves.
const navGroups: readonly NavGroup[] = [
  {label:"Operate",items:[
    ["Today","/hq","⌂"],
    ["Operations","/hq/intelligence","◈"],
    ["Decisions","/hq/decisions","✓"],
    ["Alerts","/hq/notifications","!"],
  ]},
  {label:"Company",items:[
    ["Schools","/hq/schools","▦"],
    ["People","/hq/users","◎"],
    ["Product & Learning","/hq/analytics","⌁"],
    ["Growth","/hq/marketing","↗"],
    ["Finance","/hq/billing","$"],
  ]},
  {label:"Platform",items:[
    ["Workforce","/hq/workforce","⚙"],
    ["Content","/hq/content","▤"],
    ["Curriculum","/hq/curriculum-authority","A"],
    ["Security & Controls","/hq/security","◇"],
  ]},
  {label:"Build",items:[
    ["Content Studio","/hq/studio","✦"],
    ["Content Intelligence","/hq/curriculum-intelligence","▣"],
  ]},
]

const mobileLinks: readonly NavItem[] = [
  ["Today","/hq","⌂"],
  ["Operate","/hq/intelligence","◈"],
  ["Decide","/hq/decisions","✓"],
  ["Workforce","/hq/workforce","⚙"],
  ["Alerts","/hq/notifications","!"],
]

function isActive(pathname:string,href:string){return href==="/hq"?pathname===href:pathname===href||pathname.startsWith(`${href}/`)}

export function HQNavigation(){
  const pathname=usePathname()
  return <>
    <aside className="hq-sidebar" aria-label="HQ owner navigation">
      <Link href="/hq" className="hq-side-brand" aria-label="VibeSchool HQ Today"><span className="hq-side-logo">V</span><span><strong>VibeSchool HQ</strong><small>Company Operating System</small></span></Link>
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

export const hqButtonStyle:CSSProperties={minHeight:42,padding:"0 13px",borderRadius:10,border:`1px solid ${HQ_THEME.border}`,background:"rgba(255,255,255,.035)",color:HQ_THEME.text,fontSize:11,fontWeight:800,cursor:"pointer",touchAction:"manipulation"}

export function HQStyles(){return <style jsx global>{`
:root{--hq-bg:#06101d;--hq-panel:#0b1728;--hq-panel2:#0e1d31;--hq-border:rgba(148,163,184,.13);--hq-text:#f8fafc;--hq-muted:#7f93ad;--hq-green:#22c55e;--hq-blue:#3b82f6;--hq-amber:#f59e0b;--hq-red:#ef4444;--hq-violet:#8b5cf6;--hq-cyan:#06b6d4}
*{box-sizing:border-box}.hq-sidebar{position:fixed;z-index:120;inset:0 auto 0 0;width:248px;background:linear-gradient(180deg,#071426 0%,#071321 100%);border-right:1px solid var(--hq-border);font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;padding:14px 12px}.hq-side-brand{height:56px;display:flex;align-items:center;gap:11px;padding:0 8px;text-decoration:none;color:var(--hq-text)}.hq-side-logo{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#0ea5e9,#22c55e);color:#04101d;font-size:17px;font-weight:1000;transform:skew(-10deg)}.hq-side-brand strong{display:block;font-size:14px;letter-spacing:-.02em}.hq-side-brand small,.hq-side-owner small{display:block;color:var(--hq-muted);font-size:9px;margin-top:2px}.hq-side-scroll{overflow-y:auto;scrollbar-width:none;padding:8px 0 12px}.hq-side-scroll::-webkit-scrollbar{display:none}.hq-side-group{margin:9px 0 15px}.hq-side-group-label{padding:0 11px 6px;color:#627792;text-transform:uppercase;font-size:8px;letter-spacing:.12em;font-weight:900}.hq-side-link{min-height:38px;display:flex;align-items:center;gap:10px;padding:0 11px;border-radius:9px;text-decoration:none;color:#aebdce;font-size:10.5px;font-weight:720;margin:2px 0;border:1px solid transparent}.hq-side-link:hover{background:rgba(255,255,255,.035);color:#fff}.hq-side-link.is-active{color:#fff;background:linear-gradient(90deg,rgba(37,99,235,.33),rgba(37,99,235,.16));border-color:rgba(59,130,246,.18);box-shadow:inset 2px 0 #3b82f6}.hq-side-icon{width:18px;text-align:center;color:#93a8c0;font-size:14px}.hq-side-link.is-active .hq-side-icon{color:#60a5fa}.hq-side-owner{margin-top:auto;border-top:1px solid var(--hq-border);padding:14px 8px 2px;display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;color:#fff}.hq-side-owner strong{font-size:10px}.hq-owner-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#cbd5e1,#64748b);color:#08111e;font-weight:950;font-size:12px}.hq-owner-chevron{color:#71849b}.hq-mobile-topbar{display:none}.hq-page{min-height:100dvh;margin-left:248px;background:radial-gradient(circle at 90% -10%,rgba(37,99,235,.12),transparent 30rem),linear-gradient(180deg,#06101d,#071321 46%,#06101d);color:var(--hq-text);font-family:Inter,system-ui,sans-serif}.hq-container{width:min(100%,1510px);margin:auto;padding:22px 20px 48px}.hq-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:17px}.hq-page-header h1{margin:0;font-size:clamp(21px,2.1vw,28px);letter-spacing:-.035em}.hq-page-header p{margin:5px 0 0;color:var(--hq-muted);font-size:10.5px;line-height:1.5}.hq-page-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.hq-panel{border:1px solid var(--hq-border);border-radius:13px;background:linear-gradient(180deg,rgba(15,32,53,.93),rgba(10,24,41,.98));overflow:hidden;box-shadow:0 15px 42px rgba(0,0,0,.13)}.hq-panel-header{padding:13px 14px;border-bottom:1px solid var(--hq-border)}.hq-panel-header h2{margin:0;font-size:10.5px;text-transform:uppercase;letter-spacing:.035em}.hq-panel-header p{margin:4px 0 0;color:var(--hq-muted);font-size:9.5px}.hq-panel-body{min-width:0}.hq-mobile-stack{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.hq-bottom-nav{display:none}
@media(max-width:980px){.hq-sidebar{width:210px}.hq-page{margin-left:210px}.hq-container{padding:18px 14px 42px}.hq-side-link{font-size:10px}}
@media(max-width:720px){body{overscroll-behavior-y:none;background:var(--hq-bg)}.hq-sidebar{display:none}.hq-page{margin-left:0;padding-top:58px}.hq-mobile-topbar{position:fixed;z-index:120;top:0;left:0;right:0;height:58px;padding:0 13px;display:flex;align-items:center;justify-content:space-between;background:rgba(6,16,29,.96);backdrop-filter:blur(18px);border-bottom:1px solid var(--hq-border);font-family:Inter,system-ui,sans-serif}.hq-mobile-brand{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none}.hq-mobile-brand .hq-side-logo{width:30px;height:30px;font-size:14px}.hq-mobile-brand strong{font-size:13px}.hq-mobile-brand i{font-style:normal;color:var(--hq-green);font-size:8px;margin-left:2px}.hq-container{padding:15px 11px calc(92px + env(safe-area-inset-bottom))}.hq-page-header{display:block;margin-bottom:13px}.hq-page-header h1{font-size:21px}.hq-page-header p{font-size:10px}.hq-page-actions{margin-top:12px;justify-content:flex-start;display:flex;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.hq-page-actions::-webkit-scrollbar{display:none}.hq-page-actions button{flex:0 0 auto;min-height:40px}.hq-mobile-stack{grid-template-columns:1fr}.hq-panel{border-radius:13px}.hq-bottom-nav{position:fixed;z-index:125;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);gap:2px;padding:6px 7px calc(6px + env(safe-area-inset-bottom));background:rgba(6,16,29,.98);backdrop-filter:blur(20px);border-top:1px solid var(--hq-border)}.hq-bottom-link{min-height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#71849c;text-decoration:none;font-size:8px;font-weight:800;border-radius:11px}.hq-bottom-icon{font-size:17px;line-height:1}.hq-bottom-link.is-active{color:#60a5fa}.hq-bottom-link:nth-child(3){color:#dbeafe}.hq-bottom-link:nth-child(3) .hq-bottom-icon{display:grid;place-items:center;width:42px;height:42px;margin-top:-18px;border-radius:999px;background:linear-gradient(145deg,#2563eb,#1d4ed8);border:4px solid #06101d;box-shadow:0 8px 26px rgba(37,99,235,.38)} }
`}</style>}

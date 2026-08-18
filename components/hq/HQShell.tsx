"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import HQNotificationCenter from "@/components/hq/NotificationCenter"

export const HQ_THEME = {
  bg: "#07111f", panel: "#0d1b2f", panelSoft: "rgba(255,255,255,.025)", border: "rgba(255,255,255,.09)", text: "#f8fafc", muted: "rgba(255,255,255,.5)", green: "#34d399", blue: "#60a5fa", amber: "#f59e0b", red: "#fb7185", violet: "#a78bfa",
} as const

const desktopLinks = [
  ["Command", "/hq"], ["Live", "/hq/intelligence"], ["Users", "/hq/users"], ["Schools", "/hq/schools"], ["Learning", "/hq/analytics"],
  ["Content", "/hq/curriculum-intelligence/engine"], ["Revenue", "/hq/billing"], ["Workforce", "/hq/workforce"], ["Security", "/hq/security"],
  ["Decisions", "/hq/decisions"], ["Studio", "/hq/studio"], ["Publishing", "/hq/content"], ["Authority", "/hq/curriculum-authority"],
] as const

const mobileLinks = [
  ["Home", "/hq", "⌂"], ["Insights", "/hq/analytics", "⌁"], ["Live", "/hq/intelligence", "◉"], ["Alerts", "/hq/notifications", "!"], ["More", "/hq/decisions", "≡"],
] as const

function isActive(pathname:string, href:string){return href==="/hq"?pathname===href:pathname===href||pathname.startsWith(`${href}/`)}

export function HQNavigation() {
  const pathname = usePathname()
  return <>
    <nav aria-label="HQ owner navigation" className="hq-nav"><div className="hq-nav-inner">
      <Link href="/hq" className="hq-brand" aria-label="VibeSchool HQ home"><span className="hq-brand-mark">V</span><span>VibeSchool HQ</span></Link>
      <div className="hq-nav-scroll">{desktopLinks.map(([label,href])=>{const active=isActive(pathname,href);return <Link key={href} href={href} aria-current={active?"page":undefined} className={`hq-nav-link${active?" is-active":""}`}>{label}</Link>})}</div>
      <div className="hq-nav-alerts"><HQNotificationCenter /></div>
    </div></nav>
    <nav className="hq-bottom-nav" aria-label="HQ mobile navigation">{mobileLinks.map(([label,href,icon])=>{const active=isActive(pathname,href);return <Link key={label} href={href} aria-current={active?"page":undefined} className={`hq-bottom-link${active?" is-active":""}`}><span className="hq-bottom-icon" aria-hidden>{icon}</span><span>{label}</span></Link>})}</nav>
  </>
}

export function HQPage({title,description,actions,children}:{title:string;description?:string;actions?:ReactNode;children:ReactNode}){
  return <main className="hq-page"><div className="hq-container"><header className="hq-page-header"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="hq-page-actions">{actions}</div>}</header>{children}</div></main>
}

export function HQPanel({title,description,children,className=""}:{title?:string;description?:string;children:ReactNode;className?:string}){
  return <section className={`hq-panel ${className}`}>{(title||description)&&<header className="hq-panel-header">{title&&<h2>{title}</h2>}{description&&<p>{description}</p>}</header>}<div className="hq-panel-body">{children}</div></section>
}

export const hqButtonStyle:CSSProperties={minHeight:44,padding:"0 13px",borderRadius:11,border:`1px solid ${HQ_THEME.border}`,background:"rgba(255,255,255,.045)",color:HQ_THEME.text,fontSize:12,fontWeight:800,cursor:"pointer",touchAction:"manipulation"}

export function HQStyles(){return <style jsx global>{`
:root{--hq-bg:#07111f;--hq-panel:#0d1b2f;--hq-border:rgba(255,255,255,.09);--hq-text:#f8fafc;--hq-muted:rgba(255,255,255,.5);--hq-green:#34d399;--hq-blue:#60a5fa;--hq-amber:#f59e0b;--hq-red:#fb7185}
*{box-sizing:border-box}.hq-nav{position:sticky;top:0;z-index:100;background:rgba(7,17,31,.96);backdrop-filter:blur(18px);border-bottom:1px solid var(--hq-border);font-family:Inter,system-ui,sans-serif}.hq-nav-inner{max-width:1240px;margin:auto;display:flex;align-items:center;gap:12px;padding:8px 14px}.hq-brand{display:flex;align-items:center;gap:7px;color:var(--hq-text);text-decoration:none;font-size:12px;font-weight:950;flex:none}.hq-brand-mark{display:grid;place-items:center;width:29px;height:29px;border-radius:9px;background:linear-gradient(135deg,#3b82f6,#34d399);color:#03101f;font-size:13px}.hq-nav-scroll{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;min-width:0;flex:1}.hq-nav-scroll::-webkit-scrollbar{display:none}.hq-nav-link{white-space:nowrap;padding:9px 10px;border-radius:9px;color:rgba(248,250,252,.64);font-size:11px;font-weight:800;text-decoration:none;border:1px solid transparent}.hq-nav-link:hover{color:var(--hq-text);background:rgba(255,255,255,.04)}.hq-nav-link.is-active{color:var(--hq-text);background:rgba(96,165,250,.11);border-color:rgba(96,165,250,.25)}.hq-nav-alerts{flex:none;display:flex;align-items:center}.hq-page{min-height:100dvh;background:radial-gradient(circle at top right,rgba(96,165,250,.08),transparent 24rem),var(--hq-bg);color:var(--hq-text);font-family:Inter,system-ui,sans-serif}.hq-container{max-width:1220px;margin:auto;padding:22px 18px 96px}.hq-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.hq-page-header h1{margin:0;font-size:clamp(22px,3vw,30px);letter-spacing:-.03em}.hq-page-header p{margin:6px 0 0;color:var(--hq-muted);font-size:12px;line-height:1.5}.hq-page-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.hq-panel{border:1px solid var(--hq-border);border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018));overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.12)}.hq-panel-header{padding:14px 16px;border-bottom:1px solid var(--hq-border)}.hq-panel-header h2{margin:0;font-size:13px}.hq-panel-header p{margin:4px 0 0;color:var(--hq-muted);font-size:11px}.hq-panel-body{min-width:0}.hq-mobile-stack{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.hq-bottom-nav{display:none}
@media(max-width:720px){body{overscroll-behavior-y:none}.hq-nav-inner{padding:7px 10px;gap:8px}.hq-brand span:last-child{font-size:11px}.hq-nav-scroll{display:none}.hq-nav-alerts{margin-left:auto}.hq-nav-alerts > button{min-width:42px;min-height:42px;padding:0 9px}.hq-container{padding:14px 11px calc(96px + env(safe-area-inset-bottom))}.hq-page-header{display:block;margin-bottom:14px}.hq-page-header h1{font-size:22px}.hq-page-actions{margin-top:12px;justify-content:flex-start;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.hq-page-actions button{width:100%;min-height:46px}.hq-mobile-stack{grid-template-columns:1fr}.hq-panel{border-radius:14px}.hq-bottom-nav{position:fixed;z-index:120;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);gap:2px;padding:7px 8px calc(7px + env(safe-area-inset-bottom));background:rgba(7,17,31,.97);backdrop-filter:blur(18px);border-top:1px solid var(--hq-border)}.hq-bottom-link{min-height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:rgba(248,250,252,.55);text-decoration:none;font-size:9px;font-weight:800;border-radius:12px}.hq-bottom-icon{font-size:18px;line-height:1}.hq-bottom-link.is-active{color:#93c5fd;background:rgba(59,130,246,.1)}.hq-bottom-link:nth-child(3){color:#e0f2fe}.hq-bottom-link:nth-child(3) .hq-bottom-icon{display:grid;place-items:center;width:40px;height:40px;margin-top:-18px;border-radius:999px;background:#2563eb;border:4px solid #07111f;box-shadow:0 8px 28px rgba(37,99,235,.35)} }
`}</style>}

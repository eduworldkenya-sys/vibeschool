"use client"

import Link from "next/link"
import { HQ_NAV_GROUPS, HQPage, HQPanel } from "@/components/hq/HQShell"

const hiddenFromMore = new Set(["/hq", "/hq/decisions", "/hq/notifications", "/hq/intelligence", "/hq/more"])
const groups = HQ_NAV_GROUPS.map(group=>({
  ...group,
  items: group.items.filter(([,href])=>!hiddenFromMore.has(href)),
})).filter(group=>group.items.length)

export default function HQMorePage(){
  return <HQPage title="All HQ" description="Every founder operating surface in one place. The mobile command bar keeps only the highest-frequency destinations pinned.">
    <div className="hq-more-groups">{groups.map(group=><section key={group.label} className="hq-more-section"><h2>{group.label}</h2><div className="hq-more-grid">{group.items.map(([label,href,icon])=><Link key={href} href={href} className="hq-more-link"><HQPanel title={`${icon} ${label}`}><span>Open {label} →</span></HQPanel></Link>)}</div></section>)}</div>
    <style>{`.hq-more-groups{display:grid;gap:20px}.hq-more-section h2{margin:0 0 9px;color:#8fa2ba;font-size:11px;text-transform:uppercase;letter-spacing:.09em}.hq-more-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.hq-more-link{text-decoration:none;color:inherit;min-width:0}.hq-more-link .hq-panel{height:100%}.hq-more-link .hq-panel-body{padding:13px 16px;font-size:12px;font-weight:800;color:#93c5fd}.hq-more-link:focus-visible{outline:2px solid #60a5fa;outline-offset:3px;border-radius:14px}@media(max-width:1000px){.hq-more-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.hq-more-grid{grid-template-columns:1fr}.hq-more-groups{gap:16px}}`}</style>
  </HQPage>
}

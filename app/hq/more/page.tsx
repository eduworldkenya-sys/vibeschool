import Link from "next/link"
import { HQPage, HQPanel } from "@/components/hq/HQShell"

const domains = [
  ["Product & Schools", "/hq/product", "Schools, adoption, activity, users and evidence-backed school intelligence."],
  ["Company Intelligence", "/hq/intelligence", "Activation, retention, product usage and founder operating intelligence."],
  ["Content", "/hq/content", "Publishing, curriculum, quality and Content Factory operations."],
  ["Revenue", "/hq/billing", "Commerce, M-Pesa, subscriptions, reconciliation and finance."],
  ["System", "/hq/security", "Control plane, security, authorization, runtime health and settings."],
] as const

export default function HQMorePage(){
  return <HQPage title="More" description="Open a VibeSchool operating area. Each area explains the business in human terms.">
    <div className="hq-more-grid">{domains.map(([label,href,description])=><Link key={href} href={href} className="hq-more-link"><HQPanel title={label} description={description}><span>Open {label} →</span></HQPanel></Link>)}</div>
    <style>{`.hq-more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hq-more-link{text-decoration:none;color:inherit}.hq-more-link .hq-panel-body{padding:16px;font-size:13px;font-weight:800;color:#93c5fd}.hq-more-link:focus-visible{outline:2px solid #60a5fa;outline-offset:3px;border-radius:14px}@media(max-width:720px){.hq-more-grid{grid-template-columns:1fr}}`}</style>
  </HQPage>
}

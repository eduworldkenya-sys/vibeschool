import Link from 'next/link'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

export type StudioTool = { label: string; href: string; icon: LucideIcon; detail?: string }

/** Visual shortcuts carry the caller's exact context in their existing route. */
export default function StudioTools({ title, tools }: { title: string; tools: StudioTool[] }) {
  return <section className="studio-tools" aria-label={title}>
    <h2>{title}</h2>
    <div className="studio-tools__grid">{tools.map(({ label, href, icon: Icon, detail }) => <Link key={href} className="studio-tools__tile" href={href}>
      <Icon size={23} aria-hidden="true"/><strong>{label}</strong>
      {detail && <small>{detail}</small>}<ArrowUpRight className="studio-arrow" aria-hidden="true"/>
    </Link>)}</div>
  </section>
}

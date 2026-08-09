import Link from "next/link"
import HQExecutiveAnalytics from "@/components/hq/ExecutiveAnalytics"

export default function HQAnalyticsPage(){return <main className="min-h-screen bg-slate-950 p-5 text-slate-100"><div className="mx-auto max-w-6xl"><div className="mb-5 flex items-center gap-3"><Link href="/hq" className="text-sm text-slate-400">← HQ</Link><div><h1 className="text-2xl font-black">Executive analytics</h1><p className="text-sm text-slate-400">Finance, adoption, operations and content activity from HQ authority.</p></div></div><HQExecutiveAnalytics/></div></main>}

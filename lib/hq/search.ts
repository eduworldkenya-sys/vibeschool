import { hqSupabase } from "@/lib/hq/supabase"

export type HQSearchResultType = "page" | "work_item" | "decision" | "artifact" | "notification" | "incident" | "worker" | "workforce_job" | "school" | "publication" | "curriculum_outcome"
export type HQSearchResult = { result_type: HQSearchResultType; result_id: string; title: string; subtitle: string | null; status: string | null; route: string; updated_at: string | null; rank: number }

// Add new HQ destinations here without modifying the search page or database RPC.
// This registry searches navigation; database records remain owner-gated by hq_global_search.
export const hqSearchPages = [
  {title:"Success Wishes PIN recovery",route:"/hq/support/pin-recovery",keywords:"pin reset pin recovery recover access success wishes receiver account"},
  {title:"Success Wishes",route:"/success-wishes",keywords:"digital success cards send gift wishes"},
  {title:"HQ Search",route:"/hq/search",keywords:"find anything global search"},
  {title:"HQ Home",route:"/hq",keywords:"dashboard overview"},
  {title:"HQ Decisions",route:"/hq/decisions",keywords:"approvals decisions"},
  {title:"HQ Workforce",route:"/hq/workforce",keywords:"workers agents jobs team"},
  {title:"HQ Schools",route:"/hq/schools",keywords:"school directory"},
  {title:"HQ Content",route:"/hq/content",keywords:"publications lessons resources"},
  {title:"HQ Security",route:"/hq/security",keywords:"incidents privacy safety"},
  {title:"Teacher OS",route:"/teacher",keywords:"teacher app teacher dashboard classroom"},
  {title:"Teacher lesson plans",route:"/teacher/scheme",keywords:"teacher lessons teaching planning"},
  {title:"Teacher attendance",route:"/teacher/attendance",keywords:"teacher roll call register learners"},
  {title:"Teacher assessment",route:"/teacher/assessment",keywords:"teacher marks exams results"},
  {title:"Teacher timetable",route:"/teacher/timetable",keywords:"teacher periods schedule"},
  {title:"Parent OS",route:"/parent",keywords:"parents guardians family app"},
  {title:"Student OS",route:"/student",keywords:"student learner homework lessons app"},
  {title:"Success Wishes receiver inbox",route:"/success-wishes/inbox",keywords:"received gifts cards my wishes"},
  {title:"Success Wishes sender",route:"/success-wishes",keywords:"send gift card checkout"},
] as const

export function searchHQPages(query: string): HQSearchResult[] {
 const terms=query.trim().toLowerCase().split(/\\s+/).filter(Boolean)
 if (!terms.length) return []
 return hqSearchPages.filter(page=>terms.every(term=>`${page.title} ${page.keywords}`.toLowerCase().includes(term)))
  .map((page,index)=>({result_type:"page",result_id:page.route,title:page.title,subtitle:"HQ destination",status:null,route:page.route,updated_at:null,rank:index}))
}

export async function searchHQ(query: string, limit = 40): Promise<HQSearchResult[]> {
  const normalized = query.trim()
  if (normalized.length < 2) return []
  const { data, error } = await hqSupabase.rpc("hq_global_search", { p_query: normalized, p_limit: Math.max(1, Math.min(limit, 80)) })
  if (error) throw error
  return (data ?? []) as HQSearchResult[]
}

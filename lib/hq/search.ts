import { hqSupabase } from "@/lib/hq/supabase"

export type HQSearchResultType = "page" | "work_item" | "decision" | "artifact" | "notification" | "incident" | "worker" | "workforce_job" | "school" | "publication" | "curriculum_outcome"
export type HQSearchResult = { result_type: HQSearchResultType; result_id: string; title: string; subtitle: string | null; status: string | null; route: string; updated_at: string | null; rank: number }

// Add new HQ destinations here without modifying the search page or database RPC.
// This registry searches navigation; database records remain owner-gated by hq_global_search.
export const hqSearchPages = [
  {title:"Success Wishes PIN recovery",route:"/hq/success-wishes",keywords:"pin reset pin recovery recover access success wishes receiver account"},
  {title:"Success Wishes",route:"/success-wishes",keywords:"digital success cards send gift wishes"},
  {title:"HQ Search",route:"/hq/search",keywords:"find anything global search"},
  {title:"HQ Home",route:"/hq",keywords:"dashboard overview"},
  {title:"HQ Decisions",route:"/hq/decisions",keywords:"approvals decisions"},
  {title:"HQ Workforce",route:"/hq/workforce",keywords:"workers agents jobs team"},
  {title:"HQ Schools",route:"/hq/schools",keywords:"school directory"},
  {title:"HQ Content",route:"/hq/content",keywords:"publications lessons resources"},
  {title:"HQ Security",route:"/hq/security",keywords:"incidents privacy safety"},
  {title:"HQ Analytics",route:"/hq/analytics",keywords:"visitors traffic insights statistics"},
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

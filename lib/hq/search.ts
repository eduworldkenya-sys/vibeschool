import { hqSupabase } from "@/lib/hq/supabase"

export type HQSearchResultType = "work_item" | "decision" | "artifact" | "notification" | "incident" | "worker" | "workforce_job" | "school" | "publication" | "curriculum_outcome"
export type HQSearchResult = { result_type: HQSearchResultType; result_id: string; title: string; subtitle: string | null; status: string | null; route: string; updated_at: string | null; rank: number }

export async function searchHQ(query: string, limit = 40): Promise<HQSearchResult[]> {
  const normalized = query.trim()
  if (normalized.length < 2) return []
  const { data, error } = await hqSupabase.rpc("hq_global_search", { p_query: normalized, p_limit: Math.max(1, Math.min(limit, 80)) })
  if (error) throw error
  return (data ?? []) as HQSearchResult[]
}

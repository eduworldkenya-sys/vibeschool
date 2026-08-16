import { supabase } from '@/lib/supabase'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

export interface PublicSchoolResult {
  schoolId: string
  schoolName: string
  county: string | null
  subCounty: string | null
  schoolCategory: string | null
  ownershipType: string | null
  genderType: string | null
  accommodationType: string | null
  cluster: string | null
  knecCode: string | null
  pathwaySlug: string | null
  pathwayName: string | null
  combinationSlug: string | null
  combinationName: string | null
  offeringVerifiedAt: string | null
}

type PublicSchoolRow = {
  school_id?: unknown
  school_name?: unknown
  county?: unknown
  sub_county?: unknown
  school_category?: unknown
  ownership_type?: unknown
  gender_type?: unknown
  accommodation_type?: unknown
  cluster?: unknown
  knec_code?: unknown
  pathway_slug?: unknown
  pathway_name?: unknown
  combination_slug?: unknown
  combination_name?: unknown
  offering_verified_at?: unknown
}

function text(value: unknown): string | null { return typeof value === 'string' ? value : null }

export async function searchPublicSchools(input: {
  query?: string
  county?: string
  pathwaySlug?: string
  combinationSlug?: string
  limit?: number
}): Promise<PublicSchoolResult[]> {
  const { data, error } = await rpc<PublicSchoolRow[]>('pathways_search_public_schools', {
    p_query: input.query?.trim() || null,
    p_county: input.county?.trim() || null,
    p_pathway_slug: input.pathwaySlug?.trim() || null,
    p_combination_slug: input.combinationSlug?.trim() || null,
    p_limit: Math.max(1, Math.min(input.limit ?? 30, 50)),
  })
  if (error) throw new Error(error.message || 'Schools could not be searched.')
  return (Array.isArray(data) ? data : []).map(row => ({
    schoolId: text(row.school_id) ?? '',
    schoolName: text(row.school_name) ?? 'School',
    county: text(row.county),
    subCounty: text(row.sub_county),
    schoolCategory: text(row.school_category),
    ownershipType: text(row.ownership_type),
    genderType: text(row.gender_type),
    accommodationType: text(row.accommodation_type),
    cluster: text(row.cluster),
    knecCode: text(row.knec_code),
    pathwaySlug: text(row.pathway_slug),
    pathwayName: text(row.pathway_name),
    combinationSlug: text(row.combination_slug),
    combinationName: text(row.combination_name),
    offeringVerifiedAt: text(row.offering_verified_at),
  }))
}

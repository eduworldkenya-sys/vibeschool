export type PublicSchoolAddress = {
  slug: string
  source_kind: 'canonical' | 'directory'
  source_id: string
  school_name: string
  county: string | null
  sub_county: string | null
  school_level: string | null
  ownership_type: string | null
  knec_code: string | null
  is_verified: boolean
}
export const SCHOOL_SECTIONS = ['about', 'academics', 'news', 'contact'] as const
export function schoolUrl(slug: string) { return '/school/' + encodeURIComponent(slug) }

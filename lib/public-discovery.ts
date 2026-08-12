const SITE_URL = 'https://www.vibeschool.co.ke'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export type PublicCourse = { id: string; slug: string; title: string; institution?: string | null; level?: string | null; duration_label?: string | null; description?: string | null; status?: string | null }
export type PublicModule = { id: string; slug: string; title: string; course_id: string; sequence_number?: number | null; weeks_label?: string | null }
export type ContentBlock = { title?: string | null; text?: string | null }
export type PublicTopic = { id: string; module_id: string; slug: string; title: string; subtitle?: string | null; content_status?: string | null; sequence_number?: number | null; week_number?: number | null; concept_tab?: ContentBlock[] | null; kenya_context_tab?: ContentBlock[] | null; common_errors_tab?: ContentBlock[] | null; clinical_tip_tab?: ContentBlock[] | null }

async function select<T>(table: string, query: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return []
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, next: { revalidate: 900 } })
    if (!response.ok) return []
    return (await response.json()) as T[]
  } catch { return [] }
}

const COURSE_FIELDS = 'id,slug,title,institution,level,duration_label,description,status'

export async function getPublicCourses() {
  return select<PublicCourse>('courses', `select=${COURSE_FIELDS}&status=eq.live&order=title.asc`)
}

export async function getPublicCourse(slug: string) {
  const rows = await select<PublicCourse>('courses', `select=${COURSE_FIELDS}&slug=eq.${encodeURIComponent(slug)}&status=eq.live&limit=1`)
  return rows[0] ?? null
}

export async function getPublicCourseOutline(slug: string) {
  const course = await getPublicCourse(slug)
  if (!course) return null
  const modules = await select<PublicModule>('modules', `select=id,slug,title,course_id,sequence_number,weeks_label&course_id=eq.${encodeURIComponent(course.id)}&order=sequence_number.asc`)
  if (modules.length === 0) return { course, modules: [] as Array<PublicModule & { topics: PublicTopic[] }> }
  const moduleIds = modules.map(module => module.id)
  const topics = await select<PublicTopic>('topics', `select=id,module_id,slug,title,subtitle,content_status,sequence_number,week_number&module_id=in.(${moduleIds.join(',')})&content_status=eq.published&order=sequence_number.asc`)
  return { course, modules: modules.map(module => ({ ...module, topics: topics.filter(topic => topic.module_id === module.id) })) }
}

export async function getPublicTopic(courseSlug: string, moduleSlug: string, topicSlug: string) {
  const course = await getPublicCourse(courseSlug)
  if (!course) return null
  const modules = await select<PublicModule>('modules', `select=id,slug,title,course_id,sequence_number,weeks_label&course_id=eq.${encodeURIComponent(course.id)}&slug=eq.${encodeURIComponent(moduleSlug)}&limit=1`)
  const module = modules[0]
  if (!module) return null
  const topics = await select<PublicTopic>('topics', `select=id,module_id,slug,title,subtitle,content_status,sequence_number,week_number,concept_tab,kenya_context_tab,common_errors_tab,clinical_tip_tab&module_id=eq.${encodeURIComponent(module.id)}&slug=eq.${encodeURIComponent(topicSlug)}&content_status=eq.published&limit=1`)
  const topic = topics[0]
  if (!topic) return null
  return { course, module, topic }
}

export function canonicalUrl(path: string) { return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}` }

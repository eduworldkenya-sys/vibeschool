import { NextRequest } from 'next/server'
import { SCHOOL_LEVELS } from '@/lib/learn/schoolCatalog'
import { isSafeVisualStoragePath, isVisualPayload } from '@/lib/visual-library/contract'
import { visualAdminClient, visualJson } from '@/lib/visual-library/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 24
const BATCH_SIZE = 100
const MAX_SCAN = 10000
const allowedGrades = new Set<string>(SCHOOL_LEVELS.flatMap(level => [...level.grades]))

/** Read only active, public, certified platform visuals. Never expose draft metadata. */
export async function GET(req: NextRequest) {
  const rawGrade = (req.nextUrl.searchParams.get('grade') || '').trim()
  const grade = /^\d{1,2}$/.test(rawGrade) ? 'Grade ' + Number(rawGrade) : rawGrade
  const search = (req.nextUrl.searchParams.get('search') || '').trim().slice(0, 70).toLowerCase()
  const subject = (req.nextUrl.searchParams.get('subject') || '').trim()
  const topicKey = (req.nextUrl.searchParams.get('topicKey') || '').trim().toLowerCase()
  const pageText = req.nextUrl.searchParams.get('page') || '1'
  const page = Number(pageText)

  if (grade && !allowedGrades.has(grade)) return visualJson({ error: 'Invalid grade.' }, 400)
  if (subject && (subject.length > 80 || !/^[\p{L}\d &().,'–-]{2,80}$/u.test(subject)))
    return visualJson({ error: 'Invalid subject.' }, 400)
  if (topicKey && !/^[a-z0-9-]{3,100}$/.test(topicKey))
    return visualJson({ error: 'Invalid topic.' }, 400)
  if (!/^[1-9]\d{0,2}$/.test(pageText) || page > 100)
    return visualJson({ error: 'Invalid page.' }, 400)

  try {
    const db = visualAdminClient()
    const required = page * PAGE_SIZE + 1
    const found: Array<{
      id: string; resourceVersionId: string; title: string; grade: string | null;
      subject: string | null; type: string; caption: string; altText: string;
      placements: string[]; sourceStrandId: string; topicKey: string;
    }> = []
    let scanOffset = 0
    let exhausted = false

    // Search the complete eligible catalogue, not only the newest 100 rows.
    // Caption/topic/label matching happens on the certified version payload.
    while (found.length < required && scanOffset < MAX_SCAN) {
      let q = db.from('learning_resources')
        .select('id,title,grade,subject,updated_at').eq('asset_kind','visual_aid')
        .eq('owner_type','platform').eq('status','active').eq('visibility','public')
        .order('updated_at',{ascending:false}).order('id',{ascending:true})
        .range(scanOffset,scanOffset + BATCH_SIZE - 1)
      if (grade) q = q.eq('grade',grade)
      if (subject) q = q.eq('subject',subject)
      const { data: roots, error } = await q
      if (error) return visualJson({ error: 'Visual catalogue unavailable.' }, 503)
      const eligible = roots || []
      scanOffset += eligible.length
      if (eligible.length < BATCH_SIZE) exhausted = true
      if (!eligible.length) break

      const { data: versions, error: ve } = await db.from('learning_resource_versions')
        .select('id,resource_id,payload,version,certified_at,rights_status')
        .in('resource_id',eligible.map(root => root.id))
        .eq('lifecycle_status','certified').in('rights_status',['cleared','not_applicable'])
        .not('certified_at','is',null).order('version',{ascending:false})
      if (ve) return visualJson({ error: 'Visual versions unavailable.' }, 503)

      const versionById = new Map<string, NonNullable<typeof versions>[number]>()
      for (const version of versions || []) {
        if (!versionById.has(version.resource_id)) versionById.set(version.resource_id,version)
      }
      for (const root of eligible) {
        const version = versionById.get(root.id)
        const p = version?.payload
        if (!version || !isVisualPayload(p) || !isSafeVisualStoragePath(p.storage.path)) continue
        if (topicKey && p.topic_key.toLowerCase() !== topicKey) continue
        if (search && ![root.title,root.subject,p.caption,p.alt_text,p.topic_key,...p.labels]
          .join(' ').toLowerCase().includes(search)) continue
        found.push({
          id:root.id,resourceVersionId:version.id,title:root.title,
          grade:root.grade,subject:root.subject,type:p.visual_type,
          caption:p.caption,altText:p.alt_text,placements:p.placements,
          sourceStrandId:p.source_strand_id,topicKey:p.topic_key,
        })
      }
      if (exhausted) break
    }
    // Do not misreport truncated scans as a complete catalogue.
    if (!exhausted && scanOffset >= MAX_SCAN && found.length < required)
      return visualJson({ error: 'Visual catalogue is too large for this filter. Narrow your search.' }, 503)
    const start = (page - 1) * PAGE_SIZE
    return visualJson({ visuals: found.slice(start,start + PAGE_SIZE), page,
      pageSize: PAGE_SIZE, hasMore: found.length > start + PAGE_SIZE })
  } catch {
    return visualJson({ error: 'Visual catalogue unavailable.' }, 503)
  }
}

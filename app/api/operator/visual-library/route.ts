import { NextRequest } from 'next/server'
import { saveVisualCandidate } from '@/lib/visual-library/intake'
import { isSafeVisualStoragePath, isVisualPayload, UUID_RE } from '@/lib/visual-library/contract'
import { requireVisualOperator, visualJson } from '@/lib/visual-library/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Authenticated machine operator: candidate intake and certified-asset discovery only.
 * Never grants review, certification, root activation, deletion or publishing authority.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireVisualOperator(req)
    if (!session) return visualJson({ error: 'Forbidden' }, 403)
    const grade = (req.nextUrl.searchParams.get('grade') || '').trim()
    const sourceStrandId = (req.nextUrl.searchParams.get('sourceStrandId') || '').trim()
    const topic = (req.nextUrl.searchParams.get('topicKey') || '').trim().toLowerCase().slice(0, 100)
    if (grade && !/^[1-9]$/.test(grade)) return visualJson({ error: 'Invalid grade.' }, 400)
    if (sourceStrandId && !UUID_RE.test(sourceStrandId)) return visualJson({ error: 'Invalid curriculum ID.' }, 400)

    const db = session.admin
    let query = db.from('learning_resources')
      .select('id,canonical_key,title,grade,subject,sub_strand_id')
      .eq('asset_kind', 'visual_aid').eq('owner_type', 'platform')
      .eq('status', 'active').eq('visibility', 'public')
      .order('created_at', { ascending: false }).limit(250)
    if (sourceStrandId) query = query.eq('sub_strand_id', sourceStrandId)
    const { data: resources, error } = await query
    if (error) return visualJson({ error: 'Visual catalogue unavailable.' }, 503)
    const roots = (resources || []).filter(row => !grade || String(row.grade || '').replace(/\D/g, '') === grade)
    if (!roots.length) return visualJson({ visuals: [] })

    const { data: versions, error: versionError } = await db.from('learning_resource_versions')
      .select('id,resource_id,version,payload,content_sha256,certified_at')
      .in('resource_id', roots.map(row => row.id)).eq('lifecycle_status', 'certified')
    if (versionError) return visualJson({ error: 'Certified version lookup unavailable.' }, 503)
    const byRoot = new Map((versions || []).map(version => [version.resource_id, version]))
    const visuals = roots.flatMap(row => {
      const version = byRoot.get(row.id)
      if (!version || !isVisualPayload(version.payload) || !isSafeVisualStoragePath(version.payload.storage.path)) return []
      const payload = version.payload
      if (topic && payload.topic_key.toLowerCase() !== topic) return []
      return [{
        resourceId: row.id, resourceVersionId: version.id, version: version.version,
        canonicalKey: row.canonical_key, title: row.title, grade: row.grade, subject: row.subject,
        sourceStrandId: row.sub_strand_id, topicKey: payload.topic_key, type: payload.visual_type,
        labels: payload.labels, caption: payload.caption, altText: payload.alt_text,
        placements: payload.placements, contentSha256: version.content_sha256,
        certifiedAt: version.certified_at,
        referenceToken: '[visual:' + row.id + '@' + version.id + ']',
      }]
    })
    return visualJson({ visuals })
  } catch {
    return visualJson({ error: 'Visual catalogue unavailable.' }, 503)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireVisualOperator(req)
    if (!session) return visualJson({ error: 'Forbidden' }, 403)
    return await saveVisualCandidate(req, session)
  } catch {
    return visualJson({ error: 'Visual candidate intake unavailable.' }, 503)
  }
}

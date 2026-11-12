import { NextRequest } from 'next/server'
import { requireVisualHQ, visualJson } from '@/lib/visual-library/server'
import { saveVisualCandidate } from '@/lib/visual-library/intake'
import { isVisualPayload, isSafeVisualStoragePath, VISUAL_DRAFT_BUCKET } from '@/lib/visual-library/contract'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await requireVisualHQ(req)
    if (!session) return visualJson({ error: 'Forbidden' }, 403)
    const { admin } = session
    const grade = (req.nextUrl.searchParams.get('grade') || '').trim()
    const search = (req.nextUrl.searchParams.get('search') || '').trim().slice(0, 60)
    if (req.nextUrl.searchParams.get('contexts') === '1') {
      if (!/^[1-9]$/.test(grade)) return visualJson({ error: 'Choose a grade from 1 to 9.' }, 400)
      const { data: subjects, error: subjectError } = await admin.from('subjects')
        .select('id,name').is('school_id', null)
        .ilike('name', '%' + search.replace(/[%_,()]/g, '') + '%').order('name').limit(100)
      if (subjectError) return visualJson({ error: 'Subjects unavailable.' }, 503)
      const names = new Map((subjects || []).map(row => [row.id, row.name]))
      if (!names.size) return visualJson({ contexts: [] })
      const { data: strands, error: strandError } = await admin.from('cbc_strands')
        .select('id,subject_id,grade,name,sub_strand')
        .eq('grade', 'Grade ' + grade).in('subject_id', Array.from(names.keys()))
        .order('name').limit(250)
      if (strandError) return visualJson({ error: 'Curriculum sub-strands unavailable.' }, 503)
      const contexts = (strands || []).map(row => ({
        id: row.id, grade: row.grade, subject: names.get(row.subject_id) || '',
        title: row.name + ' · ' + row.sub_strand,
      }))
      return visualJson({ contexts })
    }
    let q = admin.from('learning_resources').select('id,canonical_key,title,description,grade,subject,strand,status,visibility,created_at,updated_at')
      .eq('asset_kind', 'visual_aid').order('created_at', { ascending: false }).limit(50)
    if (/^[1-9]$/.test(grade)) q = q.ilike('grade', '%'+grade+'%')
    const { data: roots, error } = await q
    if (error) return visualJson({ error: 'Visual catalogue unavailable. Check schema migration.' }, 503)
    const ids = (roots || []).map(row => row.id)
    if (!ids.length) return visualJson({ visuals: [] })
    const { data: versions, error: versionsError } = await admin.from('learning_resource_versions')
      .select('id,resource_id,version,lifecycle_status,payload,created_at')
      .in('resource_id', ids).order('version', { ascending: false })
    if (versionsError) return visualJson({ error: 'Visual versions unavailable.' }, 503)
    const versionByRoot = new Map<string, { id: string; resource_id: string; version: number; lifecycle_status: string; payload: unknown }>()
    for (const version of versions || []) if (!versionByRoot.has(version.resource_id)) versionByRoot.set(version.resource_id, version)
    const visuals = await Promise.all((roots || []).map(async root => {
      const version = versionByRoot.get(root.id)
      const payload: unknown = version?.payload
      if (!isVisualPayload(payload) || !isSafeVisualStoragePath(payload.storage.path)) return null
      const { data: signed } = await admin.storage.from(VISUAL_DRAFT_BUCKET).createSignedUrl(payload.storage.path, 600)
      return {
        id: root.id, title: root.title, grade: root.grade, subject: root.subject, description: root.description,
        type: payload.visual_type, caption: payload.caption, altText: payload.alt_text,
        labels: payload.labels, placements: payload.placements, createdAt: root.created_at,
        version: version?.version, lifecycle: version?.lifecycle_status, previewUrl: signed?.signedUrl || null,
        referenceToken: version?.lifecycle_status === 'certified' && root.status === 'active' && root.visibility === 'public'
          ? '[visual:' + root.id + '@' + version.id + ']' : null,
        resourceVersionId: version?.id || null,
      }
    }))
    return visualJson({ visuals: visuals.filter(Boolean) })
  } catch {
    return visualJson({ error: 'Visual library unavailable.' }, 503)
  }
}


export async function POST(req: NextRequest) {
  const session = await requireVisualHQ(req)
  if (!session) return visualJson({ error: 'Forbidden' }, 403)
  return saveVisualCandidate(req, { admin: session.admin, userId: session.user.id, actor: 'hq_human' })
}

import { NextRequest } from 'next/server'
import { isSafeVisualStoragePath, isVisualPayload, UUID_RE, VISUAL_DRAFT_BUCKET } from '@/lib/visual-library/contract'
import { visualAdminClient, visualJson } from '@/lib/visual-library/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Public read is fail-closed: only an active public platform root with an actually certified version. */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const { id } = ctx.params
  if (!UUID_RE.test(id)) return visualJson({ error: 'Invalid visual reference.' }, 400)
  const pinnedVersion = req.nextUrl.searchParams.get('version')
  if (pinnedVersion && !UUID_RE.test(pinnedVersion)) return visualJson({ error: 'Invalid visual version.' }, 400)
  try {
    const db = visualAdminClient()
    const { data: root, error } = await db.from('learning_resources')
      .select('id,title,grade,subject,description')
      .eq('id', id).eq('asset_kind', 'visual_aid').eq('owner_type', 'platform')
      .eq('status', 'active').eq('visibility', 'public').maybeSingle()
    if (error || !root) return visualJson({ error: 'Visual not available.' }, 404)
    let versionQuery = db.from('learning_resource_versions')
      .select('id,payload,version').eq('resource_id', id)
      .eq('lifecycle_status', 'certified')
    if (pinnedVersion) versionQuery = versionQuery.eq('id', pinnedVersion)
    const { data: version, error: versionError } = await versionQuery.maybeSingle()
    if (versionError || !version || !isVisualPayload(version.payload) || !isSafeVisualStoragePath(version.payload.storage.path))
      return visualJson({ error: 'Visual not available.' }, 404)
    const p = version.payload
    const { data: signed, error: signError } = await db.storage.from(VISUAL_DRAFT_BUCKET).createSignedUrl(p.storage.path, 600)
    if (signError || !signed?.signedUrl) return visualJson({ error: 'Visual temporarily unavailable.' }, 503)
    return visualJson({
      id, title: root.title, grade: root.grade, subject: root.subject,
      altText: p.alt_text, caption: p.caption, type: p.visual_type,
      src: signed.signedUrl, version: version.version, resourceVersionId: version.id,
      labels: p.labels,
    })
  } catch {
    return visualJson({ error: 'Visual temporarily unavailable.' }, 503)
  }
}

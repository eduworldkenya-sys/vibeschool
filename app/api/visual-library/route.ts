import { NextRequest } from 'next/server'
import { isSafeVisualStoragePath, isVisualPayload } from '@/lib/visual-library/contract'
import { visualAdminClient, visualJson } from '@/lib/visual-library/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Browse only reusable public, certified platform visual versions. */
export async function GET(req: NextRequest) {
  const grade = (req.nextUrl.searchParams.get('grade') || '').trim()
  const search = (req.nextUrl.searchParams.get('search') || '').trim().slice(0, 70).toLowerCase()
  const subject = (req.nextUrl.searchParams.get('subject') || '').trim().slice(0, 61)
  const topicKey = (req.nextUrl.searchParams.get('topicKey') || '').trim().toLowerCase().slice(0, 101)
  if (grade && !/^[1-9]$/.test(grade)) return visualJson({error:'Invalid grade.'},400)
  if (subject && !/^[a-zA-Z &-]{3,60}$/.test(subject)) return visualJson({error:'Invalid subject.'},400)
  if (topicKey && !/^[a-z0-9-]{3,100}$/.test(topicKey)) return visualJson({error:'Invalid topic.'},400)
  try {
    const db = visualAdminClient()
    let q = db.from('learning_resources')
      .select('id,title,grade,subject,updated_at').eq('asset_kind','visual_aid')
      .eq('owner_type','platform').eq('status','active').eq('visibility','public')
      .order('updated_at',{ascending:false}).limit(100)
    if (grade) q = q.ilike('grade','%'+grade+'%')
    if (subject) q = q.eq('subject',subject)
    const { data: roots, error } = await q
    if (error) return visualJson({error:'Visual catalogue unavailable.'},503)
    const eligible = (roots||[]).filter(r => !grade || String(r.grade||'').replace(/\D/g,'')===grade)
    if (!eligible.length) return visualJson({ visuals: [] })
    const { data: versions, error: ve } = await db.from('learning_resource_versions')
      .select('id,resource_id,payload,version,certified_at,rights_status').in('resource_id',eligible.map(r=>r.id))
      .eq('lifecycle_status','certified').in('rights_status',['cleared','not_applicable'])
      .not('certified_at','is',null).order('version',{ascending:false})
    if (ve) return visualJson({error:'Visual versions unavailable.'},503)
    const versionById = new Map<string, (typeof versions)[number]>()
    for (const version of versions || []) {
      if (!versionById.has(version.resource_id)) versionById.set(version.resource_id, version)
    }
    const visuals = eligible.flatMap(root=>{
      const version = versionById.get(root.id)
      const p = version?.payload
      if (!version || !isVisualPayload(p) || !isSafeVisualStoragePath(p.storage.path)) return []
      if (topicKey && p.topic_key.toLowerCase() !== topicKey) return []
      if (search && ![root.title,root.subject,p.caption,p.alt_text,...p.labels].join(' ').toLowerCase().includes(search)) return []
      return [{ id:root.id,resourceVersionId:version.id,title:root.title,grade:root.grade,subject:root.subject,type:p.visual_type,caption:p.caption,altText:p.alt_text,placements:p.placements,sourceStrandId:p.source_strand_id }]
    })
    return visualJson({visuals})
  } catch {
    return visualJson({error:'Visual catalogue unavailable.'},503)
  }
}

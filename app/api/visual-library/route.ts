import { NextRequest } from 'next/server'
import { isSafeVisualStoragePath, isVisualPayload } from '@/lib/visual-library/contract'
import { visualAdminClient, visualJson } from '@/lib/visual-library/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Browse only reusable public, certified platform visual versions. */
export async function GET(req: NextRequest) {
  const grade = (req.nextUrl.searchParams.get('grade') || '').trim()
  const search = (req.nextUrl.searchParams.get('search') || '').trim().slice(0, 70).toLowerCase()
  if (grade && !/^[1-9]$/.test(grade)) return visualJson({error:'Invalid grade.'},400)
  try {
    const db = visualAdminClient()
    let q = db.from('learning_resources')
      .select('id,title,grade,subject,updated_at').eq('asset_kind','visual_aid')
      .eq('owner_type','platform').eq('status','active').eq('visibility','public')
      .order('updated_at',{ascending:false}).limit(100)
    if (grade) q = q.ilike('grade','%'+grade+'%')
    const { data: roots, error } = await q
    if (error) return visualJson({error:'Visual catalogue unavailable.'},503)
    const eligible = (roots||[]).filter(r => !grade || String(r.grade||'').replace(/\D/g,'')===grade)
    if (!eligible.length) return visualJson({ visuals: [] })
    const { data: versions, error: ve } = await db.from('learning_resource_versions')
      .select('resource_id,payload').in('resource_id',eligible.map(r=>r.id)).eq('lifecycle_status','certified')
    if (ve) return visualJson({error:'Visual versions unavailable.'},503)
    const payloadById = new Map((versions||[]).map(v=>[v.resource_id,v.payload]))
    const visuals = eligible.flatMap(root=>{
      const p = payloadById.get(root.id)
      if (!isVisualPayload(p) || !isSafeVisualStoragePath(p.storage.path)) return []
      if (search && ![root.title,root.subject,p.caption,p.alt_text,...p.labels].join(' ').toLowerCase().includes(search)) return []
      return [{ id:root.id,title:root.title,grade:root.grade,subject:root.subject,type:p.visual_type,caption:p.caption,altText:p.alt_text }]
    })
    return visualJson({visuals})
  } catch {
    return visualJson({error:'Visual catalogue unavailable.'},503)
  }
}

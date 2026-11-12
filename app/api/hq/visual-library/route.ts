import { createHash, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { buildCanonicalLearningAssetIdentity, normalizeCanonicalAssetDimension } from '@/lib/content/canonicalLearningAssetIdentity'
import { requireVisualHQ, visualJson } from '@/lib/visual-library/server'
import {
  imageTypeFromBytes, isSafeVisualStoragePath, isVisualPayload, isVisualPlacement, isVisualType,
  limitedText, UUID_RE, VISUAL_DRAFT_BUCKET, VISUAL_DRAFT_PREFIX, VISUAL_MAX_BYTES,
} from '@/lib/visual-library/contract'

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
    const versionByRoot = new Map<string, { resource_id: string; version: number; lifecycle_status: string; payload: unknown }>()
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
        referenceToken: '[visual:' + root.id + ']',
      }
    }))
    return visualJson({ visuals: visuals.filter(Boolean) })
  } catch {
    return visualJson({ error: 'Visual library unavailable.' }, 503)
  }
}

export async function POST(req: NextRequest) {
  let uploadedPath: string | null = null
  let newRootId: string | null = null
  let committed = false
  let cleanupAdmin: ReturnType<typeof import('@/lib/visual-library/server').visualAdminClient> | null = null
  try {
    const session = await requireVisualHQ(req)
    if (!session) return visualJson({ error: 'Forbidden' }, 403)
    const { admin, user } = session
    cleanupAdmin = admin
    const bytesHeader = Number(req.headers.get('content-length') || 0)
    if (bytesHeader > VISUAL_MAX_BYTES + 25000) return visualJson({ error: 'Image is too large.' }, 413)
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return visualJson({ error: 'Choose an image file.' }, 400)
    if (file.size < 10 || file.size > VISUAL_MAX_BYTES) return visualJson({ error: 'Image must be between 10 bytes and 5 MB.' }, 400)
    const buf = new Uint8Array(await file.arrayBuffer())
    const detected = imageTypeFromBytes(buf)
    if (!detected || file.type !== detected.mime) return visualJson({ error: 'Only valid PNG, JPG, WebP or GIF images are allowed.' }, 400)

    const title = limitedText(form.get('title'), 140)
    const description = limitedText(form.get('description'), 1000)
    const altText = limitedText(form.get('altText'), 300)
    const caption = limitedText(form.get('caption'), 300)
    const topicKey = limitedText(form.get('topicKey'), 100)
    const visualType = limitedText(form.get('visualType'), 30)
    const placement = limitedText(form.get('placement'), 30)
    const sourceStrandId = limitedText(form.get('sourceStrandId'), 36)
    const labels = limitedText(form.get('labels'), 300).split(',').map(x => x.trim()).filter(Boolean).slice(0, 12)
    if (title.length < 3 || title.length > 140 || altText.length < 8 || altText.length > 300
      || description.length > 1000 || caption.length > 300 || topicKey.length < 3 || topicKey.length > 100
      || !isVisualType(visualType) || !isVisualPlacement(placement) || !UUID_RE.test(sourceStrandId)) {
      return visualJson({ error: 'Complete the title, visual type, curriculum sub-strand, topic, alt text and placement.' }, 400)
    }

    const { data: source, error: sourceError } = await admin.from('cbc_strands')
      .select('id,subject_id,grade,name,sub_strand,learning_outcomes')
      .eq('id', sourceStrandId).maybeSingle()
    if (sourceError || !source || !source.subject_id || !/^grade[ -]?[1-9]$/i.test(source.grade))
      return visualJson({ error: 'Choose an existing Grade 1–9 curriculum sub-strand.' }, 400)
    const { data: subject, error: subjectError } = await admin.from('subjects')
      .select('id,name').eq('id', source.subject_id).is('school_id', null).maybeSingle()
    if (subjectError || !subject) return visualJson({ error: 'School-specific content cannot be registered as a global visual.' }, 400)
    const { data: curriculum } = await admin.from('curriculum').select('id')
      .eq('grade', source.grade).eq('sub_strand_id', source.id).limit(1).maybeSingle()
    const identity = buildCanonicalLearningAssetIdentity({
      curriculumId: curriculum?.id || 'cbc-strand-authority', subjectId: subject.id,
      grade: source.grade, strandId: source.id, topicKey,
      assetKind: 'visual_aid', purpose: 'reference',
      variant: visualType + '-' + normalizeCanonicalAssetDimension(title),
    })
    // Check for existing source-bound visual before spending storage or inserting a duplicate.
    const { data: existing, error: lookupError } = await admin.from('learning_resources')
      .select('id').eq('canonical_key', identity.familyKey).maybeSingle()
    if (lookupError) return visualJson({ error: 'Could not check for an existing visual.' }, 503)
    if (existing) return visualJson({ error: 'A visual with this title, type and topic already exists.', id: existing.id }, 409)

    const filename = randomUUID() + '.' + detected.ext
    uploadedPath = VISUAL_DRAFT_PREFIX + filename
    const { error: uploadError } = await admin.storage.from(VISUAL_DRAFT_BUCKET)
      .upload(uploadedPath, buf, { contentType: detected.mime, cacheControl: '0', upsert: false })
    if (uploadError) return visualJson({ error: 'Could not store the image privately.' }, 503)

    const { data: root, error: rootError } = await admin.from('learning_resources').insert({
      canonical_key: identity.familyKey,
      source_type: 'platform_authored', asset_kind: 'visual_aid',
      purpose: 'reference', identity_key_version: identity.keyVersion,
      language_code: 'en', material_variant: identity.normalized.variant,
      owner_type: 'platform', visibility: 'private', status: 'inactive',
      title, description, grade: source.grade, subject: subject.name, strand: source.name,
      subject_id: subject.id, curriculum_id: curriculum?.id || null, sub_strand_id: source.id,
      learning_outcomes: source.learning_outcomes || [], created_by: user.id,
    }).select('id').single()
    if (rootError || !root) return visualJson({ error: rootError?.code === '23505' ? 'This visual already exists.' : 'Could not register the visual.' }, rootError?.code === '23505' ? 409 : 503)
    newRootId = root.id
    const payload = {
      schema: 'vibeschool.visual.v1', visual_type: visualType, alt_text: altText,
      caption, labels, placements: [placement], topic_key: topicKey,
      source_strand_id: source.id,
      storage: { bucket: VISUAL_DRAFT_BUCKET, path: uploadedPath, mime: detected.mime, bytes: file.size },
    }
    const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const { error: versionError } = await admin.from('learning_resource_versions').insert({
      resource_id: root.id, version: 1, lifecycle_status: 'candidate',
      payload_format: 'json', payload, content_sha256: checksum, rights_status: 'pending',
      provenance: { origin: 'hq_visual_library', source_strand_id: source.id, uploaded_by: user.id }, created_by: user.id,
    })
    if (versionError) return visualJson({ error: 'Could not save the visual version.' }, 503)
    committed = true
    return visualJson({ id: root.id, status: 'candidate', message: 'Saved as a private draft. Not published.' }, 201)
  } catch {
    return visualJson({ error: 'Visual upload failed.' }, 503)
  } finally {
    if (!committed && cleanupAdmin) {
      // An upload that cannot be registered must not leave an orphan object or root.
      if (newRootId) await cleanupAdmin.from('learning_resources').delete().eq('id', newRootId)
      if (uploadedPath) await cleanupAdmin.storage.from(VISUAL_DRAFT_BUCKET).remove([uploadedPath])
    }
  }
}

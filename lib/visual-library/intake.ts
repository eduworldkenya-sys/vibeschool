import { createHash, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { buildCanonicalLearningAssetIdentity, normalizeCanonicalAssetDimension } from '@/lib/content/canonicalLearningAssetIdentity'
import { visualJson, type VisualIntakeSession } from '@/lib/visual-library/server'
import { imageTypeFromBytes, isVisualPlacement, isVisualType, limitedText, UUID_RE, VISUAL_DRAFT_BUCKET, VISUAL_DRAFT_PREFIX, VISUAL_MAX_BYTES } from '@/lib/visual-library/contract'

export async function saveVisualCandidate(req: NextRequest, session: VisualIntakeSession) {
  let uploadedPath: string | null = null
  let newRootId: string | null = null
  let committed = false
  let cleanupAdmin: ReturnType<typeof import('@/lib/visual-library/server').visualAdminClient> | null = null
  try {
    const { admin, userId, actor } = session
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
      || caption.length < 3 || labels.some(label => label.length > 80)
      || (['clock_face','number_line','diagram','chart','graph','map'].includes(visualType) && labels.length === 0)
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
      learning_outcomes: source.learning_outcomes || [], created_by: userId,
    }).select('id').single()
    if (rootError || !root) return visualJson({ error: rootError?.code === '23505' ? 'This visual already exists.' : 'Could not register the visual.' }, rootError?.code === '23505' ? 409 : 503)
    newRootId = root.id
    const payload = {
      schema: 'vibeschool.visual.v1', visual_type: visualType, alt_text: altText,
      caption, labels, placements: [placement], topic_key: topicKey,
      source_strand_id: source.id,
      storage: { bucket: VISUAL_DRAFT_BUCKET, path: uploadedPath, mime: detected.mime, bytes: file.size, sha256: createHash('sha256').update(buf).digest('hex') },
    }
    const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const { error: versionError } = await admin.from('learning_resource_versions').insert({
      resource_id: root.id, version: 1, lifecycle_status: 'candidate',
      payload_format: 'json', payload, content_sha256: checksum, rights_status: 'pending',
      provenance: { origin: actor, source_strand_id: source.id, uploaded_by: userId, request_id: limitedText(req.headers.get('x-request-id'), 100) || null }, created_by: userId,
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

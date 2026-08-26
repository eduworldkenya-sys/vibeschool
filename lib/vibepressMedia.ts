import type { SupabaseClient } from '@supabase/supabase-js'

export const VIBEPRESS_DRAFT_BUCKET = 'vibe-publication-drafts'
export const VIBEPRESS_IMAGE_BUCKET = 'vibe-publication-images'
export const VIBEPRESS_COVER_BUCKET = 'vibe-publication-covers'
export const VIBEPRESS_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const VIBEPRESS_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

const DRAFT_PREFIX = 'vibepress-draft://'
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

type MediaKind = 'images' | 'covers'

export interface PromotedMedia {
  sourceRef: string
  publicUrl: string
  publicBucket: string
  publicPath: string
  draftPath: string
}

function extensionFor(file: File): string {
  const raw = file.name.includes('.') ? file.name.split('.').pop() : undefined
  return (raw || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function validateVibePressImage(file: File): string | null {
  const ext = extensionFor(file)
  if (!ALLOWED_EXTENSIONS.has(ext) || !VIBEPRESS_IMAGE_MIME_TYPES.includes(file.type as typeof VIBEPRESS_IMAGE_MIME_TYPES[number])) {
    return 'Use a JPEG, PNG, WebP, or GIF image.'
  }
  if (file.size > VIBEPRESS_MAX_IMAGE_BYTES) return 'Image must be 5 MB or smaller.'
  return null
}

export function makeDraftMediaRef(path: string): string {
  return `${DRAFT_PREFIX}${path}`
}

export function parseDraftMediaRef(value: string | null | undefined): string | null {
  if (!value?.startsWith(DRAFT_PREFIX)) return null
  const path = value.slice(DRAFT_PREFIX.length)
  return path && !path.startsWith('/') ? path : null
}

export async function uploadDraftMedia(
  client: SupabaseClient,
  userId: string,
  kind: MediaKind,
  file: File,
): Promise<string> {
  const validationError = validateVibePressImage(file)
  if (validationError) throw new Error(validationError)
  const ext = extensionFor(file)
  const path = `${userId}/${kind}/${crypto.randomUUID()}.${ext}`
  const { error } = await client.storage.from(VIBEPRESS_DRAFT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error
  return makeDraftMediaRef(path)
}

export async function resolveVibePressMediaUrl(client: SupabaseClient, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  const draftPath = parseDraftMediaRef(value)
  if (!draftPath) return value
  const { data, error } = await client.storage.from(VIBEPRESS_DRAFT_BUCKET).createSignedUrl(draftPath, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

function parsePublicStorageUrl(value: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(value)
    const marker = '/storage/v1/object/public/'
    const index = url.pathname.indexOf(marker)
    if (index < 0) return null
    const remainder = url.pathname.slice(index + marker.length)
    const slash = remainder.indexOf('/')
    if (slash < 1) return null
    return {
      bucket: decodeURIComponent(remainder.slice(0, slash)),
      path: decodeURIComponent(remainder.slice(slash + 1)),
    }
  } catch {
    return null
  }
}

export async function removeVibePressMedia(client: SupabaseClient, value: string | null | undefined): Promise<void> {
  if (!value) return
  const draftPath = parseDraftMediaRef(value)
  if (draftPath) {
    await client.storage.from(VIBEPRESS_DRAFT_BUCKET).remove([draftPath])
    return
  }
  const publicObject = parsePublicStorageUrl(value)
  if (!publicObject || ![VIBEPRESS_IMAGE_BUCKET, VIBEPRESS_COVER_BUCKET].includes(publicObject.bucket)) return
  await client.storage.from(publicObject.bucket).remove([publicObject.path])
}

export async function promoteDraftMedia(
  client: SupabaseClient,
  value: string,
  targetBucket: typeof VIBEPRESS_IMAGE_BUCKET | typeof VIBEPRESS_COVER_BUCKET,
): Promise<PromotedMedia | null> {
  const draftPath = parseDraftMediaRef(value)
  if (!draftPath) return null
  const segments = draftPath.split('/')
  const userId = segments[0]
  const kind = segments[1] || 'media'
  const filename = segments.at(-1) || `${crypto.randomUUID()}.png`
  if (!userId) throw new Error('Draft media path is invalid.')

  const { data: blob, error: downloadError } = await client.storage.from(VIBEPRESS_DRAFT_BUCKET).download(draftPath)
  if (downloadError) throw downloadError
  const publicPath = `${userId}/${kind}/${filename}`
  const { error: uploadError } = await client.storage.from(targetBucket).upload(publicPath, blob, {
    cacheControl: '31536000',
    upsert: false,
    contentType: blob.type || undefined,
  })
  if (uploadError) throw uploadError
  const { data } = client.storage.from(targetBucket).getPublicUrl(publicPath)
  return {
    sourceRef: value,
    publicUrl: data.publicUrl,
    publicBucket: targetBucket,
    publicPath,
    draftPath,
  }
}

export async function rollbackPromotedMedia(client: SupabaseClient, promoted: readonly PromotedMedia[]): Promise<void> {
  await Promise.all(promoted.map(item => client.storage.from(item.publicBucket).remove([item.publicPath])))
}

export async function finalizePromotedMedia(client: SupabaseClient, promoted: readonly PromotedMedia[]): Promise<void> {
  if (promoted.length === 0) return
  await client.storage.from(VIBEPRESS_DRAFT_BUCKET).remove(promoted.map(item => item.draftPath))
}

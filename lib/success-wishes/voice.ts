import { randomUUID } from 'node:crypto'
import { WishError, UUID } from './contracts'

// Private Supabase Storage contract. Caller must authorise the verified sender
// and reserve a durable message quota before issuing an upload capability.
export const VOICE_BUCKET = 'success-wishes-private-voice'
export const VOICE_MAX_BYTES = 25 * 1024 * 1024
export const VOICE_MAX_SECONDS = 60
const MIME_TO_EXTENSION = {
  'audio/webm': 'webm', 'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg',
} as const
export type VoiceMime = keyof typeof MIME_TO_EXTENSION
const PATH = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(webm|m4a|mp3|ogg)$/i

export function validVoiceUpload(mime: string, bytes: number): asserts mime is VoiceMime {
  if (!Object.hasOwn(MIME_TO_EXTENSION,mime) || !Number.isInteger(bytes)
    || bytes < 1 || bytes > VOICE_MAX_BYTES) {
    throw new WishError(400, 'Choose a supported voice recording under 25 MB.')
  }
}
export function voiceObjectPath(messageId: string,mime: VoiceMime,assetId: string = randomUUID()): string {
  if (!UUID.test(messageId) || !UUID.test(assetId) || !Object.hasOwn(MIME_TO_EXTENSION,mime)) {
    throw new Error('Invalid voice asset identity.')
  }
  return messageId + '/' + assetId + '.' + MIME_TO_EXTENSION[mime]
}
export function checkVoicePath(messageId: string,path: string): void {
  const match = PATH.exec(path)
  if (!UUID.test(messageId) || !match || match[1].toLowerCase() !== messageId.toLowerCase()
    || !UUID.test(match[2])) throw new Error('Voice asset is not associated with this wish.')
}

// Narrow storage interface to make provider-failure and URL tests independent
// of privileged Supabase credentials.
type DataResult<T> = Promise<{data: T | null;error: unknown | null}>
export type VoiceStore = {
  from(bucket: string): {
    createSignedUploadUrl(path: string): DataResult<{ signedUrl: string;token: string;path: string }>
    info(path: string): DataResult<{ size: number; contentType: string }>
    createSignedUrl(path: string,expiresIn: number): DataResult<{ signedUrl: string }>
    remove(paths: string[]): DataResult<unknown>
  }
}

export function createPrivateVoiceAdapter(storage: VoiceStore) {
  const bucket = storage.from(VOICE_BUCKET)
  async function metadata(messageId: string,path: string): Promise<{size:number;contentType:string}> {
    checkVoicePath(messageId,path)
    const result = await bucket.info(path)
    if (result.error || !result.data) throw new Error('Voice object not present.')
    const {size,contentType} = result.data
    validVoiceUpload(contentType,size)
    const extension = PATH.exec(path)![3].toLowerCase()
    if (MIME_TO_EXTENSION[contentType as VoiceMime] !== extension) {
      throw new Error('Voice format and object extension do not match.')
    }
    return {size,contentType}
  }
  return {
    // A signed upload URL is a bearer capability; never cache or log it.
    async reserve(messageId: string,mime: string,bytes: number) {
      validVoiceUpload(mime,bytes)
      const path = voiceObjectPath(messageId,mime)
      const {data,error} = await bucket.createSignedUploadUrl(path)
      if (error || !data || data.path !== path || !data.token || !data.signedUrl) {
        throw new Error('Private voice upload could not be reserved.')
      }
      const url = new URL(data.signedUrl)
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('Invalid voice upload URL.')
      }
      return { path, uploadUrl: url.href, uploadToken: data.token }
    },
    // Storage metadata alone CANNOT prove media length or safe codec.
    // An independent trusted duration/content-validation worker must approve
    // the asset before delivery and the DB state must remain pending until then.
    inspect: metadata,
    async signedPlayback(messageId: string,path: string,validatedDurationSeconds: number) {
      if (!Number.isFinite(validatedDurationSeconds) || validatedDurationSeconds<=0
        || validatedDurationSeconds>VOICE_MAX_SECONDS) throw new Error('Voice duration is not verified.')
      await metadata(messageId,path)
      const {data,error} = await bucket.createSignedUrl(path,300)
      if (error || !data?.signedUrl) throw new Error('Private voice playback could not be issued.')
      const url = new URL(data.signedUrl)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid voice playback URL.')
      return {url:url.href,ttlSeconds:300}
    },
    async deleteVoice(messageId:string,path:string) {
      checkVoicePath(messageId,path)
      const {data,error} = await bucket.remove([path])
      if (error || data === null) throw new Error('Voice deletion requires reconciliation.')
    },
  }
}

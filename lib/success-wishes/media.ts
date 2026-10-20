// Server-only provider adapter. Callers must authorise the message/inbox and
// reserve an upload budget before invoking it. Never import from client code.
type MediaEnvironment = Record<string, string | undefined>
type Fetcher = typeof fetch
type JsonObject = Record<string, unknown>

export const SUCCESS_WISHES_MAX_DURATION_SECONDS = 60
const UID = /^[a-f0-9]{32}$/i
const ACCOUNT = /^[a-f0-9]{32}$/i
const UPLOAD_TTL_SECONDS = 15 * 60
const PLAYBACK_TTL_SECONDS = 5 * 60

function serverOnly(): void {
  if (typeof window !== 'undefined') throw new Error('Success Wishes media is server-only.')
}

export function successWishesMediaReady(env: MediaEnvironment = process.env): boolean {
  serverOnly()
  return ACCOUNT.test(env.SUCCESS_WISHES_CLOUDFLARE_ACCOUNT_ID?.trim() ?? '')
    && Boolean(env.SUCCESS_WISHES_CLOUDFLARE_API_TOKEN?.trim())
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid media provider response.')
  return value as JsonObject
}

function videoId(uid: string): string {
  if (!UID.test(uid)) throw new Error('Invalid media identifier.')
  return uid
}

export function createSuccessWishesMediaAdapter(options: {
  env?: MediaEnvironment
  fetch?: Fetcher
  now?: () => number
} = {}) {
  serverOnly()
  const env = options.env ?? process.env
  const request = options.fetch ?? fetch
  const now = options.now ?? Date.now

  async function api(path: string, method: 'POST' | 'GET' | 'DELETE', body?: JsonObject): Promise<unknown> {
    serverOnly()
    if (!successWishesMediaReady(env)) throw new Error('Video hosting is not configured.')
    const account = env.SUCCESS_WISHES_CLOUDFLARE_ACCOUNT_ID!.trim()
    const token = env.SUCCESS_WISHES_CLOUDFLARE_API_TOKEN!.trim()
    let response: Response
    try {
      response = await request(`https://api.cloudflare.com/client/v4/accounts/${account}/stream${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      // Do not leak request headers, provider payloads or bearer URLs to clients.
      throw new Error('Video provider could not be reached. Check status before retrying an upload request.')
    }
    if (!response.ok) throw new Error(`Video provider request failed (${response.status}).`)
    if (method === 'DELETE' && response.status === 204) return null
    let envelope: JsonObject
    try { envelope = object(await response.json()) } catch { throw new Error('Invalid media provider response.') }
    if (envelope.success !== true) throw new Error('Video provider rejected the request.')
    return envelope.result
  }

  async function getStatus(uid: string): Promise<{
    uid: string; state: 'pending' | 'ready' | 'failed'; durationSeconds: number | null
  }> {
    const result = object(await api(`/${videoId(uid)}`, 'GET'))
    if (result.uid !== uid || result.requireSignedURLs !== true) throw new Error('Media privacy verification failed.')
    const duration = typeof result.duration === 'number' && Number.isFinite(result.duration) ? result.duration : null
    const status = object(result.status)
    if (status.state === 'error' || (duration !== null && (duration <= 0 || duration > SUCCESS_WISHES_MAX_DURATION_SECONDS))) {
      return { uid, state: 'failed', durationSeconds: duration }
    }
    const ready = result.readyToStream === true && status.state === 'ready' && duration !== null
    return { uid, state: ready ? 'ready' : 'pending', durationSeconds: duration }
  }

  return {
    async createDirectUpload(messageId: string): Promise<{uid: string; uploadURL: string; expiresAt: string}> {
      if (!/^[a-f0-9-]{36}$/i.test(messageId)) throw new Error('Invalid message identifier.')
      const expiresAt = new Date(now() + UPLOAD_TTL_SECONDS * 1000).toISOString()
      const result = object(await api('/direct_upload', 'POST', {
        maxDurationSeconds: SUCCESS_WISHES_MAX_DURATION_SECONDS,
        requireSignedURLs: true,
        expiry: expiresAt,
        scheduledDeletion: new Date(now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        meta: { messageId },
      }))
      const uid = videoId(typeof result.uid === 'string' ? result.uid : '')
      if (typeof result.uploadURL !== 'string') throw new Error('Invalid media upload URL.')
      const url = new URL(result.uploadURL)
      if (url.protocol !== 'https:' || url.hostname !== 'upload.videodelivery.net' || url.username || url.password || url.port) {
        throw new Error('Invalid media upload URL.')
      }
      return { uid, uploadURL: url.href, expiresAt }
    },
    getStatus,
    async createPlayback(uid: string): Promise<{url: string; expiresAt: string}> {
      if ((await getStatus(uid)).state !== 'ready') throw new Error('Video is not ready to play.')
      const exp = Math.floor(now() / 1000) + PLAYBACK_TTL_SECONDS
      const result = object(await api(`/${videoId(uid)}/token`, 'POST', { exp, downloadable: false }))
      if (typeof result.token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(result.token)) {
        throw new Error('Invalid media playback token.')
      }
      return { url: `https://iframe.videodelivery.net/${result.token}`, expiresAt: new Date(exp * 1000).toISOString() }
    },
    async deleteVideo(uid: string): Promise<void> {
      await api(`/${videoId(uid)}`, 'DELETE')
    },
  }
}

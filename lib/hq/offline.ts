export type HQCachedEnvelope<T> = { value: T; savedAt: number; version: 1 }

const PREFIX = 'vibeschool:hq:offline:v1:'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function key(name: string) { return `${PREFIX}${name}` }

export function saveHQCache<T>(name: string, value: T) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key(name), JSON.stringify({ value, savedAt: Date.now(), version: 1 } satisfies HQCachedEnvelope<T>)) } catch {}
}

export function readHQCache<T>(name: string, maxAgeMs = MAX_AGE_MS): { value: T; savedAt: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key(name)); if (!raw) return null
    const parsed = JSON.parse(raw) as HQCachedEnvelope<T>
    if (parsed.version !== 1 || typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > maxAgeMs) { localStorage.removeItem(key(name)); return null }
    return { value: parsed.value, savedAt: parsed.savedAt }
  } catch { return null }
}

export function saveHQDraft<T>(name: string, value: T) { saveHQCache(`draft:${name}`, value) }
export function readHQDraft<T>(name: string) { return readHQCache<T>(`draft:${name}`, 7 * 24 * 60 * 60 * 1000) }
export function clearHQDraft(name: string) { if (typeof window !== 'undefined') localStorage.removeItem(key(`draft:${name}`)) }

export function clearAllHQOfflineData() {
  if (typeof window === 'undefined') return
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) localStorage.removeItem(k) }
}

export function isHQOnline() { return typeof navigator === 'undefined' ? true : navigator.onLine }

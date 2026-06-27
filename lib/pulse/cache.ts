import { PulseSnapshot } from "./fetcher";

const KEY = "pulse_cache_v1";
const TTL = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  fp: string;
  message: string;
  ts: number;
}

export function fingerprint(data: PulseSnapshot): string {
  try {
    return btoa(JSON.stringify({
      att: data.attPending.length,
      risk: data.atRisk.map(r => r.id).sort(),
      tpad: data.tpadDays,
      credits: data.credits,
      curr: data.currStats.map(s => `${s.subject}:${s.covered}/${s.total}`).sort(),
    }));
  } catch { return ""; }
}

export function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (Date.now() - parsed.ts > TTL) return null;
    return parsed;
  } catch { return null; }
}

export function writeCache(fp: string, message: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ fp, message, ts: Date.now() }));
  } catch {}
}

export function clearCache(): void {
  try { localStorage.removeItem(KEY); } catch {}
}

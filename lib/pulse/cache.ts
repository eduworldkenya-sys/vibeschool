import { PulseSnapshot } from "./fetcher";

const TWIN_KEY = "pulse_twin_v2";
const SNAP_KEY = "pulse_snap_v2";
const TTL_TWIN = 6 * 60 * 60 * 1000;
const TTL_SNAP = 24 * 60 * 60 * 1000;

interface TwinCache { fp: string; message: string; ts: number }
interface SnapCache { snapshot: PulseSnapshot; ts: number }

export function fingerprint(data: PulseSnapshot): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify({
      att: data.attPending.length,
      risk: data.atRisk.map(r => r.id).sort(),
      tpad: data.tpadDays,
      credits: data.credits,
      curr: data.currStats.map(s => `${s.subject}:${s.covered}/${s.total}`).sort(),
      streak: data.streak,
    })));
  } catch { return ""; }
}

export function readTwinCache(): TwinCache | null {
  try {
    const raw = localStorage.getItem(TWIN_KEY);
    if (!raw) return null;
    const p: TwinCache = JSON.parse(raw);
    if (Date.now() - p.ts > TTL_TWIN) return null;
    return p;
  } catch { return null; }
}

export function writeTwinCache(fp: string, message: string): void {
  try { localStorage.setItem(TWIN_KEY, JSON.stringify({ fp, message, ts: Date.now() })); } catch {}
}

export function readSnapCache(): PulseSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const p: SnapCache = JSON.parse(raw);
    if (Date.now() - p.ts > TTL_SNAP) return null;
    return p.snapshot;
  } catch { return null; }
}

export function writeSnapCache(snapshot: PulseSnapshot): void {
  try { localStorage.setItem(SNAP_KEY, JSON.stringify({ snapshot, ts: Date.now() })); } catch {}
}

export function clearCache(): void {
  try { localStorage.removeItem(TWIN_KEY); localStorage.removeItem(SNAP_KEY); } catch {}
}

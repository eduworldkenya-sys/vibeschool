// Foreground polling fallback; no transport or access-control changes.
export function liveSyncDelay(status: 'active'|'paused'|'ended'|null, failures: number): number {
  if (failures > 0) return Math.min(30000, 5000 * 2 ** Math.min(failures - 1, 3))
  return status === 'active' ? 1250 : status === 'ended' ? 15000 : 4000
}

/**
 * Canonical VibeSpin outcome and motion planning.
 * Selection happens once before animation. Presentation must not change the result.
 * Rotation is computed in the wheel's SVG degree convention (zero at top).
 */
export type SpinDirection = 'clockwise' | 'counterclockwise' | 'alternate' | 'random'
export type SpinMotion = 'cinematic' | 'classic' | 'rapid' | 'party'
export type SpinPlan = Readonly<{
  id: string
  selectedId: string
  selectedIndex: number
  eligibleCount: number
  direction: 1 | -1
  startAngle: number
  endAngle: number
  settledAngle: number
  durationMs: number
  easing: string
}>
export const normalizeSpinAngle = (angle: number): number => ((angle % 360) + 360) % 360

/** Integer rejection sampling avoids modulo bias in random segment selection. */
export function uniformSpinIndex(length: number, nextUint32?: () => number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > 100000) throw Error('Invalid spin pool size')
  const source = nextUint32 ?? (() => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint32Array(1)
      crypto.getRandomValues(bytes)
      return bytes[0]
    }
    return Math.floor(Math.random() * 0x100000000)
  })
  const range = 0x100000000
  const limit = range - (range % length)
  for (let attempts = 0; attempts < 10000; attempts++) {
    const sample = source()
    if (!Number.isInteger(sample) || sample < 0 || sample >= range) throw Error('Invalid random source')
    if (sample < limit) return sample % length
  }
  throw Error('Random source failed to produce a valid sample')
}

export function createSpinPlan(input: {
  selectedId: string; selectedIndex: number; segmentCount: number
  currentAngle: number; round: number; durationSeconds: number
  direction?: SpinDirection; motion?: SpinMotion; nextUint32?: () => number
}): SpinPlan {
  const {selectedId, selectedIndex, segmentCount} = input
  if (!selectedId || !Number.isSafeInteger(segmentCount) || segmentCount < 2 ||
      !Number.isSafeInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= segmentCount)
    throw Error('Invalid selected segment')
  const durationMs = Math.max(2000, Math.min(15000, Math.round(input.durationSeconds * 1000) || 6000))
  const startAngle = normalizeSpinAngle(Number.isFinite(input.currentAngle) ? input.currentAngle : 0)
  const directionOption = input.direction ?? 'clockwise'
  const direction: 1 | -1 =
    directionOption === 'counterclockwise' ? -1 :
    directionOption === 'alternate' ? (input.round % 2 === 0 ? 1 : -1) :
    directionOption === 'random' ? (uniformSpinIndex(2, input.nextUint32) === 0 ? 1 : -1) : 1
  const motion = input.motion ?? 'cinematic'
  const easing = motion === 'classic' ? 'cubic-bezier(.18,.58,.18,1)' :
    motion === 'rapid' ? 'cubic-bezier(.1,.72,.12,1)' :
    motion === 'party' ? 'cubic-bezier(.08,.78,.18,1)' :
    'cubic-bezier(.12,.78,.08,1)'
  const turns = motion === 'rapid' ? 4 : Math.min(13, 5 + Math.floor(durationMs / 2000))
  const target = normalizeSpinAngle(360 - (selectedIndex + .5) * (360 / segmentCount))
  const clockwiseDelta = normalizeSpinAngle(target - startAngle)
  const delta = direction === 1 ? clockwiseDelta : clockwiseDelta === 0 ? 0 : clockwiseDelta - 360
  const endAngle = startAngle + direction * turns * 360 + delta
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `spin-${input.round}-${selectedId}-${Date.now()}`
  return Object.freeze({
    id, selectedId, selectedIndex, eligibleCount: segmentCount, direction,
    startAngle, endAngle, settledAngle: target, durationMs, easing,
  })
}

/** Original, offline-safe Grade 4 Whole Numbers models; no remote calls. */
export type PlaceValueCell = { label: string; digit: number; value: number; power: number }
const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'] as const

export function boundedWholeNumber(input: string, min: number, max: number): number | null {
  const trimmed = input.trim()
  if (!/^\d{1,5}$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null
}

export function placeValueCells(value: number): PlaceValueCell[] {
  if (!Number.isInteger(value) || value < 0 || value > 99999) return []
  const digits = String(value).split('')
  return digits.map((digit, index) => {
    const power = digits.length - index - 1
    return { label: PLACES[power], digit: Number(digit), value: Number(digit) * 10 ** power, power }
  })
}

export function expandedWholeNumber(value: number): string {
  return placeValueCells(value).map(cell => cell.value).filter(value => value > 0)
    .map(value => value.toLocaleString('en-KE')).join(' + ') || '0'
}

export function roundToNearestTen(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000) throw new RangeError('Whole number must be between 0 and 1,000')
  return Math.floor((value + 5) / 10) * 10
}

export function factorsOf(value: number): number[] {
  if (!Number.isInteger(value) || value < 1 || value > 50) return []
  const factors: number[] = []
  for (let candidate = 1; candidate <= value; candidate += 1) {
    if (value % candidate === 0) factors.push(candidate)
  }
  return factors
}

export function multiplesOf(value: number, count = 4): number[] {
  if (!Number.isInteger(value) || value < 1 || value > 100 || !Number.isInteger(count) || count < 1 || count > 10) return []
  return Array.from({ length: count }, (_, index) => value * (index + 1))
}

export function romanUpToTen(value: number): string | null {
  const numerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
  return Number.isInteger(value) && value >= 1 && value <= 10 ? numerals[value] : null
}

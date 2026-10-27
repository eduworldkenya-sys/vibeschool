import type { SenderDraft } from '@/lib/success-wishes/sender-draft'
export type Template = SenderDraft['theme']
export const templates: { id: Template; name: string; subtitle: string; headline: string }[] = [
  { id: 'heritage', name: 'Golden Hour', subtitle: 'Warm & timeless', headline: 'The future is yours' },
  { id: 'botanical', name: 'New Beginnings', subtitle: 'Fresh & graceful', headline: 'Bloom into greatness' },
  { id: 'nightfall', name: 'Bright Star', subtitle: 'Bold & confident', headline: 'You were made to shine' },
  { id: 'sunrise', name: 'Above & Beyond', subtitle: 'Joyful & uplifting', headline: 'Go make it happen' },
]
export const palette: Record<Template, { top: string; bottom: string; ink: string; accent: string; border: string }> = {
  heritage: { top: '#fbf2d0', bottom: '#d1bb84', ink: '#624928', accent: '#b4954d', border: '#b4954d' },
  botanical: { top: '#f3f2e9', bottom: '#c4d6bf', ink: '#285b49', accent: '#63866a', border: '#b1c5ad' },
  nightfall: { top: '#314a75', bottom: '#111b36', ink: '#fff6dc', accent: '#f0ce85', border: '#5e5874' },
  sunrise: { top: '#ffe9bc', bottom: '#ac829c', ink: '#613653', accent: '#ffedc4', border: '#eab8a0' },
}

'use client'

import { useEffect, useState, type CSSProperties } from 'react'

export type ShowCamera = 'auto' | 'wide' | 'close' | 'tracking'
export type ShowEnergy = 'cinematic' | 'sports' | 'playful'
export type ShowDirectorSettings = {
  camera: ShowCamera
  energy: ShowEnergy
  zoom: boolean
  lighting: boolean
  captions: boolean
  motion: number
}
export const defaultDirector: ShowDirectorSettings = {
  camera: 'auto', energy: 'cinematic', zoom: true, lighting: true, captions: false, motion: 50,
}
const cameras: ShowCamera[] = ['auto', 'wide', 'close', 'tracking']
const energies: ShowEnergy[] = ['cinematic', 'sports', 'playful']
function valid(value: unknown): value is ShowDirectorSettings {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return cameras.includes(v.camera as ShowCamera) && energies.includes(v.energy as ShowEnergy) &&
    typeof v.zoom === 'boolean' && typeof v.lighting === 'boolean' &&
    typeof v.captions === 'boolean' && typeof v.motion === 'number' &&
    Number.isFinite(v.motion) && v.motion >= 0 && v.motion <= 100
}
export function useShowDirector(studio: 'spin' | 'pendulum') {
  const [settings, setSettings] = useState<ShowDirectorSettings>(defaultDirector)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vibeschool.show-director.' + studio + '.v1')
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (valid(parsed)) setSettings(parsed)
      }
    } catch { /* private browsing or invalid previous settings */ }
    setLoaded(true)
  }, [studio])
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem('vibeschool.show-director.' + studio + '.v1', JSON.stringify(settings)) }
    catch { /* show can continue if browser storage is unavailable */ }
  }, [loaded, settings, studio])
  const patch = (next: Partial<ShowDirectorSettings>) => setSettings(current => ({ ...current, ...next }))
  return { settings, patch }
}
export function cameraForPhase(settings: ShowDirectorSettings, phase: 'idle' | 'action' | 'reveal'): Exclude<ShowCamera, 'auto'> {
  if (settings.camera !== 'auto') return settings.camera
  return phase === 'idle' ? 'wide' : phase === 'action' ? 'tracking' : 'close'
}
export function focalStyle(settings: ShowDirectorSettings, phase: 'idle' | 'action' | 'reveal', reducedMotion = false): CSSProperties {
  if (reducedMotion) return {}
  const camera = cameraForPhase(settings, phase)
  const intensity = settings.motion / 100
  const scale = !settings.zoom ? 1 : camera === 'close' ? 1 + .095 * intensity : camera === 'tracking' ? 1 + .045 * intensity : 1
  return { transform: 'scale(' + scale.toFixed(3) + ')', transition: 'transform ' + (settings.energy === 'sports' ? 220 : 620) + 'ms ease-in-out', transformOrigin: 'center center' }
}
export function DirectorControls({ settings, onChange }: { settings: ShowDirectorSettings; onChange: (next: Partial<ShowDirectorSettings>) => void }) {
  const row: CSSProperties = { display: 'grid', gap: 7, marginTop: 10 }
  const select: CSSProperties = { width: '100%', minHeight: 38, borderRadius: 8, background: '#152944', color: '#f4faff', border: '1px solid #557087', padding: '7px 10px' }
  const title: CSSProperties = { color: '#eaf8ff', fontWeight: 800, fontSize: 13 }
  return <div aria-label="Shared Show Director" style={{ display: 'grid', gap: 9, padding: 13, marginTop: 12, marginBottom: 12, border: '1px solid #3c8193', borderRadius: 14, background: '#0b1d32', color: '#eaf8ff' }}>
    <strong style={{ fontSize: 15 }}>Camera & Show Director</strong>
    <small style={{ color: '#b6d6df' }}>Presentation only. Does not change random outcomes.</small>
    <label style={row}><span style={title}>Camera choreography</span><select aria-label="Camera choreography" style={select} value={settings.camera} onChange={e => onChange({ camera: e.target.value as ShowCamera })}>
      <option value="auto">Automatic · wide → tracking → close</option>
      <option value="wide">Wide studio shot</option><option value="close">Cinematic close-up</option><option value="tracking">Tracking view</option>
    </select></label>
    <label style={row}><span style={title}>Show energy</span><select aria-label="Show energy" style={select} value={settings.energy} onChange={e => onChange({ energy: e.target.value as ShowEnergy })}>
      <option value="cinematic">Cinematic suspense</option><option value="sports">Fast sports broadcast</option><option value="playful">Playful entertainment</option>
    </select></label>
    <label style={row}><span style={title}>Camera movement · {settings.motion}%</span><input aria-label="Camera movement intensity" type="range" min="0" max="100" value={settings.motion} onChange={e => onChange({ motion: Number(e.target.value) })}/></label>
    <label><input type="checkbox" checked={settings.zoom} onChange={e => onChange({ zoom: e.target.checked })}/> Automatic focal zoom</label>
    <label><input type="checkbox" checked={settings.lighting} onChange={e => onChange({ lighting: e.target.checked })}/> Cinematic vignette lighting</label>
    <label><input type="checkbox" checked={settings.captions} onChange={e => onChange({ captions: e.target.checked })}/> Show on-stage engagement prompt</label>
    <button type="button" style={{ ...select, cursor: 'pointer', fontWeight: 800 }} onClick={() => onChange(defaultDirector)}>Reset director</button>
  </div>
}
export function DirectorStageEffects({ settings, phase, prompt }: { settings: ShowDirectorSettings; phase: 'idle' | 'action' | 'reveal'; prompt: string }) {
  return <>
    {settings.lighting && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: 'inset 0 0 55px 12px rgba(0,0,0,.28)' }}/>}
    {settings.captions && phase === 'idle' && <div style={{ position: 'absolute', zIndex: 5, bottom: '17%', left: '10%', width: '80%', pointerEvents: 'none', textAlign: 'center', fontSize: 'clamp(11px,1.8vw,17px)', lineHeight: 1.3, padding: '6px 10px', borderRadius: 9, background: 'rgba(4,18,38,.83)', color: 'white', fontWeight: 800 }}>{prompt}</div>}
  </>
}

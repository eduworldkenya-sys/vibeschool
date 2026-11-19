'use client'
import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { codeFromAvatar, defaultVibeMe, parseVibeMe, vibeMeCode, vibeMePath, VIBEME_OPTIONS } from '@/lib/vibeme'

export default function VibeMeStudio({ profileId, onSaved }: { profileId?: string; onSaved?: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState<number[]>([2,0,0,0,0,0,0])
  const [owner, setOwner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    if (!open) return
    setOwner(null); setBusy(true); setMessage('')
    const load = async () => {
      try {
        const client = getSupabaseClient()
        const { data, error } = await client.auth.getUser()
        if (error || !data.user || (profileId && profileId !== data.user.id)) throw new Error('Sign in to your own account to edit your avatar.')
        const result = await client.from('profiles').select('avatar_url').eq('id', data.user.id).single()
        if (result.error || !result.data) throw new Error('Could not load your profile.')
        if (!cancelled) {
          setOwner(data.user.id)
          setChoices(parseVibeMe(codeFromAvatar(result.data.avatar_url) ?? defaultVibeMe(data.user.id))!)
        }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Avatar unavailable.') }
      finally { if (!cancelled) setBusy(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [open, profileId])
  const code = vibeMeCode(choices)
  async function save() {
    if (!owner || busy) return
    setBusy(true); setMessage('')
    try {
      const client = getSupabaseClient()
      const { data, error } = await client.auth.getUser()
      if (error || data.user?.id !== owner || (profileId && profileId !== owner)) throw new Error('Your account changed. Close and reopen VibeMe.')
      const path = vibeMePath(code)
      const result = await client.from('profiles').update({ avatar_url: path, updated_at: new Date().toISOString() }).eq('id', owner).select('id').single()
      if (result.error || !result.data) throw new Error('Avatar not saved. Try again.')
      if (mounted.current) { onSaved?.(path); setMessage('Avatar saved.'); setOpen(false) }
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : 'Avatar not saved.') }
    finally { if (mounted.current) setBusy(false) }
  }
  const action = { padding: '9px 14px', borderRadius: 12, border: '1px solid currentColor', background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: 700, cursor: 'pointer' } as const
  return <section style={{ margin: '10px 0' }}>
    {!open ? <button type="button" style={action} onClick={() => setOpen(true)}>Create / edit VibeMe</button> :
      <div style={{ display: 'grid', gap: 12, border: '1px solid rgba(127,127,127,.35)', borderRadius: 18, padding: 14, maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><strong>VibeMe Studio</strong><button type="button" style={action} disabled={busy} onClick={() => setOpen(false)}>Close</button></div>
        <img src={vibeMePath(code)} alt="Your avatar preview" width={176} height={176} style={{ justifySelf: 'center', display: 'block' }} />
        <fieldset disabled={busy || !owner} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          {VIBEME_OPTIONS.map((option, i) => <label key={option.label} style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>
            {option.label}<select value={choices[i]} onChange={e => setChoices(current => current.map((n,j) => j===i ? Number(e.target.value) : n))} style={{ minWidth: 0, minHeight: 40, border: '1px solid #888', borderRadius: 8, padding: 6, color: 'CanvasText', background: 'Canvas' }}>
              {option.values.map((value, index) => <option key={value} value={index}>{value}</option>)}
            </select>
          </label>)}
        </fieldset>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={action} disabled={busy || !owner} onClick={() => setChoices(VIBEME_OPTIONS.map(o => Math.floor(Math.random()*o.values.length)))}>Surprise me</button>
          <button type="button" style={{ ...action, background: '#cdff00', color: '#20242b', borderColor: '#20242b' }} disabled={busy || !owner} onClick={() => void save()}>{busy ? 'Please wait…' : 'Save avatar'}</button>
        </div>
      </div>}
    {message && <p role="status" style={{ margin: '6px 0', fontSize: 12 }}>{message}</p>}
  </section>
}
